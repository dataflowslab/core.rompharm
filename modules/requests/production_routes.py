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
    
    return production


@router.post("/{request_id}/production")
async def save_production_data(
    request_id: str,
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Save or update production data"""
    db = get_db()
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    # Get request body
    body = await request.json()
    
    # Check if production data exists
    existing = db.depo_production.find_one({'request_id': req_obj_id})
    
    timestamp = datetime.utcnow()
    
    if existing:
        # Update existing
        update_data = {
            'updated_at': timestamp,
            'updated_by': current_user.get('username')
        }
        
        if 'resulted' in body:
            update_data['resulted'] = body['resulted']
        
        if 'unused' in body:
            update_data['unused'] = body['unused']
        
        db.depo_production.update_one(
            {'_id': existing['_id']},
            {'$set': update_data}
        )
        
        production_id = str(existing['_id'])
    else:
        # Create new
        production_data = {
            'request_id': req_obj_id,
            'resulted': body.get('resulted', []),
            'unused': body.get('unused', []),
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


@router.get("/{request_id}/production-flow")
async def get_production_flow(
    request_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Get production approval flow"""
    db = get_db()
    
    # Find production flow
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_production",
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
    """Execute stock operations after production approval"""
    
    # Get request
    request = db.depo_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise Exception("Request not found")
    
    # Get production data
    production = db.depo_production.find_one({"request_id": ObjectId(request_id)})
    if not production:
        raise Exception("Production data not found")
    
    # Get product from recipe
    product_id = request.get('product_id')
    if not product_id:
        raise Exception("No product_id in request")
    
    destination_location = request.get('destination')
    if not destination_location:
        raise Exception("No destination location")
    
    # Constants
    supplier_id = ObjectId("694a1b9f297c9dde6d70661c")  # depo_companies
    status_ok_id = ObjectId("694321db8728e4d75ae72789")  # OK status
    
    # A. Create stock entries for produced batches
    resulted = production.get('resulted', [])
    for result in resulted:
        batch_code = result.get('batch_code')
        resulted_qty = result.get('resulted_qty', 0)
        
        if resulted_qty > 0:
            stock_entry = {
                'part': product_id,
                'location_id': ObjectId(destination_location),
                'quantity': resulted_qty,
                'batch': batch_code,
                'supplier': supplier_id,
                'status_id': status_ok_id,
                'created_at': datetime.utcnow(),
                'created_by': current_user.get('username'),
                'notes': f"Produced from request {request.get('reference')}"
            }
            
            db.depo_stocks.insert_one(stock_entry)
            print(f"[PRODUCTION] Created stock entry for batch {batch_code}: {resulted_qty} units")
    
    # B. Decrease stock for used materials
    unused = production.get('unused', [])
    items = request.get('items', [])
    
    for item in items:
        part_id = item.get('part')
        received_qty = item.get('received_quantity', item.get('quantity', 0))
        
        # Find unused quantity for this part
        unused_qty = 0
        for u in unused:
            if u.get('part') == part_id:
                unused_qty = u.get('unused_qty', 0)
                break
        
        used_qty = received_qty - unused_qty
        
        if used_qty > 0:
            # Decrease stock
            # Find stock entries for this part at destination location
            stock_entries = list(db.depo_stocks.find({
                'part': part_id,
                'location_id': ObjectId(destination_location),
                'quantity': {'$gt': 0}
            }).sort('created_at', 1))  # FIFO
            
            remaining_to_decrease = used_qty
            
            for stock in stock_entries:
                if remaining_to_decrease <= 0:
                    break
                
                stock_qty = stock.get('quantity', 0)
                decrease_amount = min(stock_qty, remaining_to_decrease)
                
                new_qty = stock_qty - decrease_amount
                
                db.depo_stocks.update_one(
                    {'_id': stock['_id']},
                    {'$set': {'quantity': new_qty, 'updated_at': datetime.utcnow()}}
                )
                
                remaining_to_decrease -= decrease_amount
                print(f"[PRODUCTION] Decreased stock for part {part_id}: -{decrease_amount} (remaining: {new_qty})")
            
            if remaining_to_decrease > 0:
                print(f"[PRODUCTION] Warning: Could not decrease full amount for part {part_id}. Remaining: {remaining_to_decrease}")
