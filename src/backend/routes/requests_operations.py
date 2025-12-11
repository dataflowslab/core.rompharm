"""
Operations and Reception flows for stock transfer requests
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from bson import ObjectId

from ..utils.db import get_db
from ..models.approval_flow_model import ApprovalFlowModel
from .auth import verify_admin

router = APIRouter(prefix="/api/requests", tags=["requests-operations"])


class OperationsStatusUpdate(BaseModel):
    status: str  # Finished or Refused
    reason: Optional[str] = None


# ==================== OPERATIONS FLOW ====================

@router.get("/{request_id}/operations-flow")
async def get_operations_flow(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Get operations flow for a request"""
    db = get_db()
    
    # Find operations flow
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


@router.post("/{request_id}/operations-flow")
async def create_operations_flow(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Create operations flow using config from MongoDB"""
    db = get_db()
    
    # Check if flow already exists
    existing = db.approval_flows.find_one({
        "object_type": "stock_request_operations",
        "object_id": request_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Operations flow already exists")
    
    # Get config
    config_collection = db['config']
    ops_config = config_collection.find_one({'slug': 'requests_operations_flow'})
    
    if not ops_config or 'items' not in ops_config:
        raise HTTPException(status_code=404, detail="No operations config found")
    
    # Find operations flow config
    flow_config = None
    for item in ops_config.get('items', []):
        if item.get('slug') == 'operations' and item.get('enabled', True):
            flow_config = item
            break
    
    if not flow_config:
        raise HTTPException(status_code=404, detail="No enabled operations flow found")
    
    # Build officers lists
    can_sign_officers = []
    for user in flow_config.get('can_sign', []):
        can_sign_officers.append({
            "type": "person",
            "reference": user.get('user_id'),
            "username": user.get('username'),
            "action": "can_sign"
        })
    
    must_sign_officers = []
    for user in flow_config.get('must_sign', []):
        must_sign_officers.append({
            "type": "person",
            "reference": user.get('user_id'),
            "username": user.get('username'),
            "action": "must_sign"
        })
    
    flow_data = {
        "object_type": "stock_request_operations",
        "object_source": "depo_request",
        "object_id": request_id,
        "flow_type": "operations",
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


@router.post("/{request_id}/operations-sign")
async def sign_operations(
    request_id: str,
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Sign operations flow"""
    db = get_db()
    
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_operations",
        "object_id": request_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No operations flow found")
    
    user_id = str(current_user["_id"])
    
    # Check if already signed
    if any(s["user_id"] == user_id for s in flow.get("signatures", [])):
        raise HTTPException(status_code=400, detail="You have already signed")
    
    # Check authorization
    can_sign = any(o["reference"] == user_id for o in flow.get("can_sign_officers", []))
    must_sign = any(o["reference"] == user_id for o in flow.get("must_sign_officers", []))
    
    if not (can_sign or must_sign):
        raise HTTPException(status_code=403, detail="You are not authorized to sign")
    
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
        "username": current_user["username"],
        "signed_at": timestamp,
        "signature_hash": signature_hash,
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent")
    }
    
    # Add signature
    db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$push": {"signatures": signature},
            "$set": {"status": "in_progress", "updated_at": timestamp}
        }
    )
    
    # Check if complete
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    signatures = updated_flow.get("signatures", [])
    signature_user_ids = [s["user_id"] for s in signatures]
    
    # Check conditions
    must_sign_officers = updated_flow.get("must_sign_officers", [])
    all_must_signed = all(o["reference"] in signature_user_ids for o in must_sign_officers)
    
    can_sign_officers = updated_flow.get("can_sign_officers", [])
    min_signatures = updated_flow.get("min_signatures", 1)
    can_sign_count = sum(1 for o in can_sign_officers if o["reference"] in signature_user_ids)
    
    if all_must_signed and can_sign_count >= min_signatures:
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
    
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_operations",
        "object_id": request_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No operations flow found")
    
    result = db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$pull": {"signatures": {"user_id": user_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    # Update status if no signatures left
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
    status_data: OperationsStatusUpdate,
    current_user: dict = Depends(verify_admin)
):
    """Update request status after operations (Finished/Refused)"""
    db = get_db()
    requests_collection = db['depo_requests_items']
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    req = requests_collection.find_one({'_id': req_obj_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Validate status
    if status_data.status not in ['Finished', 'Refused']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Require reason for Refused
    if status_data.status == 'Refused' and not status_data.reason:
        raise HTTPException(status_code=400, detail="Reason required for refusal")
    
    # Update request
    update_data = {
        'status': status_data.status,
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username')
    }
    
    if status_data.reason:
        update_data['operations_refusal_reason'] = status_data.reason
    
    if status_data.status == 'Finished':
        update_data['operations_completed_at'] = datetime.utcnow()
        update_data['operations_completed_by'] = current_user.get('username')
    
    requests_collection.update_one(
        {'_id': req_obj_id},
        {'$set': update_data}
    )
    
    print(f"[REQUESTS] Request {request_id} operations status updated to {status_data.status}")
    
    return {"success": True, "status": status_data.status}


# ==================== RECEPTION FLOW ====================

@router.get("/{request_id}/reception-flow")
async def get_reception_flow(
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
    
    # Get user details for signatures
    for signature in flow.get("signatures", []):
        user = db.users.find_one({"_id": ObjectId(signature["user_id"])})
        if user:
            signature["user_name"] = user.get("name") or user.get("username")
    
    return {"flow": flow}


@router.post("/{request_id}/reception-flow")
async def create_reception_flow(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Create reception flow using config from MongoDB"""
    db = get_db()
    
    # Check if flow already exists
    existing = db.approval_flows.find_one({
        "object_type": "stock_request_reception",
        "object_id": request_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Reception flow already exists")
    
    # Get config
    config_collection = db['config']
    ops_config = config_collection.find_one({'slug': 'requests_operations_flow'})
    
    if not ops_config or 'items' not in ops_config:
        raise HTTPException(status_code=404, detail="No reception config found")
    
    # Find reception flow config
    flow_config = None
    for item in ops_config.get('items', []):
        if item.get('slug') == 'receiving' and item.get('enabled', True):
            flow_config = item
            break
    
    if not flow_config:
        raise HTTPException(status_code=404, detail="No enabled reception flow found")
    
    # Build officers lists
    can_sign_officers = []
    for user in flow_config.get('can_sign', []):
        can_sign_officers.append({
            "type": "person",
            "reference": user.get('user_id'),
            "username": user.get('username'),
            "action": "can_sign"
        })
    
    must_sign_officers = []
    for user in flow_config.get('must_sign', []):
        must_sign_officers.append({
            "type": "person",
            "reference": user.get('user_id'),
            "username": user.get('username'),
            "action": "must_sign"
        })
    
    flow_data = {
        "object_type": "stock_request_reception",
        "object_source": "depo_request",
        "object_id": request_id,
        "flow_type": "reception",
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


@router.post("/{request_id}/reception-sign")
async def sign_reception(
    request_id: str,
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Sign reception flow"""
    db = get_db()
    requests_collection = db['depo_requests_items']
    
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_reception",
        "object_id": request_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No reception flow found")
    
    user_id = str(current_user["_id"])
    
    # Check if already signed
    if any(s["user_id"] == user_id for s in flow.get("signatures", [])):
        raise HTTPException(status_code=400, detail="You have already signed")
    
    # Check authorization
    can_sign = any(o["reference"] == user_id for o in flow.get("can_sign_officers", []))
    must_sign = any(o["reference"] == user_id for o in flow.get("must_sign_officers", []))
    
    if not (can_sign or must_sign):
        raise HTTPException(status_code=403, detail="You are not authorized to sign")
    
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
        "username": current_user["username"],
        "signed_at": timestamp,
        "signature_hash": signature_hash,
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent")
    }
    
    # Add signature
    db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$push": {"signatures": signature},
            "$set": {"status": "in_progress", "updated_at": timestamp}
        }
    )
    
    # Check if complete
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    signatures = updated_flow.get("signatures", [])
    signature_user_ids = [s["user_id"] for s in signatures]
    
    # Check conditions
    must_sign_officers = updated_flow.get("must_sign_officers", [])
    all_must_signed = all(o["reference"] in signature_user_ids for o in must_sign_officers)
    
    can_sign_officers = updated_flow.get("can_sign_officers", [])
    min_signatures = updated_flow.get("min_signatures", 1)
    can_sign_count = sum(1 for o in can_sign_officers if o["reference"] in signature_user_ids)
    
    if all_must_signed and can_sign_count >= min_signatures:
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
        
        # Update request status to "Completed"
        try:
            req_obj_id = ObjectId(request_id)
            requests_collection.update_one(
                {"_id": req_obj_id},
                {
                    "$set": {
                        "status": "Completed",
                        "reception_completed_at": timestamp,
                        "reception_completed_by": current_user.get('username'),
                        "updated_at": timestamp
                    }
                }
            )
            print(f"[REQUESTS] Request {request_id} reception completed")
        except Exception as e:
            print(f"[REQUESTS] Warning: Failed to update request status: {e}")
    
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
    
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_reception",
        "object_id": request_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No reception flow found")
    
    result = db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$pull": {"signatures": {"user_id": user_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    # Update status if no signatures left
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    if len(updated_flow.get("signatures", [])) == 0:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {"$set": {"status": "pending"}}
        )
    
    return {"message": "Signature removed successfully"}


