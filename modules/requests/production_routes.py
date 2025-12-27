"""
Production routes for requests module
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime
from bson import ObjectId
from typing import List, Optional

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_admin


router = APIRouter()


@router.get("/{request_id}/production")
async def get_production_data(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Get production data for a request"""
    db = get_db()
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    # Get production data
    production = db.depo_production.find_one({'request_id': req_obj_id})
    
    if not production:
        return None
    
    # Convert ObjectIds to strings
    production['_id'] = str(production['_id'])
    production['request_id'] = str(production['request_id'])
    
    # Convert ObjectIds in series materials if present
    if 'series' in production and production['series']:
        for serie in production['series']:
            if 'materials' in serie:
                for material in serie['materials']:
                    # Convert part ObjectId to string if it's an ObjectId
                    if 'part' in material and isinstance(material['part'], ObjectId):
                        material['part'] = str(material['part'])
    
    # Convert datetime to ISO format
    if 'created_at' in production and isinstance(production['created_at'], datetime):
        production['created_at'] = production['created_at'].isoformat()
    if 'updated_at' in production and isinstance(production['updated_at'], datetime):
        production['updated_at'] = production['updated_at'].isoformat()
    
    return production


@router.post("/{request_id}/production")
async def save_production_data(
    request_id: str,
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Save or update production data with series and materials"""
    db = get_db()
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    # Get request body
    body = await request.json()
    series = body.get('series', [])  # Array of {batch_code, materials: [{part, batch, received_qty, used_qty}]}
    
    # Check if production data exists
    existing = db.depo_production.find_one({'request_id': req_obj_id})
    
    timestamp = datetime.utcnow()
    
    if existing:
        # Update existing
        update_data = {
            'series': series,
            'updated_at': timestamp,
            'updated_by': current_user.get('username')
        }
        
        db.depo_production.update_one(
            {'_id': existing['_id']},
            {'$set': update_data}
        )
        
        production_id = str(existing['_id'])
    else:
        # Create new
        production_data = {
            'request_id': req_obj_id,
            'series': series,
            'created_at': timestamp,
            'created_by': current_user.get('username'),
            'updated_at': timestamp,
            'updated_by': current_user.get('username')
        }
        
        result = db.depo_production.insert_one(production_data)
        production_id = str(result.inserted_id)
    
    return {
        "success": True,
        "production_id": production_id,
        "message": "Production data saved successfully"
    }


@router.patch("/{request_id}/production-status")
async def update_production_status(
    request_id: str,
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Update production status"""
    db = get_db()
    requests_collection = db['depo_requests']
    
    body = await request.json()
    status = body.get('status')
    reason = body.get('reason', '')
    
    if not status:
        raise HTTPException(status_code=400, detail="Status is required")
    
    # Validate that status is a valid state ID with 'production' scene
    try:
        state_id = ObjectId(status)
        state = db.depo_requests_states.find_one({"_id": state_id})
        
        if not state:
            raise HTTPException(status_code=400, detail="Invalid state ID")
        
        # Check if state has 'production' in scenes
        if not state.get('scenes') or 'production' not in state.get('scenes', []):
            raise HTTPException(status_code=400, detail="State must have 'production' in scenes")
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
            'scene': 'production',
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
        is_canceled = str(state_id) == '67890abc1234567890abcde9'
        db.logs.insert_one({
            'collection': 'depo_requests',
            'object_id': request_id,
            'action': 'production_decision',
            'state_id': str(state_id),
            'state_name': state.get('name'),
            'is_canceled': is_canceled,
            'reason': reason if is_canceled else '',
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
        print(f"[REQUESTS] Error updating production decision: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update production decision: {str(e)}")


@router.get("/{request_id}/production-flow")
async def get_production_flow(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Get production approval flow - auto-creates if not exists"""
    db = get_db()
    
    # Find production flow
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_production",
        "object_id": request_id
    })
    
    # Auto-create if not exists and request is in Stock Received state (order >= 40)
    if not flow:
        try:
            request = db.depo_requests.find_one({"_id": ObjectId(request_id)})
            if request and request.get('state_id'):
                # Check if state is Stock Received or higher
                states_collection = db['depo_requests_states']
                state = states_collection.find_one({'_id': request['state_id']})
                
                if state and state.get('order', 0) >= 40 and state.get('order', 0) != 41:
                    # Use existing production flow template
                    production_flow_id = ObjectId("694a1ae3297c9dde6d70661a")
                    existing_flow = db.approval_flows.find_one({"_id": production_flow_id})
                    
                    if existing_flow:
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
                            "created_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow()
                        }
                        
                        result = db.approval_flows.insert_one(production_flow_data)
                        flow = db.approval_flows.find_one({"_id": result.inserted_id})
                        print(f"[PRODUCTION] Auto-created production flow for request {request_id}")
        except Exception as e:
            print(f"[PRODUCTION] Failed to auto-create production flow: {e}")
    
    if not flow:
        return {"flow": None}
    
    flow["_id"] = str(flow["_id"])
    
    # Get user details for signatures
    for signature in flow.get("signatures", []):
        user = db.users.find_one({"_id": ObjectId(signature["user_id"])})
        if user:
            signature["user_name"] = user.get("name") or user.get("username")
    
    return {"flow": flow}


@router.post("/{request_id}/production-sign")
async def sign_production(
    request_id: str,
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Sign production flow and execute stock operations"""
    db = get_db()
    requests_collection = db['depo_requests']
    stocks_collection = db['depo_stocks']
    
    # Get production flow
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_production",
        "object_id": request_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No production flow found")
    
    # Check if already signed
    user_id = str(current_user["_id"])
    existing_signature = next(
        (s for s in flow.get("signatures", []) if s["user_id"] == user_id),
        None
    )
    
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this production flow")
    
    # Check authorization
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
        raise HTTPException(status_code=403, detail="You are not authorized to sign")
    
    # Generate signature
    from src.backend.models.approval_flow_model import ApprovalFlowModel
    
    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="stock_request_production",
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
    
    # Add signature
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
    
    # Check if flow is completed
    from .approval_helpers import check_flow_completion
    
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    
    if check_flow_completion(updated_flow):
        # Mark flow as approved
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
        
        # Execute stock operations
        try:
            await execute_production_stock_operations(db, request_id, current_user)
            
            # Update request status to Produced
            requests_collection.update_one(
                {"_id": ObjectId(request_id)},
                {"$set": {"status": "Produced", "updated_at": timestamp}}
            )
            
            print(f"[PRODUCTION] Request {request_id} completed successfully")
        except Exception as e:
            print(f"[PRODUCTION] Error executing stock operations: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to execute stock operations: {str(e)}")
    
    # Get updated flow
    flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    flow["_id"] = str(flow["_id"])
    
    return flow


async def execute_production_stock_operations(db, request_id: str, current_user: dict):
    """Execute stock operations after production approval using ledger system"""
    from .production_stock_operations import execute_production_stock_operations as execute_ops
    return await execute_ops(db, request_id, current_user)
