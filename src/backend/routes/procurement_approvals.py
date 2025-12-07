"""
Procurement Approval Integration
Endpoints for integrating procurement orders with the global approval system
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from datetime import datetime
from bson import ObjectId

from ..utils.db import get_db
from ..routes.auth import verify_admin, verify_token
from ..models.approval_flow_model import ApprovalFlowModel

router = APIRouter(prefix="/api/procurement", tags=["procurement-approvals"])


async def get_current_user(authorization: Optional[str] = None):
    """Get current user from token"""
    from fastapi import Header
    return await verify_token(authorization)


@router.get("/purchase-orders/{order_id}/approval-flow")
async def get_order_approval_flow(
    order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get approval flow for a purchase order"""
    db = get_db()
    
    # Find approval flow for this order
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": str(order_id)
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


@router.post("/purchase-orders/{order_id}/approval-flow")
async def create_order_approval_flow(
    order_id: int,
    current_user: dict = Depends(verify_admin)
):
    """Create approval flow for a purchase order"""
    db = get_db()
    
    # Check if flow already exists
    existing = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": str(order_id)
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Approval flow already exists for this order")
    
    # Find active template for procurement orders
    template = db.approval_templates.find_one({
        "object_type": "procurement_order",
        "active": True
    })
    
    if not template:
        raise HTTPException(status_code=404, detail="No active approval template found for procurement orders")
    
    # Separate required and optional officers
    required_officers = []
    optional_officers = []
    
    for officer in template.get("officers", []):
        if officer.get("action") == "must_sign":
            required_officers.append(officer)
        else:
            optional_officers.append(officer)
    
    flow_data = {
        "object_type": "procurement_order",
        "object_source": "depo_procurement",
        "object_id": str(order_id),
        "template_id": str(template["_id"]),
        "required_officers": required_officers,
        "optional_officers": optional_officers,
        "signatures": [],
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = db.approval_flows.insert_one(flow_data)
    
    flow_data["_id"] = str(result.inserted_id)
    
    return flow_data


@router.post("/purchase-orders/{order_id}/sign")
async def sign_purchase_order(
    order_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Sign a purchase order approval flow"""
    import yaml
    import os
    import requests
    
    db = get_db()
    
    # Load config for InvenTree URL
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'config', 'config.yaml')
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    inventree_url = config['inventree']['url'].rstrip('/')
    
    # Get approval flow
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": str(order_id)
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this order")
    
    # Check if already signed
    user_id = str(current_user["_id"])
    existing_signature = next(
        (s for s in flow.get("signatures", []) if s["user_id"] == user_id),
        None
    )
    
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this order")
    
    # Check if user is authorized to sign
    username = current_user["username"]
    can_sign = False
    
    # Check required officers
    for officer in flow.get("required_officers", []):
        if officer["type"] == "person" and officer["reference"] == user_id:
            can_sign = True
            break
        elif officer["type"] == "role":
            # Check if user has this role
            user_role = current_user.get("role") or current_user.get("local_role")
            if user_role:
                role = db.roles.find_one({"_id": ObjectId(user_role)})
                if role and role.get("name") == officer["reference"]:
                    can_sign = True
                    break
    
    # Check optional officers
    if not can_sign:
        for officer in flow.get("optional_officers", []):
            if officer["type"] == "person" and officer["reference"] == user_id:
                can_sign = True
                break
            elif officer["type"] == "role":
                user_role = current_user.get("role") or current_user.get("local_role")
                if user_role:
                    role = db.roles.find_one({"_id": ObjectId(user_role)})
                    if role and role.get("name") == officer["reference"]:
                        can_sign = True
                        break
    
    if not can_sign:
        raise HTTPException(status_code=403, detail="You are not authorized to sign this order")
    
    # Generate signature
    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="procurement_order",
        object_id=str(order_id),
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
    
    # Check if all required signatures are collected
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    required_count = len(updated_flow.get("required_officers", []))
    
    # Count how many required officers have signed
    required_signed = 0
    print(f"[PROCUREMENT] Checking signatures for order {order_id}")
    print(f"[PROCUREMENT] Required officers: {updated_flow.get('required_officers', [])}")
    print(f"[PROCUREMENT] Signatures: {len(updated_flow.get('signatures', []))}")
    
    for officer in updated_flow.get("required_officers", []):
        if officer["type"] == "person":
            if any(s["user_id"] == officer["reference"] for s in updated_flow.get("signatures", [])):
                required_signed += 1
                print(f"[PROCUREMENT] Person {officer['reference']} has signed")
        elif officer["type"] == "role":
            # Check if any user with this role has signed
            role_name = officer["reference"]
            print(f"[PROCUREMENT] Checking role: {role_name}")
            
            # Find role by name
            role = db.roles.find_one({"name": role_name})
            if role:
                print(f"[PROCUREMENT] Found role {role_name} with ID {role['_id']}")
                for sig in updated_flow.get("signatures", []):
                    signer = db.users.find_one({"_id": ObjectId(sig["user_id"])})
                    if signer:
                        signer_role_id = signer.get("role") or signer.get("local_role")
                        print(f"[PROCUREMENT] Signer {signer.get('username')} has role: {signer_role_id}")
                        
                        # Compare role IDs (handle both string and ObjectId)
                        if signer_role_id:
                            if str(signer_role_id) == str(role["_id"]):
                                required_signed += 1
                                print(f"[PROCUREMENT] Role {role_name} requirement satisfied by {signer.get('username')}")
                                break
            else:
                print(f"[PROCUREMENT] WARNING: Role {role_name} not found in database")
    
    print(f"[PROCUREMENT] Required signatures: {required_count}, Collected: {required_signed}")
    
    # If all required officers have signed, mark as approved AND issue order (place it)
    if required_signed == required_count:
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
        
        # Issue order (place it) - InvenTree 1.0.1 requires using /issue/ endpoint
        try:
            token = current_user.get('token')
            if token:
                headers = {
                    'Authorization': f'Token {token}',
                    'Content-Type': 'application/json'
                }
                print(f"[PROCUREMENT] Issuing (placing) order {order_id}")
                response = requests.post(
                    f"{inventree_url}/api/order/po/{order_id}/issue/",
                    headers=headers,
                    json={},  # Empty payload for issue
                    timeout=10
                )
                response.raise_for_status()
                print(f"[PROCUREMENT] Order {order_id} issued successfully - status is now PLACED")
        except Exception as e:
            print(f"[PROCUREMENT] ERROR: Failed to issue order: {e}")
            if hasattr(e, 'response') and hasattr(e.response, 'text'):
                print(f"[PROCUREMENT] Response: {e.response.text}")
            # Don't raise exception, just log it
    
    # Get updated flow
    flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    flow["_id"] = str(flow["_id"])
    
    return flow


@router.delete("/purchase-orders/{order_id}/signatures/{user_id}")
async def remove_order_signature(
    order_id: int,
    user_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Remove signature from purchase order approval flow (admin only)"""
    db = get_db()
    
    # Get flow
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": str(order_id)
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this order")
    
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
    
    # Update status back to pending if no signatures left
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    if len(updated_flow.get("signatures", [])) == 0:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {"$set": {"status": "pending"}}
        )
    
    return {"message": "Signature removed successfully"}
