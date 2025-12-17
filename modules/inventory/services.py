"""
Inventory Module - Business Logic Services
"""
from fastapi import HTTPException
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db


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
        return result
    return doc


async def get_stocks_list(search=None, skip=0, limit=100, part_id=None):
    """Get list of stocks with enriched data"""
    db = get_db()
    stocks_collection = db['depo_stocks']
    
    query = {}
    
    # Filter by part_id if provided
    if part_id:
        query['part_id'] = part_id
    
    if search:
        search_conditions = [
            {'batch_code': {'$regex': search, '$options': 'i'}},
            {'serial_numbers': {'$regex': search, '$options': 'i'}},
            {'notes': {'$regex': search, '$options': 'i'}}
        ]
        if query:
            query['$and'] = [{'part_id': part_id}, {'$or': search_conditions}]
        else:
            query['$or'] = search_conditions
    
    try:
        # Get total count
        total = stocks_collection.count_documents(query)
        
        # Get paginated results
        cursor = stocks_collection.find(query).sort('created_at', -1).skip(skip).limit(limit)
        stocks = list(cursor)
        
        # Enrich with related data
        for stock in stocks:
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
            
            # Determine supplier based on supplier_id, purchase_order_id or build_order_id
            supplier_name = None
            
            # First check if supplier_id is directly in stock
            if stock.get('supplier_id'):
                supplier = db['depo_companies'].find_one({'_id': ObjectId(stock['supplier_id'])})
                if supplier:
                    supplier_name = supplier.get('name')
            
            # Check if it's from a build order (internal production)
            elif stock.get('build_order_id'):
                # Get organization name from config
                org_config = db['config'].find_one({'slug': 'organizatie'})
                if org_config:
                    supplier_name = org_config.get('value', {}).get('name', 'Internal Production')
                else:
                    supplier_name = 'Internal Production'
            
            # Check if it's from a purchase order
            elif stock.get('purchase_order_id'):
                purchase_order = db['depo_purchase_orders'].find_one({'_id': ObjectId(stock['purchase_order_id'])})
                if purchase_order and purchase_order.get('supplier_id'):
                    supplier = db['depo_companies'].find_one({'_id': ObjectId(purchase_order['supplier_id'])})
                    if supplier:
                        supplier_name = supplier.get('name')
            
            stock['supplier_name'] = supplier_name
            
            # Calculate stock value (quantity * purchase_price if available)
            stock_value = 0
            if stock.get('purchase_order_id'):
                purchase_order = db['depo_purchase_orders'].find_one({'_id': ObjectId(stock['purchase_order_id'])})
                if purchase_order and purchase_order.get('items'):
                    # Find the matching item in the purchase order
                    for item in purchase_order['items']:
                        if str(item.get('part_id')) == str(stock.get('part_id')):
                            purchase_price = item.get('purchase_price', 0)
                            stock_value = stock.get('quantity', 0) * purchase_price
                            break
            
            stock['stock_value'] = stock_value
        
        return {
            'results': serialize_doc(stocks),
            'total': total,
            'skip': skip,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stocks: {str(e)}")


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
        
        # Determine supplier
        supplier_name = None
        
        if stock.get('build_order_id'):
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
                        purchase_price = item.get('purchase_price', 0)
                        stock_value = stock.get('quantity', 0) * purchase_price
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
    """Get a specific supplier by ID"""
    db = get_db()
    companies_collection = db['depo_companies']
    
    try:
        supplier = companies_collection.find_one({'_id': ObjectId(supplier_id)})
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        return serialize_doc(supplier)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch supplier: {str(e)}")


async def create_supplier(supplier_data, current_user):
    """Create a new supplier"""
    db = get_db()
    companies_collection = db['depo_companies']
    
    # Validate that at least one checkbox is selected
    if not (supplier_data.get('is_supplier') or supplier_data.get('is_client') or supplier_data.get('is_manufacturer')):
        raise HTTPException(status_code=400, detail="At least one of is_supplier, is_client, or is_manufacturer must be selected")
    
    doc = {
        'name': supplier_data.get('name'),
        'code': supplier_data.get('code', ''),
        'is_supplier': supplier_data.get('is_supplier', False),
        'is_manufacturer': supplier_data.get('is_manufacturer', False),
        'is_client': supplier_data.get('is_client', False),
        'vatno': supplier_data.get('vatno', ''),
        'regno': supplier_data.get('regno', ''),
        'payment_conditions': supplier_data.get('payment_conditions', ''),
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
