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
async def get_qc_records(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get QC records for a purchase order"""
    db = get_db()
    collection = db['depo_procurement_qc']
    
    try:
        # Convert order_id string to ObjectId for MongoDB query
        order_obj_id = ObjectId(order_id)
        cursor = collection.find({'order_id': order_obj_id}).sort('created_at', -1)
        qc_records = list(cursor)
        return {"results": serialize_doc(qc_records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch QC records: {str(e)}")
    
# ==================== APPROVAL FLOW ENDPOINTS ====================

@router.get("/purchase-orders/{order_id}/approval-flow")
async def get_order_approval_flow(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get approval flow for a purchase order"""
    db = get_db()
    
    # ✅ FIX: Convert order_id to ObjectId for proper filtering
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": ObjectId(order_id)
    })
    
    if not flow:
        return {"flow": None}
    
    flow["_id"] = str(flow["_id"])
    
    for signature in flow.get("signatures", []):
        user = db.users.find_one({"_id": ObjectId(signature["user_id"])})
        if user:
            signature["user_name"] = user.get("name") or user.get("username")
    
    return {"flow": serialize_doc(flow)}


@router.post("/purchase-orders/{order_id}/approval-flow")
async def create_order_approval_flow(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Create approval flow for a purchase order using approval_templates"""
    db = get_db()
    
    # ✅ FIX: Convert order_id to ObjectId for proper filtering
    existing = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": ObjectId(order_id)
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Approval flow already exists for this order")
    
    # Get approval template
    templates_collection = db['approval_templates']
    approval_template = templates_collection.find_one({
        'object_type': 'procurement_order',
        'active': True
    })
    
    if not approval_template:
        raise HTTPException(status_code=404, detail="No active approval template found for procurement orders")
    
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
        "object_type": "procurement_order",
        "object_source": "depo_procurement",
        "object_id": ObjectId(order_id),  # ✅ FIX: Store as ObjectId
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


@router.post("/purchase-orders/{order_id}/sign")
async def sign_purchase_order(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Sign a purchase order approval flow"""
    from src.backend.models.approval_flow_model import ApprovalFlowModel
    
    db = get_db()
    
    # ✅ FIX: Convert order_id to ObjectId for proper filtering
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": ObjectId(order_id)
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this order")
    
    user_id = str(current_user["_id"])
    existing_signature = next(
        (s for s in flow.get("signatures", []) if s["user_id"] == user_id),
        None
    )
    
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this order")
    
    username = current_user["username"]
    can_sign = False
    
    for officer in flow.get("required_officers", []) + flow.get("optional_officers", []):
        if officer["type"] == "person" and officer["reference"] == user_id:
            can_sign = True
            break
        elif officer["type"] == "role":
            # Check if user has this role (role is ObjectId in users.role field)
            user_role_id = current_user.get("role")  # ObjectId from roles collection
            if user_role_id:
                # Get role details and check slug (lowercase identifier)
                role = db.roles.find_one({"_id": ObjectId(user_role_id)})
                if role and role.get("slug") == officer["reference"]:
                    can_sign = True
                    break
    
    if not can_sign:
        raise HTTPException(status_code=403, detail="You are not authorized to sign this order")
    
    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="procurement_order",
        object_id=order_id,
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
    
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    required_count = len(updated_flow.get("required_officers", []))
    
    required_signed = 0
    for officer in updated_flow.get("required_officers", []):
        if officer["type"] == "person":
            if any(s["user_id"] == officer["reference"] for s in updated_flow.get("signatures", [])):
                required_signed += 1
    
    if required_signed == required_count:
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
        
        processing_state = db['depo_purchase_orders_states'].find_one({'name': 'Processing'})
        if processing_state:
            db['depo_purchase_orders'].update_one(
                {'_id': ObjectId(order_id)},
                {
                    '$set': {
                        'state_id': processing_state['_id'],
                        'status': 'Processing',
                        'updated_at': timestamp,
                        'approved_at': timestamp,
                        'approved_by': username
                    }
                }
            )
    
    flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    return serialize_doc(flow)


@router.delete("/purchase-orders/{order_id}/signatures/{user_id}")
async def remove_order_signature(
    request: Request,
    order_id: str,
    user_id: str,
    current_user: dict = Depends(verify_token)
):
    """Remove signature from purchase order approval flow (admin only)"""
    db = get_db()
    
    is_admin = current_user.get('is_staff', False) or current_user.get('is_superuser', False)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admin can remove signatures")
    
    # ✅ FIX: Convert order_id to ObjectId for proper filtering
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": ObjectId(order_id)
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this order")
    
    result = db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$pull": {"signatures": {"user_id": user_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    if len(updated_flow.get("signatures", [])) == 0:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {"$set": {"status": "pending"}}
        )
    
    return {"message": "Signature removed successfully"}