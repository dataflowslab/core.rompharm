"""
DEPO Procurement Module - Purchase Orders Services
"""
from fastapi import HTTPException, UploadFile
from datetime import datetime
from bson import ObjectId
import os
import hashlib

from src.backend.utils.db import get_db
from ..utils import serialize_doc


async def get_purchase_orders_list(search=None, state_id=None, date_from=None, date_to=None, skip=None, limit=None):
    """Get list of purchase orders with supplier and state details"""
    db = get_db()
    collection = db['depo_purchase_orders']
    
    query = {}
    
    # Search filter
    if search:
        search = search.strip()
        if not search:
            search = None
        
    if search:
        or_clauses = [
            {'reference': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}},
            {'supplier_reference': {'$regex': search, '$options': 'i'}},
            {'items.part_detail.name': {'$regex': search, '$options': 'i'}},
            {'items.part_detail.ipn': {'$regex': search, '$options': 'i'}},
            {'items.reference': {'$regex': search, '$options': 'i'}},
        ]

        # Supplier name search -> map to supplier_id
        supplier_ids = []
        suppliers = db['depo_companies'].find(
            {'name': {'$regex': search, '$options': 'i'}},
            {'_id': 1}
        )
        supplier_ids = [s['_id'] for s in suppliers]
        if supplier_ids:
            supplier_id_variants = supplier_ids + [str(sid) for sid in supplier_ids]
            or_clauses.append({'supplier_id': {'$in': supplier_id_variants}})

        # Part name / IPN search -> map to part_id in items
        part_ids = []
        parts = db['depo_parts'].find(
            {
                '$or': [
                    {'name': {'$regex': search, '$options': 'i'}},
                    {'ipn': {'$regex': search, '$options': 'i'}}
                ]
            },
            {'_id': 1}
        )
        part_ids = [p['_id'] for p in parts]
        if part_ids:
            part_id_variants = part_ids + [str(pid) for pid in part_ids]
            or_clauses.append({'items.part_id': {'$in': part_id_variants}})

        query['$or'] = or_clauses
    
    # State filter
    if state_id:
        query['state_id'] = ObjectId(state_id)
    
    # Date range filter
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
        
        # Enrich with supplier and state details
        for order in orders:
            # Supplier details
            if order.get('supplier_id'):
                supplier = db['depo_companies'].find_one({'_id': ObjectId(order['supplier_id'])})
                if supplier:
                    order['supplier_detail'] = serialize_doc(supplier)
            
            # State details
            if order.get('state_id'):
                state = db['depo_purchase_orders_states'].find_one({'_id': order['state_id']})
                if state:
                    order['state_detail'] = {
                        'name': state.get('name'),
                        'color': state.get('color', 'gray'),
                        'value': state.get('value', 0)
                    }
            else:
                # No state_id - default to Pending
                order['state_detail'] = {
                    'name': 'Pending',
                    'color': 'gray',
                    'value': 0
                }
        
        results = serialize_doc(orders)
        if limit is not None or skip:
            return {
                'results': results,
                'total': total,
                'skip': skip or 0,
                'limit': limit or len(results)
            }
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch purchase orders: {str(e)}")



async def get_purchase_order_by_id(order_id: str):
    """Get a specific purchase order with enriched data"""
    db = get_db()
    collection = db['depo_purchase_orders']
    
    try:
        order = collection.find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        # Enrich with supplier details
        if order.get('supplier_id'):
            supplier = db['depo_companies'].find_one({'_id': ObjectId(order['supplier_id'])})
            if supplier:
                order['supplier_detail'] = serialize_doc(supplier)
        
        # ✅ FIX: Get state_detail from state_id (depo_purchase_orders_states)
        if order.get('state_id'):
            state = db['depo_purchase_orders_states'].find_one({'_id': order['state_id']})
            if state:
                order['state_detail'] = {
                    'name': state.get('name'),
                    'color': state.get('color', 'gray'),
                    'value': state.get('value', 0)
                }
        else:
            # No state_id - default to Pending
            order['state_detail'] = {
                'name': 'Pending',
                'color': 'gray',
                'value': 0
            }
        
        # Enrich with destination details
        if order.get('destination_id'):
            location = db['depo_locations'].find_one({'_id': ObjectId(order['destination_id'])})
            if location:
                order['destination_detail'] = {
                    'name': location.get('name')
                }
        
        return serialize_doc(order)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch purchase order: {str(e)}")



async def create_new_purchase_order(order_data, current_user):
    """Create a new purchase order with auto-generated reference"""
    db = get_db()
    collection = db['depo_purchase_orders']
    
    # Auto-generate reference if not provided
    reference = order_data.reference
    if not reference:
        last_order = collection.find_one(
            {'reference': {'$regex': '^PO-'}},
            sort=[('reference', -1)]
        )
        max_num = 0
        if last_order and last_order.get('reference'):
            try:
                max_num = int(last_order['reference'].replace('PO-', ''))
            except ValueError:
                pass
        reference = f"PO-{max_num + 1:04d}"
    
    # Get Pending state ID from database
    states_collection = db['depo_purchase_orders_states']
    pending_state = states_collection.find_one({'name': 'Pending'})
    if not pending_state:
        raise HTTPException(status_code=500, detail="Pending state not found in database")
    
    doc = {
        'reference': reference,
        'supplier_id': ObjectId(order_data.supplier_id),
        'description': order_data.description or '',
        'supplier_reference': order_data.supplier_reference or '',
        'currency': order_data.currency or 'EUR',
        'issue_date': order_data.issue_date,
        'target_date': order_data.target_date,
        'destination_id': ObjectId(order_data.destination_id) if order_data.destination_id else None,
        'notes': order_data.notes or '',
        'state_id': pending_state['_id'],
        # Don't set 'status' field - use state_id only
        'items': [],
        'line_items': 0,
        'lines': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }
    
    try:
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        order_id = str(result.inserted_id)
        
        # Auto-create approval flow based on approval_templates
        try:
            templates_collection = db['approval_templates']
            approval_template = templates_collection.find_one({
                'object_type': 'procurement_order',
                'active': True
            })
            
            if approval_template:
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
                    "object_id": order_id,
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
                
                db['approval_flows'].insert_one(flow_data)
                print(f"[PROCUREMENT] Auto-created approval flow for order {order_id} using template: {approval_template.get('name')}")
        except Exception as e:
            print(f"[PROCUREMENT] Warning: Failed to auto-create approval flow: {e}")
            # Don't fail the order creation if approval flow creation fails
        
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create purchase order: {str(e)}")
