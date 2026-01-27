"""
DEPO Procurement Module - Received Stock Approval Flow Services
Handles signature flow for received stock
"""
from fastapi import HTTPException
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.models.approval_flow_model import ApprovalFlowModel
from src.backend.utils.approval_helpers import check_approval_completion, check_user_can_sign
from ..utils import serialize_doc


async def get_received_stock_approval_flow(order_id: str):
    """Get approval flow for received stock"""
    db = get_db()
    
    flow = db.approval_flows.find_one({
        "object_type": "received_stock",
        "object_id": ObjectId(order_id)
    })
    
    if not flow:
        return {"flow": None}
    
    flow["_id"] = str(flow["_id"])
    
    # Enrich signatures with user names
    for signature in flow.get("signatures", []):
        user = db.users.find_one({"_id": ObjectId(signature["user_id"])})
        if user:
            signature["user_name"] = user.get("name") or user.get("username")
    
    return {"flow": serialize_doc(flow)}


async def create_received_stock_approval_flow(order_id: str):
    """Create approval flow for received stock using approval_templates"""
    db = get_db()
    
    # Check if flow already exists
    existing = db.approval_flows.find_one({
        "object_type": "received_stock",
        "object_id": ObjectId(order_id)
    })
    
    if existing:
        return serialize_doc(existing)  # Return existing flow
    
    # Get approval template for received stock (oid: 69792b3ff8165bc859d6f2df)
    templates_collection = db['approval_templates']
    approval_template = templates_collection.find_one({
        '_id': ObjectId('69792b3ff8165bc859d6f2df')
    })
    
    if not approval_template:
        raise HTTPException(status_code=404, detail="No approval template found for received stock")
    
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
        "object_type": "received_stock",
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


async def sign_received_stock(order_id: str, target_state_id: str, current_user: dict, request_client_host: str, request_user_agent: str):
    """Sign received stock approval flow"""
    db = get_db()
    
    # Get or create approval flow
    flow = db.approval_flows.find_one({
        "object_type": "received_stock",
        "object_id": ObjectId(order_id)
    })
    
    if not flow:
        # Auto-create approval flow
        flow_result = await create_received_stock_approval_flow(order_id)
        flow = db.approval_flows.find_one({
            "object_type": "received_stock",
            "object_id": ObjectId(order_id)
        })
    
    if not flow:
        raise HTTPException(status_code=500, detail="Failed to create approval flow")
    
    # Check if user already signed
    user_id = str(current_user["_id"])
    existing_signature = next(
        (s for s in flow.get("signatures", []) if s["user_id"] == user_id),
        None
    )
    
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this received stock")
    
    # Check if user can sign
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
        raise HTTPException(status_code=403, detail="You are not authorized to sign this received stock")
    
    # Validate target state
    if not target_state_id:
        raise HTTPException(status_code=400, detail="Target state is required")
    
    target_state = db['depo_purchase_orders_states'].find_one({'_id': ObjectId(target_state_id)})
    if not target_state:
        raise HTTPException(status_code=400, detail="Invalid target state")
    
    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="received_stock",
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
    
    # Update approval flow with signature
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
    
    # Update purchase order state
    db['depo_purchase_orders'].update_one(
        {'_id': ObjectId(order_id)},
        {
            '$set': {
                'state_id': target_state['_id'],
                'updated_at': timestamp,
                'received_signed_at': timestamp,
                'received_signed_by': username
            }
        }
    )
    
    # Check if approval is complete
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    required_officers = updated_flow.get("required_officers", [])
    signatures = updated_flow.get("signatures", [])
    
    is_complete, required_signed, required_count = check_approval_completion(
        db,
        required_officers,
        signatures
    )
    
    # Update approval flow status if complete
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


async def remove_received_stock_signature(order_id: str, user_id: str, current_user: dict):
    """Remove signature from received stock approval flow"""
    db = get_db()
    
    # Check if user is admin or the one who signed
    is_admin = current_user.get('is_staff', False) or current_user.get('is_superuser', False)
    current_user_id = str(current_user["_id"])
    
    if not is_admin and current_user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only remove your own signature or be an admin")
    
    # Get approval flow
    flow = db.approval_flows.find_one({
        "object_type": "received_stock",
        "object_id": ObjectId(order_id)
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this received stock")
    
    # Remove signature
    result = db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$pull": {"signatures": {"user_id": user_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    # Check if all signatures removed
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    if len(updated_flow.get("signatures", [])) == 0:
        # Reset approval flow status
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {"$set": {"status": "pending"}}
        )
        
        # Reset purchase order received signature data
        db['depo_purchase_orders'].update_one(
            {'_id': ObjectId(order_id)},
            {
                '$unset': {
                    'received_signed_at': '',
                    'received_signed_by': ''
                },
                '$set': {
                    'updated_at': datetime.utcnow()
                }
            }
        )
    
    return {"message": "Signature removed successfully"}
