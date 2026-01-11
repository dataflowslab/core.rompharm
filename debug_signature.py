"""
Debug signature to see why it's not recognized
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pymongo import MongoClient
from bson import ObjectId
import yaml

# Load MongoDB connection from config
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
print(f"Debugging Signature for Order: {order_id}")
print(f"{'='*70}\n")

# Get flow
flow = db.approval_flows.find_one({
    'object_type': 'procurement_order',
    'object_id': ObjectId(order_id)
})

if not flow:
    print("❌ No flow found")
    sys.exit(1)

print("📋 Required Officers:")
for i, officer in enumerate(flow.get('required_officers', []), 1):
    print(f"   {i}. Type: {officer['type']}, Reference: {officer['reference']}, Action: {officer['action']}")

print("\n✍️  Signatures:")
for i, sig in enumerate(flow.get('signatures', []), 1):
    print(f"   {i}. User ID: {sig['user_id']}, Username: {sig['username']}")
    
    # Get user details
    user = db.users.find_one({'_id': ObjectId(sig['user_id'])})
    if user:
        print(f"      User role field: {user.get('role')}")
        print(f"      User local_role field: {user.get('local_role')}")
        
        # Get role details
        role_id = user.get('role') or user.get('local_role')
        if role_id:
            if isinstance(role_id, str):
                role = db.roles.find_one({'_id': ObjectId(role_id)})
            else:
                role = db.roles.find_one({'_id': role_id})
            
            if role:
                print(f"      Role name: {role.get('name')}")
                print(f"      Role slug: {role.get('slug')}")
            else:
                print(f"      ❌ Role not found for ID: {role_id}")
        else:
            print(f"      ❌ User has no role!")
    else:
        print(f"      ❌ User not found!")

print("\n🔍 Checking Match:")
for officer in flow.get('required_officers', []):
    print(f"\n   Officer: {officer['type']} - {officer['reference']}")
    
    if officer['type'] == 'person':
        # Check if any signature matches this person
        matched = False
        for sig in flow.get('signatures', []):
            if sig['user_id'] == officer['reference']:
                matched = True
                print(f"      ✅ MATCHED by signature from user {sig['username']}")
                break
        if not matched:
            print(f"      ❌ NO MATCH")
    
    elif officer['type'] == 'role':
        # Check if any signature is from a user with this role
        matched = False
        role_slug = officer['reference']
        
        for sig in flow.get('signatures', []):
            user = db.users.find_one({'_id': ObjectId(sig['user_id'])})
            if user:
                role_id = user.get('role') or user.get('local_role')
                if role_id:
                    if isinstance(role_id, str):
                        role = db.roles.find_one({'_id': ObjectId(role_id)})
                    else:
                        role = db.roles.find_one({'_id': role_id})
                    
                    if role:
                        print(f"      Checking: user {sig['username']} has role '{role.get('slug')}'")
                        if role.get('slug') == role_slug:
                            matched = True
                            print(f"      ✅ MATCHED by signature from user {sig['username']}")
                            break
        
        if not matched:
            print(f"      ❌ NO MATCH - Need role '{role_slug}'")

print(f"\n{'='*70}\n")
