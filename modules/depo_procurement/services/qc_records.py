"""
DEPO Procurement Module - QC Records Services
"""
from fastapi import HTTPException
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db
from ..utils import serialize_doc


async def get_qc_records(order_id: str):
    """Get QC records for a purchase order"""
    db = get_db()
    collection = db['depo_procurement_qc']
    
    try:
        order_obj_id = ObjectId(order_id)
        cursor = collection.find({'order_id': order_obj_id}).sort('created_at', -1)
        qc_records = list(cursor)
        return {"results": serialize_doc(qc_records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch QC records: {str(e)}")


async def create_qc_record(order_id: str, qc_data: dict, current_user: dict):
    """Create a new QC record for a purchase order"""
    db = get_db()
    
    try:
        # Validate required fields
        if not qc_data.get('batch_code') or not qc_data.get('part_id'):
            raise HTTPException(status_code=400, detail="batch_code and part_id are required")
        
        # Get part details
        part_id = qc_data.get('part_id')
        part = db.depo_parts.find_one({'_id': ObjectId(part_id)})
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        
        # Create QC record
        qc_record = {
            'order_id': ObjectId(order_id),
            'batch_code': qc_data.get('batch_code'),
            'part_id': ObjectId(part_id),
            'part_name': part.get('name', ''),
            'prelevation_date': qc_data.get('prelevation_date'),
            'prelevated_quantity': qc_data.get('prelevated_quantity', 0),
            'ba_rompharm_no': qc_data.get('ba_rompharm_no', ''),
            'ba_rompharm_date': qc_data.get('ba_rompharm_date'),
            'test_result': qc_data.get('test_result', ''),
            'transactionable': qc_data.get('transactionable', False),
            'comment': qc_data.get('comment', ''),
            'confirmed': qc_data.get('confirmed', False),
            'created_at': datetime.utcnow(),
            'created_by': current_user.get('username'),
            'updated_at': datetime.utcnow()
        }
        
        result = db.depo_procurement_qc.insert_one(qc_record)
        qc_record['_id'] = result.inserted_id
        
        # If confirmed and conform, update stock status to OK
        if qc_record['confirmed'] and qc_record['test_result'] == 'conform':
            _update_stock_status_to_ok(db, order_id, part_id, qc_data.get('batch_code'))
        
        return serialize_doc(qc_record)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create QC record: {str(e)}")


async def update_qc_record(order_id: str, qc_id: str, qc_data: dict, current_user: dict):
    """Update a QC record"""
    db = get_db()
    
    try:
        # Get existing record
        qc_record = db.depo_procurement_qc.find_one({'_id': ObjectId(qc_id)})
        if not qc_record:
            raise HTTPException(status_code=404, detail="QC record not found")
        
        # Update fields
        update_data = {
            'ba_rompharm_no': qc_data.get('ba_rompharm_no', qc_record.get('ba_rompharm_no')),
            'ba_rompharm_date': qc_data.get('ba_rompharm_date', qc_record.get('ba_rompharm_date')),
            'test_result': qc_data.get('test_result', qc_record.get('test_result')),
            'transactionable': qc_data.get('transactionable', qc_record.get('transactionable')),
            'comment': qc_data.get('comment', qc_record.get('comment')),
            'confirmed': qc_data.get('confirmed', qc_record.get('confirmed')),
            'updated_at': datetime.utcnow(),
            'updated_by': current_user.get('username')
        }
        
        db.depo_procurement_qc.update_one(
            {'_id': ObjectId(qc_id)},
            {'$set': update_data}
        )
        
        # If confirmed and conform, update stock status to OK
        if update_data['confirmed'] and update_data['test_result'] == 'conform':
            _update_stock_status_to_ok(db, order_id, qc_record['part_id'], qc_record['batch_code'])
        
        # Return updated record
        updated_record = db.depo_procurement_qc.find_one({'_id': ObjectId(qc_id)})
        return serialize_doc(updated_record)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update QC record: {str(e)}")


def _update_stock_status_to_ok(db, order_id: str, part_id, batch_code: str):
    """Helper function to update stock status to OK"""
    # Get OK state
    ok_state = db.depo_stocks_states.find_one({'_id': ObjectId('694321db8728e4d75ae72789')})
    if not ok_state:
        ok_state = db.depo_stocks_states.find_one({'name': 'OK'})
    
    if ok_state:
        # Update all matching stocks to OK status
        db.depo_stocks.update_many(
            {
                'purchase_order_id': ObjectId(order_id),
                'part_id': part_id,
                'batch_code': batch_code
            },
            {
                '$set': {
                    'state_id': ok_state['_id'],
                    'updated_at': datetime.utcnow()
                }
            }
        )
