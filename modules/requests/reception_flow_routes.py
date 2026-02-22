"""
Reception flow routes for requests module
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_admin
from src.backend.models.approval_flow_model import ApprovalFlowModel

from .approval_helpers import check_flow_completion, enrich_flow_with_user_details


router = APIRouter()


@router.get("/{request_id}/reception-flow")
async def get_request_reception_flow(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Get reception flow for a request"""
    db = get_db()
    
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_reception",
        "object_id": request_id
    })
    
    if not flow:
        return {"flow": None}
    
    flow["_id"] = str(flow["_id"])
    enrich_flow_with_user_details(db, flow)
    
    return {"flow": flow}


@router.post("/{request_id}/reception-sign")
async def sign_reception(
    request_id: str,
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Sign reception flow for a request"""
    db = get_db()
    
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_reception",
        "object_id": request_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No reception flow found for this request")
    
    # Check if already signed
    user_id = str(current_user["_id"])
    existing_signature = next(
        (s for s in flow.get("signatures", []) if s["user_id"] == user_id),
        None
    )
    
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this reception flow")
    
    # Check if user is authorized to sign
    username = current_user["username"]
    is_staff = current_user.get("is_staff", False)
    can_sign = False
    
    # Check can_sign_officers
    for officer in flow.get("can_sign_officers", []):
        # Direct user_id match
        if officer.get("reference") == user_id:
            can_sign = True
            break
        # Role-based match
        if officer.get("type") == "role" and officer.get("reference"):
            if officer["reference"] == "admin" and is_staff:
                can_sign = True
                break
    
    # Check must_sign_officers if not already authorized
    if not can_sign:
        for officer in flow.get("must_sign_officers", []):
            # Direct user_id match
            if officer.get("reference") == user_id:
                can_sign = True
                break
            # Role-based match
            if officer.get("type") == "role" and officer.get("reference"):
                if officer["reference"] == "admin" and is_staff:
                    can_sign = True
                    break
    
    if not can_sign:
        print(f"[REQUESTS] User {username} (staff={is_staff}) not authorized to sign. Officers: {flow.get('can_sign_officers', [])} + {flow.get('must_sign_officers', [])}")
        raise HTTPException(status_code=403, detail="You are not authorized to sign this reception flow")
    
    # Generate signature
    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="stock_request_reception",
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
    
    if check_flow_completion(updated_flow):
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
        print(f"[REQUESTS] Reception flow approved for request {request_id}")
        
        # Update request state_id to Stock received&signed (694df205297c9dde6d70664d)
        try:
            req_obj_id = ObjectId(request_id)
            requests_collection = db['depo_requests']
            stock_received_signed_state_id = ObjectId("694df205297c9dde6d70664d")
            
            # Get the state to get its order
            states_collection = db['depo_requests_states']
            signed_state = states_collection.find_one({'_id': stock_received_signed_state_id})
            state_order = signed_state.get('order', 45) if signed_state else 45
            
            # Create status log entry for signing
            status_log_entry = {
                'status_id': stock_received_signed_state_id,
                'scene': 'receive_stock',
                'created_at': timestamp,
                'created_by': username,
                'reason': None
            }
            
            requests_collection.update_one(
                {"_id": req_obj_id},
                {
                    "$set": {
                        "state_id": stock_received_signed_state_id,
                        "state_order": state_order,
                        "updated_at": timestamp
                    },
                    "$push": {"status_log": status_log_entry}
                }
            )
            
            # Log the state change
            db.logs.insert_one({
                'collection': 'depo_requests',
                'object_id': request_id,
                'action': 'reception_signed',
                'state_id': str(stock_received_signed_state_id),
                'state_name': 'Stock received&signed',
                'user': username,
                'timestamp': timestamp
            })
            
            print(f"[REQUESTS] Set state_id to Stock received&signed ({stock_received_signed_state_id}) for request {request_id}")
        except Exception as e:
            print(f"[REQUESTS] Warning: Failed to update request state_id: {e}")
        
        # Auto-create production flow when reception is approved
        try:
            existing_production_flow = db.approval_flows.find_one({
                "object_type": "stock_request_production",
                "object_id": request_id
            })
            
            if not existing_production_flow:
                # Get template from approval_templates
                production_template_id = ObjectId("694a1ae3297c9dde6d70661a")
                template = db.approval_templates.find_one({"_id": production_template_id})
                
                if template:
                    # Build officers lists from template
                    can_sign_officers = []
                    
                    # Add officers from template (template already has admin role)
                    for officer in template.get('officers', []):
                        can_sign_officers.append({
                            "type": officer.get('type', 'person'),
                            "reference": officer.get('reference', ''),
                            "username": officer.get('username', ''),
                            "action": "can_sign"
                        })
                    
                    # If template doesn't have admin, add it
                    has_admin = any(o.get('type') == 'role' and o.get('reference') == 'admin' for o in can_sign_officers)
                    if not has_admin:
                        can_sign_officers.append({
                            "type": "role",
                            "reference": "admin",
                            "username": "",
                            "action": "can_sign"
                        })
                    
                    production_flow_data = {
                        "object_type": "stock_request_production",
                        "object_source": "depo_request",
                        "object_id": request_id,
                        "flow_type": "production",
                        "template_id": str(production_template_id),
                        "min_signatures": template.get('min_signatures', 1),
                        "can_sign_officers": can_sign_officers,
                        "must_sign_officers": [],
                        "signatures": [],
                        "status": "pending",
                        "created_at": timestamp,
                        "updated_at": timestamp
                    }
                    
                    db.approval_flows.insert_one(production_flow_data)
                    print(f"[REQUESTS] Auto-created production flow for request {request_id}")
                else:
                    print(f"[REQUESTS] Warning: Production template {production_template_id} not found in approval_templates")
        except Exception as e:
            print(f"[REQUESTS] Warning: Failed to auto-create production flow: {e}")
    
    # Get updated flow
    flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    flow["_id"] = str(flow["_id"])
    
    return flow


@router.delete("/{request_id}/reception-signatures/{user_id}")
async def remove_reception_signature(
    request_id: str,
    user_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Remove signature from reception flow (admin only)"""
    db = get_db()
    requests_collection = db['depo_requests']
    
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_reception",
        "object_id": request_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No reception flow found for this request")
    
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
        
        # Update request state_id back to Warehouse Approved
        try:
            req_obj_id = ObjectId(request_id)
            # Get Warehouse Approved state_id from depo_requests_states
            states_collection = db['depo_requests_states']
            warehouse_approved_state = states_collection.find_one({"name": "Warehouse Approved"})
            
            if warehouse_approved_state:
                requests_collection.update_one(
                    {"_id": req_obj_id},
                    {"$set": {
                        "state_id": warehouse_approved_state["_id"],
                        "updated_at": datetime.utcnow()
                    }}
                )
                print(f"[REQUESTS] Set state_id to Warehouse Approved ({warehouse_approved_state['_id']}) for request {request_id}")
            else:
                print(f"[REQUESTS] Warning: Warehouse Approved state not found in depo_requests_states")
        except Exception as e:
            print(f"[REQUESTS] Warning: Failed to update request state_id: {e}")
        
        # Delete production flow if exists
        try:
            production_flow = db.approval_flows.find_one({
                "object_type": "stock_request_production",
                "object_id": request_id
            })
            if production_flow:
                db.approval_flows.delete_one({"_id": production_flow["_id"]})
                print(f"[REQUESTS] Deleted production flow for request {request_id}")
                
                # Also delete production data
                db.depo_production.delete_one({"request_id": req_obj_id})
                print(f"[REQUESTS] Deleted production data for request {request_id}")
        except Exception as e:
            print(f"[REQUESTS] Warning: Failed to delete production flow: {e}")
    
    return {"message": "Signature removed successfully"}


@router.patch("/{request_id}/reception-status")
async def update_reception_status(
    request_id: str,
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Update reception final status (after all signatures)"""
    db = get_db()
    requests_collection = db['depo_requests']
    
    body = await request.json()
    status = body.get('status')
    reason = body.get('reason', '')
    
    if not status:
        raise HTTPException(status_code=400, detail="Status is required")
    
    # Validate that status is a valid state ID with 'receive_stock' scene
    try:
        state_id = ObjectId(status)
        state = db.depo_requests_states.find_one({"_id": state_id})
        
        if not state:
            raise HTTPException(status_code=400, detail="Invalid state ID")
        
        # Check if state has 'receive_stock' in scenes
        if not state.get('scenes') or 'receive_stock' not in state.get('scenes', []):
            raise HTTPException(status_code=400, detail="State must have 'receive_stock' in scenes")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail="Invalid state ID format")
    
    try:
        req_obj_id = ObjectId(request_id)
        timestamp = datetime.utcnow()
        
        # Create status log entry
        status_log_entry = {
            'status_id': state_id,
            'scene': 'receive_stock',
            'created_at': timestamp,
            'created_by': current_user.get('username'),
            'reason': reason if reason else None
        }
        
        # Update state_id, state_order and add to status_log
        update_data = {
            'state_id': state_id,
            'state_order': state.get('order', 0),
            'updated_at': timestamp
        }
        
        requests_collection.update_one(
            {'_id': req_obj_id},
            {
                '$set': update_data,
                '$push': {'status_log': status_log_entry}
            }
        )
        
        # Log to audit logs
        is_rejected = 'reject' in state.get('slug', '').lower() or 'refuse' in state.get('slug', '').lower()
        db.logs.insert_one({
            'collection': 'depo_requests',
            'object_id': request_id,
            'action': 'reception_decision',
            'state_id': str(state_id),
            'state_name': state.get('name'),
            'is_rejected': is_rejected,
            'reason': reason if is_rejected else '',
            'user': current_user.get('username'),
            'timestamp': timestamp
        })
        
        print(f"[REQUESTS] Request {request_id} state_id updated to {state.get('name')} ({status})")
        
        # If status is "Stock Received", create stock movements from source to destination
        is_stock_received = 'stock_received' in state.get('slug', '').lower() or 'stock received' in state.get('name', '').lower()
        
        if is_stock_received:
            try:
                # Get request details
                request_doc = requests_collection.find_one({'_id': req_obj_id})
                if not request_doc:
                    raise Exception("Request not found")
                
                source_id = request_doc.get('source')
                destination_id = request_doc.get('destination')
                items = request_doc.get('items', [])
                
                if not source_id or not destination_id:
                    raise Exception("Source or destination not found in request")
                
                # Convert to ObjectId if needed
                if isinstance(source_id, str):
                    source_id = ObjectId(source_id)
                if isinstance(destination_id, str):
                    destination_id = ObjectId(destination_id)
                
                # Create stock movements for each item
                stocks_collection = db['depo_stocks']
                movements_created = 0
                
                for item in items:
                    part_id = item.get('part')
                    quantity = item.get('quantity', 0)
                    batch_code = item.get('batch_code', '')
                    
                    if not part_id or quantity <= 0:
                        continue
                    
                    # Convert part_id to ObjectId if needed
                    if isinstance(part_id, str):
                        part_id = ObjectId(part_id)
                    
                    # Find stock at source location with matching part and batch
                    query = {
                        'part_id': part_id,
                        'location_id': source_id,
                        'quantity': {'$gt': 0}
                    }
                    
                    if batch_code:
                        query['batch_code'] = batch_code
                    
                    source_stocks = list(stocks_collection.find(query).sort('created_at', 1))
                    
                    if not source_stocks:
                        print(f"[REQUESTS] Warning: No stock found at source for part {part_id}, batch {batch_code}")
                        continue
                    
                    # Transfer stock from source to destination
                    remaining_qty = quantity
                    
                    for source_stock in source_stocks:
                        if remaining_qty <= 0:
                            break
                        
                        available_qty = source_stock.get('quantity', 0)
                        transfer_qty = min(remaining_qty, available_qty)
                        
                        # Reduce quantity at source
                        stocks_collection.update_one(
                            {'_id': source_stock['_id']},
                            {
                                '$inc': {'quantity': -transfer_qty},
                                '$set': {'updated_at': timestamp}
                            }
                        )
                        
                        # Create or update stock at destination
                        dest_stock_query = {
                            'part_id': part_id,
                            'location_id': destination_id,
                            'batch_code': source_stock.get('batch_code', ''),
                            'state_id': source_stock.get('state_id')
                        }
                        
                        dest_stock = stocks_collection.find_one(dest_stock_query)
                        
                        if dest_stock:
                            # Update existing stock
                            stocks_collection.update_one(
                                {'_id': dest_stock['_id']},
                                {
                                    '$inc': {'quantity': transfer_qty},
                                    '$set': {'updated_at': timestamp}
                                }
                            )
                        else:
                            # Create new stock entry at destination
                            new_stock = {
                                'part_id': part_id,
                                'location_id': destination_id,
                                'quantity': transfer_qty,
                                'batch_code': source_stock.get('batch_code', ''),
                                'supplier_batch_code': source_stock.get('supplier_batch_code', ''),
                                'serial_numbers': source_stock.get('serial_numbers', ''),
                                'packaging': source_stock.get('packaging', ''),
                                'state_id': source_stock.get('state_id'),
                                'notes': f"Transferred from request {request_doc.get('reference', request_id)}",
                                'supplier_id': source_stock.get('supplier_id'),
                                'supplier_um_id': source_stock.get('supplier_um_id'),
                                'manufacturing_date': source_stock.get('manufacturing_date'),
                                'expiry_date': source_stock.get('expiry_date'),
                                'reset_date': source_stock.get('reset_date'),
                                'created_at': timestamp,
                                'updated_at': timestamp,
                                'created_by': current_user.get('username'),
                                'updated_by': current_user.get('username'),
                                'request_id': req_obj_id,
                                'request_reference': request_doc.get('reference')
                            }
                            stocks_collection.insert_one(new_stock)
                        
                        # Log the movement
                        db.logs.insert_one({
                            'collection': 'depo_stocks',
                            'action': 'stock_transfer',
                            'request_id': request_id,
                            'request_reference': request_doc.get('reference'),
                            'part_id': str(part_id),
                            'quantity': transfer_qty,
                            'from_location': str(source_id),
                            'to_location': str(destination_id),
                            'batch_code': source_stock.get('batch_code', ''),
                            'user': current_user.get('username'),
                            'timestamp': timestamp
                        })
                        
                        remaining_qty -= transfer_qty
                        movements_created += 1
                    
                    if remaining_qty > 0:
                        print(f"[REQUESTS] Warning: Could not transfer full quantity for part {part_id}. Remaining: {remaining_qty}")
                
                print(f"[REQUESTS] Created {movements_created} stock movements for request {request_id}")
                
            except Exception as e:
                print(f"[REQUESTS] Error creating stock movements: {e}")
                import traceback
                traceback.print_exc()
                # Don't fail the status update if stock movement fails
        
        return {
            "message": f"State updated to {state.get('name')}",
            "state_id": str(state_id),
            "state_name": state.get('name')
        }
    except Exception as e:
        print(f"[REQUESTS] Error updating reception decision: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update reception decision: {str(e)}")
