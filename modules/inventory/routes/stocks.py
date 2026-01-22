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
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get list of stocks with enriched data"""
    from modules.inventory.services.stocks_service import get_stocks_list
    return await get_stocks_list(db, search, None, part_id, skip, limit)


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
