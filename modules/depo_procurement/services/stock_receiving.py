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
        
        # Get part details to check if regulated
        part = db['depo_parts'].find_one({'_id': ObjectId(item['part_id'])})
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        
        # Determine status based on part.regulated and transferable flag
        is_regulated = part.get('regulated', False)
        is_transferable = getattr(stock_data, 'transferable', False)
        
        if is_regulated:
            # Regulated parts go directly to OK status
            state = states_collection.find_one({'_id': ObjectId('694321db8728e4d75ae72789')})
            if not state:
                state = states_collection.find_one({'name': 'OK'})
        elif is_transferable:
            # Transferable stock goes to Quarantine (transactionable)
            state = states_collection.find_one({'_id': ObjectId('694322878728e4d75ae72790')})
            if not state:
                state = states_collection.find_one({'name': {'$regex': 'quarantine.*transactionable', '$options': 'i'}})
        else:
            # Default: Quarantined (not transferable)
            state = states_collection.find_one({'_id': ObjectId('694322758728e4d75ae7278f')})
            if not state:
                state = states_collection.find_one({'name': {'$regex': '^quarantined$', '$options': 'i'}})
        
        if not state:
            # Ultimate fallback: any quarantine state
            state = states_collection.find_one({'name': {'$regex': 'quarantin', '$options': 'i'}})
            if not state:
                raise HTTPException(status_code=400, detail="No suitable stock state found")
        
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
        
        stock_doc['_id'] = stock_id
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
        
        # Enrich with part details and status details
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

