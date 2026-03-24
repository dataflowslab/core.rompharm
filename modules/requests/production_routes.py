"""
Production routes for requests module
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime
from bson import ObjectId
from typing import List, Optional

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token
from src.backend.utils.sections_permissions import require_section
from .utils import generate_request_reference


router = APIRouter()


DESTROYED_STATE_ID = "694322538728e4d75ae7278c"

CANCELED_TOKENS = [
    'canceled', 'cancelled', 'anulat', 'anulare', 'cancel', 'cancelare'
]

FAILED_TOKENS = [
    'failed', 'fail', 'esuat', 'refuz', 'refused', 'rejected', 'neconform'
]


def _is_canceled_state(state: Optional[dict]) -> bool:
    if not state:
        return False
    name = (state.get('name') or '').lower()
    slug = (state.get('slug') or '').lower()
    label = (state.get('label') or '').lower()
    haystack = f"{name} {slug} {label}"
    return any(token in haystack for token in CANCELED_TOKENS)


def _is_failed_state(state: Optional[dict]) -> bool:
    if not state:
        return False
    name = (state.get('name') or '').lower()
    slug = (state.get('slug') or '').lower()
    label = (state.get('label') or '').lower()
    haystack = f"{name} {slug} {label}"
    return any(token in haystack for token in FAILED_TOKENS) and not _is_canceled_state(state)


def _get_state_by_id(db, state_id: Optional[str]) -> Optional[dict]:
    if not state_id:
        return None
    try:
        return db.depo_requests_states.find_one({'_id': ObjectId(state_id)})
    except Exception:
        return None


def _build_unused_material_totals(series: list) -> dict:
    totals = {}
    for serie in series or []:
        for material in serie.get('materials', []):
            part_id = material.get('part')
            if not part_id:
                continue
            part_key = str(part_id)
            entry = totals.setdefault(part_key, {
                'part_id': part_key,
                'part_name': material.get('part_name', ''),
                'total_received': 0.0,
                'total_used': 0.0
            })
            entry['total_received'] += float(material.get('received_qty') or 0)
            entry['total_used'] += float(material.get('used_qty') or 0)
    return totals


def _log_excessive_loss(
    db,
    request_doc: dict,
    series: list,
    unused_materials: list,
    timestamp: datetime,
    current_user: dict
):
    product_id = request_doc.get('product_id') or request_doc.get('recipe_part_id')
    if not product_id:
        return
    try:
        product_oid = ObjectId(product_id) if isinstance(product_id, str) else product_id
    except Exception:
        return

    product = db.depo_parts.find_one({'_id': product_oid})
    if not product:
        return

    threshold = product.get('loss_rate_threshold')
    if threshold is None:
        return

    total_produced = 0.0
    for serie in series or []:
        total_produced += float(serie.get('produced_qty') or 0)

    if total_produced <= 0:
        return

    return_qty_map = {}
    for item in unused_materials or []:
        part = item.get('part')
        if part:
            return_qty_map[str(part)] = float(item.get('return_qty') or 0)

    totals = _build_unused_material_totals(series)
    for part_id, data in totals.items():
        unused_qty = data['total_received'] - data['total_used']
        return_qty = return_qty_map.get(part_id, unused_qty)
        loss_qty = unused_qty - return_qty

        if loss_qty <= 0:
            continue

        loss_percent = (loss_qty / total_produced) * 100
        if loss_percent <= threshold:
            continue

        db.logs.insert_one({
            'collection': 'depo_requests',
            'object_id': str(request_doc.get('_id')),
            'action': 'production_loss_excess',
            'request_reference': request_doc.get('reference'),
            'part_id': part_id,
            'part_name': data.get('part_name', ''),
            'loss_quantity': loss_qty,
            'loss_percent': loss_percent,
            'loss_rate_threshold': threshold,
            'user': current_user.get('username'),
            'timestamp': timestamp,
            'message': f"Excessive loss for {data.get('part_name', part_id)} on build order {request_doc.get('reference')}"
        })


@router.get("/{request_id}/production")
async def get_production_data(
    request_id: str,
    current_user: dict = Depends(require_section("requests"))
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
            if 'production_step_id' in serie and isinstance(serie['production_step_id'], ObjectId):
                serie['production_step_id'] = str(serie['production_step_id'])
            if 'decision_status' in serie and isinstance(serie['decision_status'], ObjectId):
                serie['decision_status'] = str(serie['decision_status'])
            if 'signatures' in serie:
                for signature in serie['signatures']:
                    if 'user_id' in signature and isinstance(signature['user_id'], ObjectId):
                        signature['user_id'] = str(signature['user_id'])
                    if 'signed_at' in signature and isinstance(signature['signed_at'], datetime):
                        signature['signed_at'] = signature['signed_at'].isoformat()
    
    # Convert datetime to ISO format
    if 'created_at' in production and isinstance(production['created_at'], datetime):
        production['created_at'] = production['created_at'].isoformat()
    if 'updated_at' in production and isinstance(production['updated_at'], datetime):
        production['updated_at'] = production['updated_at'].isoformat()

    if 'unused_materials' in production and production['unused_materials']:
        for item in production['unused_materials']:
            if 'part' in item and isinstance(item['part'], ObjectId):
                item['part'] = str(item['part'])

    if 'return_order_id' in production and isinstance(production['return_order_id'], ObjectId):
        production['return_order_id'] = str(production['return_order_id'])
    
    return production


@router.post("/{request_id}/production")
async def save_production_data(
    request_id: str,
    request: Request,
    current_user: dict = Depends(require_section("requests"))
):
    """Save or update production data with series and materials + execute stock movements"""
    db = get_db()
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    # Get request body
    body = await request.json()
    series = body.get('series', [])  # Array of {batch_code, materials: [{part, batch, received_qty, used_qty}]}
    unused_materials = body.get('unused_materials', None)
    
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
        if unused_materials is not None:
            update_data['unused_materials'] = unused_materials
        
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
            'unused_materials': unused_materials or [],
            'created_at': timestamp,
            'created_by': current_user.get('username'),
            'updated_at': timestamp,
            'updated_by': current_user.get('username')
        }
        
        result = db.depo_production.insert_one(production_data)
        production_id = str(result.inserted_id)
    
    # Execute stock movements
    try:
        await execute_production_stock_movements(db, request_id, series, current_user, timestamp)
    except Exception as e:
        print(f"[PRODUCTION] Warning: Stock movements failed: {e}")
        # Don't fail the save if stock movements fail

    # Loss threshold notification (log)
    try:
        request_doc = db.depo_requests.find_one({'_id': req_obj_id})
        if request_doc:
            if unused_materials is not None:
                loss_unused_materials = unused_materials
            elif existing:
                loss_unused_materials = existing.get('unused_materials', [])
            else:
                loss_unused_materials = []

            _log_excessive_loss(
                db=db,
                request_doc=request_doc,
                series=series,
                unused_materials=loss_unused_materials,
                timestamp=timestamp,
                current_user=current_user
            )
    except Exception as e:
        print(f"[PRODUCTION] Warning: Failed to log loss notification: {e}")
    
    return {
        "success": True,
        "production_id": production_id,
        "message": "Production data saved successfully"
    }


async def execute_production_stock_movements(db, request_id: str, series: list, current_user: dict, timestamp: datetime):
    """Execute stock movements for production: - consumed materials, + produced batches"""
    
    # Get request details
    request = db.depo_requests.find_one({'_id': ObjectId(request_id)})
    if not request:
        raise Exception("Request not found")
    
    product_id = request.get('product_id')
    destination_id = request.get('destination')
    
    if not product_id or not destination_id:
        raise Exception("Product or destination not found in request")
    
    # Convert to ObjectId if needed
    if isinstance(product_id, str):
        product_id = ObjectId(product_id)
    if isinstance(destination_id, str):
        destination_id = ObjectId(destination_id)
    
    stocks_collection = db['depo_stocks']
    movements_created = 0
    
    # Process each series (batch code)
    for serie in series:
        batch_code = serie.get('batch_code')
        materials = serie.get('materials', [])
        decision_status = serie.get('decision_status')
        state = _get_state_by_id(db, decision_status)
        is_canceled = _is_canceled_state(state)
        is_failed = _is_failed_state(state)
        if is_canceled:
            print(f"[PRODUCTION] Skipping serie {batch_code} - decision is canceled")
            continue
        
        if not batch_code:
            continue
        
        # 1. Reduce stock for consumed materials
        for material in materials:
            part_id = material.get('part')
            used_qty = material.get('used_qty', 0)
            material_batch = material.get('batch', '')
            
            if not part_id or used_qty <= 0:
                continue
            
            # Convert part_id to ObjectId if needed
            if isinstance(part_id, str):
                part_id = ObjectId(part_id)
            
            # Find stock at destination location with matching part and batch
            query = {
                'part_id': part_id,
                'location_id': destination_id,
                'quantity': {'$gt': 0}
            }
            
            if material_batch:
                query['batch_code'] = material_batch
            
            material_stocks = list(stocks_collection.find(query).sort('created_at', 1))
            
            if not material_stocks:
                print(f"[PRODUCTION] Warning: No stock found for part {part_id}, batch {material_batch}")
                continue
            
            # Reduce stock (FIFO)
            remaining_qty = used_qty
            for stock in material_stocks:
                if remaining_qty <= 0:
                    break
                
                available_qty = stock.get('quantity', 0)
                reduce_qty = min(remaining_qty, available_qty)
                
                # Reduce quantity
                stocks_collection.update_one(
                    {'_id': stock['_id']},
                    {
                        '$inc': {'quantity': -reduce_qty},
                        '$set': {'updated_at': timestamp}
                    }
                )
                
                # Log the consumption
                db.logs.insert_one({
                    'collection': 'depo_stocks',
                    'action': 'production_consumption',
                    'request_id': request_id,
                    'request_reference': request.get('reference'),
                    'part_id': str(part_id),
                    'quantity': -reduce_qty,
                    'location': str(destination_id),
                    'batch_code': material_batch,
                    'produced_batch': batch_code,
                    'user': current_user.get('username'),
                    'timestamp': timestamp
                })
                
                remaining_qty -= reduce_qty
                movements_created += 1
            
            if remaining_qty > 0:
                print(f"[PRODUCTION] Warning: Could not consume full quantity for part {part_id}. Remaining: {remaining_qty}")
        
        # 2. Add stock for produced product with this batch code
        # Use explicit produced quantity from serie
        produced_qty = float(serie.get('produced_qty') or 0)
        
        if produced_qty > 0:
            materials_used = []
            for material in materials:
                used_qty = float(material.get('used_qty') or 0)
                if used_qty <= 0:
                    continue
                materials_used.append({
                    'part_id': str(material.get('part')),
                    'part_name': material.get('part_name', ''),
                    'batch': material.get('batch', ''),
                    'quantity': used_qty
                })
            # Check if stock entry exists for this product + batch
            existing_stock = stocks_collection.find_one({
                'part_id': product_id,
                'location_id': destination_id,
                'batch_code': batch_code
            })
            
            if existing_stock:
                # Update existing
                stocks_collection.update_one(
                    {'_id': existing_stock['_id']},
                    {
                        '$inc': {'quantity': produced_qty},
                        '$set': {
                            'updated_at': timestamp,
                            'state_id': ObjectId(DESTROYED_STATE_ID) if is_failed else existing_stock.get('state_id'),
                            'production': {
                                'request_id': request_id,
                                'serie_batch': batch_code,
                                'materials_used': materials_used,
                                'produced_at': timestamp,
                                'production_step_id': serie.get('production_step_id'),
                                'decision_status': decision_status
                            }
                        }
                    }
                )
            else:
                # Create new stock entry
                # For produced products, set supplier to Rompharm and status to Quarantined
                rompharm_supplier_id = ObjectId("694a1b9f297c9dde6d70661c")
                quarantined_state_id = ObjectId("694322878728e4d75ae72790")
                destroyed_state_id = ObjectId(DESTROYED_STATE_ID)
                
                new_stock = {
                    'part_id': product_id,
                    'location_id': destination_id,
                    'quantity': produced_qty,
                    'batch_code': batch_code,
                    'supplier_id': rompharm_supplier_id,
                    'state_id': destroyed_state_id if is_failed else quarantined_state_id,
                    'notes': f"Produced from request {request.get('reference', request_id)}",
                    'created_at': timestamp,
                    'updated_at': timestamp,
                    'created_by': current_user.get('username'),
                    'updated_by': current_user.get('username'),
                    'request_id': ObjectId(request_id),
                    'request_reference': request.get('reference'),
                    'production': {
                        'request_id': request_id,
                        'serie_batch': batch_code,
                        'materials_used': materials_used,
                        'produced_at': timestamp,
                        'production_step_id': serie.get('production_step_id'),
                        'decision_status': decision_status
                    }
                }
                if serie.get('expiry_date'):
                    try:
                        new_stock['expiry_date'] = datetime.fromisoformat(str(serie.get('expiry_date')).replace('Z', '+00:00'))
                    except Exception:
                        new_stock['expiry_date'] = serie.get('expiry_date')
                stocks_collection.insert_one(new_stock)
            
            # Log the production
            db.logs.insert_one({
                'collection': 'depo_stocks',
                'action': 'production_output',
                'request_id': request_id,
                'request_reference': request.get('reference'),
                'part_id': str(product_id),
                'quantity': produced_qty,
                'location': str(destination_id),
                'batch_code': batch_code,
                'user': current_user.get('username'),
                'timestamp': timestamp
            })
            
            movements_created += 1
    
    print(f"[PRODUCTION] Created {movements_created} stock movements for request {request_id}")


@router.patch("/{request_id}/production-status")
async def update_production_status(
    request_id: str,
    request: Request,
    current_user: dict = Depends(require_section("requests"))
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
    current_user: dict = Depends(verify_token)
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
    current_user: dict = Depends(verify_token)
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
    user_role_id = current_user.get("role")

    from src.backend.utils.approval_helpers import check_user_can_sign
    can_sign = check_user_can_sign(
        db,
        user_id,
        user_role_id,
        flow.get("must_sign_officers", []),
        flow.get("can_sign_officers", [])
    )

    if not can_sign:
        print(f"[PRODUCTION] User {username} not authorized to sign. Officers: {flow.get('can_sign_officers', [])} + {flow.get('must_sign_officers', [])}")
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
        "user_name": current_user.get('name') or username,
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
            print(f"[PRODUCTION] Request {request_id} completed successfully")
        except Exception as e:
            print(f"[PRODUCTION] Error executing stock operations: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to execute stock operations: {str(e)}")
    
    # Get updated flow
    flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    flow["_id"] = str(flow["_id"])
    
    return flow


@router.post("/{request_id}/production-series-sign")
async def sign_production_series(
    request_id: str,
    request: Request,
    current_user: dict = Depends(verify_token)
):
    """Sign production series (per batch) using production flow officers"""
    db = get_db()

    body = await request.json()
    batch_code = body.get('batch_code')
    if not batch_code:
        raise HTTPException(status_code=400, detail="batch_code is required")

    try:
        req_obj_id = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    production = db.depo_production.find_one({'request_id': req_obj_id})
    if not production:
        raise HTTPException(status_code=404, detail="Production data not found")

    series = production.get('series', [])
    serie_index = next((i for i, s in enumerate(series) if s.get('batch_code') == batch_code), None)
    if serie_index is None:
        raise HTTPException(status_code=404, detail="Production series not found")

    serie = series[serie_index]
    decision_status = serie.get('decision_status')
    if not decision_status:
        raise HTTPException(status_code=400, detail="Decision status is required before signing")

    state = _get_state_by_id(db, decision_status)
    is_canceled = _is_canceled_state(state)
    is_failed = _is_failed_state(state)

    if state and state.get('needs_comment') and not str(serie.get('decision_reason') or '').strip():
        raise HTTPException(status_code=400, detail="Comment is required for this decision")

    if not (is_canceled or is_failed) and not serie.get('expiry_date'):
        raise HTTPException(status_code=400, detail="Expiration date is required")
    if not is_canceled and not serie.get('production_step_id'):
        raise HTTPException(status_code=400, detail="Production step is required")

    produced_qty = float(serie.get('produced_qty') or 0)
    if produced_qty <= 0 and not is_canceled:
        raise HTTPException(status_code=400, detail="Produced quantity is required")

    # Get production flow for permission checks
    flow = db.approval_flows.find_one({
        "object_type": "stock_request_production",
        "object_id": request_id
    })

    if not flow:
        raise HTTPException(status_code=404, detail="No production flow found")

    user_id = str(current_user["_id"])
    existing_signature = next(
        (s for s in serie.get("signatures", []) if s.get("user_id") == user_id),
        None
    )
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this series")

    # Check authorization (same logic as production flow)
    username = current_user["username"]
    user_role_id = current_user.get("role")

    from src.backend.utils.approval_helpers import check_user_can_sign
    can_sign = check_user_can_sign(
        db,
        user_id,
        user_role_id,
        flow.get("must_sign_officers", []),
        flow.get("can_sign_officers", [])
    )

    if not can_sign:
        raise HTTPException(status_code=403, detail="You are not authorized to sign")

    from src.backend.models.approval_flow_model import ApprovalFlowModel

    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="stock_request_production_series",
        object_id=f"{request_id}:{batch_code}",
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

    serie_signatures = serie.get('signatures', [])
    serie_signatures.append(signature)
    serie['signatures'] = serie_signatures

    series[serie_index] = serie
    db.depo_production.update_one(
        {'_id': production['_id']},
        {'$set': {
            'series': series,
            'updated_at': timestamp,
            'updated_by': current_user.get('username')
        }}
    )

    return {'series': series}


@router.post("/{request_id}/production-return-order")
async def create_production_return_order(
    request_id: str,
    current_user: dict = Depends(require_section("requests"))
):
    """Create a return order for unused materials after production"""
    db = get_db()

    try:
        req_obj_id = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    request_doc = db.depo_requests.find_one({'_id': req_obj_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")

    production = db.depo_production.find_one({'request_id': req_obj_id})
    if not production:
        raise HTTPException(status_code=404, detail="Production data not found")

    if production.get('return_order_id'):
        return {
            'return_order_id': str(production.get('return_order_id')),
            'return_order_reference': production.get('return_order_reference')
        }

    series = production.get('series', [])
    unused_materials = production.get('unused_materials', [])

    totals = _build_unused_material_totals(series)
    return_qty_map = {}
    for item in unused_materials:
        part = item.get('part')
        if part:
            return_qty_map[str(part)] = float(item.get('return_qty') or 0)

    items = []
    for part_id, data in totals.items():
        unused_qty = data['total_received'] - data['total_used']
        return_qty = return_qty_map.get(part_id, unused_qty)
        return_qty = max(0, min(return_qty, unused_qty))
        if return_qty <= 0:
            continue
        items.append({
            'part': part_id,
            'quantity': return_qty,
            'init_q': return_qty,
            'notes': f"Return from production order {request_doc.get('reference')}"
        })

    if not items:
        raise HTTPException(status_code=400, detail="No return quantities available")

    source = request_doc.get('destination')
    destination = request_doc.get('source')
    if not source or not destination:
        raise HTTPException(status_code=400, detail="Request missing source/destination")

    reference = generate_request_reference(db)
    timestamp = datetime.utcnow()

    return_request_doc = {
        'reference': reference,
        'source': source,
        'destination': destination,
        'items': items,
        'line_items': len(items),
        'status': 'Pending',
        'notes': f"Return order for request {request_doc.get('reference')}",
        'issue_date': timestamp,
        'created_at': timestamp,
        'updated_at': timestamp,
        'created_by': current_user.get('username')
    }

    result = db.depo_requests.insert_one(return_request_doc)
    return_order_id = result.inserted_id

    db.depo_production.update_one(
        {'_id': production['_id']},
        {'$set': {
            'return_order_id': return_order_id,
            'return_order_reference': reference,
            'updated_at': timestamp,
            'updated_by': current_user.get('username')
        }}
    )

    return {
        'return_order_id': str(return_order_id),
        'return_order_reference': reference
    }


async def execute_production_stock_operations(db, request_id: str, current_user: dict):
    """Execute stock operations after production approval using ledger system"""
    from .production_stock_operations import execute_production_stock_operations as execute_ops
    return await execute_ops(db, request_id, current_user)
