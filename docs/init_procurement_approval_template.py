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
mongo_uri = config['mongo']['auth_string']

# Extract database name from connection string
# Format: mongodb+srv://user:pass@host/database?params
if '/' in mongo_uri.split('@')[1]:
    db_name = mongo_uri.split('@')[1].split('/')[1].split('?')[0]
else:
    db_name = 'dataflows'  # default

client = MongoClient(mongo_uri)
db = client[db_name]

# Check if template already exists
existing = db.approval_templates.find_one({
    "object_type": "procurement_order",
    "object_source": "depo_procurement"
})

if existing:
    print("Approval template for procurement orders already exists!")
    print(f"Template ID: {existing['_id']}")
    print(f"Name: {existing['name']}")
    print(f"Officers: {len(existing.get('officers', []))}")
else:
    # Create template
    # Note: You'll need to customize the officers based on your organization
    # This is just an example with admin role
    template = {
        "object_type": "procurement_order",
        "object_source": "depo_procurement",
        "name": "Procurement Order Approval",
        "description": "Approval workflow for procurement orders",
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
    print("\nNOTE: The template is configured with 'admin' role as required approver.")
    print("You can modify this in the database or through the admin interface.")
    print("\nTo add more officers, update the template with:")
    print("  - type: 'person' or 'role'")
    print("  - reference: user_id (for person) or role name (for role)")
    print("  - action: 'must_sign' or 'can_sign'")
    print("  - order: sequence number")

client.close()
