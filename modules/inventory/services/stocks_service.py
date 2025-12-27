"""
Stocks Service
Business logic pentru stocks cu ledger system
"""
from typing import Optional, Dict, Any, List
from bson import ObjectId
from datetime import datetime
from fastapi import HTTPException

from .common import serialize_doc, validate_object_id, build_search_query, paginate_results
from ..stock_movements import (
    MovementType,
    create_movement,
    create_transfer,
    get_stock_balance,
    get_stock_movements
)


async def get_stocks_list(
    db,
    search: Optional[str] = None,
    location_id: Optional[str] = None,
    part_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> Dict[str, Any]:
    """
    Get list of stocks cu balances
    """
    collection = db['depo_stocks']
    
    # Build query
    query = {}
    
    if location_id:
        # Query prin balances pentru locație specifică
        balances = list(db.depo_stocks_balances.find({
            'location_id': ObjectId(location_id),
            'quantity': {'$gt': 0}
        }))
        stock_ids = [b['stock_id'] for b in balances]
        query['_id'] = {'$in': stock_ids}
    
    if part_id:
        query['part_id'] = ObjectId(part_id)
    
    if search:
        query['$or'] = [
            {'batch_code': {'$regex': search, '$options': 'i'}},
            {'notes': {'$regex': search, '$options': 'i'}}
        ]
    
    # Paginate
    result = paginate_results(collection, query, skip, limit, sort_by='created_at', sort_order='desc')
    
    # Add balances and available_quantity to each stock
    for stock in result['results']:
        stock_id = ObjectId(stock['_id'])
        balance_info = get_stock_balance(db, stock_id)
        stock['balances'] = balance_info
        
        # Add available_quantity (total across all locations)
        if 'locations' in balance_info:
            stock['available_quantity'] = balance_info.get('total_quantity', 0)
        else:
            stock['available_quantity'] = balance_info.get('quantity', 0)
    
    return result


async def get_stock_by_id(db, stock_id: str) -> Dict[str, Any]:
    """
    Get stock by ID cu balances și movements
    """
    stock_oid = validate_object_id(stock_id, "stock_id")
    
    stock = db.depo_stocks.find_one({'_id': stock_oid})
    
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    stock_data = serialize_doc(stock)
    
    # Add balances
    stock_data['balances'] = get_stock_balance(db, stock_oid)
    
    # Add recent movements
    stock_data['recent_movements'] = get_stock_movements(db, stock_oid, limit=20)
    
    return stock_data


async def create_stock(
    db,
    part_id: str,
    batch_code: str,
    initial_quantity: float,
    location_id: str,
    created_by: str,
    supplier: Optional[str] = None,
    expiry_date: Optional[str] = None,
    purchase_price: Optional[float] = None,
    state_id: Optional[str] = None,
    notes: Optional[str] = None,
    document_type: str = "MANUAL_ENTRY",
    document_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Creare stock cu ledger system
    
    1. Creare stock master (cu initial_quantity)
    2. Creare RECEIPT movement
    3. Creare balance
    """
    # Validate IDs
    part_oid = validate_object_id(part_id, "part_id")
    location_oid = validate_object_id(location_id, "location_id")
    
    timestamp = datetime.utcnow()
    
    # 1. Create stock master
    stock_doc = {
        'part_id': part_oid,
        'batch_code': batch_code,
        'initial_quantity': initial_quantity,  # ⭐ NU se modifică niciodată!
        'initial_location_id': location_oid,
        'created_at': timestamp,
        'created_by': created_by
    }
    
    # Optional fields
    if supplier:
        stock_doc['supplier'] = validate_object_id(supplier, "supplier")
    if expiry_date:
        stock_doc['expiry_date'] = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
    if purchase_price is not None:
        stock_doc['purchase_price'] = purchase_price
    if state_id:
        stock_doc['state_id'] = validate_object_id(state_id, "state_id")
    if notes:
        stock_doc['notes'] = notes
    
    result = db.depo_stocks.insert_one(stock_doc)
    stock_id = result.inserted_id
    
    # 2. Create RECEIPT movement
    doc_id = ObjectId(document_id) if document_id else stock_id
    
    create_movement(
        db=db,
        stock_id=stock_id,
        part_id=part_oid,
        batch_code=batch_code,
        movement_type=MovementType.RECEIPT,
        quantity=initial_quantity,  # Pozitiv
        from_location_id=None,
        to_location_id=location_oid,
        document_type=document_type,
        document_id=doc_id,
        created_by=created_by,
        notes=f"Initial stock creation: {initial_quantity} units"
    )
    
    # 3. Return created stock with balance
    return await get_stock_by_id(db, str(stock_id))


async def update_stock(
    db,
    stock_id: str,
    expiry_date: Optional[str] = None,
    purchase_price: Optional[float] = None,
    state_id: Optional[str] = None,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update stock metadata (NU cantitate!)
    Cantitatea se modifică doar prin movements
    """
    stock_oid = validate_object_id(stock_id, "stock_id")
    
    # Check if exists
    existing = db.depo_stocks.find_one({'_id': stock_oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # Build update
    update_data = {'updated_at': datetime.utcnow()}
    
    if expiry_date is not None:
        update_data['expiry_date'] = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
    if purchase_price is not None:
        update_data['purchase_price'] = purchase_price
    if state_id is not None:
        update_data['state_id'] = validate_object_id(state_id, "state_id")
    if notes is not None:
        update_data['notes'] = notes
    
    # Update
    db.depo_stocks.update_one(
        {'_id': stock_oid},
        {'$set': update_data}
    )
    
    return await get_stock_by_id(db, stock_id)


async def transfer_stock(
    db,
    stock_id: str,
    from_location_id: str,
    to_location_id: str,
    quantity: float,
    created_by: str,
    document_type: str = "STOCK_TRANSFER",
    document_id: Optional[str] = None,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Transfer stock între locații
    Crează 2 mișcări: TRANSFER_OUT + TRANSFER_IN
    """
    stock_oid = validate_object_id(stock_id, "stock_id")
    from_loc_oid = validate_object_id(from_location_id, "from_location_id")
    to_loc_oid = validate_object_id(to_location_id, "to_location_id")
    
    # Get stock info
    stock = db.depo_stocks.find_one({'_id': stock_oid})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # Check balance în from_location
    balance = get_stock_balance(db, stock_oid, from_loc_oid)
    if balance['quantity'] < quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock in source location. Available: {balance['quantity']}, Requested: {quantity}"
        )
    
    # Create transfer
    doc_id = ObjectId(document_id) if document_id else ObjectId()
    
    create_transfer(
        db=db,
        stock_id=stock_oid,
        part_id=stock['part_id'],
        batch_code=stock['batch_code'],
        quantity=quantity,
        from_location_id=from_loc_oid,
        to_location_id=to_loc_oid,
        document_type=document_type,
        document_id=doc_id,
        created_by=created_by,
        notes=notes
    )
    
    return await get_stock_by_id(db, stock_id)


async def adjust_stock(
    db,
    stock_id: str,
    location_id: str,
    quantity: float,
    created_by: str,
    document_type: str = "INVENTORY_COUNT",
    document_id: Optional[str] = None,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Ajustare inventar (+ sau -)
    """
    stock_oid = validate_object_id(stock_id, "stock_id")
    location_oid = validate_object_id(location_id, "location_id")
    
    # Get stock info
    stock = db.depo_stocks.find_one({'_id': stock_oid})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # Create adjustment movement
    doc_id = ObjectId(document_id) if document_id else ObjectId()
    
    create_movement(
        db=db,
        stock_id=stock_oid,
        part_id=stock['part_id'],
        batch_code=stock['batch_code'],
        movement_type=MovementType.ADJUSTMENT,
        quantity=quantity,  # Poate fi + sau -
        from_location_id=None,
        to_location_id=location_oid,
        document_type=document_type,
        document_id=doc_id,
        created_by=created_by,
        notes=notes or f"Inventory adjustment: {quantity:+.2f}"
    )
    
    return await get_stock_by_id(db, stock_id)


async def consume_stock(
    db,
    stock_id: str,
    location_id: str,
    quantity: float,
    created_by: str,
    document_type: str,
    document_id: str,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Consum stock (producție, vânzare, etc)
    """
    stock_oid = validate_object_id(stock_id, "stock_id")
    location_oid = validate_object_id(location_id, "location_id")
    doc_oid = validate_object_id(document_id, "document_id")
    
    # Get stock info
    stock = db.depo_stocks.find_one({'_id': stock_oid})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    
    # Check balance
    balance = get_stock_balance(db, stock_oid, location_oid)
    if balance['quantity'] < quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock. Available: {balance['quantity']}, Requested: {quantity}"
        )
    
    # Create consumption movement
    create_movement(
        db=db,
        stock_id=stock_oid,
        part_id=stock['part_id'],
        batch_code=stock['batch_code'],
        movement_type=MovementType.CONSUMPTION,
        quantity=-quantity,  # Negativ
        from_location_id=location_oid,
        to_location_id=None,
        document_type=document_type,
        document_id=doc_oid,
        created_by=created_by,
        notes=notes
    )
    
    return await get_stock_by_id(db, stock_id)
