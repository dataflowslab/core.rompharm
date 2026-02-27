"""
Sales API 
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Optional, Any
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token

router = APIRouter(prefix="/api/sales", tags=["sales"])

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


@router.get("/sales-orders")
async def get_sales_orders(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    state_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    skip: Optional[int] = Query(None, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=200),
    current_user: dict = Depends(verify_token)
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
    current_user: dict = Depends(verify_token)
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
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    try:
        order = db['depo_sales_ordes'].find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
            
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
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    items = list(db['depo_sales_order_lines'].find({'order_id': order_id}))
    for item in items:
        if item.get('part_id'):
            part = db['depo_parts'].find_one({'_id': ObjectId(item['part_id'])})
            if part:
                item['part_detail'] = serialize_doc(part)
    return {"results": serialize_doc(items)}


@router.post("/sales-orders/{order_id}/items")
async def add_sales_order_item(
    order_id: str,
    item: SalesOrderItemRequest,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    orders = db['depo_sales_ordes']
    parts = db['depo_parts']
    lines = db['depo_sales_order_lines']

    order = orders.find_one({'_id': ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    part = parts.find_one({'_id': ObjectId(item.part_id)})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    if not part.get('is_salable', False):
        raise HTTPException(status_code=400, detail="Part is not marked as salable")

    doc = {
        'order_id': order_id,
        'part_id': item.part_id,
        'quantity': item.quantity,
        'allocated': 0,
        'shipped': 0,
        'sale_price': item.sale_price,
        'sale_price_currency': item.sale_price_currency or order.get('currency') or 'EUR',
        'reference': item.reference or '',
        'notes': item.notes or '',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }
    result = lines.insert_one(doc)
    doc['_id'] = result.inserted_id
    return serialize_doc(doc)


@router.put("/sales-orders/{order_id}/items/{item_id}")
async def update_sales_order_item(
    order_id: str,
    item_id: str,
    item: SalesOrderItemRequest,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    lines = db['depo_sales_order_lines']

    existing = lines.find_one({'_id': ObjectId(item_id), 'order_id': order_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")

    update_fields = {
        'quantity': item.quantity,
        'sale_price': item.sale_price,
        'sale_price_currency': item.sale_price_currency or existing.get('sale_price_currency'),
        'reference': item.reference or '',
        'notes': item.notes or '',
        'updated_at': datetime.utcnow()
    }

    lines.update_one({'_id': ObjectId(item_id)}, {'$set': update_fields})
    updated = lines.find_one({'_id': ObjectId(item_id)})
    return serialize_doc(updated)


@router.delete("/sales-orders/{order_id}/items/{item_id}")
async def delete_sales_order_item(
    order_id: str,
    item_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    lines = db['depo_sales_order_lines']
    result = lines.delete_one({'_id': ObjectId(item_id), 'order_id': order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"success": True}


@router.get("/sales-orders/{order_id}/shipments")
async def get_sales_order_shipments(
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    shipments = list(db['depo_sales_shipments'].find({'order_id': order_id}))
    return {"results": serialize_doc(shipments)}


@router.post("/sales-orders/{order_id}/shipments")
async def create_sales_order_shipment(
    order_id: str,
    shipment: ShipmentRequest,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    orders = db['depo_sales_ordes']
    if not orders.find_one({'_id': ObjectId(order_id)}):
        raise HTTPException(status_code=404, detail="Order not found")

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
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    coll = db['depo_sales_shipments']
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
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    coll = db['depo_sales_shipments']
    result = coll.delete_one({'_id': ObjectId(shipment_id), 'order_id': order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return {"success": True}


@router.get("/sales-orders/{order_id}/attachments")
async def get_sales_order_attachments(
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    atts = list(db['depo_sales_order_attachments'].find({'order_id': order_id}))
    return {"results": serialize_doc(atts)}


@router.get("/sales-orders/{order_id}/allocations")
async def get_sales_order_allocations(
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
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
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    orders = db['depo_sales_ordes']
    if not orders.find_one({'_id': ObjectId(order_id)}):
        raise HTTPException(status_code=404, detail="Order not found")

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
    return serialize_doc(doc)


@router.put("/sales-orders/{order_id}/allocations/{allocation_id}")
async def update_sales_order_allocation(
    order_id: str,
    allocation_id: str,
    allocation: AllocationRequest,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
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
    return serialize_doc(updated)


@router.delete("/sales-orders/{order_id}/allocations/{allocation_id}")
async def delete_sales_order_allocation(
    order_id: str,
    allocation_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    coll = db['depo_sales_allocations']
    result = coll.delete_one({'_id': ObjectId(allocation_id), 'order_id': order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Allocation not found")
    return {"success": True}


@router.get("/order-statuses")
async def get_sales_order_statuses(
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    states = list(db['depo_sales_ordes_states'].find().sort('value', 1))
    return {"statuses": serialize_doc(states)}


@router.patch("/sales-orders/{order_id}/status")
async def update_sales_order_status(
    order_id: str,
    update_data: StatusUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
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
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    query = {"is_client": True} # Fetch clients specifically
    if search:
        query['name'] = {'$regex': search.strip(), '$options': 'i'}
        
    customers = list(db['depo_companies'].find(query).limit(50))
    return {"results": serialize_doc(customers)}
