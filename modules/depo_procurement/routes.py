"""
DEPO Procurement Module - MongoDB integration
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Form, Query
from typing import Optional
from datetime import datetime
from bson import ObjectId

# Import from core
from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token

# Import from module
from modules.depo_procurement.models import (
    NewSupplierRequest,
    PurchaseOrderRequest,
    PurchaseOrderItemRequest,
    PurchaseOrderItemUpdateRequest,
    ReceiveStockRequest,
    UpdateOrderStatusRequest
)
from modules.depo_procurement.utils import serialize_doc

router = APIRouter(prefix="/modules/depo_procurement/api", tags=["depo_procurement"])




@router.get("/purchase-orders")
async def get_purchase_orders(
    request: Request,
    search: Optional[str] = Query(None),
    state_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of purchase orders from MongoDB with filters"""
    from modules.depo_procurement.services import get_purchase_orders_list
    return await get_purchase_orders_list(search, state_id, date_from, date_to)


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


@router.patch("/purchase-orders/{order_id}")
async def update_purchase_order(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Update a purchase order in MongoDB"""
    db = get_db()
    
    # Get the JSON body
    body = await request.json()
    
    # Remove fields that shouldn't be updated directly
    body.pop('_id', None)
    body.pop('created_at', None)
    body.pop('created_by', None)
    
    # Add updated timestamp
    body['updated_at'] = datetime.utcnow()
    
    try:
        result = db['depo_purchase_orders'].update_one(
            {'_id': ObjectId(order_id)},
            {'$set': body}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        # Return updated order
        updated_order = db['depo_purchase_orders'].find_one({'_id': ObjectId(order_id)})
        return serialize_doc(updated_order)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update purchase order: {str(e)}")


@router.patch("/purchase-orders/{order_id}/documents")
async def update_order_documents(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Update documents field in purchase order"""
    db = get_db()
    
    # Get the JSON body with documents
    body = await request.json()
    documents = body.get('documents', {})
    
    try:
        result = db['depo_purchase_orders'].update_one(
            {'_id': ObjectId(order_id)},
            {
                '$set': {
                    'documents': documents,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        return {"message": "Documents updated successfully", "documents": documents}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update documents: {str(e)}")


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


@router.put("/purchase-orders/{order_id}/items/{item_id}")
async def update_purchase_order_item(
    request: Request,
    order_id: str,
    item_id: str,
    item_data: PurchaseOrderItemUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an item in a purchase order by item _id"""
    from modules.depo_procurement.services import update_order_item_by_id
    return await update_order_item_by_id(order_id, item_id, item_data)


@router.delete("/purchase-orders/{order_id}/items/{item_id}")
async def delete_purchase_order_item(
    request: Request,
    order_id: str,
    item_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete an item from a purchase order by item _id"""
    from modules.depo_procurement.services import delete_order_item_by_id
    return await delete_order_item_by_id(order_id, item_id)


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


@router.delete("/stock-items/{stock_id}")
async def delete_stock_item(
    request: Request,
    stock_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a received stock item"""
    db = get_db()
    
    try:
        # Get stock item
        stock = db.depo_stocks.find_one({'_id': ObjectId(stock_id)})
        if not stock:
            raise HTTPException(status_code=404, detail="Stock item not found")
        
        # Get purchase order
        order_id = stock.get('purchase_order_id')
        if order_id:
            order = db.depo_purchase_orders.find_one({'_id': order_id})
            if order:
                # Remove stock_id from items.stocks array
                items = order.get('items', [])
                for item in items:
                    if 'stocks' in item and ObjectId(stock_id) in item['stocks']:
                        item['stocks'].remove(ObjectId(stock_id))
                        
                        # Recalculate received quantity
                        received_qty = 0
                        for stock_oid in item.get('stocks', []):
                            stock_entry = db.depo_stocks.find_one({'_id': stock_oid})
                            if stock_entry:
                                received_qty += stock_entry.get('quantity', 0)
                        item['received'] = received_qty
                
                # Update order
                db.depo_purchase_orders.update_one(
                    {'_id': order_id},
                    {'$set': {'items': items, 'updated_at': datetime.utcnow()}}
                )
        
        # Delete stock item
        db.depo_stocks.delete_one({'_id': ObjectId(stock_id)})
        
        return {"message": "Stock item deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete stock item: {str(e)}")


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


@router.get("/document-templates")
async def get_document_templates(
    request: Request,
    current_user: dict = Depends(verify_token)
):
    """Get document template codes for procurement orders"""
    db = get_db()
    config_collection = db['config']
    
    try:
        config = config_collection.find_one({'slug': 'document_templates_cofig'})
        if config and 'items' in config:
            # Return procurement templates as object {code: name}
            procurement_templates = config['items'].get('procurement', {})
            return {"templates": procurement_templates}
        return {"templates": {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch document templates: {str(e)}")

@router.get("/stock-statuses")
async def get_stock_statuses(
    request: Request,
    current_user: dict = Depends(verify_token)
):
    """Get available stock statuses from depo_stocks_states collection"""
    db = get_db()
    collection = db['depo_stocks_states']
    
    try:
        cursor = collection.find().sort('value', 1)
        statuses = list(cursor)
        return {"statuses": serialize_doc(statuses)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock statuses: {str(e)}")
    
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
async def get_qc_records_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get QC records for a purchase order"""
    from modules.depo_procurement.services import get_qc_records
    return await get_qc_records(order_id)


@router.post("/purchase-orders/{order_id}/qc-records")
async def create_qc_record_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Create a new QC record for a purchase order"""
    from modules.depo_procurement.services import create_qc_record
    body = await request.json()
    return await create_qc_record(order_id, body, current_user)


@router.patch("/purchase-orders/{order_id}/qc-records/{qc_id}")
async def update_qc_record_endpoint(
    request: Request,
    order_id: str,
    qc_id: str,
    current_user: dict = Depends(verify_token)
):
    """Update a QC record"""
    from modules.depo_procurement.services import update_qc_record
    body = await request.json()
    return await update_qc_record(order_id, qc_id, body, current_user)
    
# ==================== APPROVAL FLOW ENDPOINTS ====================

@router.get("/purchase-orders/{order_id}/approval-flow")
async def get_approval_flow_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get approval flow for a purchase order"""
    from modules.depo_procurement.services import get_order_approval_flow
    return await get_order_approval_flow(order_id)


@router.post("/purchase-orders/{order_id}/approval-flow")
async def create_approval_flow_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Create approval flow for a purchase order using approval_templates"""
    from modules.depo_procurement.services import create_order_approval_flow
    return await create_order_approval_flow(order_id)


@router.post("/purchase-orders/{order_id}/sign")
async def sign_order_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Sign a purchase order approval flow"""
    from modules.depo_procurement.services import sign_purchase_order
    body = await request.json()
    action = body.get('action', 'issue')
    return await sign_purchase_order(
        order_id, action, current_user, 
        request.client.host, request.headers.get("user-agent")
    )


@router.delete("/purchase-orders/{order_id}/signatures/{user_id}")
async def remove_signature_endpoint(
    request: Request,
    order_id: str,
    user_id: str,
    current_user: dict = Depends(verify_token)
):
    """Remove signature from purchase order approval flow (admin only)"""
    from modules.depo_procurement.services import remove_order_signature
    return await remove_order_signature(order_id, user_id, current_user)

# ==================== RECEIVED STOCK APPROVAL FLOW ENDPOINTS ====================

@router.get("/purchase-orders/{order_id}/received-stock-approval-flow")
async def get_received_stock_approval_flow_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get approval flow for received stock"""
    from modules.depo_procurement.services import get_received_stock_approval_flow
    return await get_received_stock_approval_flow(order_id)


@router.post("/purchase-orders/{order_id}/received-stock-approval-flow")
async def create_received_stock_approval_flow_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Create approval flow for received stock"""
    from modules.depo_procurement.services import create_received_stock_approval_flow
    return await create_received_stock_approval_flow(order_id)


@router.post("/purchase-orders/{order_id}/sign-received-stock")
async def sign_received_stock_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Sign received stock approval flow"""
    from modules.depo_procurement.services import sign_received_stock
    body = await request.json()
    target_state_id = body.get('target_state_id')
    return await sign_received_stock(
        order_id, target_state_id, current_user,
        request.client.host, request.headers.get("user-agent")
    )


@router.delete("/purchase-orders/{order_id}/received-stock-signatures/{user_id}")
async def remove_received_stock_signature_endpoint(
    request: Request,
    order_id: str,
    user_id: str,
    current_user: dict = Depends(verify_token)
):
    """Remove signature from received stock approval flow"""
    from modules.depo_procurement.services import remove_received_stock_signature
    return await remove_received_stock_signature(order_id, user_id, current_user)


# ==================== JOURNAL ENDPOINT ====================

@router.get("/purchase-orders/{order_id}/journal")
async def get_order_journal(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get activity journal for purchase order"""
    from src.backend.utils.db import get_db
    from bson import ObjectId
    
    db = get_db()
    
    # Get logs for this order
    logs = list(db.logs.find({
        'collection': 'depo_purchase_orders',
        'object_id': order_id
    }).sort('timestamp', -1))
    
    # Format logs
    journal_entries = []
    for log in logs:
        entry = {
            'type': log.get('action', 'unknown'),
            'timestamp': log.get('timestamp').isoformat() if log.get('timestamp') else '',
            'user': log.get('user', 'System'),
            'description': log.get('description', ''),
            'details': log.get('details', {})
        }
        journal_entries.append(entry)
    
    return {'entries': journal_entries}
