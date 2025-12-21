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
        'status': 'Pending',  # Keep for backward compatibility
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
        
        # Auto-create approval flow based on config
        try:
            config_collection = db['config']
            approval_config = config_collection.find_one({'slug': 'procurement_approval_flows'})
            
            if approval_config and 'items' in approval_config:
                # Get the referate flow config (first item with slug='referate')
                flow_config = None
                for item in approval_config.get('items', []):
                    if item.get('slug') == 'referate' and item.get('enabled', True):
                        flow_config = item
                        break
                
                if flow_config:
                    # Build can_sign list
                    can_sign_officers = []
                    for user in flow_config.get('can_sign', []):
                        can_sign_officers.append({
                            "type": "person",
                            "reference": user.get('user_id'),
                            "username": user.get('username'),
                            "action": "can_sign"
                        })
                    
                    # Build must_sign list
                    must_sign_officers = []
                    for user in flow_config.get('must_sign', []):
                        must_sign_officers.append({
                            "type": "person",
                            "reference": user.get('user_id'),
                            "username": user.get('username'),
                            "action": "must_sign"
                        })
                    
                    flow_data = {
                        "object_type": "procurement_order",
                        "object_source": "depo_procurement",
                        "object_id": order_id,
                        "config_slug": flow_config.get('slug'),
                        "min_signatures": flow_config.get('min_signatures', 1),
                        "required_officers": must_sign_officers,
                        "optional_officers": can_sign_officers,
                        "signatures": [],
                        "status": "pending",
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                    
                    db['approval_flows'].insert_one(flow_data)
                    print(f"[PROCUREMENT] Auto-created approval flow for order {order_id}")
        except Exception as e:
            print(f"[PROCUREMENT] Warning: Failed to auto-create approval flow: {e}")
            # Don't fail the order creation if approval flow creation fails
        
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create purchase order: {str(e)}")


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
            
            # Enrich with destination details
            if item.get('destination_id'):
                location = db['depo_locations'].find_one({'_id': ObjectId(item['destination_id'])})
                if location:
                    item['destination_detail'] = {
                        'name': location.get('name')
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
        
        # Create item with unique _id
        item = {
            '_id': str(ObjectId()),  # Generate unique ID for the item
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
        if stock_data.line_item_index < 0 or stock_data.line_item_index >= len(items):
            raise HTTPException(status_code=404, detail="Line item not found")
        
        item = items[stock_data.line_item_index]
        
        # Find state_id from depo_stocks_states based on status value
        status_value = getattr(stock_data, 'status', 65)
        state = states_collection.find_one({'value': status_value})
        
        if not state:
            # Fallback: try to find Quarantine state
            state = states_collection.find_one({'name': {'$regex': 'quarantin', '$options': 'i'}})
            if not state:
                raise HTTPException(status_code=400, detail=f"Stock state with value {status_value} not found")
        
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
        items[stock_data.line_item_index] = item
        
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


async def change_order_state(order_id: str, new_state_name: str, current_user, reason: str = None):
    """Change the state of a purchase order"""
    db = get_db()
    po_collection = db['depo_purchase_orders']
    states_collection = db['depo_purchase_orders_states']
    
    try:
        # Get the order
        order = po_collection.find_one({'_id': ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        # Get the new state
        new_state = states_collection.find_one({'name': new_state_name})
        if not new_state:
            raise HTTPException(status_code=404, detail=f"State '{new_state_name}' not found")
        
        # Update the order
        update_data = {
            'state_id': new_state['_id'],
            'status': new_state_name,  # Keep for backward compatibility
            'updated_at': datetime.utcnow(),
            'updated_by': current_user.get('username')
        }
        
        # If refusing, save the reason
        if new_state_name == 'Refused' and reason:
            update_data['refused_reason'] = reason
            update_data['refused_at'] = datetime.utcnow()
            update_data['refused_by'] = current_user.get('username')
        
        # If finishing, mark as finished
        if new_state_name == 'Finished':
            update_data['finished_at'] = datetime.utcnow()
            update_data['finished_by'] = current_user.get('username')
        
        # If canceling, mark as canceled
        if new_state_name == 'Canceled':
            update_data['canceled_at'] = datetime.utcnow()
            update_data['canceled_by'] = current_user.get('username')
        
        po_collection.update_one(
            {'_id': ObjectId(order_id)},
            {'$set': update_data}
        )
        
        # Get updated order
        updated_order = po_collection.find_one({'_id': ObjectId(order_id)})
        return serialize_doc(updated_order)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to change order state: {str(e)}")


async def check_and_auto_finish_order(order_id: str):
    """Check if all items are received and auto-finish the order"""
    db = get_db()
    po_collection = db['depo_purchase_orders']
    
    try:
        order = po_collection.find_one({'_id': ObjectId(order_id)})
        if not order:
            return
        
        items = order.get('items', [])
        if not items:
            return
        
        # Check if all items are fully received
        all_received = all(
            item.get('received', 0) >= item.get('quantity', 0)
            for item in items
        )
        
        if all_received:
            # Auto-finish the order
            states_collection = db['depo_purchase_orders_states']
            finished_state = states_collection.find_one({'name': 'Finished'})
            
            if finished_state:
                po_collection.update_one(
                    {'_id': ObjectId(order_id)},
                    {
                        '$set': {
                            'state_id': finished_state['_id'],
                            'status': 'Finished',
                            'finished_at': datetime.utcnow(),
                            'finished_by': 'system',
                            'updated_at': datetime.utcnow()
                        }
                    }
                )
    except Exception as e:
        # Don't raise exception, just log
        print(f"Failed to auto-finish order: {str(e)}")
