"""
Stocks Router
Endpoints pentru gestionare stocks cu ledger system
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token

from ..models.stock_models import (
    StockCreateRequest,
    StockUpdateRequest,
    StockTransferRequest,
    StockAdjustmentRequest,
    StockConsumptionRequest
)
from ..services.stocks_service import (
    get_stocks_list,
    get_stock_by_id,
    create_stock,
    update_stock,
    transfer_stock,
    adjust_stock,
    consume_stock
)

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/")
async def list_stocks(
    search: Optional[str] = Query(None, description="Search în batch_code sau notes"),
    location_id: Optional[str] = Query(None, description="Filtrare după locație"),
    part_id: Optional[str] = Query(None, description="Filtrare după part"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token)
):
    """
    Get list of stocks cu balances
    
    Returns:
        - results: listă stocks cu balances
        - total: număr total
        - skip, limit: paginare
    """
    db = get_db()
    return await get_stocks_list(db, search, location_id, part_id, skip, limit)


@router.get("/{stock_id}")
async def get_stock(
    stock_id: str,
    current_user: dict = Depends(verify_token)
):
    """
    Get stock by ID cu balances și istoric movements
    
    Returns:
        - Stock data
        - balances: cantități pe locații
        - recent_movements: ultimele 20 mișcări
    """
    db = get_db()
    return await get_stock_by_id(db, stock_id)


@router.post("/")
async def create_new_stock(
    stock_data: StockCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """
    Creare stock nou cu ledger system
    
    Pași:
    1. Creare stock master (cu initial_quantity)
    2. Creare RECEIPT movement
    3. Creare balance
    
    Note:
    - initial_quantity NU se modifică niciodată
    - Pentru modificări cantitate → folosește movements
    """
    db = get_db()
    
    return await create_stock(
        db=db,
        part_id=stock_data.part_id,
        batch_code=stock_data.batch_code,
        initial_quantity=stock_data.initial_quantity,
        location_id=stock_data.location_id,
        created_by=current_user.get('username'),
        supplier=stock_data.supplier,
        expiry_date=stock_data.expiry_date,
        purchase_price=stock_data.purchase_price,
        state_id=stock_data.state_id,
        notes=stock_data.notes,
        document_type=stock_data.document_type,
        document_id=stock_data.document_id
    )


@router.put("/{stock_id}")
async def update_existing_stock(
    stock_id: str,
    stock_data: StockUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """
    Update stock metadata (NU cantitate!)
    
    Poate modifica:
    - expiry_date
    - purchase_price
    - state_id
    - notes
    
    Pentru modificări cantitate → folosește:
    - POST /stocks/{stock_id}/transfer
    - POST /stocks/{stock_id}/adjust
    - POST /stocks/{stock_id}/consume
    """
    db = get_db()
    
    return await update_stock(
        db=db,
        stock_id=stock_id,
        expiry_date=stock_data.expiry_date,
        purchase_price=stock_data.purchase_price,
        state_id=stock_data.state_id,
        notes=stock_data.notes
    )


@router.post("/{stock_id}/transfer")
async def transfer_stock_between_locations(
    stock_id: str,
    transfer_data: StockTransferRequest,
    current_user: dict = Depends(verify_token)
):
    """
    Transfer stock între locații
    
    Crează 2 mișcări corelate:
    - TRANSFER_OUT (ieșire din from_location)
    - TRANSFER_IN (intrare în to_location)
    
    Validări:
    - Verifică că există suficient stock în from_location
    - Cantitate trebuie pozitivă
    """
    db = get_db()
    
    return await transfer_stock(
        db=db,
        stock_id=stock_id,
        from_location_id=transfer_data.from_location_id,
        to_location_id=transfer_data.to_location_id,
        quantity=transfer_data.quantity,
        created_by=current_user.get('username'),
        document_type=transfer_data.document_type,
        document_id=transfer_data.document_id,
        notes=transfer_data.notes
    )


@router.post("/{stock_id}/adjust")
async def adjust_stock_quantity(
    stock_id: str,
    adjustment_data: StockAdjustmentRequest,
    current_user: dict = Depends(verify_token)
):
    """
    Ajustare inventar (+ sau -)
    
    Folosit pentru:
    - Corectare după inventar fizic
    - Ajustări pentru diferențe
    
    Note:
    - quantity poate fi pozitivă (adaugă) sau negativă (scade)
    - Trebuie specificat motiv în notes
    """
    db = get_db()
    
    return await adjust_stock(
        db=db,
        stock_id=stock_id,
        location_id=adjustment_data.location_id,
        quantity=adjustment_data.quantity,
        created_by=current_user.get('username'),
        document_type=adjustment_data.document_type,
        document_id=adjustment_data.document_id,
        notes=adjustment_data.notes
    )


@router.post("/{stock_id}/consume")
async def consume_stock_quantity(
    stock_id: str,
    consumption_data: StockConsumptionRequest,
    current_user: dict = Depends(verify_token)
):
    """
    Consum stock (producție, vânzare, etc)
    
    Crează mișcare CONSUMPTION (negativă)
    
    Validări:
    - Verifică că există suficient stock în locație
    - Cantitate trebuie pozitivă (se convertește automat la negativ)
    - Necesită document_type și document_id
    """
    db = get_db()
    
    return await consume_stock(
        db=db,
        stock_id=stock_id,
        location_id=consumption_data.location_id,
        quantity=consumption_data.quantity,
        created_by=current_user.get('username'),
        document_type=consumption_data.document_type,
        document_id=consumption_data.document_id,
        notes=consumption_data.notes
    )


@router.get("/{stock_id}/movements")
async def get_stock_movement_history(
    stock_id: str,
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(verify_token)
):
    """
    Get istoric complet mișcări pentru un stock
    
    Returns:
        Listă mișcări sortate descrescător după dată
    """
    from ..stock_movements import get_stock_movements
    from ..services.common import validate_object_id
    
    db = get_db()
    stock_oid = validate_object_id(stock_id, "stock_id")
    
    movements = get_stock_movements(db, stock_oid, limit)
    
    return {
        'stock_id': stock_id,
        'movements': movements,
        'count': len(movements)
    }


@router.get("/{stock_id}/balance")
async def get_stock_balance_info(
    stock_id: str,
    location_id: Optional[str] = Query(None, description="ID locație (optional)"),
    current_user: dict = Depends(verify_token)
):
    """
    Get balance pentru un stock
    
    Args:
        location_id: Dacă specificat, returnează balance pentru o locație
                    Dacă None, returnează balances pentru toate locațiile
    
    Returns:
        - Pentru o locație: {stock_id, location_id, quantity, updated_at}
        - Pentru toate: {stock_id, locations: [...], total_quantity}
    """
    from ..stock_movements import get_stock_balance
    from ..services.common import validate_object_id
    from bson import ObjectId
    
    db = get_db()
    stock_oid = validate_object_id(stock_id, "stock_id")
    location_oid = ObjectId(location_id) if location_id else None
    
    return get_stock_balance(db, stock_oid, location_oid)
