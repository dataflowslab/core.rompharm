"""
Force fix order - manually set to Issued status
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import yaml

# Load MongoDB connection
def get_mongo_connection():
    config_path = os.path.join(os.path.dirname(__file__), 'config', 'config.yaml')
    if not os.path.exists(config_path):
        config_path = os.path.join(os.path.dirname(__file__), 'config.yaml')
    
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    return config.get('mongo', {}).get('auth_string')

mongo_uri = get_mongo_connection()
client = MongoClient(mongo_uri)
db = client['dataflows_rompharm']

order_id = '695d181640dfa129109bedef'

print(f"\n{'='*70}")
print(f"FORCE FIXING Order: {order_id}")
print(f"{'='*70}\n")

# 1. Fix approval flow to approved
flow = db.approval_flows.find_one({
    'object_type': 'procurement_order',
    'object_id': ObjectId(order_id)
})

if flow:
    print("🔧 Setting approval flow to 'approved'...")
    db.approval_flows.update_one(
        {'_id': flow['_id']},
        {
            '$set': {
                'status': 'approved',
                'completed_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
        }
    )
    print("   ✅ Flow status = approved")

# 2. Fix order to Issued
issued_state_id = ObjectId('6943a4a6451609dd8a618cdf')
issued_state = db.depo_purchase_orders_states.find_one({'_id': issued_state_id})

if issued_state:
    print(f"\n🔧 Setting order to 'Issued' state...")
    print(f"   State: {issued_state.get('name')} (value: {issued_state.get('value')})")
    
    db.depo_purchase_orders.update_one(
        {'_id': ObjectId(order_id)},
        {
            '$set': {
                'state_id': issued_state['_id'],
                'updated_at': datetime.utcnow(),
                'approved_at': datetime.utcnow(),
                'approved_by': 'romphadmin'
            },
            '$unset': {
                'status': ''  # Remove old status field
            }
        }
    )
    print("   ✅ Order state_id = Issued")
    print("   ✅ Removed old 'status' field")

print(f"\n🎉 SUCCESS!")
print(f"   - Approval Flow: approved")
print(f"   - Order Status: Issued")
print(f"\n✅ Refresh your browser to see changes!")
print(f"{'='*70}\n")
