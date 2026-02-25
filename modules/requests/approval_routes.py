"""
Approval flow routes for requests module
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_admin
from src.backend.models.approval_flow_model import ApprovalFlowModel

from .approval_helpers import get_state_by_slug, update_request_state, check_flow_completion, get_flow_config, build_officers_lists
from .reception_flow_routes import router as reception_router
from .production_routes import router as production_router


router = APIRouter()

# Include reception and production flow routes
router.include_router(reception_router)
router.include_router(production_router)


# ==================== APPROVAL FLOW ====================

@router.get("/{request_id}/approval-flow")
async def get_request_approval_flow(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Get approval flow for a request"""
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
    is_staff = current_user.get("is_staff", False)
    can_sign = False
    
    # Check can_sign officers
    for officer in flow.get("can_sign_officers", []):
        # Direct user_id match
        if officer.get("reference") == user_id:
            can_sign = True
            break
        # Fallback to username match (in case references are missing)
        if officer.get("username") and officer.get("username") == username:
            can_sign = True
            break
        # Role-based match (admin)
        if officer.get("type") == "role" and officer.get("reference") == "admin" and is_staff:
            can_sign = True
            break
    
    # Check must_sign officers
    if not can_sign:
        for officer in flow.get("must_sign_officers", []):
            # Direct user_id match
            if officer.get("reference") == user_id:
                can_sign = True
                break
            # Fallback to username match
            if officer.get("username") and officer.get("username") == username:
                can_sign = True
                break
            # Role-based match (admin)
            if officer.get("type") == "role" and officer.get("reference") == "admin" and is_staff:
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
            update_request_state(db, request_id, "approved")
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


# ==================== OPERATIONS FLOW ====================

