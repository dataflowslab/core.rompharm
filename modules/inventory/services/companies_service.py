"""
Inventory Module - Companies/Suppliers/Manufacturers/Clients Services
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
    """
    db = get_db()
    companies_collection = db['depo_companies']
    
    # Determine prefix based on company type
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
            number_part = code.split('-')[1]
            number = int(number_part)
            if number > max_number:
                max_number = number
        except (IndexError, ValueError):
            continue
    
    next_number = max_number + 1
    return f"{prefix}-{next_number:04d}"


def generate_company_id_str(company):
    """
    Generate display ID string for company based on type and pk
    Format: S009 (Supplier), M009 (Manufacturer), C009 (Client)
    """
    pk = company.get('pk')
    if not pk:
        return 'N/A'
    
    if company.get('is_manufacturer'):
        prefix = 'M'
    elif company.get('is_supplier'):
        prefix = 'S'
    elif company.get('is_client'):
        prefix = 'C'
    else:
        prefix = 'N'
    
    return f"{prefix}{pk:03d}"


def serialize_company_doc(doc):
    """Serialize company document with id_str"""
    from modules.inventory.routes.utils import serialize_doc
    result = serialize_doc(doc)
    
    if isinstance(result, dict) and 'pk' in result:
        if 'is_supplier' in result or 'is_manufacturer' in result or 'is_client' in result:
            result['id_str'] = generate_company_id_str(doc)
    
    return result


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
        total = companies_collection.count_documents(query)
        cursor = companies_collection.find(query).sort('name', 1).skip(skip).limit(limit)
        suppliers = list(cursor)
        
        return {
            'results': serialize_company_doc(suppliers),
            'total': total,
            'skip': skip,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch suppliers: {str(e)}")


async def get_supplier_by_id(supplier_id: str):
    """Get a specific supplier by ID with enriched addresses"""
    db = get_db()
    
    try:
        pipeline = [
            {'$match': {'_id': ObjectId(supplier_id)}},
            {'$unwind': {'path': '$addresses', 'preserveNullAndEmptyArrays': True}},
            {
                '$lookup': {
                    'from': 'depo_countries',
                    'let': {'country_id': {'$toObjectId': '$addresses.country_id'}},
                    'pipeline': [{'$match': {'$expr': {'$eq': ['$_id', '$$country_id']}}}],
                    'as': 'country_info'
                }
            },
            {
                '$addFields': {
                    'addresses.country': {
                        '$ifNull': [
                            {'$arrayElemAt': ['$country_info.name', 0]},
                            '$addresses.country'
                        ]
                    }
                }
            },
            {'$project': {'country_info': 0}},
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
        
        if not supplier.get('addresses') or supplier['addresses'] == [{}]:
            supplier['addresses'] = []
        
        return serialize_company_doc(supplier)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch supplier: {str(e)}")


async def create_supplier(supplier_data, current_user):
    """Create a new supplier with auto-generated pk and code"""
    db = get_db()
    companies_collection = db['depo_companies']
    
    if not (supplier_data.get('is_supplier') or supplier_data.get('is_client') or supplier_data.get('is_manufacturer')):
        raise HTTPException(status_code=400, detail="At least one of is_supplier, is_client, or is_manufacturer must be selected")
    
    auto_pk = generate_company_pk()
    auto_code = generate_company_code(supplier_data)
    
    doc = {
        'pk': auto_pk,
        'name': supplier_data.get('name'),
        'code': auto_code,
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
        return serialize_company_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create supplier: {str(e)}")


async def update_supplier(supplier_id: str, supplier_data, current_user):
    """Update an existing supplier"""
    db = get_db()
    companies_collection = db['depo_companies']
    
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
    
    for field in ['name', 'code', 'is_supplier', 'is_manufacturer', 'is_client', 
                  'vatno', 'regno', 'payment_conditions', 'delivery_conditions', 
                  'bank_account', 'addresses', 'contacts']:
        if field in supplier_data:
            update_doc[field] = supplier_data[field]
    
    if 'currency_id' in supplier_data:
        update_doc['currency_id'] = ObjectId(supplier_data['currency_id']) if supplier_data['currency_id'] else None
    
    try:
        result = companies_collection.update_one(
            {'_id': ObjectId(supplier_id)},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        updated_supplier = companies_collection.find_one({'_id': ObjectId(supplier_id)})
        return serialize_company_doc(updated_supplier)
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
        cursor = parts_collection.find({
            'suppliers.supplier_id': supplier_id
        }).sort('name', 1)
        
        parts = list(cursor)
        
        for part in parts:
            if part.get('suppliers'):
                for supplier_info in part['suppliers']:
                    if supplier_info.get('supplier_id') == supplier_id:
                        part['supplier_code'] = supplier_info.get('supplier_code', '')
                        part['supplier_currency'] = supplier_info.get('currency', 'EUR')
                        break
        
        from modules.inventory.routes.utils import serialize_doc
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
        
        part = parts_collection.find_one({'_id': ObjectId(part_id)})
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        
        if 'suppliers' not in part:
            part['suppliers'] = []
        
        supplier_exists = any(s.get('supplier_id') == supplier_id for s in part['suppliers'])
        
        if supplier_exists:
            raise HTTPException(status_code=400, detail="Supplier already associated with this part")
        
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
        part = parts_collection.find_one({'_id': ObjectId(part_id)})
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        
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
        part = parts_collection.find_one({'_id': ObjectId(part_id)})
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        
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
            'results': serialize_company_doc(manufacturers),
            'total': total,
            'skip': skip,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch manufacturers: {str(e)}")


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
            'results': serialize_company_doc(clients),
            'total': total,
            'skip': skip,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch clients: {str(e)}")
