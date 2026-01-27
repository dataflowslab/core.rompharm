"""
Inventory Module - Business Logic Services
Main entry point - imports from specialized service modules
"""

# Import company-related functions
from modules.inventory.services.companies_service import (
    generate_company_pk,
    generate_company_code,
    generate_company_id_str,
    serialize_company_doc,
    get_suppliers_list,
    get_supplier_by_id,
    create_supplier,
    update_supplier,
    delete_supplier,
    get_supplier_parts,
    add_supplier_part,
    update_supplier_part,
    remove_supplier_part,
    get_manufacturers_list,
    get_clients_list,
)

# Import stock functions - use legacy versions for now
from fastapi import HTTPException
from datetime import datetime
from bson import ObjectId
from src.backend.utils.db import get_db


async def get_stocks_list(search=None, skip=0, limit=100, part_id=None, location_id=None, state_id=None, start_date=None, end_date=None, qc_verified=None, has_batch=None, has_expiry=None):
    """Get list of stocks with enriched data using aggregation pipeline"""
    db = get_db()
    
    # Build match stage
    match_stage = {}
    
    if part_id:
        match_stage['part_id'] = ObjectId(part_id)
    
    if location_id:
        match_stage['location_id'] = ObjectId(location_id)
    
    if state_id:
        match_stage['state_id'] = ObjectId(state_id)
    
    # Date range filter
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = datetime.fromisoformat(start_date) if isinstance(start_date, str) else start_date
        if end_date:
            date_query['$lte'] = datetime.fromisoformat(end_date) if isinstance(end_date, str) else end_date
        match_stage['received_date'] = date_query
    
    # QC Verified filter
    if qc_verified is not None:
        if qc_verified:
            match_stage['rompharm_ba_no'] = {'$exists': True, '$ne': '', '$ne': None}
        else:
            match_stage['$or'] = [
                {'rompharm_ba_no': {'$exists': False}},
                {'rompharm_ba_no': ''},
                {'rompharm_ba_no': None}
            ]
    
    # Has batch filter
    if has_batch is not None:
        if has_batch:
            match_stage['batch_code'] = {'$exists': True, '$ne': '', '$ne': None}
        else:
            match_stage['$or'] = [
                {'batch_code': {'$exists': False}},
                {'batch_code': ''},
                {'batch_code': None}
            ]
    
    # Has expiry filter
    if has_expiry is not None:
        if has_expiry:
            match_stage['expiry_date'] = {'$exists': True, '$ne': '', '$ne': None}
        else:
            match_stage['$or'] = [
                {'expiry_date': {'$exists': False}},
                {'expiry_date': ''},
                {'expiry_date': None}
            ]
    
    # Build aggregation pipeline
    pipeline = []
    
    if match_stage:
        pipeline.append({'$match': match_stage})
    
    # Lookup part details
    pipeline.append({
        '$lookup': {
            'from': 'depo_parts',
            'localField': 'part_id',
            'foreignField': '_id',
            'as': 'part_detail'
        }
    })
    pipeline.append({'$unwind': {'path': '$part_detail', 'preserveNullAndEmptyArrays': True}})
    
    # Lookup System UM from part
    pipeline.append({
        '$lookup': {
            'from': 'depo_ums',
            'localField': 'part_detail.system_um_id',
            'foreignField': '_id',
            'as': 'system_um_detail'
        }
    })
    pipeline.append({'$unwind': {'path': '$system_um_detail', 'preserveNullAndEmptyArrays': True}})
    
    # Lookup location details
    pipeline.append({
        '$lookup': {
            'from': 'depo_locations',
            'localField': 'location_id',
            'foreignField': '_id',
            'as': 'location_detail'
        }
    })
    pipeline.append({'$unwind': {'path': '$location_detail', 'preserveNullAndEmptyArrays': True}})
    
    # Lookup supplier details
    pipeline.append({
        '$lookup': {
            'from': 'depo_companies',
            'localField': 'supplier_id',
            'foreignField': '_id',
            'as': 'supplier_detail'
        }
    })
    pipeline.append({'$unwind': {'path': '$supplier_detail', 'preserveNullAndEmptyArrays': True}})
    
    # Lookup state details
    pipeline.append({
        '$lookup': {
            'from': 'depo_stocks_states',
            'localField': 'state_id',
            'foreignField': '_id',
            'as': 'status_detail'
        }
    })
    pipeline.append({'$unwind': {'path': '$status_detail', 'preserveNullAndEmptyArrays': True}})
    
    # Search filter
    if search:
        search_conditions = {
            '$or': [
                {'batch_code': {'$regex': search, '$options': 'i'}},
                {'supplier_batch_code': {'$regex': search, '$options': 'i'}},
                {'notes': {'$regex': search, '$options': 'i'}},
                {'part_detail.name': {'$regex': search, '$options': 'i'}},
                {'part_detail.ipn': {'$regex': search, '$options': 'i'}},
                {'supplier_detail.name': {'$regex': search, '$options': 'i'}},
                {'location_detail.name': {'$regex': search, '$options': 'i'}},
            ]
        }
        pipeline.append({'$match': search_conditions})
    
    # Add computed fields
    pipeline.append({
        '$addFields': {
            'batch_date': '$received_date',
            'supplier_name': '$supplier_detail.name',
            'part_detail': {
                'name': '$part_detail.name',
                'ipn': '$part_detail.ipn',
                'um': '$part_detail.um'
            },
            'system_um_detail': {
                'name': '$system_um_detail.name',
                'abrev': '$system_um_detail.abrev',
                'symbol': '$system_um_detail.symbol'
            },
            'location_detail': {
                'name': '$location_detail.name',
                'description': '$location_detail.description'
            },
            'status_detail': {
                'name': '$status_detail.name',
                'value': '$status_detail.value',
                'color': '$status_detail.color'
            }
        }
    })
    
    # Count total
    count_pipeline = pipeline.copy()
    count_pipeline.append({'$count': 'total'})
    count_result = list(db['depo_stocks'].aggregate(count_pipeline))
    total = count_result[0]['total'] if count_result else 0
    
    # Sort and paginate
    pipeline.append({'$sort': {'created_at': -1}})
    pipeline.append({'$skip': skip})
    pipeline.append({'$limit': limit})
    
    # Execute
    stocks = list(db['depo_stocks'].aggregate(pipeline))
    
    from modules.inventory.routes.utils import serialize_doc
    return {
        'results': serialize_doc(stocks),
        'total': total,
        'skip': skip,
        'limit': limit
    }


