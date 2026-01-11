"""
Fix existing order that was signed with old code
This will update the order status to Issued and approval flow to approved
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import yaml

# Import the global helper
from src.backend.utils.approval_helpers import check_approval_completion

# Load MongoDB connection from config
def get_mongo_connection():
    """Load MongoDB connection string from config.yaml"""
    config_path = os.path.join(os.path.dirname(__file__), 'config', 'config.yaml')
    
    if not os.path.exists(config_path):
        # Try root config.yaml
        config_path = os.path.join(os.path.dirname(__file__), 'config.yaml')
    
    if not os.path.exists(config_path):
        raise Exception("config.yaml not found!")
    
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    mongo_uri = config.get('mongo', {}).get('auth_string')
    if not mongo_uri:
        raise Exception("MongoDB auth_string not found in config!")
    
    return mongo_uri

# MongoDB connection
mongo_uri = get_mongo_connection()
client = MongoClient(mongo_uri)
db = client['dataflows_rompharm']

def fix_order(order_id):
    """Fix order that was signed with old code"""
    
    print(f"\n{'='*70}")
    print(f"Fixing Order: {order_id}")
    print(f"{'='*70}\n")
    
    # 1. Get order
    order = db.depo_purchase_orders.find_one({'_id': ObjectId(order_id)})
    if not order:
        print(f"❌ Order not found: {order_id}")
        return
    
    print(f"📦 Order: {order.get('reference', 'N/A')}")
    print(f"   Current Status: {order.get('status', 'N/A')}")
    print(f"   State ID: {order.get('state_id', 'N/A')}")
    
    # 2. Get approval flow
    flow = db.approval_flows.find_one({
        'object_type': 'procurement_order',
        'object_id': ObjectId(order_id)
    })
    
    if not flow:
        print(f"\n❌ No approval flow found")
        return
    
    print(f"\n✅ Approval Flow Found")
    print(f"   Flow Status: {flow.get('status', 'N/A')}")
    print(f"   Signatures: {len(flow.get('signatures', []))}")
    
    # 3. Check completion
    required_officers = flow.get('required_officers', [])
    signatures = flow.get('signatures', [])
    
    is_complete, signed_count, required_count = check_approval_completion(
        db,
        required_officers,
        signatures
    )
    
    print(f"\n📊 Completion: {signed_count}/{required_count}")
    print(f"   Is Complete: {'✅ YES' if is_complete else '❌ NO'}")
    
    if not is_complete:
        print(f"\n⏳ Order is not fully signed yet")
        return
    
    # 4. Fix flow status
    if flow.get('status') != 'approved':
        print(f"\n🔧 Fixing flow status to 'approved'...")
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
        print(f"   ✅ Flow status updated")
    
    # 5. Fix order status to Issued
    issued_state_id = ObjectId('6943a4a6451609dd8a618cdf')
    issued_state = db.depo_purchase_orders_states.find_one({'_id': issued_state_id})
    
    if not issued_state:
        print(f"\n❌ ERROR: Issued state not found!")
        return
    
    print(f"\n🔧 Fixing order status to 'Issued'...")
    print(f"   State: {issued_state.get('name')} (value: {issued_state.get('value')})")
    
    last_signature = signatures[-1] if signatures else {}
    
    db.depo_purchase_orders.update_one(
        {'_id': ObjectId(order_id)},
        {
            '$set': {
                'state_id': issued_state['_id'],
                'updated_at': datetime.utcnow(),
                'approved_at': datetime.utcnow(),
                'approved_by': last_signature.get('username', 'system')
            },
            '$unset': {
                'status': ''  # Remove old status field
            }
        }
    )
    
    print(f"   ✅ Order updated to 'Issued'")
    print(f"\n🎉 SUCCESS! Order is now:")
    print(f"   - Approval Flow: approved")
    print(f"   - Order Status: Issued")
    print(f"   - Ready for receiving stock")
    print(f"\n{'='*70}\n")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        # Default to the order we've been working with
        order_id = '695d181640dfa129109bedef'
        print(f"Using default order ID: {order_id}")
    else:
        order_id = sys.argv[1]
    
    try:
        fix_order(order_id)
        print("\n✅ Done! Refresh the page in your browser to see the changes.")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
