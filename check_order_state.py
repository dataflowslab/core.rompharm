#!/usr/bin/env python3
"""
Check purchase order state and state_detail
"""
import os
import sys
from pymongo import MongoClient
from bson import ObjectId

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# MongoDB connection
client = MongoClient('mongodb://localhost:27017/')
db = client['dataflows_rompharm']

# Order ID from URL
order_id = "6972932e09fe7a898c8feb5a"

print(f"\n{'='*60}")
print(f"Checking Purchase Order: {order_id}")
print(f"{'='*60}\n")

# Get order
order = db.depo_purchase_orders.find_one({"_id": ObjectId(order_id)})

if not order:
    print(f"❌ Order not found!")
    sys.exit(1)

print(f"✅ Order found: {order.get('reference')}")
print(f"\n📋 Order Details:")
print(f"  - Reference: {order.get('reference')}")
print(f"  - Supplier: {order.get('supplier_id')}")
print(f"  - state_id: {order.get('state_id')}")
print(f"  - status (old): {order.get('status')}")

# Get state detail
state_id = order.get('state_id')
if state_id:
    print(f"\n🔍 Looking up state: {state_id}")
    state = db.depo_purchase_orders_states.find_one({"_id": ObjectId(state_id)})
    
    if state:
        print(f"✅ State found:")
        print(f"  - Name: {state.get('name')}")
        print(f"  - Color: {state.get('color')}")
        print(f"  - Value: {state.get('value')}")
    else:
        print(f"❌ State NOT found in depo_purchase_orders_states!")
else:
    print(f"\n⚠️  No state_id in order!")

# List all available states
print(f"\n📊 Available States:")
states = list(db.depo_purchase_orders_states.find().sort("value", 1))
for state in states:
    print(f"  - {state['_id']} | value={state.get('value', 'N/A'):3} | {state.get('name', 'N/A'):15} | color={state.get('color', 'N/A')}")

# Test aggregation
print(f"\n🔧 Testing Aggregation:")
pipeline = [
    {"$match": {"_id": ObjectId(order_id)}},
    {
        "$lookup": {
            "from": "depo_purchase_orders_states",
            "localField": "state_id",
            "foreignField": "_id",
            "as": "state_detail"
        }
    },
    {"$unwind": {"path": "$state_detail", "preserveNullAndEmptyArrays": True}}
]

result = list(db.depo_purchase_orders.aggregate(pipeline))
if result:
    order_with_state = result[0]
    state_detail = order_with_state.get('state_detail')
    
    if state_detail:
        print(f"✅ Aggregation works!")
        print(f"  - state_detail.name: {state_detail.get('name')}")
        print(f"  - state_detail.color: {state_detail.get('color')}")
        print(f"  - state_detail.value: {state_detail.get('value')}")
    else:
        print(f"❌ Aggregation returned no state_detail!")
else:
    print(f"❌ Aggregation failed!")

print(f"\n{'='*60}")
print(f"✅ Check complete!")
print(f"{'='*60}\n")
