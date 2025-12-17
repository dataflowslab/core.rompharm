"""
DEPO Procurement Module - Business Logic Services
"""
from fastapi import HTTPException, UploadFile
from datetime import datetime
from bson import ObjectId
import os
import hashlib

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


async def get_purchase_orders_list(search=None):
    """Get list of purchase orders with supplier details"""
    db = get_db()
    collection = db['depo_purchase_orders']
    
    query = {}
    if search:
        query['$or'] = [
            {'reference': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}},
            {'supplier_reference': {'$regex': search, '$options': 'i'}}
        ]
    
    try:
        cursor = collection.find(query).sort('created_at', -1)
        orders = list(cursor)
        
        # Enrich with supplier details
        for order in orders:
            if order.get('supplier_id'):
                supplier = db['depo_companies'].find_one({'_id': ObjectId(order['supplier_id'])})
                if supplier:
                    order['supplier_detail'] = serialize_doc(supplier)
        
        return serialize_doc(orders)
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
        'status': 'Pending',
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
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create purchase order: {str(e)}")


async def get_order_items(order_id: str):
    """Get items for a purchase order with part details"""
    db = get_db()
    collection = db['depo_purchase_orders']
    
    try:
        order = collection.find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        items = order.get('items', [])
        
        # Enrich with part details
        for item in items:
            if item.get('part_id'):
                part = db['depo_parts'].find_one({'_id': ObjectId(item['part_id'])})
                if part:
                    item['part_detail'] = {
                        'name': part.get('name'),
                        'ipn': part.get('ipn'),
                        'um': part.get('um')
                    }
        
        return {'results': serialize_doc(items)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch purchase order items: {str(e)}")


async def add_order_item(order_id: str, item_data):
    """Add an item to a purchase order"""
    db = get_db()
    collection = db['depo_purchase_orders']
    
    try:
        order = collection.find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        # Get part details
        part = db['depo_parts'].find_one({'_id': ObjectId(item_data.part_id)})
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        
        # Create item
        item = {
            'part_id': item_data.part_id,
            'quantity': item_data.quantity,
            'received': 0,
            'purchase_price': item_data.purchase_price,
            'reference': item_data.reference or '',
            'destination_id': item_data.destination_id,
            'purchase_price_currency': item_data.purchase_price_currency or order.get('currency', 'EUR'),
            'notes': item_data.notes or '',
            'part_detail': {
                'name': part.get('name'),
                'ipn': part.get('ipn'),
                'um': part.get('um')
            }
        }
        
        # Add to order
        items = order.get('items', [])
        items.append(item)
        
        collection.update_one(
            {'_id': ObjectId(order_id)},
            {
                '$set': {
                    'items': items,
                    'lines': len(items),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        return serialize_doc(item)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add item to purchase order: {str(e)}")


async def update_order_item(order_id: str, item_index: int, item_data):
    """Update an item in a purchase order"""
    db = get_db()
    collection = db['depo_purchase_orders']
    
    try:
        order = collection.find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        items = order.get('items', [])
        if item_index < 0 or item_index >= len(items):
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Update item fields
        if item_data.quantity is not None:
            items[item_index]['quantity'] = item_data.quantity
        if item_data.purchase_price is not None:
            items[item_index]['purchase_price'] = item_data.purchase_price
        if item_data.reference is not None:
            items[item_index]['reference'] = item_data.reference
        if item_data.destination_id is not None:
            items[item_index]['destination_id'] = item_data.destination_id
        if item_data.purchase_price_currency is not None:
            items[item_index]['purchase_price_currency'] = item_data.purchase_price_currency
        if item_data.notes is not None:
            items[item_index]['notes'] = item_data.notes
        
        collection.update_one(
            {'_id': ObjectId(order_id)},
            {
                '$set': {
                    'items': items,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        return serialize_doc(items[item_index])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update item: {str(e)}")


async def delete_order_item(order_id: str, item_index: int):
    """Delete an item from a purchase order"""
    db = get_db()
    collection = db['depo_purchase_orders']
    
    try:
        order = collection.find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        items = order.get('items', [])
        if item_index < 0 or item_index >= len(items):
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Remove item
        items.pop(item_index)
        
        collection.update_one(
            {'_id': ObjectId(order_id)},
            {
                '$set': {
                    'items': items,
                    'lines': len(items),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete item: {str(e)}")


async def receive_stock_item(order_id: str, stock_data, current_user):
    """Receive stock items for a purchase order line"""
    db = get_db()
    po_collection = db['depo_purchase_orders']
    stock_collection = db['depo_stocks']
    
    try:
        # Get purchase order
        order = po_collection.find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        items = order.get('items', [])
        if stock_data.line_item_index < 0 or stock_data.line_item_index >= len(items):
            raise HTTPException(status_code=404, detail="Line item not found")
        
        item = items[stock_data.line_item_index]
        
        # Create stock entry
        stock_doc = {
            'part_id': ObjectId(item['part_id']),
            'location_id': ObjectId(stock_data.location_id),
            'quantity': stock_data.quantity,
            'batch_code': stock_data.batch_code or '',
            'serial_numbers': stock_data.serial_numbers or '',
            'packaging': stock_data.packaging or '',
            'status': stock_data.status or 'OK',
            'notes': stock_data.notes or '',
            'purchase_order_id': ObjectId(order_id),
            'purchase_order_reference': order.get('reference'),
            'supplier_id': order.get('supplier_id'),
            'received_date': datetime.utcnow(),
            'received_by': current_user.get('username'),
            'created_at': datetime.utcnow()
        }
        
        result = stock_collection.insert_one(stock_doc)
        
        # Update received quantity in order
        item['received'] = item.get('received', 0) + stock_data.quantity
        items[stock_data.line_item_index] = item
        
        # Calculate line_items (number of items with received > 0)
        line_items = sum(1 for i in items if i.get('received', 0) > 0)
        
        po_collection.update_one(
            {'_id': ObjectId(order_id)},
            {
                '$set': {
                    'items': items,
                    'line_items': line_items,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        stock_doc['_id'] = result.inserted_id
        return serialize_doc(stock_doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to receive stock: {str(e)}")


async def get_received_stock_items(order_id: str):
    """Get received stock items for a purchase order"""
    db = get_db()
    collection = db['depo_stocks']
    
    try:
        cursor = collection.find({'purchase_order_id': ObjectId(order_id)}).sort('received_date', -1)
        stocks = list(cursor)
        
        # Enrich with part details
        for stock in stocks:
            if stock.get('part_id'):
                part = db['depo_parts'].find_one({'_id': ObjectId(stock['part_id'])})
                if part:
                    stock['part_detail'] = {
                        'name': part.get('name'),
                        'ipn': part.get('ipn'),
                        'um': part.get('um')
                    }
        
        return serialize_doc(stocks)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch received items: {str(e)}")


async def get_order_attachments(order_id: str):
    """Get attachments for a purchase order"""
    db = get_db()
    collection = db['depo_purchase_order_attachments']
    
    try:
        cursor = collection.find({'order_id': ObjectId(order_id)}).sort('created_at', -1)
        attachments = list(cursor)
        return serialize_doc(attachments)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch attachments: {str(e)}")


async def upload_order_attachment(order_id: str, file: UploadFile, comment: str, current_user):
    """Upload an attachment to a purchase order"""
    db = get_db()
    collection = db['depo_purchase_order_attachments']
    
    try:
        # Read file content
        file_content = await file.read()
        
        # Save file to media/files directory
        file_hash = hashlib.sha256(file_content).hexdigest()
        
        # Create date-based directory structure
        now = datetime.utcnow()
        file_dir = os.path.join('media', 'files', str(now.year), f"{now.month:02d}", f"{now.day:02d}")
        os.makedirs(file_dir, exist_ok=True)
        
        file_path = os.path.join(file_dir, file_hash)
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # Create attachment record
        doc = {
            'order_id': ObjectId(order_id),
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload attachment: {str(e)}")


async def delete_order_attachment(attachment_id: str):
    """Delete an attachment from a purchase order"""
    db = get_db()
    collection = db['depo_purchase_order_attachments']
    
    try:
        # Get attachment to delete file
        attachment = collection.find_one({'_id': ObjectId(attachment_id)})
        if attachment and attachment.get('file_path'):
            try:
                os.remove(attachment['file_path'])
            except:
                pass
        
        result = collection.delete_one({'_id': ObjectId(attachment_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Attachment not found")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete attachment: {str(e)}")