@router.patch("/{request_id}/reception-status")
async def update_reception_status(
    request_id: str,
    status_data: OperationsStatusUpdate,
    current_user: dict = Depends(verify_admin)
):
    """Update request status after reception (Approved/Refused)"""
    db = get_db()
    requests_collection = db['depo_requests_items']
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    req = requests_collection.find_one({'_id': req_obj_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Validate status
    if status_data.status not in ['Approved', 'Refused']:
        raise HTTPException(status_code=400, detail="Invalid status. Use Approved or Refused")
    
    # Require reason for Refused
    if status_data.status == 'Refused' and not status_data.reason:
        raise HTTPException(status_code=400, detail="Reason required for refusal")
    
    # Update request
    update_data = {
        'reception_status': status_data.status,
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username')
    }
    
    if status_data.reason:
        update_data['reception_refusal_reason'] = status_data.reason
    
    if status_data.status == 'Approved':
        update_data['status'] = 'Completed'
        update_data['reception_approved_at'] = datetime.utcnow()
        update_data['reception_approved_by'] = current_user.get('username')
    
    requests_collection.update_one(
        {'_id': req_obj_id},
        {'$set': update_data}
    )
    
    print(f"[REQUESTS] Request {request_id} reception status updated to {status_data.status}")
    
    return {"success": True, "status": status_data.status}
