"""
Inventory Module - Business Logic Services
"""
from fastapi import HTTPException
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db


def generate_company_pk():
    """
    Generate auto-increment pk (primary key) for company
    Starts from 1 and increments for each new company
    """
    db = get_db()
    companies_collection = db['depo_companies']
    
    # Find the maximum pk value
    max_pk_doc = companies_collection.find_one(
        {'pk': {'$exists': True}},
        sort=[('pk', -1)]
    )
    
    if max_pk_doc and 'pk' in max_pk_doc:
        return max_pk_doc['pk'] + 1
    else:
        return 1


def generate_company_code(company_data):
    """
    Generate auto-increment code for company based on type
    Format: MA-XXXX for manufacturers/suppliers, CL-XXXX for clients
    Priority: If is_manufacturer or is_supplier -> MA, else CL
    
    Algorithm:
    1. Determine prefix (MA or CL) based on company type
    2. Find ALL codes with this prefix
    3. Extract numeric part from each code
    4. Find the maximum number
    5. Increment and format as PREFIX-XXXX
    """
    db = get_db()
    companies_collection = db['depo_companies']
    
    # Determine prefix based on company type
    # Priority: MA (manufacturer/supplier) > CL (client)
    if company_data.get('is_manufacturer') or company_data.get('is_supplier'):
        prefix = 'MA'
    else:
        prefix = 'CL'
    
    # Find ALL codes with this prefix to extract the highest number
    regex_pattern = f"^{prefix}-"
    existing_codes = companies_collection.find(
        {'code': {'$regex': regex_pattern}},
        {'code': 1}
    )
    
    # Extract all numbers and find the maximum
    max_number = 0
    for doc in existing_codes:
        code = doc.get('code', '')
        try:
            # Extract number part after prefix (e.g., "MA-0005" -> "0005" -> 5)
            number_part = code.split('-')[1]
            number = int(number_part)
            if number > max_number:
                max_number = number
        except (IndexError, ValueError):
            # Skip invalid codes
            continue
    
    # Next number is max + 1
    next_number = max_number + 1
    
    # Format as PREFIX-XXXX (4 digits with leading zeros)
    return f"{prefix}-{next_number:04d}"


def generate_company_id_str(company):
    """
    Generate display ID string for company based on type and pk
    Format: S009 (Supplier), M009 (Manufacturer), C009 (Client)
    Priority: M (if is_manufacturer) > S (if is_supplier) > C (if is_client)
    """
    pk = company.get('pk')
    if not pk:
        return 'N/A'
    
    # Determine prefix based on company type (priority: M > S > C)
    if company.get('is_manufacturer'):
        prefix = 'M'
    elif company.get('is_supplier'):
        prefix = 'S'
    elif company.get('is_client'):
        prefix = 'C'
    else:
        prefix = 'N'  # Unknown
    
    # Format as PREFIX + 00 + PK (e.g., S009, M015, C001)
    return f"{prefix}{pk:03d}"


def serialize_doc(doc):
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
                result[key] = [serialize_doc(item) if isinstance(item, dict) else item for item in value]
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            else:
                result[key] = value
        
        # Add id_str for companies (if pk exists)
        if 'pk' in doc and ('is_supplier' in doc or 'is_manufacturer' in doc or 'is_client' in doc):
            result['id_str'] = generate_company_id_str(doc)
        
        return result
    return doc


async def get_stocks_list(search=None, skip=0, limit=100, part_id=None, location_id=None, state_id=None, start_date=None, end_date=None):
    """Get list of stocks with enriched data using aggregation pipeline"""
    from datetime import datetime
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
    
    # Build aggregation pipeline
    pipeline = []
    
    # Initial match (before lookups for performance)
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
    
    # Search filter (after lookups so we can search in joined fields)
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
    
    # Count total (before pagination)
    count_pipeline = pipeline.copy()
    count_pipeline.append({'$count': 'total'})
    count_result = list(db['depo_stocks'].aggregate(count_pipeline))
    total = count_result[0]['total'] if count_result else 0
    
    # Sort and paginate
    pipeline.append({'$sort': {'created_at': -1}})
    pipeline.append({'$skip': skip})
    pipeline.append({'$limit': limit})
    
    # Execute aggregation
    stocks = list(db['depo_stocks'].aggregate(pipeline))
    
    # Serialize ObjectIds using helper function
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
        
        # Add batch_date (same as received_date)
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
        
        # Get status details from depo_stocks_states using state_id
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
        supplier_detail = None
        
        # First check if supplier_id is directly in stock
        if stock.get('supplier_id'):
            supplier = db['depo_companies'].find_one({'_id': ObjectId(stock['supplier_id'])})
            if supplier:
                supplier_name = supplier.get('name')
                supplier_detail = {
                    'name': supplier.get('name'),
                    'code': supplier.get('code', ''),
                    '_id': str(supplier['_id'])
                }
        
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
        
        return serialize_doc(stock)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock: {str(e)}")


