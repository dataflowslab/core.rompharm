from pymongo import MongoClient
from bson import ObjectId

client = MongoClient('mongodb://localhost:27017/')
db = client['dataflows_rompharm']

flow_id = '694df0c15391435dcc61014d'
request_id = '694db53bf6e7ee031a6321c8'

print('\n=== RECEPTION FLOW ===')
flow = db.approval_flows.find_one({'_id': ObjectId(flow_id)})
if flow:
    print(f"Flow ID: {flow['_id']}")
    print(f"Object Type: {flow.get('object_type')}")
    print(f"Object ID: {flow.get('object_id')}")
    print(f"Status: {flow.get('status')}")
    print(f"Can Sign Officers: {len(flow.get('can_sign_officers', []))}")
    print(f"Must Sign Officers: {len(flow.get('must_sign_officers', []))}")
    print(f"Signatures: {len(flow.get('signatures', []))}")
    print(f"\nCan Sign Officers:")
    for officer in flow.get('can_sign_officers', []):
        print(f"  - {officer.get('username')} ({officer.get('reference')})")
else:
    print('Flow not found!')

print('\n=== ALL FLOWS FOR REQUEST ===')
flows = list(db.approval_flows.find({'object_id': request_id}))
for f in flows:
    print(f"Type: {f.get('object_type'):40} | Status: {f.get('status'):15} | ID: {f['_id']}")

print('\n=== REQUEST STATE ===')
request = db.depo_requests.find_one({'_id': ObjectId(request_id)})
if request:
    state_id = request.get('state_id')
    if state_id:
        state = db.depo_requests_states.find_one({'_id': state_id})
        if state:
            print(f"State: {state.get('name')} (order: {state.get('order')})")
            print(f"Scenes: {state.get('scenes')}")
