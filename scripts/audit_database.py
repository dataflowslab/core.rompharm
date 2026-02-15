
import os
import sys
from pymongo import MongoClient

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.backend.utils.db import get_db

def audit_database():
    db = get_db()
    collections = db.list_collection_names()
    
    # Define root search path
    search_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    unused_collections = []
    
    print(f"Scanning {len(collections)} collections against codebase in {search_root}...")
    
    for col_name in collections:
        found = False
        # Simple grep-like search
        # Exclude .git, __pycache__, node_modules
        for root, dirs, files in os.walk(search_root):
            if '.git' in dirs: dirs.remove('.git')
            if '__pycache__' in dirs: dirs.remove('__pycache__')
            if 'node_modules' in dirs: dirs.remove('node_modules')
            
            for file in files:
                if file.endswith(('.py', '.ts', '.tsx', '.js', '.json')):
                    try:
                        with open(os.path.join(root, file), 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            if col_name in content:
                                found = True
                                break
                    except Exception:
                        continue
            if found:
                break
        
        if not found:
            unused_collections.append(col_name)
    
    print("\nPotentially Unused Collections:")
    for col in unused_collections:
        print(f"- {col}")

if __name__ == "__main__":
    audit_database()