@router.get("/{request_id}/operations-flow")
async def get_request_operations_flow(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Get operations flow for a request"""
    db = get_db()
    
    # Find operations flow for this request
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_operations",
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


@router.post("/{request_id}/operations-sign")
async def sign_operations(
    request_id: str,
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Sign operations flow for a request"""
    db = get_db()
    requests_collection = db['depo_requests']
    
    # Get operations flow
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_operations",
        "object_id": request_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No operations flow found for this request")
    
    # Check if already signed
    user_id = str(current_user["_id"])
    existing_signature = next(
        (s for s in flow.get("signatures", []) if s["user_id"] == user_id),
        None
    )
    
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this operations flow")
    
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
        print(f"[REQUESTS] User {username} (staff={is_staff}) not authorized to sign operations. Officers: {flow.get('can_sign_officers', [])} + {flow.get('must_sign_officers', [])}")
        raise HTTPException(status_code=403, detail="You are not authorized to sign this operations flow")
    
    # Generate signature
    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="stock_request_operations",
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
    
    # If all conditions met, mark as approved
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
        
        # Update request state_id to "Warehouse signed"
        try:
            req_obj_id = ObjectId(request_id)
            warehouse_signed_state_id = ObjectId("694dec8e297c9dde6d706648")
            
            requests_collection.update_one(
                {"_id": req_obj_id},
                {"$set": {
                    "state_id": warehouse_signed_state_id,
                    "updated_at": timestamp
                }}
            )
            
            # Log the state change
            db.logs.insert_one({
                'collection': 'depo_requests',
                'object_id': request_id,
                'action': 'operations_signed',
                'state_id': str(warehouse_signed_state_id),
                'state_name': 'Warehouse signed',
                'user': username,
                'timestamp': timestamp
            })
            
            print(f"[REQUESTS] Operations flow approved for request {request_id}, state updated to Warehouse signed")
            
            # Auto-create reception flow from approval_templates
            try:
                existing_reception_flow = db.approval_flows.find_one({
                    "object_type": "stock_request_reception",
                    "object_id": request_id
                })
                
                if not existing_reception_flow:
                    # Get template from approval_templates
                    template_id = ObjectId("694877f8ec1cdc6fda1dd7d8")
                    template = db.approval_templates.find_one({"_id": template_id})
                    
                    if template:
                        # Map officers from template to can_sign_officers format
                        officers = template.get('officers', [])
                        can_sign_officers = []
                        for officer in officers:
                            can_sign_officers.append({
                                "type": officer.get('type', 'person'),
                                "reference": officer.get('reference', ''),
                                "username": officer.get('username', ''),
                                "action": "can_sign"
                            })
                        
                        reception_flow_data = {
                            "object_type": "stock_request_reception",
                            "object_source": "requests",
                            "object_id": request_id,
                            "template_id": str(template_id),
                            "name": template.get('name', 'Receiving Approval'),
                            "description": template.get('description', ''),
                            "can_sign_officers": can_sign_officers,
                            "must_sign_officers": [],
                            "min_signatures": 1,
                            "signatures": [],
                            "status": "pending",
                            "active": template.get('active', True),
                            "created_at": timestamp,
                            "updated_at": timestamp
                        }
                        
                        result = db.approval_flows.insert_one(reception_flow_data)
                        print(f"[REQUESTS] ✓ Auto-created reception flow for request {request_id} from template {template_id}")
                    else:
                        print(f"[REQUESTS] ERROR: Template {template_id} not found in approval_templates")
            except Exception as e:
                print(f"[REQUESTS] ERROR: Failed to auto-create reception flow: {e}")
                import traceback
                traceback.print_exc()
        except Exception as e:
            print(f"[REQUESTS] Warning: Failed to update state_id: {e}")
    
    # Get updated flow
    flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    flow["_id"] = str(flow["_id"])
    
    return flow


@router.delete("/{request_id}/operations-signatures/{user_id}")
async def remove_operations_signature(
    request_id: str,
    user_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Remove signature from operations flow (admin only)"""
    db = get_db()
    
    # Get flow
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_operations",
        "object_id": request_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No operations flow found for this request")
    
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
    
    return {"message": "Signature removed successfully"}


@router.patch("/{request_id}/operations-status")
async def update_operations_status(
    request_id: str,
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Update operations decision (can be set before all signatures)"""
    db = get_db()
    requests_collection = db['depo_requests']
    
    # Get request body
    body = await request.json()
    status = body.get('status')
    reason = body.get('reason', '')
    
    if not status:
        raise HTTPException(status_code=400, detail="Status is required")
    
    # Validate that status is a valid state ID with 'operations' scene
    try:
        state_id = ObjectId(status)
        state = db.depo_requests_states.find_one({"_id": state_id})
        
        if not state:
            raise HTTPException(status_code=400, detail="Invalid state ID")
        
        # Check if state has 'operations' in scenes
        if not state.get('scenes') or 'operations' not in state.get('scenes', []):
            raise HTTPException(status_code=400, detail="State must have 'operations' in scenes")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail="Invalid state ID format")
    
    # Update request state_id and add to status_log
    try:
        req_obj_id = ObjectId(request_id)
        state_id = ObjectId(status)
        timestamp = datetime.utcnow()
        
        # Create status log entry
        status_log_entry = {
            'status_id': state_id,
            'scene': 'operations',
            'created_at': timestamp,
            'created_by': current_user.get('username'),
            'reason': reason if reason else None
        }
        
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
        is_rejected = 'reject' in state.get('slug', '').lower()
        db.logs.insert_one({
            'collection': 'depo_requests',
            'object_id': request_id,
            'action': 'operations_decision',
            'state_id': str(state_id),
            'state_name': state.get('name'),
            'is_rejected': is_rejected,
            'reason': reason if is_rejected else '',
            'user': current_user.get('username'),
            'timestamp': timestamp
        })
        
        print(f"[REQUESTS] Request {request_id} state_id updated to {state.get('name')} ({status})")

        # Auto-sign operations after decision save (if current user can sign)
        auto_signed = False
        auto_sign_error = None
        try:
            flow = db.approval_flows.find_one({
                "object_type": "stock_request_operations",
                "object_id": request_id
            })
            if flow:
                existing_signature = next(
                    (s for s in flow.get("signatures", []) if s.get("user_id") == str(current_user["_id"])),
                    None
                )
                if not existing_signature:
                    try:
                        await sign_operations(request_id, request, current_user)
                        auto_signed = True
                    except HTTPException as e:
                        # Don't fail decision save if sign fails
                        if e.status_code == 400 and "already signed" in str(e.detail).lower():
                            auto_signed = True
                        else:
                            auto_sign_error = e.detail
                    except Exception as e:
                        auto_sign_error = str(e)
        except Exception as e:
            auto_sign_error = str(e)

        return {
            "message": f"State updated to {state.get('name')}",
            "state_id": str(state_id),
            "state_name": state.get('name'),
            "auto_signed": auto_signed,
            "auto_sign_error": auto_sign_error
        }
    except Exception as e:
        print(f"[REQUESTS] Error updating operations decision: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update operations decision: {str(e)}")


#
