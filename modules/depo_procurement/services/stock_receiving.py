"""
DEPO Procurement Module - Stock Receiving Services
"""
from fastapi import HTTPException, UploadFile
from datetime import datetime
from bson import ObjectId
import os
import hashlib

from src.backend.utils.db import get_db
from ..utils import serialize_doc
from .order_state import check_and_auto_finish_order


async def receive_stock_item(order_id: str, stock_data, current_user):
    """Receive stock items for a purchase order line - creates separate depo_stocks entry and links it to the item"""
    db = get_db()
    po_collection = db['depo_purchase_orders']
    stock_collection = db['depo_stocks']
    states_collection = db['depo_stocks_states']
    
    try:
        # Get purchase order
        order = po_collection.find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        items = order.get('items', [])
        
        # Find item by part_id instead of index (more reliable)
        item = None
        item_index = -1
        for idx, order_item in enumerate(items):
            if order_item.get('part_id') == stock_data.part_id:
                item = order_item
                item_index = idx
                break
        
        if not item:
            raise HTTPException(status_code=404, detail=f"Item with part_id {stock_data.part_id} not found in order")
        
        # Get part details to check lotallexp flag
        part = db['depo_parts'].find_one({'_id': ObjectId(item['part_id'])})
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        
        # All received stock starts with "Label" status (699b2d8a111409dd80cc361b)
        # This is an intermediate state before the product is scanned via mobile app
        # After scanning, it will move to quarantine or OK based on lotallexp and other rules
        state = states_collection.find_one({'_id': ObjectId('699b2d8a111409dd80cc361b')})
        if not state:
            state = states_collection.find_one({'name': 'Label'})
        
        if not state:
            raise HTTPException(status_code=400, detail="Label status not found in depo_stocks_states")
        
        # Create separate stock entry in depo_stocks with all supplier batch data
        stock_doc = {
            'part_id': ObjectId(item['part_id']),
            'location_id': ObjectId(stock_data.location_id),
            'quantity': stock_data.quantity,
            'batch_code': stock_data.batch_code or '',
            'supplier_batch_code': getattr(stock_data, 'supplier_batch_code', '') or '',
            'serial_numbers': stock_data.serial_numbers or '',
            'packaging': stock_data.packaging or '',
            'state_id': state['_id'],  # Save state_id instead of status value
            'notes': stock_data.notes or '',
            'purchase_order_id': ObjectId(order_id),
            'purchase_order_reference': order.get('reference'),
            'supplier_id': order.get('supplier_id'),
            'supplier_um_id': ObjectId(getattr(stock_data, 'supplier_um_id', '694813b6297c9dde6d7065b7')),
            'received_date': datetime.utcnow(),
            'received_by': current_user.get('username'),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'created_by': current_user.get('username'),
            'updated_by': current_user.get('username'),
            # Additional supplier batch data fields
            'manufacturing_date': getattr(stock_data, 'manufacturing_date', None),
            'expected_quantity': getattr(stock_data, 'expected_quantity', None),
            'expiry_date': getattr(stock_data, 'expiry_date', None),
            'reset_date': getattr(stock_data, 'reset_date', None),
            'containers': getattr(stock_data, 'containers', None),
            'containers_cleaned': getattr(stock_data, 'containers_cleaned', False),
            'supplier_ba_no': getattr(stock_data, 'supplier_ba_no', '') or '',
            'supplier_ba_date': getattr(stock_data, 'supplier_ba_date', None),
            'accord_ba': getattr(stock_data, 'accord_ba', False),
            'is_list_supplier': getattr(stock_data, 'is_list_supplier', False),
            'clean_transport': getattr(stock_data, 'clean_transport', False),
            'temperature_control': getattr(stock_data, 'temperature_control', False),
            'temperature_conditions_met': getattr(stock_data, 'temperature_conditions_met', None),
        }
        
        result = stock_collection.insert_one(stock_doc)
        stock_id = result.inserted_id
        
        # Initialize stocks array if it doesn't exist
        if 'stocks' not in item:
            item['stocks'] = []
        
        # Add stock_id to item's stocks array
        item['stocks'].append(stock_id)
        items[item_index] = item
        
        # Calculate received quantity from stocks array
        received_qty = 0
        for stock_oid in item.get('stocks', []):
            stock_entry = stock_collection.find_one({'_id': stock_oid})
            if stock_entry:
                received_qty += stock_entry.get('quantity', 0)
        
        # Update item with calculated received quantity (for backward compatibility and quick access)
        item['received'] = received_qty
        
        # Calculate line_items (number of items with stocks)
        line_items = sum(1 for i in items if i.get('stocks') and len(i.get('stocks', [])) > 0)
        
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
        
        # Check if all items are received and auto-finish
        await check_and_auto_finish_order(order_id)
        
        # Log the stock receipt
        part_name = part.get('name', 'Unknown')
        db.logs.insert_one({
            'collection': 'depo_purchase_orders',
            'object_id': order_id,
            'action': 'stock_received',
            'user': current_user.get('username'),
            'timestamp': datetime.utcnow(),
            'description': f'Stock received: {part_name} - Quantity: {stock_data.quantity}',
            'details': {
                'part_id': item['part_id'],
                'part_name': part_name,
                'quantity': stock_data.quantity,
                'location_id': stock_data.location_id,
                'batch_code': stock_data.batch_code or '',
                'stock_id': str(stock_id)
            }
        })
        
        stock_doc['_id'] = stock_id
        return serialize_doc(stock_doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to receive stock: {str(e)}")


async def get_received_stock_items(order_id: str):
    """Get received stock items for a purchase order with System UM and converted quantities"""
    db = get_db()
    collection = db['depo_stocks']
    
    try:
        cursor = collection.find({'purchase_order_id': ObjectId(order_id)}).sort('received_date', -1)
        stocks = list(cursor)
        
        # Enrich with part details, status details, and System UM
        for stock in stocks:
            # Get part details
            if stock.get('part_id'):
                part = db['depo_parts'].find_one({'_id': ObjectId(stock['part_id'])})
                if part:
                    stock['part_detail'] = {
                        'name': part.get('name'),
                        'ipn': part.get('ipn'),
                        'um': part.get('um')
                    }
                    
                    # Get System UM details
                    if part.get('system_um_id'):
                        system_um = db['depo_ums'].find_one({'_id': ObjectId(part['system_um_id'])})
                        if system_um:
                            stock['system_um_detail'] = {
                                'name': system_um.get('name'),
                                'abrev': system_um.get('abrev'),
                                'symbol': system_um.get('symbol', '')
                            }
                    
                    # Get Manufacturer UM details
                    if part.get('manufacturer_um_id'):
                        manufacturer_um = db['depo_ums'].find_one({'_id': ObjectId(part['manufacturer_um_id'])})
                        if manufacturer_um:
                            stock['manufacturer_um_detail'] = {
                                'name': manufacturer_um.get('name'),
                                'abrev': manufacturer_um.get('abrev'),
                                'symbol': manufacturer_um.get('symbol', '')
                            }
                    
                    # Calculate converted quantity (Manufacturer UM * Conversion Modifier = System UM)
                    conversion_modifier = part.get('conversion_modifier', 1.0) or 1.0
                    stock['quantity_received'] = stock.get('quantity', 0)  # Original quantity in Manufacturer UM
                    stock['quantity_system_um'] = stock.get('quantity', 0) * conversion_modifier  # Converted to System UM
                    stock['conversion_modifier'] = conversion_modifier
            
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
        
        return serialize_doc(stocks)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch received items: {str(e)}")
