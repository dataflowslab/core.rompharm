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
                # Use existing production flow ID from config
                production_flow_id = ObjectId("694a1ae3297c9dde6d70661a")
                
                # Get the existing flow to copy its configuration
                existing_flow = db.approval_flows.find_one({"_id": production_flow_id})
                
                if existing_flow:
                    # Build officers lists from existing flow
                    can_sign_officers = existing_flow.get('can_sign_officers', [])
                    must_sign_officers = existing_flow.get('must_sign_officers', [])
                    
                    production_flow_data = {
                        "object_type": "stock_request_production",
                        "object_source": "depo_request",
                        "object_id": request_id,
                        "flow_type": "production",
                        "config_slug": existing_flow.get('config_slug', 'production'),
                        "min_signatures": existing_flow.get('min_signatures', 1),
                        "can_sign_officers": can_sign_officers,
                        "must_sign_officers": must_sign_officers,
                        "signatures": [],
                        "status": "pending",
                        "created_at": timestamp,
                        "updated_at": timestamp
                    }
                    
                    db.approval_flows.insert_one(production_flow_data)
                    print(f"[REQUESTS] Auto-created production flow for request {request_id}")
                else:
                    print(f"[REQUESTS] Warning: Production flow template {production_flow_id} not found")
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
        
        # Update state_id and add to status_log
        update_data = {
            'state_id': state_id,
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
        
        return {
            "message": f"State updated to {state.get('name')}",
            "state_id": str(state_id),
            "state_name": state.get('name')
        }
    except Exception as e:
        print(f"[REQUESTS] Error updating reception decision: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update reception decision: {str(e)}")
