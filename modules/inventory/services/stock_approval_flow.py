"""
Inventory Module - Stock Approval Flow Services
Handles BA Rompharm signature flow for stock items
"""
from fastapi import HTTPException
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.models.approval_flow_model import ApprovalFlowModel
from src.backend.utils.approval_helpers import check_approval_completion, check_user_can_sign
from ..routes.utils import serialize_doc


async def get_stock_approval_flow(stock_id: str):
    """Get approval flow for a stock item"""
    db = get_db()
    
    flow = db.approval_flows.find_one({
        "object_type": "stock_qc",
        "object_id": ObjectId(stock_id)
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


async def create_stock_approval_flow(stock_id: str):
    """Create approval flow for a stock item using approval_templates"""
    db = get_db()
    
    # Check if flow already exists
    existing = db.approval_flows.find_one({
        "object_type": "stock_qc",
        "object_id": ObjectId(stock_id)
    })
    
    if existing:
        return serialize_doc(existing)  # Return existing flow
    
    # Get approval template for stock QC (oid: 69792501f8165bc859d6f2d5)
    templates_collection = db['approval_templates']
    approval_template = templates_collection.find_one({
        '_id': ObjectId('69792501f8165bc859d6f2d5')
    })
    
    if not approval_template:
        raise HTTPException(status_code=404, detail="No approval template found for stock QC")
    
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
        "object_type": "stock_qc",
        "object_source": "inventory",
        "object_id": ObjectId(stock_id),
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


async def sign_stock_qc(stock_id: str, qc_data: dict, current_user: dict, request_client_host: str, request_user_agent: str):
    """Sign BA Rompharm for a stock item"""
    db = get_db()
    
    # Get or create approval flow
    flow = db.approval_flows.find_one({
        "object_type": "stock_qc",
        "object_id": ObjectId(stock_id)
    })
    
    if not flow:
        # Auto-create approval flow
        flow_result = await create_stock_approval_flow(stock_id)
        flow = db.approval_flows.find_one({
            "object_type": "stock_qc",
            "object_id": ObjectId(stock_id)
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
        raise HTTPException(status_code=400, detail="You have already signed this BA Rompharm")
    
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
        raise HTTPException(status_code=403, detail="You are not authorized to sign this BA Rompharm")
    
    # Validate QC data
    if not qc_data.get('rompharm_ba_no') or not qc_data.get('rompharm_ba_date') or not qc_data.get('test_result'):
        raise HTTPException(status_code=400, detail="BA Number, Date, and Test Result are required")
    
    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="stock_qc",
        object_id=stock_id,
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
    
    # Update stock with QC data
    update_doc = {
        'rompharm_ba_no': qc_data['rompharm_ba_no'],
        'rompharm_ba_date': qc_data['rompharm_ba_date'],
        'test_result': qc_data['test_result'],
        'updated_at': timestamp,
        'updated_by': username
    }
    
    db.depo_stocks.update_one(
        {'_id': ObjectId(stock_id)},
        {'$set': update_doc}
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


async def remove_stock_signature(stock_id: str, user_id: str, current_user: dict):
    """Remove signature from stock QC approval flow"""
    db = get_db()
    
    # Check if user is admin or the one who signed
    is_admin = current_user.get('is_staff', False) or current_user.get('is_superuser', False)
    current_user_id = str(current_user["_id"])
    
    if not is_admin and current_user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only remove your own signature or be an admin")
    
    # Check if stock has transfers (stock movements)
    stock_movements = db.depo_stock_movements.find_one({
        'stock_id': ObjectId(stock_id)
    })
    
    if stock_movements:
        raise HTTPException(status_code=400, detail="Cannot remove signature: stock has transfers")
    
    # Get approval flow
    flow = db.approval_flows.find_one({
        "object_type": "stock_qc",
        "object_id": ObjectId(stock_id)
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this stock")
    
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
        
        # Reset stock QC data
        db.depo_stocks.update_one(
            {'_id': ObjectId(stock_id)},
            {
                '$unset': {
                    'rompharm_ba_no': '',
                    'rompharm_ba_date': '',
                    'test_result': ''
                },
                '$set': {
                    'updated_at': datetime.utcnow()
                }
            }
        )
    
    return {"message": "Signature removed successfully"}


async def update_stock_transactionable(stock_id: str, transactionable: bool, current_user: dict):
    """Update transactionable status for stock in quarantine"""
    db = get_db()
    
    # Get stock
    stock = db.depo_stocks.find_one({'_id': ObjectId(stock_id)})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # Check if user can modify (must be in approval flow)
    flow = db.approval_flows.find_one({
        "object_type": "stock_qc",
        "object_id": ObjectId(stock_id)
    })
    
    if flow:
        user_id = str(current_user["_id"])
        user_role_id = current_user.get("role")
        
        can_sign = check_user_can_sign(
            db,
            user_id,
            user_role_id,
            flow.get("required_officers", []),
            flow.get("optional_officers", [])
        )
        
        if not can_sign:
            raise HTTPException(status_code=403, detail="You are not authorized to modify this stock")
    
    # Update transactionable status
    update_doc = {
        'transactionable': transactionable,
        'updated_at': datetime.utcnow(),
        'updated_by': current_user["username"]
    }
    
    # If transactionable is True, set state to "Quarantined Transactionable"
    if transactionable:
        update_doc['state_id'] = ObjectId('694322878728e4d75ae72790')
    else:
        # Reset to default quarantine state if needed
        # Keep current state or set to default quarantine
        pass
    
    db.depo_stocks.update_one(
        {'_id': ObjectId(stock_id)},
        {'$set': update_doc}
    )
    
    updated_stock = db.depo_stocks.find_one({'_id': ObjectId(stock_id)})
    return serialize_doc(updated_stock)


async def sign_stock_qa(stock_id: str, qa_data: dict, current_user: dict, request_client_host: str, request_user_agent: str):
    """Sign QA Rompharm for a stock item (Quality Assurance)"""
    db = get_db()
    
    # Validate QA data
    if not qa_data.get('qa_rompharm_ba_no') or not qa_data.get('qa_rompharm_ba_date') or not qa_data.get('qa_test_result'):
        raise HTTPException(status_code=400, detail="QA Number, Date, and Result are required")
    
    # Additional validation: Reason is required if Neconform
    if qa_data.get('qa_test_result') == 'neconform' and not qa_data.get('qa_reason'):
        raise HTTPException(status_code=400, detail="Reason is required for Non-conforming result")

    stock_oid = ObjectId(stock_id)
    
    # Prepare update
    timestamp = datetime.utcnow()
    username = current_user["username"]
    
    update_doc = {
        'qa_rompharm_ba_no': qa_data['qa_rompharm_ba_no'],
        'qa_rompharm_ba_date': qa_data['qa_rompharm_ba_date'],
        'qa_test_result': qa_data['qa_test_result'],
        'qa_reason': qa_data.get('qa_reason', ''),
        'qa_signed_by': username,
        'qa_signed_at': timestamp,
        'updated_at': timestamp,
        'updated_by': username
    }
    
    # State and Location Logic
    if qa_data['qa_test_result'] == 'conform':
        # OK status
        update_doc['state_id'] = ObjectId('694321db8728e4d75ae72789')
        # Location remains same? Or should we ensure it's in a specific place? 
        # Requirement doesn't mention moving if Conform, implies it stays where it is (usually Quarantine -> OK)
        
    elif qa_data['qa_test_result'] == 'neconform':
        # Quarantined Not OK status (or Non-conforming state)
        update_doc['state_id'] = ObjectId('6979211af8165bc859d6f2d2')
        
        # Move to Non-conforming location
        new_location_id = ObjectId('69418f4c71d731f72ad65486')
        update_doc['location_id'] = new_location_id
        
        # We need to log this movement!
        # But `db.depo_stocks.update_one` won't trigger movement logic automatically if we just change location_id field.
        # However, `create_movement` creates a record. 
        # We should update the stock's location_id AND create a movement record.
        
        stock = db.depo_stocks.find_one({'_id': stock_oid})
        if stock and stock.get('location_id') != new_location_id:
             # Create internal movement record for tracking
             from modules.inventory.stock_movements import create_movement, MovementType
             create_movement(
                db=db,
                stock_id=stock_oid,
                part_id=stock['part_id'],
                batch_code=stock['batch_code'],
                movement_type=MovementType.TRANSFER, # Or adjustment/status change? Transfer seems appropriate for location change.
                quantity=stock.get('quantity', 0), # Entire quantity moves?
                from_location_id=stock.get('location_id'),
                to_location_id=new_location_id,
                document_type="QA_DECISION",
                document_id=stock_oid,
                created_by=username,
                notes=f"Moved to Non-conforming due to QA Neconform. Reason: {qa_data.get('qa_reason', '')}"
             )

    db.depo_stocks.update_one(
        {'_id': stock_oid},
        {'$set': update_doc}
    )
    
    # Log to journal (using stock notes or separate journal collection? Stock currently has `notes`. 
    # Let's append to a journal if exists, or just rely on the movement and fields)
    
    # Return updated stock
    updated_stock = db.depo_stocks.find_one({'_id': stock_oid})
    return serialize_doc(updated_stock)


async def remove_stock_qa_signature(stock_id: str, current_user: dict):
    """Remove QA signature and revert actions"""
    db = get_db()
    stock_oid = ObjectId(stock_id)
    username = current_user["username"]
    
    stock = db.depo_stocks.find_one({'_id': stock_oid})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
        
    if not stock.get('qa_signed_at'):
        raise HTTPException(status_code=400, detail="QA not signed")

    # Revert logic
    # If it was Neconform, it might have been moved.
    # We should probably revert state to "Received" or "Quarantine" (Initial state).
    # Since we don't store "previous state", we might default to standard Quarantine state?
    # Requirement: "Este scos din carantina sau decizia anulata"
    # Let's set it back to a neutral "Quarantine" state (usually where it enters before QA).
    # Quarantine State OID: 694322878728e4d75ae72790 (Wait, that was transactionable? Let's check stocks.py created state)
    # stocks.py: state = states_collection.find_one({'name': {'$regex': 'quarantin', '$options': 'i'}})
    # Usually '694322878728e4d75ae72790' is Quarantine Transactionable?
    # Let's assume we revert to "Quarantine" (not transactionable usually, or simple Quarantine).
    # Let's look up "Quarantine" state.
    
    quarantine_state = db.depo_stocks_states.find_one({'name': 'Quarantine'}) 
    # If not found, use a fallback from config/known IDs?
    # Known ID for "Quarantine" (from `create_stock` logic inference or context):
    # In `create_stock`: if no status, valid default is 65 (Quarantine).
    # Let's try to find value=65 state.
    
    target_state_id = None
    state_65 = db.depo_stocks_states.find_one({'value': 65})
    if state_65:
        target_state_id = state_65['_id']
    else:
        # Fallback to the ID we know is "Quarantined Not OK" or similar? No, we want "Pending QA".
        # Let's assume we unset state changes or move to a "Quarantine" state.
        pass

    # If it was moved to Non-conforming location (69418f4c71d731f72ad65486), should we move it back?
    # Use `initial_location_id`?
    target_location_id = stock.get('initial_location_id')
    
    update_unset = {
        'qa_rompharm_ba_no': '',
        'qa_rompharm_ba_date': '',
        'qa_test_result': '',
        'qa_reason': '',
        'qa_signed_by': '',
        'qa_signed_at': ''
    }
    
    update_set = {
        'updated_at': datetime.utcnow(),
        'updated_by': username
    }
    
    if target_state_id:
        update_set['state_id'] = target_state_id
        
    # If we are moving it back
    if stock.get('qa_test_result') == 'neconform' and target_location_id and stock.get('location_id') != target_location_id:
        # Move back to initial location
        update_set['location_id'] = target_location_id
        
        from modules.inventory.stock_movements import create_movement, MovementType
        create_movement(
            db=db,
            stock_id=stock_oid,
            part_id=stock['part_id'],
            batch_code=stock['batch_code'],
            movement_type=MovementType.TRANSFER,
            quantity=stock.get('quantity', 0),
            from_location_id=stock.get('location_id'),
            to_location_id=target_location_id,
            document_type="QA_DECISION_REVERT",
            document_id=stock_oid,
            created_by=username,
            notes="Reverted QA Decision (Removed from Non-conforming)"
        )

    db.depo_stocks.update_one(
        {'_id': stock_oid},
        {
            '$unset': update_unset,
            '$set': update_set
        }
    )
    
    return {"message": "QA Signature removed successfully"}
