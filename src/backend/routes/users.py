"""
Users routes
"""
from fastapi import APIRouter, Depends
from typing import List, Dict, Any

from ..utils.db import get_db
# UserModel removed - using direct DB access
from ..routes.auth import verify_admin

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/")
async def list_users(user = Depends(verify_admin)) -> List[Dict[str, Any]]:
    """
    List all users with their last login information
    Requires administrator access
    """
    db = get_db()
    users_collection = db['users']
    
    users = list(users_collection.find(
        {},
        {
            'username': 1,
            'is_staff': 1,
            'last_login': 1,
            'created_at': 1,
            'updated_at': 1
        }
    ).sort('last_login', -1))
    
    # Convert ObjectId to string and format dates
    for user_doc in users:
        user_doc['id'] = str(user_doc['_id'])
        del user_doc['_id']
        
        if 'created_at' in user_doc:
            user_doc['created_at'] = user_doc['created_at'].isoformat()
        if 'updated_at' in user_doc:
            user_doc['updated_at'] = user_doc['updated_at'].isoformat()
        if 'last_login' in user_doc:
            user_doc['last_login'] = user_doc['last_login'].isoformat()
    
    return users
