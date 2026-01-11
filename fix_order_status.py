"""
Quick fix script to check and update order status after signing
Usage: python fix_order_status.py <order_id>
"""
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

# Import the global helper
from src.backend.utils.approval_helpers import check_approval_completion

# MongoDB connection
client = MongoClient('mongodb://localhost:27017/')
db = client['dataflows_rompharm']

def fix_order_status(order_id):
    """Check and fix order status based on approval flow"""
    
    print(f"\n{'='*70}")
    print(f"Checking Order: {order_id}")
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
    
    # 3. Check completion using global helper
    required_officers = flow.get('required_officers', [])
    signatures = flow.get('signatures', [])
    
    print(f"\n🔍 Checking Completion...")
    print(f"   Required Officers: {len(required_officers)}")
    
    for i, officer in enumerate(required_officers, 1):
        print(f"   {i}. Type: {officer['type']}, Reference: {officer['reference']}")
    
    # Use the global helper function
    is_complete, signed_count, required_count = check_approval_completion(
        db,
        required_officers,
        signatures
    )
    
    print(f"\n📊 Completion Status: {signed_count}/{required_count}")
    print(f"   Is Complete: {'✅ YES' if is_complete else '❌ NO'}")
    
    # 4. Fix if needed
    if is_complete:
        if flow.get('status') != 'approved':
            print(f"\n⚠️  Flow is complete but status is '{flow.get('status')}'")
            print(f"   Fixing flow status...")
            
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
            print(f"   ✅ Flow status updated to 'approved'")
        
        if order.get('status') != 'Processing':
            print(f"\n⚠️  Order status is '{order.get('status')}' but should be 'Processing'")
            print(f"   Fixing order status...")
            
            processing_state = db.depo_purchase_orders_states.find_one({'name': 'Processing'})
            if processing_state:
                last_signature = signatures[-1] if signatures else {}
                
                db.depo_purchase_orders.update_one(
                    {'_id': ObjectId(order_id)},
                    {
                        '$set': {
                            'state_id': processing_state['_id'],
                            'status': 'Processing',
                            'updated_at': datetime.utcnow(),
                            'approved_at': datetime.utcnow(),
                            'approved_by': last_signature.get('username', 'system')
                        }
                    }
                )
                print(f"   ✅ Order status updated to 'Processing'")
                print(f"\n🎉 SUCCESS! Order is now approved and ready for receiving stock")
            else:
                print(f"   ❌ ERROR: 'Processing' state not found in database")
        else:
            print(f"\n✅ Order status is already correct: 'Processing'")
    else:
        print(f"\n⏳ Order is not yet fully approved")
        print(f"   Waiting for {required_count - signed_count} more signature(s)")
    
    print(f"\n{'='*70}\n")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python fix_order_status.py <order_id>")
        print("Example: python fix_order_status.py 695d181640dfa129109bedef")
        sys.exit(1)
    
    order_id = sys.argv[1]
    
    try:
        fix_order_status(order_id)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
