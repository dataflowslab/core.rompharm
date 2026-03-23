"""
Sales API 
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Optional, Any, List
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel

from src.backend.utils.db import get_db
from src.backend.utils.sections_permissions import (
    require_section,
    get_section_permissions,
    apply_scope_to_query,
    is_doc_in_scope
)
from modules.inventory.stock_movements import create_movement, MovementType, update_balance

router = APIRouter(prefix="/api/sales", tags=["sales"])

RETURN_ORDER_INITIAL_STATE_ID = "6943a4a6451609dd8a618ce0"
RETURN_ORDER_APPROVAL_TEMPLATE_ID = "69b39f0d0ec895067fed4e8d"


def _ensure_sales_scope(db, current_user: dict, order_doc: dict) -> None:
    perms = get_section_permissions(db, current_user, "sales")
    if not is_doc_in_scope(db, current_user, perms, order_doc, created_by_field="created_by"):
        raise HTTPException(status_code=403, detail="Access denied")


def _get_sales_order_or_404(db, current_user: dict, order_id: str) -> dict:
    order = db['depo_sales_ordes'].find_one({'_id': ObjectId(order_id)})
    if not order:
        order = db['depo_sales_orders'].find_one({'_id': ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    _ensure_sales_scope(db, current_user, order)
    return order

# --- Models ---
class SalesOrderRequest(BaseModel):
    customer_id: str
    reference: Optional[str] = None
    customer_reference: Optional[str] = None
    currency: Optional[str] = "EUR"
    issue_date: Optional[str] = None
    target_date: Optional[str] = None
    destination_id: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None

class StatusUpdateRequest(BaseModel):
    status: int # Can be used for legacy if needed
    state_id: Optional[str] = None

class SalesOrderItemRequest(BaseModel):
    part_id: str
    quantity: float
    sale_price: Optional[float] = None
    sale_price_currency: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

class ReturnOrderItemRequest(BaseModel):
    order_item_id: str
    part_id: str
    quantity: float
    notes: Optional[str] = None

class ReturnOrderRequest(BaseModel):
    items: List[ReturnOrderItemRequest]
    notes: Optional[str] = None

class ShipmentRequest(BaseModel):
    reference: Optional[str] = None
    carrier: Optional[str] = None
    uit: Optional[str] = None
    tracking_number: Optional[str] = None
    shipment_date: Optional[str] = None
    delivery_date: Optional[str] = None
    notes: Optional[str] = None

class AllocationRequest(BaseModel):
    order_item_id: Optional[str] = None
    part_id: str
    source_location_id: Optional[str] = None
    batch_code: Optional[str] = None
    quantity: float
    shipment_id: Optional[str] = None

# --- Utils ---
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


def _load_sales_order_with_items(db, order_id: str):
    try:
        order_oid = ObjectId(order_id)
    except Exception:
        return None, None, []

    orders_collection = db['depo_sales_ordes']
    order = orders_collection.find_one({'_id': order_oid})
    if not order:
        orders_collection = db['depo_sales_orders']
        order = orders_collection.find_one({'_id': order_oid})
    if not order:
        return None, None, []

    items = order.get('items', [])

    if not items:
        legacy_query = {'order_id': {'$in': [order_id, order_oid]}}
        legacy_items = list(db['depo_sales_order_lines'].find(legacy_query))
        if legacy_items:
            mapped_items = []
            for legacy in legacy_items:
                mapped_items.append({
                    '_id': str(legacy.get('_id') or ObjectId()),
                    'order': order_id,
                    'part_id': legacy.get('part_id'),
                    'part': legacy.get('part_id'),
                    'quantity': legacy.get('quantity', 0),
                    'allocated': legacy.get('allocated', 0),
                    'shipped': legacy.get('shipped', 0),
                    'sale_price': legacy.get('sale_price'),
                    'sale_price_currency': legacy.get('sale_price_currency'),
                    'reference': legacy.get('reference', ''),
                    'notes': legacy.get('notes', '')
                })
            items = mapped_items
            orders_collection.update_one(
                {'_id': order_oid},
                {'$set': {'items': items, 'line_items': len(items), 'updated_at': datetime.utcnow()}}
            )

    for item in items:
        if '_id' not in item:
            item['_id'] = str(ObjectId())
        if not item.get('order'):
            item['order'] = order_id
        if not item.get('part') and item.get('part_id'):
            item['part'] = item.get('part_id')
        if item.get('part_id'):
            try:
                part = db['depo_parts'].find_one({'_id': ObjectId(item['part_id'])})
            except Exception:
                part = None
            if part:
                item['part_detail'] = {
                    'name': part.get('name'),
                    'IPN': part.get('ipn'),
                    'um': part.get('um')
                }
        if item.get('allocated') is None:
            item['allocated'] = 0
        if item.get('shipped') is None:
            item['shipped'] = 0

    orders_collection.update_one(
        {'_id': order_oid},
        {'$set': {'items': items, 'updated_at': datetime.utcnow()}}
    )

    return order, orders_collection, items


def _resolve_allocation_stock(db, part_id: str, batch_code: Optional[str], source_location_id: Optional[str], min_qty: Optional[float] = None):
    if not part_id or not source_location_id:
        return None, None
    try:
        part_oid = ObjectId(part_id)
        source_oid = ObjectId(source_location_id)
    except Exception:
        return None, None

    qty_filter = {'$gt': 0}
    if min_qty is not None and min_qty > 0:
        qty_filter = {'$gte': min_qty}

    balances = list(db.depo_stocks_balances.find({
        'location_id': source_oid,
        'quantity': qty_filter
    }))

    for bal in balances:
        stock = db.depo_stocks.find_one({
            '_id': bal.get('stock_id'),
            'part_id': part_oid,
            'batch_code': batch_code or ''
        })
        if stock:
            return stock, source_oid

    # Fallback: try stocks directly
    query = {'part_id': part_oid, 'batch_code': batch_code or ''}
    stock = db.depo_stocks.find_one(query)
    return stock, source_oid


def _safe_object_id(value):
    try:
        return value if isinstance(value, ObjectId) else ObjectId(value)
    except Exception:
        return None


def _create_sales_allocation_movement(db, order: dict, allocation: dict, current_user: dict):
    part_id = allocation.get('part_id') or allocation.get('part')
    batch_code = allocation.get('batch_code') or ''
    source_location_id = allocation.get('source_location_id')
    quantity = allocation.get('quantity', 0)

    if not part_id or not source_location_id or quantity <= 0:
        return None

    stock, source_oid = _resolve_allocation_stock(db, part_id, batch_code, str(source_location_id), quantity)
    if not stock or not source_oid:
        return None

    order_oid = _safe_object_id(order.get('_id')) or order.get('_id')

    movement_id = create_movement(
        db=db,
        stock_id=stock['_id'],
        part_id=stock['part_id'],
        batch_code=batch_code,
        movement_type=MovementType.CONSUMPTION,
        quantity=-float(quantity),
        from_location_id=source_oid,
        to_location_id=None,
        document_type='SALES_ORDER',
        document_id=order_oid,
        created_by=current_user.get('username', 'system'),
        notes=allocation.get('notes') or f"Sales order {order.get('reference', '')}"
    )

    db.depo_stocks_movements.update_one(
        {'_id': movement_id},
        {'$set': {
            'allocation_id': str(allocation.get('_id')),
            'order_id': order_oid,
            'order_reference': order.get('reference', ''),
            'state_id': stock.get('state_id'),
            'source_id': source_oid,
            'destination_id': None
        }}
    )

    return movement_id


def _update_sales_allocation_movement(db, order: dict, allocation_id: str, new_allocation: dict, previous_allocation: dict, current_user: dict):
    alloc_oid = _safe_object_id(allocation_id)
    movement = db.depo_stocks_movements.find_one({
        'allocation_id': {'$in': [allocation_id, alloc_oid]} ,
        'document_type': 'SALES_ORDER'
    })

    prev_qty = float(previous_allocation.get('quantity') or 0)
    new_qty = float(new_allocation.get('quantity') or 0)
    prev_source = previous_allocation.get('source_location_id')
    new_source = new_allocation.get('source_location_id')
    prev_batch = previous_allocation.get('batch_code') or ''
    new_batch = new_allocation.get('batch_code') or ''
    prev_part = previous_allocation.get('part_id') or previous_allocation.get('part')
    new_part = new_allocation.get('part_id') or new_allocation.get('part')

    if new_qty <= 0:
        if movement and movement.get('from_location_id') and movement.get('stock_id'):
            try:
                stock_oid = _safe_object_id(movement.get('stock_id'))
                loc_oid = _safe_object_id(movement.get('from_location_id'))
                if stock_oid and loc_oid:
                    update_balance(
                        db,
                        stock_oid,
                        loc_oid,
                        abs(float(movement.get('quantity') or 0)),
                        datetime.utcnow()
                    )
            except Exception:
                pass
            db.depo_stocks_movements.delete_one({'_id': movement['_id']})
        return

    if not movement:
        _create_sales_allocation_movement(db, order, new_allocation, current_user)
        return

    source_changed = str(prev_source) != str(new_source)
    batch_changed = (prev_batch or '') != (new_batch or '')
    part_changed = str(prev_part) != str(new_part)

    # Reverse old balance if source/batch/part changed
    if source_changed or batch_changed or part_changed:
        if movement.get('from_location_id') and movement.get('stock_id'):
            try:
                stock_oid = _safe_object_id(movement.get('stock_id'))
                loc_oid = _safe_object_id(movement.get('from_location_id'))
                if stock_oid and loc_oid:
                    update_balance(
                        db,
                        stock_oid,
                        loc_oid,
                        abs(float(movement.get('quantity') or 0)),
                        datetime.utcnow()
                    )
            except Exception:
                pass

        stock, source_oid = _resolve_allocation_stock(db, new_part, new_batch, str(new_source), new_qty)
        if not stock or not source_oid:
            return

        db.depo_stocks_movements.update_one(
            {'_id': movement['_id']},
            {'$set': {
                'stock_id': stock['_id'],
                'part_id': stock['part_id'],
                'batch_code': new_batch,
                'quantity': -float(new_qty),
                'from_location_id': source_oid,
                'to_location_id': None,
                'source_id': source_oid,
                'destination_id': None,
                'state_id': stock.get('state_id'),
                'updated_at': datetime.utcnow(),
                'updated_by': current_user.get('username', 'system')
            }}
        )

        try:
            update_balance(
                db,
                stock['_id'],
                source_oid,
                -float(new_qty),
                datetime.utcnow()
            )
        except Exception:
            pass
        return

    # Quantity change only
    if movement.get('from_location_id') and movement.get('stock_id'):
        delta = new_qty - prev_qty
        if abs(delta) > 0:
            try:
                stock_oid = _safe_object_id(movement.get('stock_id'))
                loc_oid = _safe_object_id(movement.get('from_location_id'))
                if stock_oid and loc_oid:
                    update_balance(
                        db,
                        stock_oid,
                        loc_oid,
                        -float(delta),
                        datetime.utcnow()
                    )
            except Exception:
                pass

    db.depo_stocks_movements.update_one(
        {'_id': movement['_id']},
        {'$set': {
            'quantity': -float(new_qty),
            'updated_at': datetime.utcnow(),
            'updated_by': current_user.get('username', 'system')
        }}
    )


@router.get("/sales-orders")
async def get_sales_orders(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    state_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    skip: Optional[int] = Query(None, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=200),
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    collection = db['depo_sales_ordes']
    
    query = {}
    
    if search:
        search_val = search.strip()
        or_clauses = [
            {'reference': {'$regex': search_val, '$options': 'i'}},
            {'description': {'$regex': search_val, '$options': 'i'}},
            {'customer_reference': {'$regex': search_val, '$options': 'i'}}
        ]
        
        # Customer name search
        customers = db['depo_companies'].find(
            {'name': {'$regex': search_val, '$options': 'i'}},
            {'_id': 1}
        )
        customer_ids = [c['_id'] for c in customers]
        if customer_ids:
            customer_id_variants = customer_ids + [str(cid) for cid in customer_ids]
            or_clauses.append({'customer_id': {'$in': customer_id_variants}})
            
        query['$or'] = or_clauses

    if state_id:
        query['state_id'] = ObjectId(state_id)
        
    if date_from or date_to:
        query['issue_date'] = {}
        if date_from:
            query['issue_date']['$gte'] = date_from
        if date_to:
            query['issue_date']['$lte'] = date_to

    perms = get_section_permissions(db, current_user, "sales")
    query = apply_scope_to_query(db, current_user, perms, query, created_by_field="created_by")
            
    try:
        cursor = collection.find(query).sort('created_at', -1)
        total = collection.count_documents(query)
        if limit is not None:
            cursor = cursor.skip(skip or 0).limit(limit)
        elif skip:
            cursor = cursor.skip(skip)
        orders = list(cursor)
        
        # Enrich orders
        for order in orders:
            if order.get('customer_id'):
                customer = db['depo_companies'].find_one({'_id': ObjectId(order['customer_id'])})
                if customer:
                    order['customer_detail'] = serialize_doc(customer)
                    
            if order.get('state_id'):
                state = db['depo_sales_ordes_states'].find_one({'_id': order['state_id']})
                if state:
                    order['state_detail'] = {
                        'name': state.get('name'),
                        'color': state.get('color', 'gray'),
                        'value': state.get('value', 0)
                    }
                    order['status'] = state.get('value', 10)
                    order['status_text'] = state.get('name')
            else:
                order['state_detail'] = {'name': 'Draft', 'color': 'gray', 'value': 10}
                order['status'] = 10
                order['status_text'] = 'Draft'
                
        results = serialize_doc(orders)
        return {
            'results': results,
            'total': total,
            'skip': skip or 0,
            'limit': limit or len(results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sales-orders")
async def create_sales_order(
    order_data: SalesOrderRequest,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    collection = db['depo_sales_ordes']
    
    reference = order_data.reference
    if not reference:
        last_order = collection.find_one(
            {'reference': {'$regex': '^SO-'}},
            sort=[('reference', -1)]
        )
        max_num = 0
        if last_order and last_order.get('reference'):
            try:
                max_num = int(last_order['reference'].replace('SO-', ''))
            except ValueError:
                pass
        reference = f"SO-{max_num + 1:04d}"
        
    # Get initial state
    states_collection = db['depo_sales_ordes_states']
    draft_state = states_collection.find_one({'name': 'Draft'}) or states_collection.find_one({'value': 10})
    
    doc = {
        'reference': reference,
        'customer_id': ObjectId(order_data.customer_id),
        'customer_reference': order_data.customer_reference or '',
        'description': order_data.description or '',
        'currency': order_data.currency or 'EUR',
        'issue_date': order_data.issue_date,
        'target_date': order_data.target_date,
        'destination_id': ObjectId(order_data.destination_id) if order_data.destination_id else None,
        'notes': order_data.notes or '',
        'state_id': draft_state['_id'] if draft_state else None,
        'items': [],
        'line_items': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }
    
    try:
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        
        # Try creating approval flow
        try:
            templates_collection = db['approval_templates']
            approval_template = templates_collection.find_one({
                '_id': ObjectId('69a1250e4e9208a5d9b2ac04') # Specific template required by user
            })
            
            if approval_template:
                officers = approval_template.get('officers', [])
                required_officers = []
                optional_officers = []
                
                for officer in officers:
                    o_data = {
                        "type": officer.get('type'),
                        "reference": officer.get('reference'),
                        "action": officer.get('action'),
                        "order": officer.get('order', 0)
                    }
                    if officer.get('action') == 'must_sign':
                        required_officers.append(o_data)
                    elif officer.get('action') == 'can_sign':
                        optional_officers.append(o_data)
                        
                required_officers.sort(key=lambda x: x.get('order', 0))
                optional_officers.sort(key=lambda x: x.get('order', 0))
                
                flow_data = {
                    "object_type": "sales_order",
                    "object_source": "depo_sales",
                    "object_id": str(result.inserted_id),
                    "template_id": str(approval_template['_id']),
                    "template_name": approval_template.get('name'),
                    "min_signatures": len(required_officers),
                    "required_officers": required_officers,
                    "optional_officers": optional_officers,
                    "signatures": [],
                    "status": "pending",
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                db['approval_flows'].insert_one(flow_data)
        except Exception as e:
            print(f"Failed to auto-create approval flow: {e}")
            
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sales-orders/{order_id}")
async def get_sales_order(
    order_id: str,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    try:
        order = db['depo_sales_ordes'].find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        _ensure_sales_scope(db, current_user, order)
            
        if order.get('customer_id'):
            customer = db['depo_companies'].find_one({'_id': ObjectId(order['customer_id'])})
            if customer:
                order['customer_detail'] = serialize_doc(customer)
                
        if order.get('state_id'):
            state = db['depo_sales_ordes_states'].find_one({'_id': order['state_id']})
            if state:
                order['state_detail'] = {
                    'name': state.get('name'),
                    'color': state.get('color', 'gray'),
                    'value': state.get('value', 0)
                }
                order['status'] = state.get('value', 10)
                order['status_text'] = state.get('name')
                
        if order.get('destination_id'):
            loc = db['depo_locations'].find_one({'_id': ObjectId(order['destination_id'])})
            if loc:
                order['destination_detail'] = serialize_doc(loc)
                
        return serialize_doc(order)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sales-orders/{order_id}/items")
async def get_sales_order_items(
    order_id: str,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    orders_collection = db['depo_sales_ordes']
    order = orders_collection.find_one({'_id': ObjectId(order_id)})
    if not order:
        orders_collection = db['depo_sales_orders']
        order = orders_collection.find_one({'_id': ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _ensure_sales_scope(db, current_user, order)

    items = order.get('items', [])

    # Backfill from legacy lines if no embedded items
    if not items:
        legacy_items = list(db['depo_sales_order_lines'].find({'order_id': {'$in': [order_id, ObjectId(order_id)]}}))
        if legacy_items:
            mapped_items = []
            for legacy in legacy_items:
                mapped_items.append({
                    '_id': str(legacy.get('_id') or ObjectId()),
                    'order': order_id,
                    'part_id': legacy.get('part_id'),
                    'part': legacy.get('part_id'),
                    'quantity': legacy.get('quantity', 0),
                    'allocated': legacy.get('allocated', 0),
                    'shipped': legacy.get('shipped', 0),
                    'sale_price': legacy.get('sale_price'),
                    'sale_price_currency': legacy.get('sale_price_currency'),
                    'reference': legacy.get('reference', ''),
                    'notes': legacy.get('notes', '')
                })
            items = mapped_items
            orders_collection.update_one(
                {'_id': ObjectId(order_id)},
                {'$set': {'items': items, 'line_items': len(items), 'updated_at': datetime.utcnow()}}
            )

    # Enrich items with part details
    for item in items:
        if '_id' not in item:
            item['_id'] = str(ObjectId())
        if not item.get('order'):
            item['order'] = order_id
        if not item.get('part') and item.get('part_id'):
            item['part'] = item.get('part_id')
        if item.get('part_id'):
            try:
                part = db['depo_parts'].find_one({'_id': ObjectId(item['part_id'])})
            except Exception:
                part = None
            if part:
                item['part_detail'] = {
                    'name': part.get('name'),
                    'IPN': part.get('ipn'),
                    'um': part.get('um')
                }
        if item.get('allocated') is None:
            item['allocated'] = 0
        if item.get('shipped') is None:
            item['shipped'] = 0

    orders_collection.update_one(
        {'_id': ObjectId(order_id)},
        {'$set': {'items': items, 'updated_at': datetime.utcnow()}}
    )

    return {"results": serialize_doc(items)}


@router.post("/sales-orders/{order_id}/items")
async def add_sales_order_item(
    order_id: str,
    item: SalesOrderItemRequest,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    orders = db['depo_sales_ordes']
    parts = db['depo_parts']

    order = orders.find_one({'_id': ObjectId(order_id)})
    if not order:
        orders = db['depo_sales_orders']
        order = orders.find_one({'_id': ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _ensure_sales_scope(db, current_user, order)

    _ensure_sales_scope(db, current_user, order)

    part = parts.find_one({'_id': ObjectId(item.part_id)})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    if not part.get('is_salable', False):
        raise HTTPException(status_code=400, detail="Part is not marked as salable")

    doc = {
        '_id': str(ObjectId()),
        'order': order_id,
        'part_id': item.part_id,
        'part': item.part_id,
        'quantity': item.quantity,
        'allocated': 0,
        'shipped': 0,
        'sale_price': item.sale_price,
        'sale_price_currency': item.sale_price_currency or order.get('currency') or 'EUR',
        'reference': item.reference or '',
        'notes': item.notes or '',
        'part_detail': {
            'name': part.get('name'),
            'IPN': part.get('ipn'),
            'um': part.get('um')
        }
    }

    items = order.get('items', [])
    items.append(doc)

    orders.update_one(
        {'_id': ObjectId(order_id)},
        {'$set': {
            'items': items,
            'line_items': len(items),
            'updated_at': datetime.utcnow()
        }}
    )

    return serialize_doc(doc)


@router.put("/sales-orders/{order_id}/items/{item_id}")
async def update_sales_order_item(
    order_id: str,
    item_id: str,
    item: SalesOrderItemRequest,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    orders = db['depo_sales_ordes']
    parts = db['depo_parts']

    order = orders.find_one({'_id': ObjectId(order_id)})
    if not order:
        orders = db['depo_sales_orders']
        order = orders.find_one({'_id': ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _ensure_sales_scope(db, current_user, order)

    items = order.get('items', [])
    item_index = next((idx for idx, it in enumerate(items) if it.get('_id') == item_id), None)
    if item_index is None:
        raise HTTPException(status_code=404, detail="Item not found")

    existing = items[item_index]

    existing['quantity'] = item.quantity
    existing['sale_price'] = item.sale_price
    existing['sale_price_currency'] = item.sale_price_currency or existing.get('sale_price_currency') or order.get('currency')
    existing['reference'] = item.reference or ''
    existing['notes'] = item.notes or ''

    if item.part_id and item.part_id != existing.get('part_id'):
        part = parts.find_one({'_id': ObjectId(item.part_id)})
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        existing['part_id'] = item.part_id
        existing['part'] = item.part_id
        existing['part_detail'] = {
            'name': part.get('name'),
            'IPN': part.get('ipn'),
            'um': part.get('um')
        }

    items[item_index] = existing

    orders.update_one(
        {'_id': ObjectId(order_id)},
        {'$set': {'items': items, 'updated_at': datetime.utcnow()}}
    )

    return serialize_doc(existing)


@router.delete("/sales-orders/{order_id}/items/{item_id}")
async def delete_sales_order_item(
    order_id: str,
    item_id: str,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    orders = db['depo_sales_ordes']

    order = orders.find_one({'_id': ObjectId(order_id)})
    if not order:
        orders = db['depo_sales_orders']
        order = orders.find_one({'_id': ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    items = order.get('items', [])
    new_items = [it for it in items if it.get('_id') != item_id]
    if len(new_items) == len(items):
        raise HTTPException(status_code=404, detail="Item not found")

    orders.update_one(
        {'_id': ObjectId(order_id)},
        {'$set': {
            'items': new_items,
            'line_items': len(new_items),
            'updated_at': datetime.utcnow()
        }}
    )

    return {"success": True}


@router.get("/sales-orders/{order_id}/shipments")
async def get_sales_order_shipments(
    order_id: str,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    _get_sales_order_or_404(db, current_user, order_id)
    shipments = list(db['depo_sales_shipments'].find({'order_id': order_id}))
    return {"results": serialize_doc(shipments)}


@router.post("/sales-orders/{order_id}/shipments")
async def create_sales_order_shipment(
    order_id: str,
    shipment: ShipmentRequest,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    _get_sales_order_or_404(db, current_user, order_id)

    doc = {
        'order_id': order_id,
        'reference': shipment.reference or '',
        'carrier': shipment.carrier or '',
        'uit': shipment.uit or '',
        'tracking_number': shipment.tracking_number or '',
        'shipment_date': shipment.shipment_date,
        'delivery_date': shipment.delivery_date,
        'notes': shipment.notes or '',
        'items': [],
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }
    result = db['depo_sales_shipments'].insert_one(doc)
    doc['_id'] = result.inserted_id
    return serialize_doc(doc)


@router.put("/sales-orders/{order_id}/shipments/{shipment_id}")
async def update_sales_order_shipment(
    order_id: str,
    shipment_id: str,
    shipment: ShipmentRequest,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    coll = db['depo_sales_shipments']
    _get_sales_order_or_404(db, current_user, order_id)
    existing = coll.find_one({'_id': ObjectId(shipment_id), 'order_id': order_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Shipment not found")

    update_fields = {
        'reference': shipment.reference if shipment.reference is not None else existing.get('reference', ''),
        'carrier': shipment.carrier if shipment.carrier is not None else existing.get('carrier', ''),
        'uit': shipment.uit if shipment.uit is not None else existing.get('uit', ''),
        'tracking_number': shipment.tracking_number if shipment.tracking_number is not None else existing.get('tracking_number', ''),
        'shipment_date': shipment.shipment_date,
        'delivery_date': shipment.delivery_date,
        'notes': shipment.notes if shipment.notes is not None else existing.get('notes', ''),
        'updated_at': datetime.utcnow()
    }
    coll.update_one({'_id': ObjectId(shipment_id)}, {'$set': update_fields})
    updated = coll.find_one({'_id': ObjectId(shipment_id)})
    return serialize_doc(updated)


@router.delete("/sales-orders/{order_id}/shipments/{shipment_id}")
async def delete_sales_order_shipment(
    order_id: str,
    shipment_id: str,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    coll = db['depo_sales_shipments']
    _get_sales_order_or_404(db, current_user, order_id)
    result = coll.delete_one({'_id': ObjectId(shipment_id), 'order_id': order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return {"success": True}


@router.get("/sales-orders/{order_id}/attachments")
async def get_sales_order_attachments(
    order_id: str,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    _get_sales_order_or_404(db, current_user, order_id)
    atts = list(db['depo_sales_order_attachments'].find({'order_id': order_id}))
    return {"results": serialize_doc(atts)}


@router.get("/sales-orders/{order_id}/returns")
async def get_sales_order_returns(
    order_id: str,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    _get_sales_order_or_404(db, current_user, order_id)
    coll = db['depo_return_orders']
    query = {'sales_order_id': order_id}
    try:
        query = {'sales_order_id': {'$in': [order_id, ObjectId(order_id)]}}
    except Exception:
        pass
    returns = list(coll.find(query).sort('created_at', -1))
    return {"results": serialize_doc(returns)}


@router.post("/sales-orders/{order_id}/returns")
async def create_sales_order_return(
    order_id: str,
    payload: ReturnOrderRequest,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()

    order, _, order_items = _load_sales_order_with_items(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    _ensure_sales_scope(db, current_user, order)

    if not payload.items:
        raise HTTPException(status_code=400, detail="Return must have at least one item")

    coll = db['depo_return_orders']

    returned_by_item = {}
    try:
        query = {'sales_order_id': {'$in': [order_id, ObjectId(order_id)]}}
    except Exception:
        query = {'sales_order_id': order_id}
    existing_returns = list(coll.find(query))
    for ret in existing_returns:
        for item in ret.get('items', []):
            key = item.get('order_item_id') or item.get('order_item') or item.get('sales_item_id')
            if not key:
                continue
            returned_by_item[key] = returned_by_item.get(key, 0.0) + float(item.get('quantity') or 0)

    items_by_id = {str(item.get('_id')): item for item in order_items}

    return_items = []
    for req_item in payload.items:
        if req_item.quantity is None or req_item.quantity <= 0:
            continue

        order_item_id = req_item.order_item_id
        if not order_item_id or order_item_id not in items_by_id:
            raise HTTPException(status_code=400, detail="Invalid order item")

        source_item = items_by_id[order_item_id]
        available = float(source_item.get('quantity') or 0) - float(returned_by_item.get(order_item_id, 0.0))
        if req_item.quantity > available + 1e-6:
            raise HTTPException(status_code=400, detail="Return quantity exceeds available amount")

        part_id = req_item.part_id or source_item.get('part_id') or source_item.get('part')
        if not part_id:
            raise HTTPException(status_code=400, detail="Part not found for item")

        part_detail = source_item.get('part_detail')
        if not part_detail:
            try:
                part_doc = db['depo_parts'].find_one({'_id': ObjectId(part_id)})
            except Exception:
                part_doc = None
            if part_doc:
                part_detail = {
                    'name': part_doc.get('name'),
                    'IPN': part_doc.get('ipn'),
                    'um': part_doc.get('um')
                }

        return_items.append({
            '_id': str(ObjectId()),
            'order_item_id': order_item_id,
            'part_id': part_id,
            'part': part_id,
            'quantity': req_item.quantity,
            'received': 0,
            'stocks': [],
            'sale_price': source_item.get('sale_price'),
            'sale_price_currency': source_item.get('sale_price_currency'),
            'notes': req_item.notes or '',
            'part_detail': part_detail
        })

    if not return_items:
        raise HTTPException(status_code=400, detail="Return must have at least one item")

    reference = None
    last_order = coll.find_one(
        {'reference': {'$regex': '^RO-'}},
        sort=[('reference', -1)]
    )
    if last_order and last_order.get('reference'):
        try:
            reference = int(last_order['reference'].replace('RO-', ''))
        except ValueError:
            reference = None
    next_ref = (reference or 0) + 1
    reference = f"RO-{next_ref:04d}"

    doc = {
        'reference': reference,
        'sales_order_id': order_id,
        'sales_order_reference': order.get('reference', ''),
        'customer_id': order.get('customer_id'),
        'currency': order.get('currency', ''),
        'issue_date': datetime.utcnow().strftime('%Y-%m-%d'),
        'notes': payload.notes or '',
        'items': return_items,
        'line_items': len(return_items),
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }
    try:
        doc['state_id'] = ObjectId(RETURN_ORDER_INITIAL_STATE_ID)
    except Exception:
        doc['state_id'] = RETURN_ORDER_INITIAL_STATE_ID

    result = coll.insert_one(doc)
    doc['_id'] = result.inserted_id

    try:
        templates_collection = db['approval_templates']
        approval_template = templates_collection.find_one({
            '_id': ObjectId(RETURN_ORDER_APPROVAL_TEMPLATE_ID)
        })

        if approval_template:
            officers = approval_template.get('officers', [])
            required_officers = []
            optional_officers = []

            for officer in officers:
                o_data = {
                    "type": officer.get('type'),
                    "reference": officer.get('reference'),
                    "action": officer.get('action'),
                    "order": officer.get('order', 0)
                }
                if officer.get('action') == 'must_sign':
                    required_officers.append(o_data)
                elif officer.get('action') == 'can_sign':
                    optional_officers.append(o_data)

            required_officers.sort(key=lambda x: x.get('order', 0))
            optional_officers.sort(key=lambda x: x.get('order', 0))

            flow_data = {
                "object_type": "return_order",
                "object_source": "depo_returns",
                "object_id": str(result.inserted_id),
                "template_id": str(approval_template['_id']),
                "template_name": approval_template.get('name'),
                "min_signatures": len(required_officers),
                "required_officers": required_officers,
                "optional_officers": optional_officers,
                "signatures": [],
                "status": "pending",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            db['approval_flows'].insert_one(flow_data)
    except Exception as e:
        print(f"Failed to auto-create approval flow for return order: {e}")

    return serialize_doc(doc)


@router.get("/sales-orders/{order_id}/allocations")
async def get_sales_order_allocations(
    order_id: str,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    _get_sales_order_or_404(db, current_user, order_id)
    allocs = list(db['depo_sales_allocations'].find({'order_id': order_id}))
    for alloc in allocs:
        if alloc.get('part_id'):
            part = db['depo_parts'].find_one({'_id': ObjectId(alloc['part_id'])})
            if part:
                alloc['part_detail'] = serialize_doc(part)
        if alloc.get('source_location_id'):
            loc = db['depo_locations'].find_one({'_id': ObjectId(alloc['source_location_id'])})
            if loc:
                alloc['source_location_detail'] = serialize_doc(loc)
    return {"results": serialize_doc(allocs)}


@router.post("/sales-orders/{order_id}/allocations")
async def create_sales_order_allocation(
    order_id: str,
    allocation: AllocationRequest,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    _get_sales_order_or_404(db, current_user, order_id)

    if allocation.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    doc = {
        'order_id': order_id,
        'order_item_id': allocation.order_item_id,
        'part_id': allocation.part_id,
        'source_location_id': ObjectId(allocation.source_location_id) if allocation.source_location_id else None,
        'batch_code': allocation.batch_code,
        'quantity': allocation.quantity,
        'shipment_id': allocation.shipment_id,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }
    result = db['depo_sales_allocations'].insert_one(doc)
    doc['_id'] = result.inserted_id
    try:
        order = db['depo_sales_ordes'].find_one({'_id': ObjectId(order_id)}) or db['depo_sales_orders'].find_one({'_id': ObjectId(order_id)})
        if order:
            _create_sales_allocation_movement(db, order, doc, current_user)
    except Exception as e:
        print(f"[SALES] Warning: Failed to create sales movement: {e}")
    return serialize_doc(doc)


@router.put("/sales-orders/{order_id}/allocations/{allocation_id}")
async def update_sales_order_allocation(
    order_id: str,
    allocation_id: str,
    allocation: AllocationRequest,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    _get_sales_order_or_404(db, current_user, order_id)
    coll = db['depo_sales_allocations']
    existing = coll.find_one({'_id': ObjectId(allocation_id), 'order_id': order_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Allocation not found")

    update_fields = {
        'quantity': allocation.quantity,
        'batch_code': allocation.batch_code,
        'source_location_id': ObjectId(allocation.source_location_id) if allocation.source_location_id else None,
        'shipment_id': allocation.shipment_id,
        'updated_at': datetime.utcnow()
    }
    coll.update_one({'_id': ObjectId(allocation_id)}, {'$set': update_fields})
    updated = coll.find_one({'_id': ObjectId(allocation_id)})
    try:
        order = db['depo_sales_ordes'].find_one({'_id': ObjectId(order_id)}) or db['depo_sales_orders'].find_one({'_id': ObjectId(order_id)})
        if order and updated:
            _update_sales_allocation_movement(db, order, allocation_id, updated, existing, current_user)
    except Exception as e:
        print(f"[SALES] Warning: Failed to update sales movement: {e}")
    return serialize_doc(updated)


@router.delete("/sales-orders/{order_id}/allocations/{allocation_id}")
async def delete_sales_order_allocation(
    order_id: str,
    allocation_id: str,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    _get_sales_order_or_404(db, current_user, order_id)
    coll = db['depo_sales_allocations']
    existing = coll.find_one({'_id': ObjectId(allocation_id), 'order_id': order_id})
    result = coll.delete_one({'_id': ObjectId(allocation_id), 'order_id': order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Allocation not found")
    try:
        alloc_oid = _safe_object_id(allocation_id)
        movement = db.depo_stocks_movements.find_one({
            'allocation_id': {'$in': [allocation_id, alloc_oid]},
            'document_type': 'SALES_ORDER'
        })
        if movement and movement.get('from_location_id') and movement.get('stock_id'):
            try:
                update_balance(
                    db,
                    movement.get('stock_id'),
                    movement.get('from_location_id'),
                    abs(float(movement.get('quantity') or 0)),
                    datetime.utcnow()
                )
            except Exception:
                pass
            db.depo_stocks_movements.delete_one({'_id': movement['_id']})
    except Exception as e:
        print(f"[SALES] Warning: Failed to remove sales movement: {e}")
    return {"success": True}


@router.get("/order-statuses")
async def get_sales_order_statuses(
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    states = list(db['depo_sales_ordes_states'].find().sort('value', 1))
    return {"statuses": serialize_doc(states)}


@router.get("/returns")
async def get_return_orders(
    search: Optional[str] = Query(None),
    state_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(require_section("sales"))
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
        try:
            query['state_id'] = ObjectId(state_id)
        except Exception:
            query['state_id'] = state_id
    if date_from or date_to:
        query['issue_date'] = {}
        if date_from:
            query['issue_date']['$gte'] = date_from
        if date_to:
            query['issue_date']['$lte'] = date_to

    returns = list(coll.find(query).sort('created_at', -1))

    for ret in returns:
        if ret.get('state_id'):
            try:
                state_oid = ObjectId(ret['state_id']) if isinstance(ret['state_id'], str) else ret['state_id']
                state = db['depo_sales_ordes_states'].find_one({'_id': state_oid})
            except Exception:
                state = None
            if state:
                ret['state_detail'] = {
                    'name': state.get('name'),
                    'color': state.get('color', 'gray'),
                    'value': state.get('value', 0)
                }
                ret['status'] = state.get('value', 10)
                ret['status_text'] = state.get('name')

        customer_detail = None
        customer_id = ret.get('customer_id')
        if customer_id:
            try:
                customer_oid = ObjectId(customer_id) if isinstance(customer_id, str) else customer_id
                customer_detail = db['depo_companies'].find_one({'_id': customer_oid})
            except Exception:
                customer_detail = None
        if not customer_detail:
            sales_order_id = ret.get('sales_order_id')
            if sales_order_id:
                try:
                    order_oid = ObjectId(sales_order_id) if isinstance(sales_order_id, str) else sales_order_id
                    order_doc = db['depo_sales_ordes'].find_one({'_id': order_oid}) or db['depo_sales_orders'].find_one({'_id': order_oid})
                except Exception:
                    order_doc = None
                if order_doc and order_doc.get('customer_id'):
                    try:
                        customer_oid = ObjectId(order_doc['customer_id']) if isinstance(order_doc['customer_id'], str) else order_doc['customer_id']
                        customer_detail = db['depo_companies'].find_one({'_id': customer_oid})
                    except Exception:
                        customer_detail = None
        if customer_detail:
            ret['customer_detail'] = serialize_doc(customer_detail)
        if 'line_items' not in ret:
            ret['line_items'] = len(ret.get('items', []))

    return {"results": serialize_doc(returns)}


@router.patch("/sales-orders/{order_id}/status")
async def update_sales_order_status(
    order_id: str,
    update_data: StatusUpdateRequest,
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    _get_sales_order_or_404(db, current_user, order_id)
    collection = db['depo_sales_ordes']
    
    update_fields = {}
    if update_data.state_id:
        update_fields['state_id'] = ObjectId(update_data.state_id)
        
    if not update_fields:
        return {"success": True}
        
    try:
        collection.update_one(
            {'_id': ObjectId(order_id)},
            {'$set': update_fields}
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/customers")
async def get_sales_customers(
    search: Optional[str] = Query(None),
    current_user: dict = Depends(require_section("sales"))
):
    db = get_db()
    query = {"is_client": True} # Fetch clients specifically
    if search:
        query['name'] = {'$regex': search.strip(), '$options': 'i'}
        
    customers = list(db['depo_companies'].find(query).limit(50))
    return {"results": serialize_doc(customers)}
