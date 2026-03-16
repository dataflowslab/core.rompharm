"""
Users routes
"""
from fastapi import APIRouter, Depends
from typing import List, Dict, Any, Optional
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_admin

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/")
def list_users(user = Depends(verify_admin)) -> List[Dict[str, Any]]:
    """
    List all users with their last login information
    Requires administrator access
    """
    db = get_db()
    users_collection = db['users']
    roles_collection = db['roles']
    
    users = list(users_collection.find({}, {
        'username': 1,
        'is_staff': 1,
        'name': 1,
        'firstname': 1,
        'lastname': 1,
        'last_login': 1,
        'created_at': 1,
        'updated_at': 1,
        'role': 1,
        'role_id': 1,
        'locations': 1
    }).sort('last_login', -1))
    
    # Convert ObjectId to string and format dates
    for user_doc in users:
        user_doc['id'] = str(user_doc['_id'])
        user_doc['_id'] = user_doc['id']

        role_value = user_doc.get('role') or user_doc.get('role_id')
        role_id = None
        if isinstance(role_value, ObjectId):
            role_id = role_value
        elif isinstance(role_value, dict) and role_value.get("$oid"):
            try:
                role_id = ObjectId(role_value.get("$oid"))
            except Exception:
                role_id = None
        elif isinstance(role_value, str):
            try:
                role_id = ObjectId(role_value)
            except Exception:
                role_id = None

        if role_id:
            role = roles_collection.find_one({'_id': role_id})
            if role:
                user_doc['role'] = {
                    '_id': str(role['_id']),
                    'name': role.get('name'),
                    'slug': role.get('slug')
                }
                user_doc['role_id'] = str(role_id)

        locations = []
        for loc in user_doc.get('locations') or []:
            if isinstance(loc, ObjectId):
                locations.append(str(loc))
            elif isinstance(loc, dict) and loc.get("$oid"):
                locations.append(str(loc.get("$oid")))
            elif isinstance(loc, str):
                locations.append(loc)
        user_doc['locations'] = locations
        
        if 'created_at' in user_doc:
            user_doc['created_at'] = user_doc['created_at'].isoformat()
        if 'updated_at' in user_doc:
            user_doc['updated_at'] = user_doc['updated_at'].isoformat()
        if 'last_login' in user_doc:
            user_doc['last_login'] = user_doc['last_login'].isoformat()

        if not user_doc.get('name'):
            firstname = user_doc.get('firstname', '') or ''
            lastname = user_doc.get('lastname', '') or ''
            display_name = f"{firstname} {lastname}".strip()
            if display_name:
                user_doc['name'] = display_name
    
    return users
