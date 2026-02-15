"""
Migration script to update all users with mobile=True
"""
import sys
import os

# Add parent directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.backend.utils.db import get_db

def migrate_users():
    print("Starting user migration...")
    db = get_db()
    users_collection = db['users']
    
    # Update all users to have mobile=True
    result = users_collection.update_many(
        {},  # All documents
        {'$set': {'mobile': True}}
    )
    
    print(f"Migration completed. Modified {result.modified_count} users.")

if __name__ == "__main__":
    migrate_users()
