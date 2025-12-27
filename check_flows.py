from pymongo import MongoClient
from bson import ObjectId

client = MongoClient('mongodb://localhost:27017/')
db = client['dataflows_rompharm']

request_id = '694db53bf6e7ee031a6321c8'

print('\n=== APPROVAL FLOWS FOR REQUEST', request_id, '===\n')
flows = list(db.approval_flows.find({'object_id': request_id}))
for f in flows:
    print(f"Type: {f.get('object_type'):40} | Status: {f.get('status'):15} | Signatures: {len(f.get('signatures', []))}")

print('\n=== RECEPTION CONFIG ===\n')
config = db.config.find_one({'slug': 'requests_reception_flow'})
print('Config found:', config is not None)
if config:
    print('Items:', len(config.get('items', [])))
    for item in config.get('items', []):
        print(f"  - Slug: {item.get('slug'):20} | Enabled: {item.get('enabled')}")
        print(f"    Can sign: {len(item.get('can_sign', []))} users")
        print(f"    Must sign: {len(item.get('must_sign', []))} users")
else:
    print('ERROR: No reception config found!')

print('\n=== REQUEST STATE ===\n')
request = db.depo_requests.find_one({'_id': ObjectId(request_id)})
if request:
    state_id = request.get('state_id')
    if state_id:
        state = db.depo_requests_states.find_one({'_id': state_id})
        if state:
            print(f"State: {state.get('name')} (order: {state.get('order')})")
        else:
            print(f"State ID: {state_id} (not found in states)")
    else:
        print('No state_id set')
