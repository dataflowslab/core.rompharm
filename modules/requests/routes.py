"""
Requests routes for internal stock transfer requests
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import requests

from src.backend.utils.db import get_db
from src.backend.utils.config import load_config
from src.backend.routes.auth import verify_admin, verify_token

router = APIRouter(prefix="/modules/requests/api", tags=["requests"])


async def get_current_user(authorization: Optional[str] = None):
    """Get current user from token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await verify_token(authorization)


def get_inventree_headers(user: dict) -> Dict[str, str]:
    """Get headers for InvenTree API requests"""
    token = user.get('token')
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated with InvenTree")
    
    return {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }


# Pydantic models
class RequestItemCreate(BaseModel):
    part: int
    quantity: float
    notes: Optional[str] = None
    series: Optional[str] = None
    batch_code: Optional[str] = None


class RequestCreate(BaseModel):
    source: int  # Stock location ID
    destination: int  # Stock location ID
    items: List[RequestItemCreate]
    notes: Optional[str] = None
    product_id: Optional[int] = None  # Main product ID if recipe-based
    product_quantity: Optional[float] = None  # Quantity of main product
    recipe_id: Optional[str] = None  # Recipe ObjectId if recipe-based
    recipe_part_id: Optional[str] = None  # Recipe part ObjectId if recipe-based


class RequestUpdate(BaseModel):
    source: Optional[int] = None
    destination: Optional[int] = None
    notes: Optional[str] = None
    batch_codes: Optional[List[str]] = None
    status: Optional[str] = None
    issue_date: Optional[str] = None
    items: Optional[List[RequestItemCreate]] = None


