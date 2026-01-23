"""
DEPO Procurement Module - Approval Flow Services
"""
from fastapi import HTTPException
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.models.approval_flow_model import ApprovalFlowModel
from src.backend.utils.approval_helpers import check_approval_completion, check_user_can_sign
from ..utils import serialize_doc


async def get_order_approval_flow(order_id: str):
    """Get approval flow for a purchase order"""
    db = get_db()
    
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": ObjectId(order_id)
    })
    
    if not flow:
        return {"flow": None}
    
    flow["_id"] = str(flow["_id"])
    
    for signature in flow.get("signatures", []):
        user = db.users.find_one({"_id": ObjectId(signature["user_id"])})
        if user:
            signature["user_name"] = user.get("name") or user.get("username")
    
    return {"flow": serialize_doc(flow)}


async def create_order_approval_flow(order_id: str):
    """Create approval flow for a purchase order using approval_templates"""
    db = get_db()
    
    existing = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": ObjectId(order_id)
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Approval flow already exists for this order")
    
    # Get approval template
    templates_collection = db['approval_templates']
    approval_template = templates_collection.find_one({
        'object_type': 'procurement_order',
        'active': True
    })
    
    if not approval_template:
        raise HTTPException(status_code=404, detail="No active approval template found for procurement orders")
    
    officers = approval_template.get('officers', [])
    
    # Separate officers by action type
    required_officers = []
    optional_officers = []
    
    for officer in officers:
        officer_data = {
            "type": officer.get('type'),
            "reference": officer.get('reference'),
            "action": officer.get('action'),
            "order": officer.get('order', 0)
        }
        
        if officer.get('action') == 'must_sign':
            required_officers.append(officer_data)
        elif officer.get('action') == 'can_sign':
            optional_officers.append(officer_data)
    
    # Sort by order
    required_officers.sort(key=lambda x: x.get('order', 0))
    optional_officers.sort(key=lambda x: x.get('order', 0))
    
    # Count minimum signatures (number of must_sign officers)
    min_signatures = len(required_officers)
    
    flow_data = {
        "object_type": "procurement_order",
        "object_source": "depo_procurement",
        "object_id": ObjectId(order_id),
        "template_id": str(approval_template['_id']),
        "template_name": approval_template.get('name'),
        "min_signatures": min_signatures,
        "required_officers": required_officers,
        "optional_officers": optional_officers,
        "signatures": [],
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = db.approval_flows.insert_one(flow_data)
    flow_data["_id"] = str(result.inserted_id)
    
    return serialize_doc(flow_data)


async def sign_purchase_order(order_id: str, action: str, current_user: dict, request_client_host: str, request_user_agent: str):
    """Sign a purchase order approval flow"""
    db = get_db()

    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": ObjectId(order_id)
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this order")
    
    user_id = str(current_user["_id"])
    existing_signature = next(
        (s for s in flow.get("signatures", []) if s["user_id"] == user_id),
        None
    )
    
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this order")
    
    username = current_user["username"]
    user_role_id = current_user.get("role")
    
    can_sign = check_user_can_sign(
        db,
        user_id,
        user_role_id,
        flow.get("required_officers", []),
        flow.get("optional_officers", [])
    )
    
    if not can_sign:
        raise HTTPException(status_code=403, detail="You are not authorized to sign this order")
    
    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="procurement_order",
        object_id=order_id,
        timestamp=timestamp
    )
    
    signature = {
        "user_id": user_id,
        "username": username,
        "signed_at": timestamp,
        "signature_hash": signature_hash,
        "ip_address": request_client_host,
        "user_agent": request_user_agent
    }
    
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
    
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    required_officers = updated_flow.get("required_officers", [])
    signatures = updated_flow.get("signatures", [])
    
    is_complete, required_signed, required_count = check_approval_completion(
        db,
        required_officers,
        signatures
    )
    
    # Change order state based on action (immediately after first signature)
    if action == 'issue':
        # ISSUED state: 6943a4a6451609dd8a618cdf
        target_state = db['depo_purchase_orders_states'].find_one({'_id': ObjectId('6943a4a6451609dd8a618cdf')})
        if not target_state:
            target_state = db['depo_purchase_orders_states'].find_one({'name': 'Issued'})
    elif action == 'cancel':
        # CANCELLED state: 6943a4a6451609dd8a618ce2
        target_state = db['depo_purchase_orders_states'].find_one({'_id': ObjectId('6943a4a6451609dd8a618ce2')})
        if not target_state:
            target_state = db['depo_purchase_orders_states'].find_one({'name': 'Cancelled'})
    else:
        target_state = None
    
    if target_state:
        db['depo_purchase_orders'].update_one(
            {'_id': ObjectId(order_id)},
            {
                '$set': {
                    'state_id': target_state['_id'],
                    'updated_at': timestamp,
                    'signed_at': timestamp,
                    'signed_by': username,
                    'sign_action': action
                },
                '$unset': {
                    'status': ''  # Remove old status field
                }
            }
        )
    
    # Update approval flow status
    if is_complete:
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
    
    flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    return serialize_doc(flow)


async def remove_order_signature(order_id: str, user_id: str, current_user: dict):
    """Remove signature from purchase order approval flow (admin only)"""
    db = get_db()
    
    is_admin = current_user.get('is_staff', False) or current_user.get('is_superuser', False)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admin can remove signatures")
    
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": ObjectId(order_id)
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this order")
    
    result = db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$pull": {"signatures": {"user_id": user_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    if len(updated_flow.get("signatures", [])) == 0:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {"$set": {"status": "pending"}}
        )
    
    return {"message": "Signature removed successfully"}
