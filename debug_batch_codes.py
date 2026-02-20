"""
Debug script to check batch codes for ACID TIOCTIC
"""
from pymongo import MongoClient
from bson import ObjectId

client = MongoClient('mongodb://localhost:27017/')
db = client['dataflows_rompharm']

# Part ID for ACID TIOCTIC
part_id = ObjectId('697c6071a2906a7551ea0094')

# Get part info
part = db.depo_parts.find_one({'_id': part_id}, {'name': 1, 'ipn': 1})
print(f"Part: {part.get('name')} ({part.get('ipn')})")
print(f"Part ID: {part_id}")
print()

# Get requestable states
print("Requestable states:")
states = list(db.depo_stocks_states.find({'is_requestable': True}))
print(f"Found {len(states)} requestable states")
for state in states:
    print(f"  - {state['name']} (ID: {state['_id']}, is_requestable={state.get('is_requestable')}, is_transferable={state.get('is_transferable')})")
print()

# Get stock records
print("Stock records for this part:")
stocks = list(db.depo_stocks.find({
    'part_id': part_id,
    'quantity': {'$gt': 0}
}))
print(f"Found {len(stocks)} stock records with quantity > 0")
for stock in stocks:
    location = db.depo_locations.find_one({'_id': stock.get('location_id')}, {'code': 1, 'name': 1})
    state = db.depo_stocks_states.find_one({'_id': stock.get('state_id')}, {'name': 1})
    print(f"  - Batch: {stock.get('batch_code')}")
    print(f"    Qty: {stock.get('quantity')}")
    print(f"    Location: {location.get('code') if location else 'N/A'} (ID: {stock.get('location_id')})")
    print(f"    State: {state.get('name') if state else 'N/A'} (ID: {stock.get('state_id')})")
    print(f"    Expiry: {stock.get('expiry_date')}")
    print()

# Check if states match
print("Checking state matching:")
requestable_state_ids = [s['_id'] for s in states]
print(f"Requestable state IDs: {requestable_state_ids}")
print()

matching_stocks = list(db.depo_stocks.find({
    'part_id': part_id,
    'state_id': {'$in': requestable_state_ids},
    'quantity': {'$gt': 0}
}))
print(f"Stock records matching requestable states: {len(matching_stocks)}")
for stock in matching_stocks:
    print(f"  - Batch: {stock.get('batch_code')}, Qty: {stock.get('quantity')}")
