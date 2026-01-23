#!/usr/bin/env python3
"""
Check purchase orders in MongoDB Atlas
"""
import os
import sys
import yaml
from pymongo import MongoClient
from bson import ObjectId

# Load config
config_path = os.path.join(os.path.dirname(__file__), 'config', 'config.yaml')
with open(config_path, 'r') as f:
    config = yaml.safe_load(f)

# MongoDB connection
connection_string = config['mongo'].get('auth_string')
client = MongoClient(connection_string, tlsAllowInvalidCertificates=True)
db = client.get_default_database()

print(f"\n{'='*60}")
print(f"Connected to: {db.name}")
print(f"{'='*60}\n")

# Get all orders
orders = list(db.depo_purchase_orders.find().sort('created_at', -1).limit(10))

if not orders:
    print("❌ No purchase orders found!")
else:
    print(f"✅ Found {db.depo_purchase_orders.count_documents({})} total orders")
    print(f"Showing last 10:\n")
    
    for order in orders:
        print(f"📦 {order.get('reference', 'N/A')}")
        print(f"   ID: {order['_id']}")
        print(f"   Supplier: {order.get('supplier_id', 'N/A')}")
        print(f"   state_id: {order.get('state_id', 'N/A')}")
        print(f"   Created: {order.get('created_at', 'N/A')}")
        
        # Get state detail
        if order.get('state_id'):
            state = db.depo_purchase_orders_states.find_one({'_id': order['state_id']})
            if state:
                print(f"   State: {state.get('name')} (color: {state.get('color')})")
        
        print()

# Check the specific order from the error
target_id = "6972932e09fe7a898c8feb5a"
print(f"\n{'='*60}")
print(f"Checking specific order: {target_id}")
print(f"{'='*60}\n")

try:
    order = db.depo_purchase_orders.find_one({'_id': ObjectId(target_id)})
    if order:
        print(f"✅ Order found!")
        print(f"   Reference: {order.get('reference')}")
        print(f"   state_id: {order.get('state_id')}")
        print(f"   Supplier: {order.get('supplier_id')}")
        
        # Get state
        if order.get('state_id'):
            state = db.depo_purchase_orders_states.find_one({'_id': order['state_id']})
            if state:
                print(f"   State: {state.get('name')} (value: {state.get('value')}, color: {state.get('color')})")
        
        # Get approval flow
        flow = db.approval_flows.find_one({
            'object_type': 'procurement_order',
            'object_id': ObjectId(target_id)
        })
        if flow:
            print(f"   Approval Flow: {flow.get('status')} ({len(flow.get('signatures', []))} signatures)")
    else:
        print(f"❌ Order NOT found!")
        print(f"\nPossible reasons:")
        print(f"  1. Order was deleted")
        print(f"  2. Wrong database")
        print(f"  3. ID changed")
except Exception as e:
    print(f"❌ Error: {e}")

print(f"\n{'='*60}\n")

client.close()
