"""
Check request and flows
"""
from bson import ObjectId
from src.backend.utils.db import get_db

REQUEST_ID = "694f0c0ae56bf17091f9bf69"

db = get_db()

# Check request
request = db.depo_requests.find_one({'_id': ObjectId(REQUEST_ID)})
if request:
    print("✅ Request found:")
    print(f"  Reference: {request.get('reference')}")
    print(f"  State ID: {request.get('state_id')}")
    
    # Get state info
    if request.get('state_id'):
        state = db.depo_requests_states.find_one({'_id': request['state_id']})
        if state:
            print(f"  State: {state.get('name')} (order: {state.get('order')})")
            print(f"  Scenes: {state.get('scenes', [])}")
    
    print(f"  Items: {len(request.get('items', []))}")
else:
    print("❌ Request not found")

# Check operations flow
print("\n" + "="*60)
print("OPERATIONS FLOW")
print("="*60)

ops_flow = db.approval_flows.find_one({
    'object_type': 'stock_request_operations',
    'object_id': REQUEST_ID
})

if ops_flow:
    print("✅ Operations flow found:")
    print(f"  Status: {ops_flow.get('status')}")
    print(f"  Signatures: {len(ops_flow.get('signatures', []))}")
else:
    print("❌ Operations flow NOT found")
    print("\nChecking if it should be auto-created...")
    
    # Check if request state requires operations flow
    if request and request.get('state_id'):
        state = db.depo_requests_states.find_one({'_id': request['state_id']})
        if state:
            print(f"  State order: {state.get('order')}")
            print(f"  Should auto-create if order >= 10")

# Check all flows for this request
print("\n" + "="*60)
print("ALL FLOWS FOR REQUEST")
print("="*60)

all_flows = list(db.approval_flows.find({'object_id': REQUEST_ID}))
print(f"Found {len(all_flows)} flows:")
for flow in all_flows:
    print(f"  - {flow.get('object_type')}: {flow.get('status')}")
