"""
Stock Movements routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token
from modules.inventory.routes.utils import serialize_doc

router = APIRouter()


class StockMovementCreate(BaseModel):
    stock_id: str
    movement_type: str
    quantity: float
    date: str
    notes: Optional[str] = None


@router.get("/stock-movements")
async def get_stock_movements(
    request: Request,
    stock_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get list of stock movements"""
    collection = db['depo_stocks_movements']
    
    query = {}
    if stock_id:
        query['stock_id'] = ObjectId(stock_id)
    
    if start_date:
        query['date'] = query.get('date', {})
        query['date']['$gte'] = datetime.fromisoformat(start_date)
    
    if end_date:
        query['date'] = query.get('date', {})
        query['date']['$lte'] = datetime.fromisoformat(end_date)
    
    try:
        total = collection.count_documents(query)
        cursor = collection.find(query).sort('date', -1).skip(skip).limit(limit)
        movements = list(cursor)
        
        return {
            'results': serialize_doc(movements),
            'total': total,
            'skip': skip,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch movements: {str(e)}")


@router.post("/stock-movements")
async def create_stock_movement(
    request: Request,
    movement_data: StockMovementCreate,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Create a new stock movement"""
    collection = db['depo_stocks_movements']
    stocks_collection = db['depo_stocks']
    
    # Validate stock exists
    stock = stocks_collection.find_one({'_id': ObjectId(movement_data.stock_id)})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # Create movement document
    doc = {
        'stock_id': ObjectId(movement_data.stock_id),
        'part_id': stock['part_id'],
        'movement_type': movement_data.movement_type,
        'quantity': movement_data.quantity,
        'date': datetime.fromisoformat(movement_data.date),
        'notes': movement_data.notes or '',
        'created_by': current_user.get('username', 'system'),
        'created_at': datetime.utcnow(),
    }
    
    try:
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        
        # Update stock quantity if needed (for prelevation, reduce quantity)
        if movement_data.movement_type == 'prelevation':
            new_quantity = stock['quantity'] - movement_data.quantity
            if new_quantity < 0:
                raise HTTPException(status_code=400, detail="Insufficient stock quantity")
            
            stocks_collection.update_one(
                {'_id': ObjectId(movement_data.stock_id)},
                {'$set': {'quantity': new_quantity, 'updated_at': datetime.utcnow()}}
            )
        
        return serialize_doc(doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create movement: {str(e)}")
