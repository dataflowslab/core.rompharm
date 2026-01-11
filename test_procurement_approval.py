"""
Test script for procurement approval flow
Usage: python test_procurement_approval.py <order_id>
"""
import sys
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

# MongoDB connection
client = MongoClient('mongodb://localhost:27017/')
db = client['dataflows_rompharm']

def test_approval_flow(order_id):
    """Test and debug approval flow for a purchase order"""
    
    print(f"\n{'='*60}")
    print(f"Testing Approval Flow for Order: {order_id}")
    print(f"{'='*60}\n")
    
    # 1. Get order
    order = db.depo_purchase_orders.find_one({'_id': ObjectId(order_id)})
    if not order:
        print(f"❌ Order not found: {order_id}")
        return
    
    print(f"📦 Order: {order.get('reference', 'N/A')}")
    print(f"   Status: {order.get('status', 'N/A')}")
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
    print(f"   Flow ID: {flow['_id']}")
    print(f"   Status: {flow.get('status', 'N/A')}")
    print(f"   Template: {flow.get('template_name', 'N/A')}")
    
    # 3. Check officers
    required_officers = flow.get('required_officers', [])
    optional_officers = flow.get('optional_officers', [])
    signatures = flow.get('signatures', [])
    
    print(f"\n👥 Required Officers: {len(required_officers)}")
    for i, officer in enumerate(required_officers, 1):
        print(f"   {i}. Type: {officer['type']}, Reference: {officer['reference']}, Action: {officer['action']}")
    
    print(f"\n👥 Optional Officers: {len(optional_officers)}")
    for i, officer in enumerate(optional_officers, 1):
        print(f"   {i}. Type: {officer['type']}, Reference: {officer['reference']}, Action: {officer['action']}")
    
    print(f"\n✍️  Signatures: {len(signatures)}")
    for i, sig in enumerate(signatures, 1):
        user = db.users.find_one({'_id': ObjectId(sig['user_id'])})
        user_name = user.get('name') or user.get('username') if user else 'Unknown'
        print(f"   {i}. User: {user_name} ({sig['username']})")
        print(f"      Signed at: {sig['signed_at']}")
        print(f"      User ID: {sig['user_id']}")
    
    # 4. Check if all required officers have signed
    print(f"\n🔍 Checking Signature Completion...")
    
    required_signed = 0
    for officer in required_officers:
        has_signed = False
        
        if officer['type'] == 'person':
            # Check if this person has signed
            if any(s['user_id'] == officer['reference'] for s in signatures):
                has_signed = True
                required_signed += 1
        
        elif officer['type'] == 'role':
            # Check if anyone with this role has signed
            role_slug = officer['reference']
            role = db.roles.find_one({'slug': role_slug})
            
            if role:
                role_id = str(role['_id'])
                # Check if any signature is from a user with this role
                for sig in signatures:
                    user = db.users.find_one({'_id': ObjectId(sig['user_id'])})
                    if user:
                        user_role = user.get('role') or user.get('local_role')
                        if user_role == role_id:
                            has_signed = True
                            required_signed += 1
                            break
        
        status_icon = "✅" if has_signed else "❌"
        print(f"   {status_icon} {officer['type']}: {officer['reference']} - {'SIGNED' if has_signed else 'PENDING'}")
    
    required_count = len(required_officers)
    print(f"\n📊 Completion Status: {required_signed}/{required_count} required signatures")
    
    # 5. Determine if flow should be approved
    should_be_approved = required_signed == required_count
    
    if should_be_approved:
        print(f"\n✅ All required signatures collected - Flow should be APPROVED")
        
        # Check if order status matches
        if order.get('status') != 'Processing':
            print(f"\n⚠️  WARNING: Order status is '{order.get('status')}' but should be 'Processing'")
            print(f"   Fixing order status...")
            
            # Fix order status
            processing_state = db.depo_purchase_orders_states.find_one({'name': 'Processing'})
            if processing_state:
                db.depo_purchase_orders.update_one(
                    {'_id': ObjectId(order_id)},
                    {
                        '$set': {
                            'state_id': processing_state['_id'],
                            'status': 'Processing',
                            'updated_at': datetime.utcnow(),
                            'approved_at': datetime.utcnow(),
                            'approved_by': signatures[-1]['username'] if signatures else 'system'
                        }
                    }
                )
                print(f"   ✅ Order status updated to 'Processing'")
            
            # Fix flow status
            if flow.get('status') != 'approved':
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
        else:
            print(f"\n✅ Order status is correct: 'Processing'")
    else:
        print(f"\n⏳ Waiting for more signatures ({required_count - required_signed} remaining)")
    
    print(f"\n{'='*60}\n")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python test_procurement_approval.py <order_id>")
        print("Example: python test_procurement_approval.py 695d181640dfa129109bedef")
        sys.exit(1)
    
    order_id = sys.argv[1]
    test_approval_flow(order_id)
