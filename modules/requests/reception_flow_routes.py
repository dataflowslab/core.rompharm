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
    can_sign = False
    
    for officer in flow.get("can_sign_officers", []):
        if officer["reference"] == user_id:
            can_sign = True
            break
    
    if not can_sign:
        for officer in flow.get("must_sign_officers", []):
            if officer["reference"] == user_id:
                can_sign = True
                break
    
    if not can_sign:
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
    
    if status not in ['Approved', 'Refused']:
        raise HTTPException(status_code=400, detail="Status must be 'Approved' or 'Refused'")
    
    try:
        req_obj_id = ObjectId(request_id)
        update_data = {
            'reception_result': status,
            'reception_result_updated_at': datetime.utcnow(),
            'reception_result_updated_by': current_user.get('username'),
            'updated_at': datetime.utcnow()
        }
        
        if status == 'Refused':
            update_data['reception_result_reason'] = reason
            update_data['status'] = 'Warehouse Transfer Refused'
        else:
            update_data['reception_result_reason'] = ''
            update_data['status'] = 'Stock Received'
        
        requests_collection.update_one(
            {'_id': req_obj_id},
            {'$set': update_data}
        )
        
        print(f"[REQUESTS] Request {request_id} reception decision set to {status}")
        
        return {
            "message": f"Reception decision set to {status}",
            "status": status,
            "reception_result": status
        }
    except Exception as e:
        print(f"[REQUESTS] Error updating reception decision: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update reception decision: {str(e)}")
