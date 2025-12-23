"""
Requests routes for internal stock transfer requests
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from datetime import datetime
import requests
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.utils.config import load_config
from src.backend.routes.auth import verify_admin

from .models import RequestCreate, RequestUpdate
from .utils import get_inventree_headers, generate_request_reference
from .services import (
    fetch_stock_locations,
    search_parts,
    get_part_stock_info,
    fetch_part_bom,
    fetch_part_batch_codes,
    fetch_part_recipe
)
from .approval_routes import router as approval_router


router = APIRouter(prefix="/modules/requests/api", tags=["requests"])

# Include approval routes
router.include_router(approval_router)


# ==================== STOCK LOCATIONS ====================

@router.get("/states")
async def get_request_states(
    current_user: dict = Depends(verify_admin)
):
    """Get list of request states from MongoDB depo_requests_states"""
    db = get_db()
    states_collection = db['depo_requests_states']
    
    states = list(states_collection.find().sort('level', 1))
    
    # Convert ObjectIds to strings
    for state in states:
        state['_id'] = str(state['_id'])
    
    return {"results": states}


@router.get("/stock-locations")
async def get_stock_locations(
    request: Request,
    current_user: dict = Depends(verify_admin),
    db = Depends(get_db)
):
    """Get list of stock locations from MongoDB depo_locations"""
    return await fetch_stock_locations(current_user, db)


# ==================== PARTS ====================

@router.get("/parts")
async def get_parts(
    request: Request,
    search: Optional[str] = None,
    current_user: dict = Depends(verify_admin),
    db = Depends(get_db)
):
    """Get list of parts from MongoDB depo_parts with search"""
    return await search_parts(db, search)


@router.get("/parts/{part_id}/stock-info")
async def get_part_stock_info_route(
    part_id: str,
    current_user: dict = Depends(verify_admin),
    db = Depends(get_db)
):
    """Get stock information for a part from MongoDB depo_stocks with batches using ObjectId"""
    return await get_part_stock_info(db, part_id)


@router.get("/parts/{part_id}/bom")
async def get_part_bom(
    part_id: str,
    current_user: dict = Depends(verify_admin),
    db = Depends(get_db)
):
    """Get BOM (Bill of Materials) for a part from MongoDB depo_bom using ObjectId"""
    return await fetch_part_bom(current_user, part_id, db)


@router.get("/parts/{part_id}/batch-codes")
async def get_part_batch_codes(
    part_id: str,
    location_id: Optional[str] = None,
    current_user: dict = Depends(verify_admin),
    db = Depends(get_db)
):
    """Get available batch codes for a part from MongoDB depo_stocks using ObjectId"""
    return await fetch_part_batch_codes(current_user, part_id, location_id, db)


@router.get("/parts/{part_id}/recipe")
async def get_part_recipe(
    part_id: str,
    current_user: dict = Depends(verify_admin),
    db = Depends(get_db)
):
    """Get recipe for a part (with fallback to BOM if no recipe exists) using ObjectId"""
    return await fetch_part_recipe(db, current_user, part_id)


# ==================== REQUESTS CRUD ====================

@router.get("/")
async def list_requests(
    current_user: dict = Depends(verify_admin)
):
    """List all requests with location names from depo_locations"""
    db = get_db()
    requests_collection = db['depo_requests']
    locations_collection = db['depo_locations']
    
    requests_list = list(requests_collection.find().sort('created_at', -1))
    
    # Get all unique location ObjectIds
    location_oids = set()
    for req in requests_list:
        if req.get('source'):
            try:
                location_oids.add(ObjectId(req['source']) if isinstance(req['source'], str) else req['source'])
            except:
                pass
        if req.get('destination'):
            try:
                location_oids.add(ObjectId(req['destination']) if isinstance(req['destination'], str) else req['destination'])
            except:
                pass
    
    # Fetch all locations from MongoDB
    location_map = {}
    if location_oids:
        try:
            locations = list(locations_collection.find({'_id': {'$in': list(location_oids)}}))
            for loc in locations:
                loc_id = str(loc['_id'])
                location_map[loc_id] = loc.get('code', str(loc['_id']))
        except Exception as e:
            print(f"Warning: Failed to fetch locations: {e}")
    
    # Convert ObjectId to string and add location names
    for req in requests_list:
        req['_id'] = str(req['_id'])
        
        # Get state info from state_id and set status
        if req.get('state_id'):
            states_collection = db['depo_requests_states']
            try:
                state_id_obj = req['state_id'] if isinstance(req['state_id'], ObjectId) else ObjectId(req['state_id'])
                state = states_collection.find_one({'_id': state_id_obj})
                if state:
                    # Set status from state name
                    req['status'] = state.get('name', 'Unknown')
                req['state_id'] = str(state_id_obj)
            except Exception as e:
                print(f"[ERROR] Failed to lookup state for request {req['_id']}: {e}")
                if isinstance(req.get('state_id'), ObjectId):
                    req['state_id'] = str(req['state_id'])
        
        # Convert source and destination ObjectIds to strings
        if req.get('source'):
            if isinstance(req['source'], ObjectId):
                req['source'] = str(req['source'])
            source_id = req['source']
            req['source_name'] = location_map.get(source_id, source_id)
        
        if req.get('destination'):
            if isinstance(req['destination'], ObjectId):
                req['destination'] = str(req['destination'])
            dest_id = req['destination']
            req['destination_name'] = location_map.get(dest_id, dest_id)
        
        # Convert recipe ObjectIds if present
        if 'recipe_id' in req and isinstance(req['recipe_id'], ObjectId):
            req['recipe_id'] = str(req['recipe_id'])
        if 'recipe_part_id' in req and isinstance(req['recipe_part_id'], ObjectId):
            req['recipe_part_id'] = str(req['recipe_part_id'])
        
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
    """Get a specific request by ID with location and part details from MongoDB"""
    db = get_db()
    requests_collection = db['depo_requests']
    locations_collection = db['depo_locations']
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    req = requests_collection.find_one({'_id': req_obj_id})
    
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Convert source and destination ObjectIds to strings
    if req.get('source'):
        if isinstance(req['source'], ObjectId):
            req['source'] = str(req['source'])
    
    if req.get('destination'):
        if isinstance(req['destination'], ObjectId):
            req['destination'] = str(req['destination'])
    
    # Get source location details from MongoDB
    if req.get('source'):
        try:
            source_oid = ObjectId(req['source'])
            source_loc = locations_collection.find_one({'_id': source_oid})
            if source_loc:
                req['source_detail'] = {
                    'pk': str(source_loc['_id']),
                    'name': source_loc.get('code', str(source_loc['_id'])),
                    'code': source_loc.get('code', ''),
                    'description': source_loc.get('description', '')
                }
        except Exception as e:
            print(f"Warning: Failed to get source location: {e}")
    
    # Get destination location details from MongoDB
    if req.get('destination'):
        try:
            dest_oid = ObjectId(req['destination'])
            dest_loc = locations_collection.find_one({'_id': dest_oid})
            if dest_loc:
                req['destination_detail'] = {
                    'pk': str(dest_loc['_id']),
                    'name': dest_loc.get('code', str(dest_loc['_id'])),
                    'code': dest_loc.get('code', ''),
                    'description': dest_loc.get('description', '')
                }
        except Exception as e:
            print(f"Warning: Failed to get destination location: {e}")
    
    # Get part details for each item from MongoDB depo_parts
    if req.get('items'):
        parts_collection = db['depo_parts']
        for item in req['items']:
            if item.get('part'):
                try:
                    # Get part from MongoDB using integer id
                    part = parts_collection.find_one({"id": item['part']})
                    if part:
                        item['part_detail'] = {
                            'pk': part.get('id'),
                            'name': part.get('name', ''),
                            'IPN': part.get('ipn', ''),
                            'description': part.get('description', ''),
                            'active': part.get('active', True),
                            'assembly': part.get('assembly', False),
                            'component': part.get('component', False),
                            'purchaseable': part.get('purchaseable', False),
                            'salable': part.get('salable', False),
                            'trackable': part.get('trackable', False),
                            'virtual': part.get('virtual', False)
                        }
                except Exception as e:
                    print(f"Warning: Failed to get part details: {e}")
    
    # Convert all ObjectIds to strings
    req['_id'] = str(req['_id'])
    
    # Get state level and order from depo_requests_states using state_id
    if req.get('state_id'):
        states_collection = db['depo_requests_states']
        try:
            state_id_obj = req['state_id'] if isinstance(req['state_id'], ObjectId) else ObjectId(req['state_id'])
            state = states_collection.find_one({'_id': state_id_obj})
            if state:
                req['state_level'] = state.get('workflow_level', 0)  # Use workflow_level not level
                req['state_order'] = state.get('order', 0)  # Add order field
                # Also set status from state if not present
                if not req.get('status'):
                    req['status'] = state.get('name', 'Unknown')
            else:
                req['state_level'] = 0
                req['state_order'] = 0
        except Exception as e:
            print(f"[ERROR] Failed to lookup state: {e}")
            req['state_level'] = 0
            req['state_order'] = 0
    else:
        req['state_level'] = 0
        req['state_order'] = 0
    
    # Convert state_id if present
    if 'state_id' in req and isinstance(req['state_id'], ObjectId):
        req['state_id'] = str(req['state_id'])
    
    # Convert recipe ObjectIds if present
    if 'recipe_id' in req and isinstance(req['recipe_id'], ObjectId):
        req['recipe_id'] = str(req['recipe_id'])
    if 'recipe_part_id' in req and isinstance(req['recipe_part_id'], ObjectId):
        req['recipe_part_id'] = str(req['recipe_part_id'])
    
    # Convert datetime to ISO format
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
    # Set init_q (initial quantity) for each item if not provided
    items_with_init_q = []
    for item in request_data.items:
        item_dict = item.dict()
        if item_dict.get('init_q') is None:
            item_dict['init_q'] = item_dict['quantity']  # Save initial quantity
        items_with_init_q.append(item_dict)
    
    request_doc = {
        'reference': reference,
        'source': request_data.source,
        'destination': request_data.destination,
        'items': items_with_init_q,
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
        request_doc['recipe_id'] = ObjectId(request_data.recipe_id)
    if request_data.recipe_part_id:
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
    
    # Convert state_id if present
    if 'state_id' in updated and isinstance(updated['state_id'], ObjectId):
        updated['state_id'] = str(updated['state_id'])
    
    # Convert source and destination ObjectIds to strings
    if updated.get('source') and isinstance(updated['source'], ObjectId):
        updated['source'] = str(updated['source'])
    if updated.get('destination') and isinstance(updated['destination'], ObjectId):
        updated['destination'] = str(updated['destination'])
    
    # Convert recipe ObjectIds if present
    if 'recipe_id' in updated and isinstance(updated['recipe_id'], ObjectId):
        updated['recipe_id'] = str(updated['recipe_id'])
    if 'recipe_part_id' in updated and isinstance(updated['recipe_part_id'], ObjectId):
        updated['recipe_part_id'] = str(updated['recipe_part_id'])
    
    # Convert datetime to ISO format
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
