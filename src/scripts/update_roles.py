"""
Update roles from InvenTree
Synchronizes roles from InvenTree API to local database
"""
import sys
import os
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from src.backend.utils.db import get_db, close_db
from src.backend.models.role_model import RoleModel
import requests
import yaml


def load_config():
    """Load configuration from config.yaml"""
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', 'config.yaml')
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def fetch_inventree_roles():
    """Fetch roles from InvenTree API"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    
    # Get admin token from database (use first admin user)
    db = get_db()
    users_collection = db['users']
    admin_user = users_collection.find_one({'is_staff': True})
    
    if not admin_user:
        print("ERROR: No admin user found in database")
        return []
    
    token = admin_user['token']
    
    # Fetch roles from InvenTree
    headers = {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }
    
    try:
        # InvenTree 1.0.1 uses /api/user/roles/ endpoint
        response = requests.get(
            f"{inventree_url}/api/user/roles/",
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Failed to fetch roles from InvenTree: {e}")
        return []


def sync_roles():
    """Synchronize roles from InvenTree to local database"""
    print(f"[{datetime.now().isoformat()}] Starting role synchronization...")
    
    try:
        # Fetch roles from InvenTree
        inventree_roles = fetch_inventree_roles()
        
        if not inventree_roles:
            print("WARNING: No roles fetched from InvenTree")
            return
        
        print(f"Fetched {len(inventree_roles)} roles from InvenTree")
        
        # Get database
        db = get_db()
        roles_collection = db[RoleModel.collection_name]
        
        # Sync each role
        synced_count = 0
        for role_data in inventree_roles:
            role_name = role_data.get('name')
            role_id = role_data.get('pk') or role_data.get('id')
            
            if not role_name:
                continue
            
            # Check if role exists
            existing_role = roles_collection.find_one({'inventree_id': role_id})
            
            if existing_role:
                # Update existing role
                roles_collection.update_one(
                    {'inventree_id': role_id},
                    {
                        '$set': {
                            'name': role_name,
                            'description': role_data.get('description'),
                            'updated_at': datetime.utcnow()
                        }
                    }
                )
                print(f"  Updated role: {role_name}")
            else:
                # Create new role
                role_doc = RoleModel.create(
                    name=role_name,
                    inventree_id=role_id,
                    description=role_data.get('description')
                )
                roles_collection.insert_one(role_doc)
                print(f"  Created role: {role_name}")
            
            synced_count += 1
        
        print(f"[{datetime.now().isoformat()}] Successfully synchronized {synced_count} roles")
        
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] ERROR: {str(e)}")
        raise
    finally:
        close_db()


if __name__ == "__main__":
    sync_roles()
