"""
Import requests states into MongoDB

This script imports the predefined request states into the depo_requests_states collection.
Run this script once to initialize the states system.

Usage:
    python utils/import_requests_states.py
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.backend.utils.db import get_db
from bson import ObjectId


def import_requests_states():
    """Import requests states from JSON file"""
    db = get_db()
    collection = db['depo_requests_states']
    
    # Read JSON file
    json_path = Path(__file__).parent / 'depo_requests_states.json'
    with open(json_path, 'r', encoding='utf-8') as f:
        states = json.load(f)
    
    # Check if states already exist
    existing_count = collection.count_documents({})
    if existing_count > 0:
        print(f"⚠️  Collection already has {existing_count} states.")
        response = input("Do you want to delete existing states and reimport? (yes/no): ")
        if response.lower() != 'yes':
            print("❌ Import canceled.")
            return
        
        # Delete existing states
        result = collection.delete_many({})
        print(f"🗑️  Deleted {result.deleted_count} existing states.")
    
    # Convert $oid and $date to proper types
    for state in states:
        if '_id' in state and '$oid' in state['_id']:
            state['_id'] = ObjectId(state['_id']['$oid'])
        
        if 'created_at' in state and '$date' in state['created_at']:
            state['created_at'] = datetime.fromisoformat(
                state['created_at']['$date'].replace('Z', '+00:00')
            )
        
        if 'updated_at' in state and '$date' in state['updated_at']:
            state['updated_at'] = datetime.fromisoformat(
                state['updated_at']['$date'].replace('Z', '+00:00')
            )
    
    # Insert states
    result = collection.insert_many(states)
    print(f"✅ Successfully imported {len(result.inserted_ids)} request states!")
    
    # Display imported states
    print("\n📋 Imported States:")
    print("-" * 80)
    for state in states:
        print(f"  • {state['name']:30} (workflow_level: {state['workflow_level']:4}) - {state['description']}")
    print("-" * 80)
    
    # Create indexes
    collection.create_index('slug', unique=True)
    collection.create_index('workflow_level')
    collection.create_index('order')
    print("\n🔍 Created indexes on: slug (unique), workflow_level, order")
    
    print("\n✨ Import completed successfully!")


if __name__ == '__main__':
    try:
        import_requests_states()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
