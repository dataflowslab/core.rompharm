#!/usr/bin/env python3
"""
Check all purchase orders in database
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

print(f"\n{'='*60}")
print(f"Checking Purchase Orders")
print(f"{'='*60}\n")

# Get all orders
orders = list(db.depo_purchase_orders.find().sort('created_at', -1).limit(10))

if not orders:
    print("❌ No purchase orders found!")
else:
    print(f"✅ Found {len(orders)} orders (showing last 10):\n")
    
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
    else:
        print(f"❌ Order NOT found!")
        print(f"\nPossible reasons:")
        print(f"  1. Order was deleted")
        print(f"  2. Wrong database")
        print(f"  3. ID changed")
except Exception as e:
    print(f"❌ Error: {e}")

print(f"\n{'='*60}\n")