async def get_suppliers_list(search=None, skip=0, limit=100):
    """Get list of suppliers (companies with is_supplier=true)"""
    db = get_db()
    companies_collection = db['depo_companies']
    
    query = {'is_supplier': True}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'code': {'$regex': search, '$options': 'i'}},
            {'vatno': {'$regex': search, '$options': 'i'}},
            {'regno': {'$regex': search, '$options': 'i'}}
        ]
        query['is_supplier'] = True
    
    try:
        # Get total count
        total = companies_collection.count_documents(query)
        
        # Get paginated results
        cursor = companies_collection.find(query).sort('name', 1).skip(skip).limit(limit)
        suppliers = list(cursor)
        
        return {
            'results': serialize_doc(suppliers),
            'total': total,
            'skip': skip,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch suppliers: {str(e)}")


async def get_supplier_by_id(supplier_id: str):
    """Get a specific supplier by ID with enriched addresses using aggregation"""
    db = get_db()
    
    try:
        # Use aggregation pipeline for efficient data enrichment
        pipeline = [
            {'$match': {'_id': ObjectId(supplier_id)}},
            # Unwind addresses to enrich each one
            {'$unwind': {'path': '$addresses', 'preserveNullAndEmptyArrays': True}},
            # Lookup country for each address
            {
                '$lookup': {
                    'from': 'depo_countries',
                    'let': {'country_id': {'$toObjectId': '$addresses.country_id'}},
                    'pipeline': [
                        {'$match': {'$expr': {'$eq': ['$_id', '$$country_id']}}}
                    ],
                    'as': 'country_info'
                }
            },
            # Add country name to address
            {
                '$addFields': {
                    'addresses.country': {
                        '$ifNull': [
                            {'$arrayElemAt': ['$country_info.name', 0]},
                            '$addresses.country'  # Keep original if lookup fails
                        ]
                    }
                }
            },
            # Remove temporary country_info
            {'$project': {'country_info': 0}},
            # Group back to reconstruct the document
            {
                '$group': {
                    '_id': '$_id',
                    'pk': {'$first': '$pk'},
                    'name': {'$first': '$name'},
                    'code': {'$first': '$code'},
                    'vatno': {'$first': '$vatno'},
                    'regno': {'$first': '$regno'},
                    'payment_conditions': {'$first': '$payment_conditions'},
                    'delivery_conditions': {'$first': '$delivery_conditions'},
                    'bank_account': {'$first': '$bank_account'},
                    'currency_id': {'$first': '$currency_id'},
                    'is_supplier': {'$first': '$is_supplier'},
                    'is_manufacturer': {'$first': '$is_manufacturer'},
                    'is_client': {'$first': '$is_client'},
                    'addresses': {'$push': '$addresses'},
                    'contacts': {'$first': '$contacts'},
                    'created_at': {'$first': '$created_at'},
                    'updated_at': {'$first': '$updated_at'},
                }
            },
            # Clean up addresses array (remove null from unwind)
            {
                '$addFields': {
                    'addresses': {
                        '$filter': {
                            'input': '$addresses',
                            'as': 'addr',
                            'cond': {'$ne': ['$$addr', {}]}
                        }
                    }
                }
            }
        ]
        
        result = list(db['depo_companies'].aggregate(pipeline))
        
        if not result:
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        supplier = result[0]
        
        # If no addresses, set empty array
        if not supplier.get('addresses') or supplier['addresses'] == [{}]:
            supplier['addresses'] = []
        
        return serialize_doc(supplier)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch supplier: {str(e)}")


async def create_supplier(supplier_data, current_user):
    """Create a new supplier with auto-generated pk and code"""
    db = get_db()
    companies_collection = db['depo_companies']
    
    # Validate that at least one checkbox is selected
    if not (supplier_data.get('is_supplier') or supplier_data.get('is_client') or supplier_data.get('is_manufacturer')):
        raise HTTPException(status_code=400, detail="At least one of is_supplier, is_client, or is_manufacturer must be selected")
    
    # Generate auto-increment pk
    auto_pk = generate_company_pk()
    
    # Generate auto-increment code based on company type
    auto_code = generate_company_code(supplier_data)
    
    doc = {
        'pk': auto_pk,  # Auto-generated primary key
        'name': supplier_data.get('name'),
        'code': auto_code,  # Auto-generated, readonly
        'is_supplier': supplier_data.get('is_supplier', False),
        'is_manufacturer': supplier_data.get('is_manufacturer', False),
        'is_client': supplier_data.get('is_client', False),
        'vatno': supplier_data.get('vatno', ''),
        'regno': supplier_data.get('regno', ''),
        'payment_conditions': supplier_data.get('payment_conditions', ''),
        'delivery_conditions': supplier_data.get('delivery_conditions', ''),
        'bank_account': supplier_data.get('bank_account', ''),
        'currency_id': ObjectId(supplier_data['currency_id']) if supplier_data.get('currency_id') else None,
        'addresses': supplier_data.get('addresses', []),
        'contacts': supplier_data.get('contacts', []),
        'created_at': datetime.utcnow(),
        'created_by': current_user.get('username'),
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username')
    }
    
    try:
        result = companies_collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create supplier: {str(e)}")


async def update_supplier(supplier_id: str, supplier_data, current_user):
    """Update an existing supplier"""
    db = get_db()
    companies_collection = db['depo_companies']
    
    # Validate that at least one checkbox is selected
    if 'is_supplier' in supplier_data or 'is_client' in supplier_data or 'is_manufacturer' in supplier_data:
        is_supplier = supplier_data.get('is_supplier', False)
        is_client = supplier_data.get('is_client', False)
        is_manufacturer = supplier_data.get('is_manufacturer', False)
        
        if not (is_supplier or is_client or is_manufacturer):
            raise HTTPException(status_code=400, detail="At least one of is_supplier, is_client, or is_manufacturer must be selected")
    
    update_doc = {
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username')
    }
    
    # Update fields if provided
    if 'name' in supplier_data:
        update_doc['name'] = supplier_data['name']
    if 'code' in supplier_data:
        update_doc['code'] = supplier_data['code']
    # Note: 'pk' is auto-generated and readonly, cannot be updated
    if 'is_supplier' in supplier_data:
        update_doc['is_supplier'] = supplier_data['is_supplier']
    if 'is_manufacturer' in supplier_data:
        update_doc['is_manufacturer'] = supplier_data['is_manufacturer']
    if 'is_client' in supplier_data:
        update_doc['is_client'] = supplier_data['is_client']
    if 'vatno' in supplier_data:
        update_doc['vatno'] = supplier_data['vatno']
    if 'regno' in supplier_data:
        update_doc['regno'] = supplier_data['regno']
    if 'payment_conditions' in supplier_data:
        update_doc['payment_conditions'] = supplier_data['payment_conditions']
    if 'delivery_conditions' in supplier_data:
        update_doc['delivery_conditions'] = supplier_data['delivery_conditions']
    if 'bank_account' in supplier_data:
        update_doc['bank_account'] = supplier_data['bank_account']
    if 'currency_id' in supplier_data:
        update_doc['currency_id'] = ObjectId(supplier_data['currency_id']) if supplier_data['currency_id'] else None
    if 'addresses' in supplier_data:
        update_doc['addresses'] = supplier_data['addresses']
    if 'contacts' in supplier_data:
        update_doc['contacts'] = supplier_data['contacts']
    
    try:
        result = companies_collection.update_one(
            {'_id': ObjectId(supplier_id)},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        # Return updated document
        updated_supplier = companies_collection.find_one({'_id': ObjectId(supplier_id)})
        return serialize_doc(updated_supplier)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update supplier: {str(e)}")


async def delete_supplier(supplier_id: str):
    """Delete a supplier"""
    db = get_db()
    companies_collection = db['depo_companies']
    
    try:
        result = companies_collection.delete_one({'_id': ObjectId(supplier_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        return {'success': True, 'message': 'Supplier deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete supplier: {str(e)}")


async def get_supplier_parts(supplier_id: str):
    """Get parts associated with a supplier"""
    db = get_db()
    parts_collection = db['depo_parts']
    
    try:
        # Find parts that have this supplier in their suppliers array
        cursor = parts_collection.find({
            'suppliers.supplier_id': supplier_id
        }).sort('name', 1)
        
        parts = list(cursor)
        
        # Enrich with supplier-specific data
        for part in parts:
            if part.get('suppliers'):
                for supplier_info in part['suppliers']:
                    if supplier_info.get('supplier_id') == supplier_id:
                        part['supplier_code'] = supplier_info.get('supplier_code', '')
                        part['supplier_currency'] = supplier_info.get('currency', 'EUR')
                        break
        
        return serialize_doc(parts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch supplier parts: {str(e)}")


async def add_supplier_part(supplier_id: str, part_data):
    """Add a part to supplier's parts list"""
    db = get_db()
    parts_collection = db['depo_parts']
    
    try:
        part_id = part_data.get('part_id')
        supplier_code = part_data.get('supplier_code', '')
        currency = part_data.get('currency', 'EUR')
        
        # Check if part exists
        part = parts_collection.find_one({'_id': ObjectId(part_id)})
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        
        # Initialize suppliers array if it doesn't exist
        if 'suppliers' not in part:
            part['suppliers'] = []
        
        # Check if supplier already exists for this part
        supplier_exists = False
        for supplier_info in part['suppliers']:
            if supplier_info.get('supplier_id') == supplier_id:
                supplier_exists = True
                break
        
        if supplier_exists:
            raise HTTPException(status_code=400, detail="Supplier already associated with this part")
        
        # Add supplier to part
        part['suppliers'].append({
            'supplier_id': supplier_id,
            'supplier_code': supplier_code,
            'currency': currency
        })
        
        parts_collection.update_one(
            {'_id': ObjectId(part_id)},
            {'$set': {'suppliers': part['suppliers']}}
        )
        
        return {'success': True, 'message': 'Part added to supplier successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add part to supplier: {str(e)}")


async def update_supplier_part(supplier_id: str, part_id: str, part_data):
    """Update supplier-specific data for a part"""
    db = get_db()
    parts_collection = db['depo_parts']
    
    try:
        # Get the part
        part = parts_collection.find_one({'_id': ObjectId(part_id)})
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        
        # Find and update the supplier info
        if 'suppliers' not in part:
            raise HTTPException(status_code=404, detail="Supplier not associated with this part")
        
        supplier_found = False
        for supplier_info in part['suppliers']:
            if supplier_info.get('supplier_id') == supplier_id:
                supplier_found = True
                if 'supplier_code' in part_data:
                    supplier_info['supplier_code'] = part_data['supplier_code']
                if 'currency' in part_data:
                    supplier_info['currency'] = part_data['currency']
                break
        
        if not supplier_found:
            raise HTTPException(status_code=404, detail="Supplier not associated with this part")
        
        parts_collection.update_one(
            {'_id': ObjectId(part_id)},
            {'$set': {'suppliers': part['suppliers']}}
        )
        
        return {'success': True, 'message': 'Supplier part updated successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update supplier part: {str(e)}")


async def remove_supplier_part(supplier_id: str, part_id: str):
    """Remove a part from supplier's parts list"""
    db = get_db()
    parts_collection = db['depo_parts']
    
    try:
        # Get the part
        part = parts_collection.find_one({'_id': ObjectId(part_id)})
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        
        # Remove supplier from part's suppliers array
        if 'suppliers' in part:
            part['suppliers'] = [s for s in part['suppliers'] if s.get('supplier_id') != supplier_id]
            
            parts_collection.update_one(
                {'_id': ObjectId(part_id)},
                {'$set': {'suppliers': part['suppliers']}}
            )
        
        return {'success': True, 'message': 'Part removed from supplier successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove part from supplier: {str(e)}")


# Manufacturers functions (same as suppliers but filter by is_manufacturer=true)
async def get_manufacturers_list(search=None, skip=0, limit=100):
    """Get list of manufacturers (companies with is_manufacturer=true)"""
    db = get_db()
    companies_collection = db['depo_companies']
    
    query = {'is_manufacturer': True}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'code': {'$regex': search, '$options': 'i'}},
            {'vatno': {'$regex': search, '$options': 'i'}},
            {'regno': {'$regex': search, '$options': 'i'}}
        ]
        query['is_manufacturer'] = True
    
    try:
        total = companies_collection.count_documents(query)
        cursor = companies_collection.find(query).sort('name', 1).skip(skip).limit(limit)
        manufacturers = list(cursor)
        
        return {
            'results': serialize_doc(manufacturers),
            'total': total,
            'skip': skip,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch manufacturers: {str(e)}")


# Clients functions (same as suppliers but filter by is_client=true)
async def get_clients_list(search=None, skip=0, limit=100):
    """Get list of clients (companies with is_client=true)"""
    db = get_db()
    companies_collection = db['depo_companies']
    
    query = {'is_client': True}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'code': {'$regex': search, '$options': 'i'}},
            {'vatno': {'$regex': search, '$options': 'i'}},
            {'regno': {'$regex': search, '$options': 'i'}}
        ]
        query['is_client'] = True
    
    try:
        total = companies_collection.count_documents(query)
        cursor = companies_collection.find(query).sort('name', 1).skip(skip).limit(limit)
        clients = list(cursor)
        
        return {
            'results': serialize_doc(clients),
            'total': total,
            'skip': skip,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch clients: {str(e)}")
