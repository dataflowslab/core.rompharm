"""
Stocks routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token
from .utils import serialize_doc, StockCreateRequest, StockUpdateRequest

router = APIRouter()


@router.get("/stocks")
async def get_stocks(
    request: Request,
    search: Optional[str] = Query(None),
    part_id: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    state_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    qc_verified: Optional[bool] = Query(None),  # Filter by QC verification status
    has_batch: Optional[bool] = Query(None),  # Filter by batch/lot existence
    has_expiry: Optional[bool] = Query(None),  # Filter by expiry date existence
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get list of stocks with enriched data"""
    from modules.inventory.services import get_stocks_list
    return await get_stocks_list(
        search=search,
        skip=skip,
        limit=limit,
        part_id=part_id,
        location_id=location_id,
        state_id=state_id,
        start_date=start_date,
        end_date=end_date,
        qc_verified=qc_verified,
        has_batch=has_batch,
        has_expiry=has_expiry
    )


@router.get("/stocks/{stock_id}")
async def get_stock(
    request: Request,
    stock_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific stock entry with enriched data"""
    from modules.inventory.services import get_stock_by_id
    return await get_stock_by_id(stock_id)


@router.post("/stocks")
async def create_stock(
    request: Request,
    stock_data: StockCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new stock item"""
    db = get_db()
    collection = db['depo_stocks']
    
    # Validate part exists
    parts_collection = db['depo_parts']
    part = parts_collection.find_one({'_id': ObjectId(stock_data.part_id)})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    
    # Validate location exists
    locations_collection = db['depo_locations']
    location = locations_collection.find_one({'_id': ObjectId(stock_data.location_id)})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    # Find state_id from depo_stocks_states
    states_collection = db['depo_stocks_states']
    status_value = stock_data.status or 65
    state = states_collection.find_one({'value': status_value})
    
    if not state:
        state = states_collection.find_one({'name': {'$regex': 'quarantin', '$options': 'i'}})
        if not state:
            raise HTTPException(status_code=400, detail=f"Stock state with value {status_value} not found")
    
    doc = {
        'part_id': ObjectId(stock_data.part_id),
        'quantity': stock_data.quantity,
        'location_id': ObjectId(stock_data.location_id),
        'batch_code': stock_data.batch_code or '',
        'supplier_batch_code': stock_data.supplier_batch_code or '',
        'state_id': state['_id'],
        'notes': stock_data.notes or '',
        'received_date': datetime.utcnow(),
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username', 'system'),
        'updated_by': current_user.get('username', 'system')
    }
    
    if stock_data.supplier_id:
        doc['supplier_id'] = ObjectId(stock_data.supplier_id)
    
    if stock_data.supplier_um_id:
        doc['supplier_um_id'] = ObjectId(stock_data.supplier_um_id)
    
    # Add optional fields
    optional_fields = [
        'manufacturing_date', 'expected_quantity', 'expiry_date', 'reset_date',
        'containers', 'containers_cleaned', 'supplier_ba_no', 'supplier_ba_date',
        'accord_ba', 'is_list_supplier', 'clean_transport', 'temperature_control',
        'temperature_conditions_met'
    ]
    
    for field in optional_fields:
        value = getattr(stock_data, field, None)
        if value is not None:
            doc[field] = value
    
    try:
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create stock: {str(e)}")


@router.put("/stocks/{stock_id}")
async def update_stock(
    request: Request,
    stock_id: str,
    stock_data: StockUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update stock QC information"""
    db = get_db()
    collection = db['depo_stocks']
    
    update_doc = {
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username', 'system')
    }
    
    if stock_data.rompharm_ba_no is not None:
        update_doc['rompharm_ba_no'] = stock_data.rompharm_ba_no
    
    if stock_data.rompharm_ba_date is not None:
        update_doc['rompharm_ba_date'] = stock_data.rompharm_ba_date
    
    # Store test_result if provided
    if stock_data.test_result is not None:
        update_doc['test_result'] = stock_data.test_result
    
    # Auto-set state_id based on test_result when BA is signed
    # REMOVED: BA Rompharm no longer changes state. Only QA Rompharm does.
    # if stock_data.rompharm_ba_no and stock_data.test_result:
    #     if stock_data.test_result == 'conform':
    #         # Set to OK status
    #         update_doc['state_id'] = ObjectId('694321db8728e4d75ae72789')
    #     elif stock_data.test_result == 'neconform':
    #         # Set to Quarantined Not OK status
    #         update_doc['state_id'] = ObjectId('6979211af8165bc859d6f2d2')
    
    # Allow manual state_id override if provided explicitly
    if stock_data.state_id is not None:
        update_doc['state_id'] = ObjectId(stock_data.state_id) if stock_data.state_id else None
    
    if len(update_doc) == 2:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        result = collection.update_one(
            {'_id': ObjectId(stock_id)},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Stock not found")
        
        updated_stock = collection.find_one({'_id': ObjectId(stock_id)})
        return serialize_doc(updated_stock)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update stock: {str(e)}")


@router.get("/stock-states")
async def get_stock_states(
    request: Request,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get list of stock states from depo_stocks_states"""
    try:
        states = list(db['depo_stocks_states'].find().sort('value', 1))
        return serialize_doc(states)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock states: {str(e)}")


# Approval Flow Endpoints

@router.get("/stocks/{stock_id}/approval-flow")
async def get_stock_approval_flow_endpoint(
    request: Request,
    stock_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get approval flow for a stock item"""
    from modules.inventory.services import get_stock_approval_flow
    return await get_stock_approval_flow(stock_id)


@router.post("/stocks/{stock_id}/approval-flow")
async def create_stock_approval_flow_endpoint(
    request: Request,
    stock_id: str,
    current_user: dict = Depends(verify_token)
):
    """Create approval flow for a stock item"""
    from modules.inventory.services import create_stock_approval_flow
    return await create_stock_approval_flow(stock_id)


@router.post("/stocks/{stock_id}/sign")
async def sign_stock_qc_endpoint(
    request: Request,
    stock_id: str,
    current_user: dict = Depends(verify_token)
):
    """Sign BA Rompharm for a stock item"""
    from modules.inventory.services import sign_stock_qc
    
    body = await request.json()
    qc_data = {
        'rompharm_ba_no': body.get('rompharm_ba_no'),
        'rompharm_ba_date': body.get('rompharm_ba_date'),
        'test_result': body.get('test_result')
    }
    
    client_host = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    return await sign_stock_qc(stock_id, qc_data, current_user, client_host, user_agent)


@router.delete("/stocks/{stock_id}/signatures/{user_id}")
async def remove_stock_signature_endpoint(
    request: Request,
    stock_id: str,
    user_id: str,
    current_user: dict = Depends(verify_token)
):
    """Remove signature from stock QC approval flow"""
    from modules.inventory.services import remove_stock_signature
    return await remove_stock_signature(stock_id, user_id, current_user)


@router.post("/stocks/{stock_id}/sign-qa")
async def sign_stock_qa_endpoint(
    request: Request,
    stock_id: str,
    current_user: dict = Depends(verify_token)
):
    """Sign QA Rompharm for a stock item"""
    from modules.inventory.services import sign_stock_qa
    
    body = await request.json()
    qa_data = {
        'qa_rompharm_ba_no': body.get('qa_rompharm_ba_no'),
        'qa_rompharm_ba_date': body.get('qa_rompharm_ba_date'),
        'qa_test_result': body.get('qa_test_result'),
        'qa_reason': body.get('qa_reason')
    }
    
    client_host = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    return await sign_stock_qa(stock_id, qa_data, current_user, client_host, user_agent)


@router.delete("/stocks/{stock_id}/signatures-qa/{user_id}")
async def remove_stock_qa_signature_endpoint(
    request: Request,
    stock_id: str,
    user_id: str,
    current_user: dict = Depends(verify_token)
):
    """Remove QA signature from stock"""
    from modules.inventory.services import remove_stock_qa_signature
    return await remove_stock_qa_signature(stock_id, current_user)


@router.put("/stocks/{stock_id}/transactionable")
async def update_stock_transactionable_endpoint(
    request: Request,
    stock_id: str,
    current_user: dict = Depends(verify_token)
):
    """Update transactionable status for stock in quarantine"""
    from modules.inventory.services import update_stock_transactionable
    
    body = await request.json()
    transactionable = body.get('transactionable', False)
    
    return await update_stock_transactionable(stock_id, transactionable, current_user)