def generate_request_reference(db) -> str:
    """Generate next request reference (REQ-NNNN)"""
    requests_collection = db['depo_requests']
    
    # Find the highest reference number
    last_request = requests_collection.find_one(
        {'reference': {'$regex': '^REQ-'}},
        sort=[('reference', -1)]
    )
    
    if last_request and 'reference' in last_request:
        # Extract number from REQ-NNNN
        try:
            last_num = int(last_request['reference'].split('-')[1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    return f"REQ-{next_num:04d}"


@router.get("/stock-locations")
async def get_stock_locations(
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Get list of stock locations from InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        response = requests.get(
            f"{inventree_url}/api/stock/location/",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock locations: {str(e)}")


@router.get("/parts")
async def get_parts(
    request: Request,
    search: Optional[str] = None,
    current_user: dict = Depends(verify_admin),
    db = Depends(get_db)
):
    """Get list of parts from MongoDB depo_parts with search"""
    if not search or len(search.strip()) < 2:
        return {"results": [], "count": 0}
    
    try:
        search_term = search.strip()
        
        # Search in depo_parts collection by name or IPN (case-insensitive)
        query = {
            "$or": [
                {"name": {"$regex": search_term, "$options": "i"}},
                {"ipn": {"$regex": search_term, "$options": "i"}}
            ]
        }
        
        parts = list(db.depo_parts.find(query).limit(30))
        
        # Format results to match expected structure
        results = []
        for part in parts:
            results.append({
                "pk": part.get("id"),  # Use 'id' field as pk
                "name": part.get("name", ""),
                "IPN": part.get("ipn", "")  # Map 'ipn' to 'IPN'
            })
        
        return {
            "results": results,
            "count": len(results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch parts: {str(e)}")


@router.get("/parts/{part_id}/stock-info")
async def get_part_stock_info(
    part_id: int,
    current_user: dict = Depends(verify_admin),
    db = Depends(get_db)
):
    """Get stock information for a part from MongoDB depo_stocks with batches
    
    Only shows transferable stock (state_id = 694322878728e4d75ae72790)
    Link: depo_parts._id (ObjectId) <-> depo_stocks.part_id (ObjectId)
    """
    from bson import ObjectId
    
    try:
        # Get the part from depo_parts to get its _id (ObjectId)
        part = db.depo_parts.find_one({"id": part_id})
        
        if not part:
            # Part not found in depo_parts
            return {
                "part_id": part_id,
                "total": 0,
                "in_sales": 0,
                "in_builds": 0,
                "in_procurement": 0,
                "available": 0,
                "batches": []
            }
        
        part_oid = part.get("_id")  # This is the ObjectId
        
        # Transferable state_id (quarantined and transferable)
        transferable_state_id = ObjectId('694322878728e4d75ae72790')
        
        # Query depo_stocks using part_id = depo_parts._id (ObjectId) and transferable state
        stock_records = list(db.depo_stocks.find({
            "part_id": part_oid,
            "state_id": transferable_state_id
        }))
        
        if stock_records:
            # Calculate totals
            total = sum(s.get("quantity", 0) for s in stock_records)
            
            # Get batches with stock > 0
            batches = []
            for stock in stock_records:
                quantity = stock.get("quantity", 0)
                if quantity > 0:
                    # Extract location_id (handle both ObjectId and string formats)
                    location = stock.get("location_id")
                    if isinstance(location, ObjectId):
                        location_id = str(location)
                    elif isinstance(location, dict) and "$oid" in location:
                        location_id = location["$oid"]
                    else:
                        location_id = str(location) if location else ""
                    
                    batches.append({
                        "batch_code": stock.get("batch_code", ""),
                        "supplier_batch_code": stock.get("supplier_batch_code", ""),
                        "quantity": quantity,
                        "location_id": location_id
                    })
            
            return {
                "part_id": part_id,
                "total": total,
                "in_sales": 0,  # TODO: Calculate from allocations
                "in_builds": 0,  # TODO: Calculate from allocations
                "in_procurement": 0,  # TODO: Calculate from allocations
                "available": total,  # For now, total = available
                "batches": batches
            }
        else:
            # No stock records found
            return {
                "part_id": part_id,
                "total": 0,
                "in_sales": 0,
                "in_builds": 0,
                "in_procurement": 0,
                "available": 0,
                "batches": []
            }
    except Exception as e:
        print(f"[ERROR] Failed to fetch stock info for part {part_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock info: {str(e)}")


@router.get("/parts/{part_id}/bom")
async def get_part_bom(
    part_id: int,
    current_user: dict = Depends(verify_admin)
):
    """Get BOM (Bill of Materials) for a part - returns sub-components"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        response = requests.get(
            f"{inventree_url}/api/bom/",
            headers=headers,
            params={'part': part_id},
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        bom_items = data if isinstance(data, list) else data.get('results', [])
        
        return {"results": bom_items}
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch BOM: {str(e)}")


@router.get("/parts/{part_id}/batch-codes")
async def get_part_batch_codes(
    part_id: int,
    location_id: Optional[int] = None,
    current_user: dict = Depends(verify_admin)
):
    """Get available batch codes for a part from InvenTree stock items"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        # Get stock items for this part
        params = {
            'part': part_id,
            'in_stock': 'true',
            'status': 10  # OK status (transferable)
        }
        
        if location_id:
            params['location'] = location_id
        
        response = requests.get(
            f"{inventree_url}/api/stock/",
            headers=headers,
            params=params,
            timeout=10
        )
        response.raise_for_status()
        stock_data = response.json()
        stock_items = stock_data if isinstance(stock_data, list) else stock_data.get('results', [])
        
        # Extract unique batch codes with details
        batch_map = {}
        for item in stock_items:
            batch = item.get('batch', '')
            if batch and batch.strip():
                if batch not in batch_map:
                    batch_map[batch] = {
                        'batch_code': batch,
                        'expiry_date': item.get('expiry_date', ''),
                        'quantity': 0,
                        'location': item.get('location_detail', {}).get('name', ''),
                        'location_id': item.get('location', 0)
                    }
                batch_map[batch]['quantity'] += item.get('quantity', 0)
        
        batch_codes = list(batch_map.values())
        
        return {"batch_codes": batch_codes}
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch batch codes: {str(e)}")


@router.get("/")
async def list_requests(
    current_user: dict = Depends(verify_admin)
):
    """List all requests with location names"""
    db = get_db()
    requests_collection = db['depo_requests']
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    requests_list = list(requests_collection.find().sort('created_at', -1))
    
    # Get all unique location IDs
    location_ids = set()
    for req in requests_list:
        if req.get('source'):
            location_ids.add(req['source'])
        if req.get('destination'):
            location_ids.add(req['destination'])
    
    # Fetch all locations in one call
    location_map = {}
    if location_ids:
        try:
            locations_response = requests.get(
                f"{inventree_url}/api/stock/location/",
                headers=headers,
                timeout=10
            )
            if locations_response.status_code == 200:
                locations_data = locations_response.json()
                locations = locations_data if isinstance(locations_data, list) else locations_data.get('results', [])
                for loc in locations:
                    loc_id = loc.get('pk') or loc.get('id')
                    if loc_id in location_ids:
                        location_map[loc_id] = loc.get('name', str(loc_id))
        except Exception as e:
            print(f"Warning: Failed to fetch locations: {e}")
    
    # Convert ObjectId to string and add location names
    for req in requests_list:
        req['_id'] = str(req['_id'])
        
        # Add location names
        if req.get('source') and req['source'] in location_map:
            req['source_name'] = location_map[req['source']]
        if req.get('destination') and req['destination'] in location_map:
            req['destination_name'] = location_map[req['destination']]
        
        if 'created_at' in req and isinstance(req['created_at'], datetime):
            req['created_at'] = req['created_at'].isoformat()
        if 'updated_at' in req and isinstance(req['updated_at'], datetime):
            req['updated_at'] = req['updated_at'].isoformat()
        if 'issue_date' in req and isinstance(req['issue_date'], datetime):
            req['issue_date'] = req['issue_date'].isoformat()
    
    return {"results": requests_list}


@router.get("/{request_id}")
async def get_request(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Get a specific request by ID with location and part details"""
    from bson import ObjectId
    
    db = get_db()
    requests_collection = db['depo_requests']
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    req = requests_collection.find_one({'_id': req_obj_id})
    
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get source location details
    if req.get('source'):
        try:
            source_response = requests.get(
                f"{inventree_url}/api/stock/location/{req['source']}/",
                headers=headers,
                timeout=10
            )
            if source_response.status_code == 200:
                req['source_detail'] = source_response.json()
        except Exception as e:
            print(f"Warning: Failed to get source location: {e}")
    
    # Get destination location details
    if req.get('destination'):
        try:
            dest_response = requests.get(
                f"{inventree_url}/api/stock/location/{req['destination']}/",
                headers=headers,
                timeout=10
            )
            if dest_response.status_code == 200:
                req['destination_detail'] = dest_response.json()
        except Exception as e:
            print(f"Warning: Failed to get destination location: {e}")
    
    # Get part details for each item
    if req.get('items'):
        for item in req['items']:
            if item.get('part'):
                try:
                    part_response = requests.get(
                        f"{inventree_url}/api/part/{item['part']}/",
                        headers=headers,
                        timeout=10
                    )
                    if part_response.status_code == 200:
                        item['part_detail'] = part_response.json()
                except Exception as e:
                    print(f"Warning: Failed to get part details: {e}")
    
    req['_id'] = str(req['_id'])
    if 'created_at' in req and isinstance(req['created_at'], datetime):
        req['created_at'] = req['created_at'].isoformat()
    if 'updated_at' in req and isinstance(req['updated_at'], datetime):
        req['updated_at'] = req['updated_at'].isoformat()
    if 'issue_date' in req and isinstance(req['issue_date'], datetime):
        req['issue_date'] = req['issue_date'].isoformat()
    
    return req


@router.post("/")
async def create_request(
    request_data: RequestCreate,
    current_user: dict = Depends(verify_admin)
):
    """Create a new request"""
    db = get_db()
    requests_collection = db['depo_requests']
    
    # Validate source != destination
    if request_data.source == request_data.destination:
        raise HTTPException(status_code=400, detail="Source and destination cannot be the same")
    
    # Generate reference
    reference = generate_request_reference(db)
    
    # Create request document
    request_doc = {
        'reference': reference,
        'source': request_data.source,
        'destination': request_data.destination,
        'items': [item.dict() for item in request_data.items],
        'line_items': len(request_data.items),
        'status': 'Pending',
        'notes': request_data.notes or '',
        'issue_date': datetime.utcnow(),
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }
    
    # Add recipe information if provided
    if request_data.recipe_id:
        from bson import ObjectId
        request_doc['recipe_id'] = ObjectId(request_data.recipe_id)
    if request_data.recipe_part_id:
        from bson import ObjectId
        request_doc['recipe_part_id'] = ObjectId(request_data.recipe_part_id)
    if request_data.product_id:
        request_doc['product_id'] = request_data.product_id
    if request_data.product_quantity:
        request_doc['product_quantity'] = request_data.product_quantity
    
    result = requests_collection.insert_one(request_doc)
    request_id = str(result.inserted_id)
    request_doc['_id'] = request_id
    request_doc['created_at'] = request_doc['created_at'].isoformat()
    request_doc['updated_at'] = request_doc['updated_at'].isoformat()
    request_doc['issue_date'] = request_doc['issue_date'].isoformat()
    
    # Auto-create approval flow
    try:
        # Get request approval config from MongoDB (use operations flow config)
        config_collection = db['config']
        approval_config = config_collection.find_one({'slug': 'requests_operations_flow'})
        
        if approval_config and 'items' in approval_config:
            # Get the operations flow config (first item with slug='operations')
            flow_config = None
            for item in approval_config.get('items', []):
                if item.get('slug') == 'operations' and item.get('enabled', True):
                    flow_config = item
                    break
            
            if flow_config:
                # Build can_sign list
                can_sign_officers = []
                for user in flow_config.get('can_sign', []):
                    can_sign_officers.append({
                        "type": "person",
                        "reference": user.get('user_id'),
                        "username": user.get('username'),
                        "action": "can_sign"
                    })
                
                # Build must_sign list
                must_sign_officers = []
                for user in flow_config.get('must_sign', []):
                    must_sign_officers.append({
                        "type": "person",
                        "reference": user.get('user_id'),
                        "username": user.get('username'),
                        "action": "must_sign"
                    })
                
                flow_data = {
                    "object_type": "stock_request",
                    "object_source": "depo_request",
                    "object_id": request_id,
                    "config_slug": flow_config.get('slug'),
                    "min_signatures": flow_config.get('min_signatures', 1),
                    "can_sign_officers": can_sign_officers,
                    "must_sign_officers": must_sign_officers,
                    "signatures": [],
                    "status": "pending",
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                db.approval_flows.insert_one(flow_data)
                print(f"[REQUESTS] Auto-created approval flow for request {request_id}")
    except Exception as e:
        print(f"[REQUESTS] Warning: Failed to auto-create approval flow: {e}")
        # Don't fail the request creation if approval flow creation fails
    
    return request_doc


@router.patch("/{request_id}")
async def update_request(
    request_id: str,
    request_data: RequestUpdate,
    current_user: dict = Depends(verify_admin)
):
    """Update a request"""
    from bson import ObjectId
    
    db = get_db()
    requests_collection = db['depo_requests']
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    # Get existing request
    existing = requests_collection.find_one({'_id': req_obj_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Prepare update
    update_data = {
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username')
    }
    
    if request_data.source is not None:
        update_data['source'] = request_data.source
    if request_data.destination is not None:
        update_data['destination'] = request_data.destination
    if request_data.notes is not None:
        update_data['notes'] = request_data.notes
    if request_data.batch_codes is not None:
        update_data['batch_codes'] = request_data.batch_codes
    if request_data.status is not None:
        update_data['status'] = request_data.status
    if request_data.issue_date is not None:
        # Parse date string to datetime
        try:
            update_data['issue_date'] = datetime.fromisoformat(request_data.issue_date.replace('Z', '+00:00'))
        except:
            update_data['issue_date'] = datetime.utcnow()
    if request_data.items is not None:
        update_data['items'] = [item.dict() for item in request_data.items]
        update_data['line_items'] = len(request_data.items)
    
    # Validate source != destination if both are being updated
    source = update_data.get('source', existing.get('source'))
    destination = update_data.get('destination', existing.get('destination'))
    if source == destination:
        raise HTTPException(status_code=400, detail="Source and destination cannot be the same")
    
    requests_collection.update_one(
        {'_id': req_obj_id},
        {'$set': update_data}
    )
    
    # Get updated request
    updated = requests_collection.find_one({'_id': req_obj_id})
    updated['_id'] = str(updated['_id'])
    if 'created_at' in updated and isinstance(updated['created_at'], datetime):
        updated['created_at'] = updated['created_at'].isoformat()
    if 'updated_at' in updated and isinstance(updated['updated_at'], datetime):
        updated['updated_at'] = updated['updated_at'].isoformat()
    if 'issue_date' in updated and isinstance(updated['issue_date'], datetime):
        updated['issue_date'] = updated['issue_date'].isoformat()
    
    return updated


@router.delete("/{request_id}")
async def delete_request(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Delete a request"""
    from bson import ObjectId
    
    db = get_db()
    requests_collection = db['depo_requests']
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    result = requests_collection.delete_one({'_id': req_obj_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {"success": True, "message": "Request deleted successfully"}


# ==================== APPROVAL INTEGRATION ====================

@router.get("/{request_id}/approval-flow")
async def get_request_approval_flow(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Get approval flow for a request"""
    from bson import ObjectId
    
    db = get_db()
    
    # Find approval flow for this request
    flow = db.approval_flows.find_one({
        "object_type": "stock_request",
        "object_id": request_id
    })
    
    if not flow:
        return {"flow": None}
    
    flow["_id"] = str(flow["_id"])
    
    # Get user details for signatures
    for signature in flow.get("signatures", []):
        user = db.users.find_one({"_id": ObjectId(signature["user_id"])})
        if user:
            signature["user_name"] = user.get("name") or user.get("username")
    
    return {"flow": flow}


@router.post("/{request_id}/approval-flow")
async def create_request_approval_flow(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Create approval flow for a request using config from MongoDB"""
    from bson import ObjectId
    
    db = get_db()
    
    # Check if flow already exists
    existing = db.approval_flows.find_one({
        "object_type": "stock_request",
        "object_id": request_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Approval flow already exists for this request")
    
    # Get request approval config from MongoDB (use operations flow config)
    config_collection = db['config']
    approval_config = config_collection.find_one({'slug': 'requests_operations_flow'})
    
    if not approval_config or 'items' not in approval_config:
        raise HTTPException(status_code=404, detail="No request operations flow configuration found")
    
    # Get the operations flow config (first item with slug='operations')
    flow_config = None
    for item in approval_config.get('items', []):
        if item.get('slug') == 'operations' and item.get('enabled', True):
            flow_config = item
            break
    
    if not flow_config:
        raise HTTPException(status_code=404, detail="No enabled approval flow found")
    
    # Build can_sign list
    can_sign_officers = []
    for user in flow_config.get('can_sign', []):
        can_sign_officers.append({
            "type": "person",
            "reference": user.get('user_id'),
            "username": user.get('username'),
            "action": "can_sign"
        })
    
    # Build must_sign list
    must_sign_officers = []
    for user in flow_config.get('must_sign', []):
        must_sign_officers.append({
            "type": "person",
            "reference": user.get('user_id'),
            "username": user.get('username'),
            "action": "must_sign"
        })
    
    flow_data = {
        "object_type": "stock_request",
        "object_source": "depo_request",
        "object_id": request_id,
        "config_slug": flow_config.get('slug'),
        "min_signatures": flow_config.get('min_signatures', 1),
        "can_sign_officers": can_sign_officers,
        "must_sign_officers": must_sign_officers,
        "signatures": [],
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = db.approval_flows.insert_one(flow_data)
    
    flow_data["_id"] = str(result.inserted_id)
    
    return flow_data


@router.post("/{request_id}/sign")
async def sign_request(
    request_id: str,
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Sign a request approval flow"""
    from bson import ObjectId
    from src.backend.models.approval_flow_model import ApprovalFlowModel
    
    db = get_db()
    requests_collection = db['depo_requests']
    
    # Get approval flow
    flow = db.approval_flows.find_one({
        "object_type": "stock_request",
        "object_id": request_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this request")
    
    # Check if already signed
    user_id = str(current_user["_id"])
    existing_signature = next(
        (s for s in flow.get("signatures", []) if s["user_id"] == user_id),
        None
    )
    
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this request")
    
    # Check if user is authorized to sign
    username = current_user["username"]
    can_sign = False
    
    # Check can_sign officers
    for officer in flow.get("can_sign_officers", []):
        if officer["reference"] == user_id:
            can_sign = True
            break
    
    # Check must_sign officers
    if not can_sign:
        for officer in flow.get("must_sign_officers", []):
            if officer["reference"] == user_id:
                can_sign = True
                break
    
    if not can_sign:
        raise HTTPException(status_code=403, detail="You are not authorized to sign this request")
    
    # Generate signature
    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="stock_request",
        object_id=request_id,
        timestamp=timestamp
    )
    
    signature = {
        "user_id": user_id,
        "username": username,
        "signed_at": timestamp,
        "signature_hash": signature_hash,
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent")
    }
    
    # Add signature to flow
    db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$push": {"signatures": signature},
            "$set": {
                "status": "in_progress",
                "updated_at": timestamp
            }
        }
    )
    
    # Check if approval conditions are met
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    signatures = updated_flow.get("signatures", [])
    signature_user_ids = [s["user_id"] for s in signatures]
    
    # Check must_sign: all must have signed
    must_sign_officers = updated_flow.get("must_sign_officers", [])
    all_must_signed = True
    for officer in must_sign_officers:
        if officer["reference"] not in signature_user_ids:
            all_must_signed = False
            break
    
    # Check can_sign: at least min_signatures have signed
    can_sign_officers = updated_flow.get("can_sign_officers", [])
    min_signatures = updated_flow.get("min_signatures", 1)
    can_sign_count = 0
    for officer in can_sign_officers:
        if officer["reference"] in signature_user_ids:
            can_sign_count += 1
    
    has_min_signatures = can_sign_count >= min_signatures
    
    # If all conditions met, mark as approved and update request status
    if all_must_signed and has_min_signatures:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {
                "$set": {
                    "status": "approved",
                    "completed_at": timestamp,
                    "updated_at": timestamp
                }
            }
        )
        
        # Update request status to "Approved"
        try:
            req_obj_id = ObjectId(request_id)
        except:
            req_obj_id = None
        
        if req_obj_id:
            requests_collection.update_one(
                {"_id": req_obj_id},
                {"$set": {"status": "Approved", "updated_at": timestamp}}
            )
            print(f"[REQUESTS] Request {request_id} status updated to Approved")
            
            # Auto-create operations flow when request is approved
            try:
                # Check if operations flow already exists
                existing_ops_flow = db.approval_flows.find_one({
                    "object_type": "stock_request_operations",
                    "object_id": request_id
                })
                
                if not existing_ops_flow:
                    # Get operations config
                    config_collection = db['config']
                    ops_config = config_collection.find_one({'slug': 'requests_operations_flow'})
                    
                    if ops_config and 'items' in ops_config:
                        # Find operations flow config
                        ops_flow_config = None
                        for item in ops_config.get('items', []):
                            if item.get('slug') == 'operations' and item.get('enabled', True):
                                ops_flow_config = item
                                break
                        
                        if ops_flow_config:
                            # Build officers lists
                            can_sign_officers = []
                            for user in ops_flow_config.get('can_sign', []):
                                can_sign_officers.append({
                                    "type": "person",
                                    "reference": user.get('user_id'),
                                    "username": user.get('username'),
                                    "action": "can_sign"
                                })
                            
                            must_sign_officers = []
                            for user in ops_flow_config.get('must_sign', []):
                                must_sign_officers.append({
                                    "type": "person",
                                    "reference": user.get('user_id'),
                                    "username": user.get('username'),
                                    "action": "must_sign"
                                })
                            
                            ops_flow_data = {
                                "object_type": "stock_request_operations",
                                "object_source": "depo_request",
                                "object_id": request_id,
                                "flow_type": "operations",
                                "config_slug": ops_flow_config.get('slug'),
                                "min_signatures": ops_flow_config.get('min_signatures', 1),
                                "can_sign_officers": can_sign_officers,
                                "must_sign_officers": must_sign_officers,
                                "signatures": [],
                                "status": "pending",
                                "created_at": timestamp,
                                "updated_at": timestamp
                            }
                            
                            db.approval_flows.insert_one(ops_flow_data)
                            print(f"[REQUESTS] Auto-created operations flow for request {request_id}")
            except Exception as e:
                print(f"[REQUESTS] Warning: Failed to auto-create operations flow: {e}")
    
    # Get updated flow
    flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    flow["_id"] = str(flow["_id"])
    
    return flow


@router.delete("/{request_id}/signatures/{user_id}")
async def remove_request_signature(
    request_id: str,
    user_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Remove signature from request approval flow (admin only)"""
    from bson import ObjectId
    
    db = get_db()
    requests_collection = db['depo_requests']
    
    # Get flow
    flow = db.approval_flows.find_one({
        "object_type": "stock_request",
        "object_id": request_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this request")
    
    # Remove signature
    result = db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$pull": {"signatures": {"user_id": user_id}},
            "$set": {"updated_at": datetime.utcnow(), "status": "in_progress"}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    # Update status back to pending if no signatures left
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    if len(updated_flow.get("signatures", [])) == 0:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {"$set": {"status": "pending"}}
        )
        
        # Update request status back to Pending
        try:
            req_obj_id = ObjectId(request_id)
            requests_collection.update_one(
                {"_id": req_obj_id},
                {"$set": {"status": "Pending", "updated_at": datetime.utcnow()}}
            )
            print(f"[REQUESTS] Request {request_id} status updated to Pending after signature removal")
        except Exception as e:
            print(f"[REQUESTS] Warning: Failed to update request status: {e}")
    else:
        # Still has signatures but not approved anymore
        # Update request status to In Progress
        try:
            req_obj_id = ObjectId(request_id)
            requests_collection.update_one(
                {"_id": req_obj_id},
                {"$set": {"status": "In Progress", "updated_at": datetime.utcnow()}}
            )
            print(f"[REQUESTS] Request {request_id} status updated to In Progress after signature removal")
        except Exception as e:
            print(f"[REQUESTS] Warning: Failed to update request status: {e}")
    
    return {"message": "Signature removed successfully"}


#
async def get_part_recipe(
    part_id: int,
    current_user: dict = Depends(verify_admin),
    db=Depends(get_db),
):
    """
    Get recipe for a part (with fallback to BOM if no recipe exists)
    Uses part_id (ObjectId) from depo_parts
    """
    from bson import ObjectId
    
    # Get the part from depo_parts to get its _id (ObjectId)
    part = db.depo_parts.find_one({"id": part_id})
    
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    
    part_oid = part.get("_id")  # This is the ObjectId

    # Try to get recipe from depo_recipes using part_id (ObjectId)
    recipe = db.depo_recipes.find_one({"part_id": part_oid})

    if recipe:
        current_date = datetime.utcnow()

        # Collect all part_ids (ObjectIds) recursively
        def collect_part_ids(items):
            ids = []
            for item in items:
                if item.get("type") == 1 and item.get("part_id"):
                    part_id_val = item["part_id"]
                    if isinstance(part_id_val, ObjectId):
                        ids.append(part_id_val)
                    else:
                        ids.append(ObjectId(part_id_val))
                if item.get("items"):
                    ids.extend(collect_part_ids(item["items"]))
            return ids

        part_ids = collect_part_ids(recipe.get("items", []))
        parts = list(
            db.depo_parts.find({"_id": {"$in": part_ids}})
        )
        parts_map = {p["_id"]: p for p in parts}

        # Process recipe items
        def process_items(items):
            valid_items = []

            for item in items:
                start = item.get("start")
                fin = item.get("fin")

                is_valid = True
                if start and start > current_date:
                    is_valid = False
                if fin and fin < current_date:
                    is_valid = False

                if not is_valid:
                    continue

                processed_item = {
                    "type": item.get("type"),
                    "mandatory": item.get("mandatory", True),
                    "notes": item.get("notes"),
                }

                if item.get("type") == 1:
                    item_part_id = item.get("part_id")
                    if isinstance(item_part_id, ObjectId):
                        part_oid_key = item_part_id
                    else:
                        part_oid_key = ObjectId(item_part_id)
                    
                    part_data = parts_map.get(part_oid_key, {})
                    processed_item.update({
                        "part": part_data.get("id"),  # Return integer id for frontend
                        "name": part_data.get("name", f"Part {str(part_oid_key)}"),
                        "IPN": part_data.get("ipn", ""),
                        "quantity": item.get("q", 1),
                    })
                else:
                    alternatives = process_items(item.get("items", []))
                    if alternatives:
                        processed_item["alternatives"] = alternatives

                valid_items.append(processed_item)

            return valid_items

        processed_items = process_items(recipe.get("items", []))

        return {
            "source": "recipe",
            "recipe_id": str(recipe["_id"]),
            "recipe_part_id": str(part_oid),
            "items": processed_items,
        }

    # -----------------------------
    # Fallback to BOM (InvenTree)
    # -----------------------------
    config = load_config()
    inventree_url = config["inventree"]["url"].rstrip("/")
    headers = get_inventree_headers(current_user)

    try:
        response = requests.get(
            f"{inventree_url}/api/bom/",
            headers=headers,
            params={"part": part_id},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        bom_items = (
            data if isinstance(data, list)
            else data.get("results", [])
        )

        result = []
        for item in bom_items:
            sub_part_id = item.get("sub_part")
            quantity = item.get("quantity", 1)

            if not sub_part_id:
                continue

            part_response = requests.get(
                f"{inventree_url}/api/part/{sub_part_id}/",
                headers=headers,
                timeout=10,
            )

            if part_response.status_code == 200:
                part_data = part_response.json()
                result.append({
                    "type": 1,
                    "part": sub_part_id,
                    "name": part_data.get("name"),
                    "IPN": part_data.get("IPN"),
                    "quantity": quantity,
                    "mandatory": True,
                })

        return {
            "source": "bom",
            "items": result,
        }

    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch BOM: {str(e)}",
        )
