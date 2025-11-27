#!/usr/bin/env python3
"""
Initialize approval template for procurement orders
"""
import yaml
from pymongo import MongoClient
from datetime import datetime

# Load config
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

# Connect to MongoDB
mongo_uri = config['mongodb']['uri']
db_name = config['mongodb']['database']

client = MongoClient(mongo_uri)
db = client[db_name]

# Check if template already exists
existing = db.approval_templates.find_one({
    "object_type": "procurement_order"
})

if existing:
    print("Approval template for procurement orders already exists")
    print(f"Template ID: {existing['_id']}")
    print(f"Name: {existing['name']}")
    print(f"Officers: {len(existing.get('officers', []))}")
else:
    # Create template
    template = {
        "object_type": "procurement_order",
        "object_source": "depo_procurement",
        "name": "Procurement Order Approval",
        "description": "Default approval template for procurement orders",
        "officers": [
            {
                "type": "role",
                "reference": "admin",
                "action": "must_sign",
                "order": 1
            }
        ],
        "active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = db.approval_templates.insert_one(template)
    print("Approval template created successfully!")
    print(f"Template ID: {result.inserted_id}")
    print(f"Name: {template['name']}")
    print(f"Officers: {len(template['officers'])}")

print("\nYou can customize the template by adding more officers:")
print("- type: 'person' or 'role'")
print("- reference: user_id (for person) or role_name (for role)")
print("- action: 'must_sign' or 'can_sign'")
print("- order: sequence number")

client.close()
