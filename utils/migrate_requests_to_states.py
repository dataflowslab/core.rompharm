"""
Migrate existing requests to use state_id system

This script migrates all existing requests from string-based status
to the new state_id system with workflow levels.

Usage:
    python utils/migrate_requests_to_states.py
"""

import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.backend.utils.db import get_db
from bson import ObjectId


def migrate_requests():
    """Migrate requests to use state_id"""
    db = get_db()
    requests_collection = db['depo_requests']
    states_collection = db['depo_requests_states']
    
    # Load all states
    states = {s['slug']: s for s in states_collection.find()}
    
    if not states:
        print("❌ No states found! Please run import_requests_states.py first.")
        return
    
    # Map old status strings to new state slugs
    status_mapping = {
        'Pending': 'new',
        'New': 'new',
        'Approved': 'approved',
        'In Operations': 'approved',
        'Finished': 'warehouse_approved',
        'Refused': 'warehouse_rejected',
        'Warehouse Approved': 'warehouse_approved',
        'Warehouse Rejected': 'warehouse_rejected',
        'Stock Received': 'stock_received',
        'Warehouse Transfer Refused': 'warehouse_transfer_refused',
        'Produced': 'produced',
        'Failed': 'failed',
        'Canceled': 'canceled',
        'Cancelled': 'canceled'
    }
    
    # Get all requests
    total_requests = requests_collection.count_documents({})
    print(f"📊 Found {total_requests} requests to migrate")
    
    if total_requests == 0:
        print("✅ No requests to migrate")
        return
    
    migrated = 0
    skipped = 0
    errors = 0
    
    for request in requests_collection.find():
        try:
            # Get current status
            old_status = request.get('status', 'Pending')
            
            # Check if already migrated
            if 'state_id' in request and request.get('state_id'):
                skipped += 1
                continue
            
            # Map to new state
            state_slug = status_mapping.get(old_status, 'new')
            state = states.get(state_slug)
            
            if not state:
                print(f"⚠️  Unknown status '{old_status}' for request {request.get('reference', request['_id'])}, using 'new'")
                state = states['new']
            
            # Update request
            update_data = {
                'state_id': state['_id'],
                'workflow_level': state['workflow_level'],
                'status': state['name'],  # Keep status for backward compatibility
                'updated_at': datetime.utcnow()
            }
            
            requests_collection.update_one(
                {'_id': request['_id']},
                {'$set': update_data}
            )
            
            migrated += 1
            
            if migrated % 10 == 0:
                print(f"  ⏳ Migrated {migrated}/{total_requests}...")
        
        except Exception as e:
            errors += 1
            print(f"❌ Error migrating request {request.get('reference', request['_id'])}: {e}")
    
    print("\n" + "="*80)
    print(f"✅ Migration completed!")
    print(f"  • Migrated: {migrated}")
    print(f"  • Skipped (already migrated): {skipped}")
    print(f"  • Errors: {errors}")
    print("="*80)
    
    # Show distribution
    print("\n📊 State Distribution:")
    pipeline = [
        {
            '$lookup': {
                'from': 'depo_requests_states',
                'localField': 'state_id',
                'foreignField': '_id',
                'as': 'state'
            }
        },
        {'$unwind': '$state'},
        {
            '$group': {
                '_id': '$state.name',
                'count': {'$sum': 1}
            }
        },
        {'$sort': {'count': -1}}
    ]
    
    for result in requests_collection.aggregate(pipeline):
        print(f"  • {result['_id']:30} : {result['count']:3} requests")


if __name__ == '__main__':
    try:
        migrate_requests()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
