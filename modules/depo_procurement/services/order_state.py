"""
DEPO Procurement Module - Order State Services
"""
from fastapi import HTTPException, UploadFile
from datetime import datetime
from bson import ObjectId
import os
import hashlib

from src.backend.utils.db import get_db
from ..utils import serialize_doc


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
