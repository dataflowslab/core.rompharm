from pymongo import MongoClient
from bson import ObjectId

client = MongoClient('mongodb://localhost:27017/')
db = client['dataflows_rompharm']

request_id = '694db53bf6e7ee031a6321c8'

print('\n=== OPERATIONS FLOW ===')
ops_flow = db.approval_flows.find_one({
    'object_type': 'operations',
    'object_id': request_id
})
if ops_flow:
    print(f"Flow ID: {ops_flow['_id']}")
    print(f"Status: {ops_flow.get('status')}")
    print(f"Can Sign Officers: {ops_flow.get('can_sign_officers')}")
    print(f"Must Sign Officers: {ops_flow.get('must_sign_officers')}")
    print(f"Signatures: {len(ops_flow.get('signatures', []))}")
else:
    print('Operations flow NOT FOUND!')

print('\n=== RECEPTION FLOW ===')
reception_flow = db.approval_flows.find_one({
    'object_type': 'stock_request_reception',
    'object_id': request_id
})
if reception_flow:
    print(f"Flow ID: {reception_flow['_id']}")
    print(f"Status: {reception_flow.get('status')}")
    print(f"Can Sign Officers: {reception_flow.get('can_sign_officers')}")
    print(f"Must Sign Officers: {reception_flow.get('must_sign_officers')}")
    print(f"Signatures: {len(reception_flow.get('signatures', []))}")
else:
    print('Reception flow NOT FOUND!')

print('\n=== REQUEST STATE ===')
request = db.depo_requests.find_one({'_id': ObjectId(request_id)})
if request:
    state_id = request.get('state_id')
    state_order = request.get('state_order')
    print(f"State Order: {state_order}")
    if state_id:
        state = db.depo_requests_states.find_one({'_id': state_id})
        if state:
            print(f"State: {state.get('name')} (order: {state.get('order')})")
