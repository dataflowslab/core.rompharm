"""
DEPO Procurement Module - MongoDB integration
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Form, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId
import os

# Import from core
from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token

router = APIRouter(prefix="/modules/depo_procurement/api", tags=["depo_procurement"])


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == '_id':
                # Convert _id to string and also add as 'pk' for frontend compatibility
                result[key] = str(value) if value else None
                result['pk'] = str(value) if value else None
            elif key.endswith('_id'):
                result[key] = str(value) if value else None
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = [serialize_doc(item) if isinstance(item, dict) else item for item in value]
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            else:
                result[key] = value
        return result
    return doc


def is_manager(user: dict) -> bool:
    """Check if user is in Managers group"""
    groups = user.get('groups', [])
    for group in groups:
        if isinstance(group, dict):
            if group.get('name', '').lower() == 'managers':
                return True
        elif isinstance(group, str):
            if group.lower() == 'managers':
                return True
    return False


# Pydantic models
class NewSupplierRequest(BaseModel):
    name: str
    currency: str = "EUR"
    tax_id: Optional[str] = None
    is_supplier: bool = True
    is_manufacturer: bool = False
    cod: Optional[str] = None
    reg_code: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None


class PurchaseOrderRequest(BaseModel):
    supplier_id: str
    reference: Optional[str] = None
    description: Optional[str] = None
    supplier_reference: Optional[str] = None
    currency: Optional[str] = "EUR"
    issue_date: Optional[str] = None
    target_date: Optional[str] = None
    destination_id: Optional[str] = None
    notes: Optional[str] = None


class PurchaseOrderItemRequest(BaseModel):
    part_id: str
    quantity: float
    purchase_price: Optional[float] = None
    reference: Optional[str] = None
    destination_id: Optional[str] = None
    purchase_price_currency: Optional[str] = None
    notes: Optional[str] = None


class PurchaseOrderItemUpdateRequest(BaseModel):
    quantity: Optional[float] = None
    purchase_price: Optional[float] = None
    reference: Optional[str] = None
    destination_id: Optional[str] = None
    purchase_price_currency: Optional[str] = None
    notes: Optional[str] = None


class ReceiveStockRequest(BaseModel):
    line_item_index: int
    quantity: float
    location_id: str
    batch_code: Optional[str] = None
    supplier_batch_code: Optional[str] = None
    serial_numbers: Optional[str] = None
    packaging: Optional[str] = None
    status: Optional[str] = "OK"
    notes: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expected_quantity: Optional[float] = None
    expiry_date: Optional[str] = None
    reset_date: Optional[str] = None
    containers: Optional[List[Dict[str, Any]]] = None
    containers_cleaned: Optional[bool] = False
    supplier_ba_no: Optional[str] = None
    supplier_ba_date: Optional[str] = None
    accord_ba: Optional[bool] = False
    is_list_supplier: Optional[bool] = False
    clean_transport: Optional[bool] = False
    temperature_control: Optional[bool] = False
    temperature_conditions_met: Optional[bool] = None


class UpdateOrderStatusRequest(BaseModel):
    status: str


@router.get("/suppliers")
async def get_suppliers(
    request: Request,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of suppliers from MongoDB"""
    db = get_db()
    collection = db['depo_companies']
    
    query = {'is_supplier': True}
    if search:
        query['name'] = {'$regex': search, '$options': 'i'}
    
    try:
        cursor = collection.find(query).sort('name', 1)
        suppliers = list(cursor)
        return serialize_doc(suppliers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch suppliers: {str(e)}")


@router.post("/suppliers")
async def create_supplier(
    request: Request,
    supplier_data: NewSupplierRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new supplier in MongoDB"""
    db = get_db()
    collection = db['depo_companies']
    
    doc = {
        'name': supplier_data.name,
        'is_supplier': supplier_data.is_supplier,
        'is_manufacturer': supplier_data.is_manufacturer,
        'currency': supplier_data.currency,
        'tax_id': supplier_data.tax_id,
        'cod': supplier_data.cod,
        'reg_code': supplier_data.reg_code,
        'address': supplier_data.address,
        'country': supplier_data.country,
        'city': supplier_data.city,
        'created_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }
    
    try:
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create supplier: {str(e)}")


@router.get("/stock-locations")
async def get_stock_locations(
    request: Request,
    current_user: dict = Depends(verify_token)
):
    """Get list of stock locations from MongoDB"""
    db = get_db()
    collection = db['depo_locations']
    
    try:
        cursor = collection.find().sort('name', 1)
        locations = list(cursor)
        return serialize_doc(locations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock locations: {str(e)}")


@router.get("/currencies")
async def get_currencies(
    request: Request,
    current_user: dict = Depends(verify_token)
):
    """Get list of currencies from MongoDB"""
    db = get_db()
    collection = db['depo_currencies']
    
    try:
        cursor = collection.find().sort('code', 1)
        currencies = list(cursor)
        
        # If no currencies in database, return empty list (frontend will handle)
        return serialize_doc(currencies)
    except Exception as e:
        # Return empty list on error
        return []


@router.get("/purchase-orders")
async def get_purchase_orders(
    request: Request,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of purchase orders from MongoDB"""
    from modules.depo_procurement.services import get_purchase_orders_list
    return await get_purchase_orders_list(search)


@router.get("/purchase-orders/{order_id}")
async def get_purchase_order(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific purchase order from MongoDB"""
    from modules.depo_procurement.services import get_purchase_order_by_id
    return await get_purchase_order_by_id(order_id)


@router.post("/purchase-orders")
async def create_purchase_order(
    request: Request,
    order_data: PurchaseOrderRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new purchase order in MongoDB"""
    from modules.depo_procurement.services import create_new_purchase_order
    return await create_new_purchase_order(order_data, current_user)


@router.get("/purchase-orders/{order_id}/items")
async def get_purchase_order_items(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get items for a purchase order"""
    from modules.depo_procurement.services import get_order_items
    return await get_order_items(order_id)


@router.post("/purchase-orders/{order_id}/items")
async def add_purchase_order_item(
    request: Request,
    order_id: str,
    item_data: PurchaseOrderItemRequest,
    current_user: dict = Depends(verify_token)
):
    """Add an item to a purchase order"""
    from modules.depo_procurement.services import add_order_item
    return await add_order_item(order_id, item_data)


@router.put("/purchase-orders/{order_id}/items/{item_index}")
async def update_purchase_order_item(
    request: Request,
    order_id: str,
    item_index: int,
    item_data: PurchaseOrderItemUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an item in a purchase order"""
    from modules.depo_procurement.services import update_order_item
    return await update_order_item(order_id, item_index, item_data)


@router.delete("/purchase-orders/{order_id}/items/{item_index}")
async def delete_purchase_order_item(
    request: Request,
    order_id: str,
    item_index: int,
    current_user: dict = Depends(verify_token)
):
    """Delete an item from a purchase order"""
    from modules.depo_procurement.services import delete_order_item
    return await delete_order_item(order_id, item_index)


@router.get("/parts")
async def get_parts(
    request: Request,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of parts from MongoDB"""
    db = get_db()
    collection = db['depo_parts']
    
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'ipn': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}}
        ]
    
    try:
        cursor = collection.find(query).sort('name', 1).limit(50)
        parts = list(cursor)
        return serialize_doc(parts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch parts: {str(e)}")


@router.post("/purchase-orders/{order_id}/receive-stock")
async def receive_stock(
    request: Request,
    order_id: str,
    stock_data: ReceiveStockRequest,
    current_user: dict = Depends(verify_token)
):
    """Receive stock items for a purchase order line"""
    from modules.depo_procurement.services import receive_stock_item
    return await receive_stock_item(order_id, stock_data, current_user)


@router.get("/purchase-orders/{order_id}/received-items")
async def get_received_items(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get received stock items for a purchase order"""
    from modules.depo_procurement.services import get_received_stock_items
    return await get_received_stock_items(order_id)


@router.get("/order-statuses")
async def get_order_statuses(
    request: Request,
    current_user: dict = Depends(verify_token)
):
    """Get available purchase order statuses/states"""
    db = get_db()
    collection = db['depo_purchase_orders_states']
    
    try:
        cursor = collection.find().sort('value', 1)
        states = list(cursor)
        return {"statuses": serialize_doc(states)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch order states: {str(e)}")


@router.patch("/purchase-orders/{order_id}/state")
async def update_order_state(
    request: Request,
    order_id: str,
    state_name: str,
    reason: Optional[str] = None,
    current_user: dict = Depends(verify_token)
):
    """Update purchase order state"""
    from modules.depo_procurement.services import change_order_state
    
    # Check permissions
    db = get_db()
    order = db['depo_purchase_orders'].find_one({'_id': ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Check if user can change state
    is_admin = current_user.get('is_staff', False) or current_user.get('is_superuser', False)
    is_creator = order.get('created_by') == current_user.get('username')
    
    # For Cancel: admin or creator can cancel
    if state_name == 'Canceled':
        if not (is_admin or is_creator):
            raise HTTPException(status_code=403, detail="Only admin or creator can cancel the order")
    
    # For Refuse: must be admin or must_sign user
    elif state_name == 'Refused':
        if not is_admin:
            # Check if user is in must_sign list
            config = db['config'].find_one({'slug': 'procurement_approval_flows'})
            if config and config.get('items'):
                flow_config = next((item for item in config['items'] if item.get('slug') == 'referate'), None)
                if flow_config:
                    must_sign_users = [u.get('username') for u in flow_config.get('must_sign', [])]
                    if current_user.get('username') not in must_sign_users:
                        raise HTTPException(status_code=403, detail="Only admin or must_sign users can refuse the order")
        
        if not reason:
            raise HTTPException(status_code=400, detail="Reason is required when refusing an order")
    
    # For Finish: only admin can manually finish
    elif state_name == 'Finished':
        if not is_admin:
            raise HTTPException(status_code=403, detail="Only admin can manually finish the order")
    
    return await change_order_state(order_id, state_name, current_user, reason)


@router.get("/purchase-orders/{order_id}/attachments")
async def get_attachments(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get attachments for a purchase order"""
    from modules.depo_procurement.services import get_order_attachments
    return await get_order_attachments(order_id)


@router.post("/purchase-orders/{order_id}/attachments")
async def upload_attachment(
    request: Request,
    order_id: str,
    file: UploadFile = File(...),
    comment: Optional[str] = Form(None),
    current_user: dict = Depends(verify_token)
):
    """Upload an attachment to a purchase order"""
    from modules.depo_procurement.services import upload_order_attachment
    return await upload_order_attachment(order_id, file, comment, current_user)


@router.delete("/purchase-orders/{order_id}/attachments/{attachment_id}")
async def delete_attachment(
    request: Request,
    order_id: str,
    attachment_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete an attachment from a purchase order"""
    from modules.depo_procurement.services import delete_order_attachment
    return await delete_order_attachment(attachment_id)


@router.get("/purchase-orders/{order_id}/qc-records")
async def get_qc_records(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get QC records for a purchase order"""
    db = get_db()
    collection = db['depo_procurement_qc']
    
    try:
        cursor = collection.find({'order_id': ObjectId(order_id)}).sort('created_at', -1)
        qc_records = list(cursor)
        return {"results": serialize_doc(qc_records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch QC records: {str(e)}")