async def get_stock_by_id(stock_id: str):
    """Get a specific stock entry with enriched data"""
    db = get_db()
    stocks_collection = db['depo_stocks']
    
    try:
        stock = stocks_collection.find_one({'_id': ObjectId(stock_id)})
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")
        
        if stock.get('received_date'):
            stock['batch_date'] = stock['received_date']
        
        # Get part details
        if stock.get('part_id'):
            part = db['depo_parts'].find_one({'_id': ObjectId(stock['part_id'])})
            if part:
                stock['part_detail'] = {
                    'name': part.get('name'),
                    'ipn': part.get('ipn'),
                    'um': part.get('um')
                }
        
        # Get location details
        if stock.get('location_id'):
            location = db['depo_locations'].find_one({'_id': ObjectId(stock['location_id'])})
            if location:
                stock['location_detail'] = {
                    'name': location.get('name'),
                    'description': location.get('description', '')
                }
        
        # Get status details
        if stock.get('state_id'):
            state = db['depo_stocks_states'].find_one({'_id': ObjectId(stock['state_id'])})
            if state:
                stock['status'] = state.get('name')
                stock['status_detail'] = {
                    'name': state.get('name'),
                    'value': state.get('value'),
                    'color': state.get('color', 'gray')
                }
        
        # Get supplier UM details
        if stock.get('supplier_um_id'):
            supplier_um = db['depo_ums'].find_one({'_id': ObjectId(stock['supplier_um_id'])})
            if supplier_um:
                stock['supplier_um_detail'] = {
                    'name': supplier_um.get('name'),
                    'abrev': supplier_um.get('abrev'),
                    'symbol': supplier_um.get('symbol', '')
                }
        
        # Determine supplier
        supplier_name = None
        
        if stock.get('supplier_id'):
            supplier = db['depo_companies'].find_one({'_id': ObjectId(stock['supplier_id'])})
            if supplier:
                supplier_name = supplier.get('name')
        elif stock.get('build_order_id'):
            org_config = db['config'].find_one({'slug': 'organizatie'})
            if org_config:
                supplier_name = org_config.get('value', {}).get('name', 'Internal Production')
            else:
                supplier_name = 'Internal Production'
        elif stock.get('purchase_order_id'):
            purchase_order = db['depo_purchase_orders'].find_one({'_id': ObjectId(stock['purchase_order_id'])})
            if purchase_order and purchase_order.get('supplier_id'):
                supplier = db['depo_companies'].find_one({'_id': ObjectId(purchase_order['supplier_id'])})
                if supplier:
                    supplier_name = supplier.get('name')
        
        stock['supplier_name'] = supplier_name
        
        # Calculate stock value
        stock_value = 0
        if stock.get('purchase_order_id'):
            purchase_order = db['depo_purchase_orders'].find_one({'_id': ObjectId(stock['purchase_order_id'])})
            if purchase_order and purchase_order.get('items'):
                for item in purchase_order['items']:
                    if str(item.get('part_id')) == str(stock.get('part_id')):
                        purchase_price = item.get('purchase_price', 0) or 0
                        quantity = stock.get('quantity', 0) or 0
                        stock_value = quantity * purchase_price
                        break
        
        stock['stock_value'] = stock_value
        
        from modules.inventory.routes.utils import serialize_doc
        return serialize_doc(stock)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock: {str(e)}")
