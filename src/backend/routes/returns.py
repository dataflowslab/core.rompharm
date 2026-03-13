"""
Returns API - Return Orders
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, Form
from typing import Optional, Any, List, Dict
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token
from src.backend.models.approval_flow_model import ApprovalFlowModel
from src.backend.utils.approval_helpers import check_approval_completion, check_user_can_sign

router = APIRouter(prefix="/api/returns", tags=["returns"])

RETURN_ORDER_INITIAL_STATE_ID = "6943a4a6451609dd8a618ce0"
RETURN_ORDER_APPROVAL_TEMPLATE_ID = "69b39f0d0ec895067fed4e8d"


class ReturnReceiveStockRequest(BaseModel):
    order_item_id: Optional[str] = None
    part_id: str
    quantity: float
    location_id: str
    batch_code: Optional[str] = None
    supplier_batch_code: Optional[str] = None
    serial_numbers: Optional[str] = None
    packaging: Optional[str] = None
    transferable: Optional[bool] = False
    supplier_id: Optional[str] = None
    supplier_um_id: Optional[str] = None
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


def serialize_doc(doc: Any) -> Any:
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == '_id' or key.endswith('_id'):
                result[key] = str(value) if value else None
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = [
                    serialize_doc(item) if isinstance(item, dict)
                    else str(item) if isinstance(item, ObjectId)
                    else item
                    for item in value
                ]
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            else:
                result[key] = value
        return result
    return doc


def _safe_object_id(value: Any) -> Optional[ObjectId]:
    if not value:
        return None
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(value)
    except Exception:
        return None


def _get_state_by_name(collection, names: List[str], fallback_values: Optional[List[int]] = None):
    for name in names:
        state = collection.find_one({'name': {'$regex': name, '$options': 'i'}})
        if not state:
            state = collection.find_one({'slug': {'$regex': name, '$options': 'i'}})
        if state:
            return state
    if fallback_values:
        state = collection.find_one({'value': {'$in': fallback_values}})
        if state:
            return state
    return None


def _enrich_return_order(db, order: dict):
    if not order:
        return order

    customer_detail = None
    customer_id = order.get('customer_id')
    customer_oid = _safe_object_id(customer_id)
    if customer_oid:
        customer_detail = db['depo_companies'].find_one({'_id': customer_oid})
    if not customer_detail:
        sales_order_id = order.get('sales_order_id')
        sales_oid = _safe_object_id(sales_order_id)
        if sales_oid:
            sales_order = db['depo_sales_ordes'].find_one({'_id': sales_oid}) or db['depo_sales_orders'].find_one({'_id': sales_oid})
            if sales_order and sales_order.get('customer_id'):
                sales_customer_oid = _safe_object_id(sales_order.get('customer_id'))
                if sales_customer_oid:
                    customer_detail = db['depo_companies'].find_one({'_id': sales_customer_oid})

    if customer_detail:
        order['customer_detail'] = serialize_doc(customer_detail)

    state_id = order.get('state_id')
    state_oid = _safe_object_id(state_id) if state_id else None
    if state_oid:
        state = db['depo_sales_ordes_states'].find_one({'_id': state_oid})
        if state:
            order['state_detail'] = {
                'name': state.get('name'),
                'color': state.get('color', 'gray'),
                'value': state.get('value', 0)
            }
            order['status'] = state.get('value', 10)
            order['status_text'] = state.get('name')

    if 'line_items' not in order:
        order['line_items'] = len(order.get('items', []))
    if 'lines' not in order:
        order['lines'] = len(order.get('items', []))

    return order


@router.get("")
async def get_return_orders(
    search: Optional[str] = Query(None),
    state_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    skip: Optional[int] = Query(None, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=200),
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    coll = db['depo_return_orders']

    query = {}
    if search:
        search_val = search.strip()
        query['$or'] = [
            {'reference': {'$regex': search_val, '$options': 'i'}},
            {'sales_order_reference': {'$regex': search_val, '$options': 'i'}},
            {'notes': {'$regex': search_val, '$options': 'i'}}
        ]
    if state_id:
        state_oid = _safe_object_id(state_id)
        query['state_id'] = state_oid or state_id
    if date_from or date_to:
        query['issue_date'] = {}
        if date_from:
            query['issue_date']['$gte'] = date_from
        if date_to:
            query['issue_date']['$lte'] = date_to

    cursor = coll.find(query).sort('created_at', -1)
    total = coll.count_documents(query)
    if limit is not None:
        cursor = cursor.skip(skip or 0).limit(limit)
    elif skip:
        cursor = cursor.skip(skip)
    orders = list(cursor)

    for order in orders:
        _enrich_return_order(db, order)
        items = order.get('items', [])
        if items:
            received_lines = sum(1 for item in items if (item.get('received') or 0) > 0)
            order['line_items'] = received_lines
            order['lines'] = len(items)

    results = serialize_doc(orders)
    return {
        'results': results,
        'total': total,
        'skip': skip or 0,
        'limit': limit or len(results)
    }


@router.get("/order-statuses")
async def get_return_order_statuses(
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    collection = db['depo_sales_ordes_states']
    states = list(collection.find().sort('value', 1))
    return {"statuses": serialize_doc(states)}


@router.get("/stock-statuses")
async def get_stock_statuses(
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    collection = db['depo_stocks_states']
    statuses = list(collection.find().sort('value', 1))
    return {"statuses": serialize_doc(statuses)}


@router.get("/{return_id}")
async def get_return_order(
    return_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    order = db['depo_return_orders'].find_one({'_id': ObjectId(return_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Return order not found")

    _enrich_return_order(db, order)

    return serialize_doc(order)


@router.patch("/{return_id}")
async def update_return_order(
    request: Request,
    return_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    body = await request.json()

    body.pop('_id', None)
    body.pop('created_at', None)
    body.pop('created_by', None)
    body.pop('sales_order_id', None)
    body.pop('sales_order_reference', None)
    body.pop('customer_id', None)

    body['updated_at'] = datetime.utcnow()

    result = db['depo_return_orders'].update_one(
        {'_id': ObjectId(return_id)},
        {'$set': body}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Return order not found")

    updated = db['depo_return_orders'].find_one({'_id': ObjectId(return_id)})
    return serialize_doc(updated)


@router.get("/{return_id}/items")
async def get_return_order_items(
    return_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    order = db['depo_return_orders'].find_one({'_id': ObjectId(return_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Return order not found")

    items = order.get('items', [])
    for item in items:
        if '_id' not in item:
            item['_id'] = str(ObjectId())
        if not item.get('part') and item.get('part_id'):
            item['part'] = item.get('part_id')
        part_oid = _safe_object_id(item.get('part_id') or item.get('part'))
        if part_oid:
            part = db['depo_parts'].find_one({'_id': part_oid})
        else:
            part = None
        if part:
            item['part_detail'] = {
                'name': part.get('name'),
                'IPN': part.get('ipn'),
                'um': part.get('um')
            }

        received_qty = 0
        stocks = item.get('stocks') or []
        if stocks:
            for stock_oid in stocks:
                stock_entry = db['depo_stocks'].find_one({'_id': stock_oid})
                if stock_entry:
                    received_qty += stock_entry.get('quantity', 0)
        else:
            stock_cursor = db['depo_stocks'].find({
                'return_order_id': ObjectId(return_id),
                'part_id': part_oid
            })
            for stock_entry in stock_cursor:
                received_qty += stock_entry.get('quantity', 0)
        item['received'] = received_qty

        if item.get('sale_price') is None:
            item['sale_price'] = item.get('price') or item.get('unit_price')

    db['depo_return_orders'].update_one(
        {'_id': ObjectId(return_id)},
        {'$set': {'items': items, 'updated_at': datetime.utcnow()}}
    )

    return {"results": serialize_doc(items)}


@router.post("/{return_id}/receive-stock")
async def receive_return_stock(
    return_id: str,
    stock_data: ReturnReceiveStockRequest,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    orders_collection = db['depo_return_orders']
    stocks_collection = db['depo_stocks']
    states_collection = db['depo_stocks_states']

    order = orders_collection.find_one({'_id': ObjectId(return_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Return order not found")

    items = order.get('items', [])
    item = None
    item_index = -1
    for idx, order_item in enumerate(items):
        if stock_data.order_item_id and order_item.get('_id') == stock_data.order_item_id:
            item = order_item
            item_index = idx
            break
        if order_item.get('part_id') == stock_data.part_id:
            item = order_item
            item_index = idx
            break

    if not item:
        raise HTTPException(status_code=404, detail="Item not found in return order")

    part = None
    part_oid = _safe_object_id(item.get('part_id') or item.get('part'))
    if part_oid:
        part = db['depo_parts'].find_one({'_id': part_oid})

    state = states_collection.find_one({'_id': ObjectId('699b2d8a111409dd80cc361b')})
    if not state:
        state = states_collection.find_one({'name': 'Label'})
    if not state:
        raise HTTPException(status_code=400, detail="Label status not found in depo_stocks_states")

    stock_doc = {
        'part_id': part_oid,
        'location_id': ObjectId(stock_data.location_id),
        'quantity': stock_data.quantity,
        'batch_code': stock_data.batch_code or '',
        'supplier_batch_code': stock_data.supplier_batch_code or '',
        'serial_numbers': stock_data.serial_numbers or '',
        'packaging': stock_data.packaging or '',
        'state_id': state['_id'],
        'notes': stock_data.notes or '',
        'return_order_id': ObjectId(return_id),
        'return_order_reference': order.get('reference'),
        'sales_order_id': _safe_object_id(order.get('sales_order_id')),
        'sales_order_reference': order.get('sales_order_reference'),
        'customer_id': _safe_object_id(order.get('customer_id')),
        'supplier_id': _safe_object_id(stock_data.supplier_id) if stock_data.supplier_id else None,
        'supplier_um_id': _safe_object_id(stock_data.supplier_um_id) if stock_data.supplier_um_id else None,
        'received_date': datetime.utcnow(),
        'received_by': current_user.get('username'),
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username'),
        'updated_by': current_user.get('username'),
        'manufacturing_date': stock_data.manufacturing_date,
        'expected_quantity': stock_data.expected_quantity,
        'expiry_date': stock_data.expiry_date,
        'reset_date': stock_data.reset_date,
        'containers': stock_data.containers,
        'containers_cleaned': stock_data.containers_cleaned,
        'supplier_ba_no': stock_data.supplier_ba_no or '',
        'supplier_ba_date': stock_data.supplier_ba_date,
        'accord_ba': stock_data.accord_ba,
        'is_list_supplier': stock_data.is_list_supplier,
        'clean_transport': stock_data.clean_transport,
        'temperature_control': stock_data.temperature_control,
        'temperature_conditions_met': stock_data.temperature_conditions_met,
    }

    result = stocks_collection.insert_one(stock_doc)
    stock_id = result.inserted_id

    if 'stocks' not in item:
        item['stocks'] = []
    item['stocks'].append(stock_id)

    received_qty = 0
    for stock_oid in item.get('stocks', []):
        stock_entry = stocks_collection.find_one({'_id': stock_oid})
        if stock_entry:
            received_qty += stock_entry.get('quantity', 0)
    item['received'] = received_qty
    items[item_index] = item

    line_items = sum(1 for i in items if i.get('stocks') and len(i.get('stocks', [])) > 0)

    orders_collection.update_one(
        {'_id': ObjectId(return_id)},
        {'$set': {'items': items, 'line_items': line_items, 'updated_at': datetime.utcnow()}}
    )

    part_name = part.get('name', 'Unknown') if part else 'Unknown'
    db.logs.insert_one({
        'collection': 'depo_return_orders',
        'object_id': return_id,
        'action': 'stock_received',
        'user': current_user.get('username'),
        'timestamp': datetime.utcnow(),
        'description': f'Received stock from return: {part_name} - Quantity: {stock_data.quantity}',
        'details': {
            'part_id': str(part_oid) if part_oid else None,
            'part_name': part_name,
            'quantity': stock_data.quantity,
            'location_id': stock_data.location_id,
            'batch_code': stock_data.batch_code or '',
            'stock_id': str(stock_id)
        }
    })

    stock_doc['_id'] = stock_id
    return serialize_doc(stock_doc)


@router.get("/{return_id}/received-items")
async def get_received_items(
    return_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    stocks_collection = db['depo_stocks']

    cursor = stocks_collection.find({'return_order_id': ObjectId(return_id)}).sort('received_date', -1)
    stocks = list(cursor)

    for stock in stocks:
        if stock.get('part_id'):
            part = db['depo_parts'].find_one({'_id': ObjectId(stock['part_id'])})
            if part:
                stock['part_detail'] = {
                    'name': part.get('name'),
                    'ipn': part.get('ipn'),
                    'um': part.get('um')
                }
                if part.get('system_um_id'):
                    system_um = db['depo_ums'].find_one({'_id': ObjectId(part['system_um_id'])})
                    if system_um:
                        stock['system_um_detail'] = {
                            'name': system_um.get('name'),
                            'abrev': system_um.get('abrev'),
                            'symbol': system_um.get('symbol', '')
                        }
                if part.get('manufacturer_um_id'):
                    manufacturer_um = db['depo_ums'].find_one({'_id': ObjectId(part['manufacturer_um_id'])})
                    if manufacturer_um:
                        stock['manufacturer_um_detail'] = {
                            'name': manufacturer_um.get('name'),
                            'abrev': manufacturer_um.get('abrev'),
                            'symbol': manufacturer_um.get('symbol', '')
                        }
                conversion_modifier = part.get('conversion_modifier', 1.0) or 1.0
                stock['quantity_received'] = stock.get('quantity', 0)
                stock['quantity_system_um'] = stock.get('quantity', 0) * conversion_modifier
                stock['conversion_modifier'] = conversion_modifier

        if stock.get('location_id'):
            location = db['depo_locations'].find_one({'_id': ObjectId(stock['location_id'])})
            if location:
                stock['location_detail'] = {
                    'name': location.get('name'),
                    'description': location.get('description', '')
                }

        if stock.get('state_id'):
            state = db['depo_stocks_states'].find_one({'_id': ObjectId(stock['state_id'])})
            if state:
                stock['status'] = state.get('name')
                stock['status_detail'] = {
                    'name': state.get('name'),
                    'value': state.get('value'),
                    'color': state.get('color', 'gray')
                }

    return {"results": serialize_doc(stocks)}


@router.delete("/stock-items/{stock_id}")
async def delete_stock_item(
    stock_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    stocks_collection = db['depo_stocks']
    stock = stocks_collection.find_one({'_id': ObjectId(stock_id)})
    if not stock:
        raise HTTPException(status_code=404, detail="Stock item not found")

    return_order_id = stock.get('return_order_id')
    if return_order_id:
        order = db['depo_return_orders'].find_one({'_id': return_order_id})
        if order:
            items = order.get('items', [])
            for item in items:
                if 'stocks' in item and ObjectId(stock_id) in item['stocks']:
                    item['stocks'].remove(ObjectId(stock_id))
                    received_qty = 0
                    for stock_oid in item.get('stocks', []):
                        stock_entry = stocks_collection.find_one({'_id': stock_oid})
                        if stock_entry:
                            received_qty += stock_entry.get('quantity', 0)
                    item['received'] = received_qty

            db['depo_return_orders'].update_one(
                {'_id': return_order_id},
                {'$set': {'items': items, 'updated_at': datetime.utcnow()}}
            )

    stocks_collection.delete_one({'_id': ObjectId(stock_id)})
    return {"message": "Stock item deleted successfully"}


@router.get("/{return_id}/attachments")
async def get_attachments(
    return_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    collection = db['depo_return_order_attachments']
    cursor = collection.find({'order_id': ObjectId(return_id)}).sort('created_at', -1)
    attachments = list(cursor)

    for attachment in attachments:
        if attachment.get('file_path'):
            url_path = attachment['file_path'].replace('\\', '/')
            if not url_path.startswith('/'):
                url_path = '/' + url_path
            attachment['attachment'] = url_path

    return {"results": serialize_doc(attachments)}


@router.post("/{return_id}/attachments")
async def upload_attachment(
    return_id: str,
    file: UploadFile = File(...),
    comment: Optional[str] = Form(None),
    current_user: dict = Depends(verify_token)
):
    import os
    import hashlib

    db = get_db()
    collection = db['depo_return_order_attachments']

    file_content = await file.read()
    file_hash = hashlib.sha256(file_content).hexdigest()

    now = datetime.utcnow()
    file_dir = os.path.join('media', 'files', str(now.year), f"{now.month:02d}", f"{now.day:02d}")
    os.makedirs(file_dir, exist_ok=True)

    file_path = os.path.join(file_dir, file_hash)
    with open(file_path, 'wb') as f:
        f.write(file_content)

    doc = {
        'order_id': ObjectId(return_id),
        'filename': file.filename,
        'file_hash': file_hash,
        'file_path': file_path,
        'content_type': file.content_type,
        'size': len(file_content),
        'comment': comment or '',
        'created_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }

    result = collection.insert_one(doc)
    doc['_id'] = result.inserted_id

    return serialize_doc(doc)


@router.delete("/{return_id}/attachments/{attachment_id}")
async def delete_attachment(
    return_id: str,
    attachment_id: str,
    current_user: dict = Depends(verify_token)
):
    import os

    db = get_db()
    collection = db['depo_return_order_attachments']

    attachment = collection.find_one({'_id': ObjectId(attachment_id)})
    if attachment and attachment.get('file_path'):
        try:
            os.remove(attachment['file_path'])
        except Exception:
            pass

    result = collection.delete_one({'_id': ObjectId(attachment_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Attachment not found")

    return {"success": True}


@router.get("/{return_id}/approval-flow")
async def get_approval_flow(
    return_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    return_oid = _safe_object_id(return_id)
    object_ids = [return_id]
    if return_oid:
        object_ids.append(return_oid)

    flow = db.approval_flows.find_one({
        "object_type": "return_order",
        "object_id": {"$in": object_ids}
    })

    if not flow:
        return {"flow": None}

    flow["_id"] = str(flow["_id"])
    for signature in flow.get("signatures", []):
        user = db.users.find_one({"_id": ObjectId(signature["user_id"])})
        if user:
            signature["user_name"] = user.get("name") or user.get("username")

    return {"flow": serialize_doc(flow)}


@router.post("/{return_id}/approval-flow")
async def create_approval_flow(
    return_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    return_oid = _safe_object_id(return_id)
    object_ids = [return_id]
    if return_oid:
        object_ids.append(return_oid)

    existing = db.approval_flows.find_one({
        "object_type": "return_order",
        "object_id": {"$in": object_ids}
    })
    if existing:
        return serialize_doc(existing)

    approval_template = db['approval_templates'].find_one({
        '_id': ObjectId(RETURN_ORDER_APPROVAL_TEMPLATE_ID)
    })
    if not approval_template:
        raise HTTPException(status_code=404, detail="No approval template found for return orders")

    officers = approval_template.get('officers', [])
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

    required_officers.sort(key=lambda x: x.get('order', 0))
    optional_officers.sort(key=lambda x: x.get('order', 0))
    min_signatures = len(required_officers)

    flow_data = {
        "object_type": "return_order",
        "object_source": "depo_returns",
        "object_id": return_id,
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


@router.post("/{return_id}/sign")
async def sign_return_order(
    request: Request,
    return_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    body = await request.json()
    action = body.get('action', 'issue')

    return_oid = _safe_object_id(return_id)
    object_ids = [return_id]
    if return_oid:
        object_ids.append(return_oid)

    flow = db.approval_flows.find_one({
        "object_type": "return_order",
        "object_id": {"$in": object_ids}
    })
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this return order")

    user_id = str(current_user["_id"])
    existing_signature = next(
        (s for s in flow.get("signatures", []) if s["user_id"] == user_id),
        None
    )
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this return order")

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
        raise HTTPException(status_code=403, detail="You are not authorized to sign this return order")

    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="return_order",
        object_id=return_id,
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
        {"$push": {"signatures": signature}, "$set": {"status": "in_progress", "updated_at": timestamp}}
    )

    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    required_officers = updated_flow.get("required_officers", [])
    signatures = updated_flow.get("signatures", [])
    is_complete, _, _ = check_approval_completion(db, required_officers, signatures)

    states_collection = db['depo_sales_ordes_states']
    target_state = None
    if action == 'issue':
        target_state = _get_state_by_name(states_collection, ['issued', 'emis'], [20])
    elif action == 'cancel':
        target_state = _get_state_by_name(states_collection, ['cancel', 'anulat', 'canceled', 'cancelled'], [40, 50])

    if target_state:
        db['depo_return_orders'].update_one(
            {'_id': ObjectId(return_id)},
            {
                '$set': {
                    'state_id': target_state['_id'],
                    'updated_at': timestamp,
                    'signed_at': timestamp,
                    'signed_by': username,
                    'sign_action': action
                }
            }
        )

    if is_complete:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {"$set": {"status": "approved", "completed_at": timestamp, "updated_at": timestamp}}
        )

    db.logs.insert_one({
        'collection': 'depo_return_orders',
        'object_id': return_id,
        'action': 'order_signed',
        'user': username,
        'timestamp': timestamp,
        'description': f'Return order signed by {username} - Action: {action}',
        'details': {
            'action': action,
            'state_name': target_state.get('name') if target_state else 'Unknown',
            'signature_hash': signature_hash
        }
    })

    flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    return serialize_doc(flow)


@router.delete("/{return_id}/signatures/{user_id}")
async def remove_signature(
    return_id: str,
    user_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    is_admin = current_user.get('is_staff', False) or current_user.get('is_superuser', False)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admin can remove signatures")

    return_oid = _safe_object_id(return_id)
    object_ids = [return_id]
    if return_oid:
        object_ids.append(return_oid)

    flow = db.approval_flows.find_one({
        "object_type": "return_order",
        "object_id": {"$in": object_ids}
    })
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this return order")

    result = db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {"$pull": {"signatures": {"user_id": user_id}}, "$set": {"updated_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Signature not found")

    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    if len(updated_flow.get("signatures", [])) == 0:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {"$set": {"status": "pending"}}
        )

        pending_state = _safe_object_id(RETURN_ORDER_INITIAL_STATE_ID)
        if pending_state:
            db['depo_return_orders'].update_one(
                {'_id': ObjectId(return_id)},
                {
                    '$set': {
                        'state_id': pending_state,
                        'updated_at': datetime.utcnow()
                    },
                    '$unset': {
                        'signed_at': '',
                        'signed_by': '',
                        'sign_action': ''
                    }
                }
            )

    removed_user = db.users.find_one({'_id': ObjectId(user_id)})
    removed_username = removed_user.get('username') if removed_user else user_id

    db.logs.insert_one({
        'collection': 'depo_return_orders',
        'object_id': return_id,
        'action': 'signature_removed',
        'user': current_user.get('username'),
        'timestamp': datetime.utcnow(),
        'description': f'Signature removed from {removed_username} by {current_user.get("username")}',
        'details': {
            'removed_user_id': user_id,
            'removed_username': removed_username
        }
    })

    return {"message": "Signature removed successfully"}


@router.get("/{return_id}/journal")
async def get_return_order_journal(
    return_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    logs = list(db.logs.find({
        'collection': 'depo_return_orders',
        'object_id': return_id
    }).sort('timestamp', -1))

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
