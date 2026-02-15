
import os
import sys
from pymongo import MongoClient
from bson import ObjectId
import datetime

# Add project root to path
# Assuming script is in scripts/ folder, root is one level up
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(project_root)

# Now we can import from src
from src.backend.utils.db import get_db

def init_templates():
    db = get_db()
    collection = db['label_templates']

    templates = [
        {
            "_id": ObjectId(),
            "name": "Article Label (50x30mm)",
            "table": "depo_parts",
            "dimensions": {"width": 50, "height": 30},
            "description": "Standard label for articles/parts",
            "created_at": datetime.datetime.utcnow()
        },
        {
            "_id": ObjectId(),
            "name": "Stock Label (50x30mm)",
            "table": "depo_stocks",
            "dimensions": {"width": 50, "height": 30},
            "description": "Standard label for stock items with batch info",
            "created_at": datetime.datetime.utcnow()
        },
        {
            "_id": ObjectId(),
            "name": "Location Label (50x30mm)",
            "table": "depo_locations",
            "dimensions": {"width": 50, "height": 30},
            "description": "Standard label for locations",
            "created_at": datetime.datetime.utcnow()
        }
    ]

    for template in templates:
        existing = collection.find_one({"table": template["table"]})
        if not existing:
            collection.insert_one(template)
            print(f"Created template: {template['name']}")
        else:
            print(f"Template for {template['table']} already exists.")

if __name__ == "__main__":
    init_templates()
