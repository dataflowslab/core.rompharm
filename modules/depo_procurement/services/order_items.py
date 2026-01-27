"""
DEPO Procurement Module - Order Items Services
"""
from fastapi import HTTPException, UploadFile
from datetime import datetime
from bson import ObjectId
import os
import hashlib

from src.backend.utils.db import get_db
from ..utils import serialize_doc


async def get_order_items(order_id: str):
    """Get items for a purchase order with part and destination details"""
    db = get_db()
    collection = db['depo_purchase_orders']
    
    try:
        order = collection.find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        items = order.get('items', [])
        
        # Enrich items with part and destination details
        for idx, item in enumerate(items):
            # Add _id if missing (for backward compatibility with old items)
            if '_id' not in item:
                item['_id'] = str(ObjectId())
            
            # Enrich with part details
            if item.get('part_id'):
                part = db['depo_parts'].find_one({'_id': ObjectId(item['part_id'])})
                if part:
                    item['part_detail'] = {
                        'name': part.get('name'),
                        'ipn': part.get('ipn'),
                        'um': part.get('um')
                    }
        
        # Update items in database if any _id was added
        if any('_id' not in item for item in order.get('items', [])):
            collection.update_one(
                {'_id': ObjectId(order_id)},
                {'$set': {'items': items}}
            )
        
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
        
        # Determine currency: use provided currency, or get from article supplier, or use order currency
        item_currency = item_data.purchase_price_currency
        if not item_currency and order.get('supplier_id'):
            # Try to get currency from article supplier relationship
            article_supplier = db['depo_parts_suppliers'].find_one({
                'part_id': ObjectId(item_data.part_id),
                'supplier_id': ObjectId(order['supplier_id'])
            })
            if article_supplier and article_supplier.get('currency'):
                item_currency = article_supplier['currency']
        
        # Fallback to order currency
        if not item_currency:
            item_currency = order.get('currency', 'EUR')
        
        # Create item with unique _id
        item = {
            '_id': str(ObjectId()),  # Generate unique ID for the item
            'part_id': item_data.part_id,
            'quantity': item_data.quantity,
            'received': 0,
            'purchase_price': item_data.purchase_price,
            'reference': item_data.reference or '',
            'purchase_price_currency': item_currency,
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
    """Update an item in a purchase order by index (deprecated - use update_order_item_by_id)"""
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



async def update_order_item_by_id(order_id: str, item_id: str, item_data):
    """Update an item in a purchase order by item _id"""
    db = get_db()
    collection = db['depo_purchase_orders']
    
    try:
        order = collection.find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        items = order.get('items', [])
        
        # Find item by _id
        item_index = -1
        for idx, item in enumerate(items):
            if item.get('_id') == item_id:
                item_index = idx
                break
        
        if item_index == -1:
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Update item fields
        if item_data.quantity is not None:
            items[item_index]['quantity'] = item_data.quantity
        if item_data.purchase_price is not None:
            items[item_index]['purchase_price'] = item_data.purchase_price
        if item_data.reference is not None:
            items[item_index]['reference'] = item_data.reference
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
    """Delete an item from a purchase order by index (deprecated - use delete_order_item_by_id)"""
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



async def delete_order_item_by_id(order_id: str, item_id: str):
    """Delete an item from a purchase order by item _id"""
    db = get_db()
    collection = db['depo_purchase_orders']
    
    try:
        order = collection.find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        items = order.get('items', [])
        
        # Find item by _id
        item_index = -1
        for idx, item in enumerate(items):
            if item.get('_id') == item_id:
                item_index = idx
                break
        
        if item_index == -1:
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

