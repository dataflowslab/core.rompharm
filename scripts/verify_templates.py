
import os
import sys
from pymongo import MongoClient

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.backend.utils.db import get_db

def verify_templates():
    db = get_db()
    collection = db['label_templates']
    
    templates = list(collection.find())
    print(f"Found {len(templates)} templates.")
    for t in templates:
        print(f"- {t.get('name')} (Table: {t.get('table')})")

    if len(templates) >= 3:
        print("\nSUCCESS: Templates verified.")
    else:
        print("\nFAILURE: Missing templates.")

if __name__ == "__main__":
    verify_templates()
