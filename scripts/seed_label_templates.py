
import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.backend.utils.db import get_db
from src.backend.config import settings

async def seed_templates():
    print("Seeding label templates...")
    db = get_db()
    collection = db['label_templates']
    
    templates = [
        {
            "name": "Stock Label (50x30mm)",
            "table": "depo_stocks",
            "dimensions": {"width": 50, "height": 30},
            "orientation": "landscape",
            "is_default": True
        },
        {
            "name": "Location Label (50x30mm)",
            "table": "depo_locations",
            "dimensions": {"width": 50, "height": 30},
            "orientation": "landscape",
            "is_default": True
        },
        {
            "name": "Part Label (50x30mm)",
            "table": "depo_parts",
            "dimensions": {"width": 50, "height": 30},
            "orientation": "landscape",
            "is_default": True
        }
    ]
    
    for template in templates:
        existing = collection.find_one({"name": template["name"], "table": template["table"]})
        if not existing:
            collection.insert_one(template)
            print(f"Created template: {template['name']}")
        else:
            print(f"Template already exists: {template['name']}")
            
    print("Done.")

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(seed_templates())
