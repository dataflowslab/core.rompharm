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
    from_location_id: Optional[str] = None
    to_location_id: Optional[str] = None
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

        serialized = serialize_doc(movements)

        # Enrich with location names
        location_ids = set()
        for mov in serialized:
            for key in ('from_location_id', 'to_location_id', 'source_id', 'destination_id'):
                if mov.get(key):
                    location_ids.add(mov.get(key))

        location_map = {}
        if location_ids:
            loc_oids = []
            for loc_id in location_ids:
                try:
                    loc_oids.append(ObjectId(loc_id))
                except Exception:
                    continue
            if loc_oids:
                locations = list(db['depo_locations'].find({'_id': {'$in': loc_oids}}))
                for loc in locations:
                    location_map[str(loc['_id'])] = loc.get('code', loc.get('name', str(loc['_id'])))

        # Enrich with request/sales references when available
        request_ids = set()
        sales_ids = set()
        for mov in serialized:
            doc_type = (mov.get('document_type') or '').lower()
            if 'request' in doc_type and mov.get('document_id'):
                request_ids.add(mov.get('document_id'))
            if 'sales' in doc_type and mov.get('document_id'):
                sales_ids.add(mov.get('document_id'))

        request_map = {}
        if request_ids:
            req_oids = []
            for req_id in request_ids:
                try:
                    req_oids.append(ObjectId(req_id))
                except Exception:
                    continue
            if req_oids:
                requests = list(db['depo_requests'].find({'_id': {'$in': req_oids}}, {'reference': 1}))
                for req in requests:
                    request_map[str(req['_id'])] = req.get('reference')

        sales_map = {}
        if sales_ids:
            sales_oids = []
            for sid in sales_ids:
                try:
                    sales_oids.append(ObjectId(sid))
                except Exception:
                    continue
            if sales_oids:
                orders = list(db['depo_sales_ordes'].find({'_id': {'$in': sales_oids}}, {'reference': 1}))
                if not orders:
                    orders = list(db['depo_sales_orders'].find({'_id': {'$in': sales_oids}}, {'reference': 1}))
                for order in orders:
                    sales_map[str(order['_id'])] = order.get('reference')

        for mov in serialized:
            source_id = mov.get('source_id') or mov.get('from_location_id')
            dest_id = mov.get('destination_id') or mov.get('to_location_id')
            mov['source_name'] = location_map.get(source_id, source_id)
            mov['destination_name'] = location_map.get(dest_id, dest_id)
            if mov.get('document_id'):
                mov['document_reference'] = request_map.get(mov['document_id']) or sales_map.get(mov['document_id'])

        return {
            'results': serialized,
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
    stocks_collection = db['depo_stocks']
    from modules.inventory.stock_movements import create_transfer, create_movement, MovementType, get_stock_balance
    from modules.inventory.services.common import validate_object_id

    QC_LOCATION_ID = ObjectId('6941cbcb8728e4d75ae7273e')
    
    # Validate stock exists
    stock = stocks_collection.find_one({'_id': ObjectId(movement_data.stock_id)})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    movement_type = (movement_data.movement_type or '').strip().lower()
    username = current_user.get('username', 'system')

    # Prelevation = transfer from current location -> QC
    if movement_type == 'prelevation':
        # Resolve source location
        from_location = movement_data.from_location_id or stock.get('location_id') or stock.get('initial_location_id')
        if not from_location:
            balances = list(db.depo_stocks_balances.find({
                'stock_id': stock['_id'],
                'quantity': {'$gt': 0}
            }).sort('quantity', -1))
            if balances:
                from_location = balances[0].get('location_id')

        if not from_location:
            raise HTTPException(status_code=400, detail="Cannot determine source location for prelevation")

        try:
            from_location_oid = validate_object_id(str(from_location), "from_location_id")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid source location for prelevation")

        to_location_oid = validate_object_id(str(movement_data.to_location_id), "to_location_id") if movement_data.to_location_id else QC_LOCATION_ID

        # Check balance if we can
        try:
            balance = get_stock_balance(db, stock['_id'], from_location_oid)
            if balance.get('quantity', 0) < movement_data.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock quantity. Available: {balance.get('quantity', 0)}, Requested: {movement_data.quantity}"
                )
        except HTTPException:
            raise
        except Exception:
            # If balance isn't available, allow and rely on downstream validation
            pass

        try:
            movement_out_id, movement_in_id = create_transfer(
                db=db,
                stock_id=stock['_id'],
                part_id=stock['part_id'],
                batch_code=stock.get('batch_code', ''),
                quantity=movement_data.quantity,
                from_location_id=from_location_oid,
                to_location_id=to_location_oid,
                document_type="PRELEVATION",
                document_id=stock['_id'],
                created_by=username,
                notes=movement_data.notes or 'Quality Control Prelevation'
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create prelevation: {str(e)}")

        return {
            'movement_out_id': str(movement_out_id),
            'movement_in_id': str(movement_in_id),
            'from_location_id': str(from_location_oid),
            'to_location_id': str(to_location_oid),
            'quantity': movement_data.quantity,
            'movement_type': 'PRELEVATION',
            'stock_id': movement_data.stock_id
        }

    # Fallback: create a simple movement record (legacy)
    doc = {
        'stock_id': ObjectId(movement_data.stock_id),
        'part_id': stock['part_id'],
        'movement_type': movement_data.movement_type,
        'quantity': movement_data.quantity,
        'date': datetime.fromisoformat(movement_data.date),
        'notes': movement_data.notes or '',
        'created_by': username,
        'created_at': datetime.utcnow(),
        'from_location_id': ObjectId(movement_data.from_location_id) if movement_data.from_location_id else None,
        'to_location_id': ObjectId(movement_data.to_location_id) if movement_data.to_location_id else None,
        'source_id': ObjectId(movement_data.from_location_id) if movement_data.from_location_id else None,
        'destination_id': ObjectId(movement_data.to_location_id) if movement_data.to_location_id else None,
    }

    try:
        result = db['depo_stocks_movements'].insert_one(doc)
        doc['_id'] = result.inserted_id
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create movement: {str(e)}")
