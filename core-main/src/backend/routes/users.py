"""
Users routes
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime
import hashlib

from ..utils.db import get_db
from ..models.user_model import UserModel
from ..routes.auth import verify_admin
from ..utils.audit import log_action

router = APIRouter(prefix="/api/users", tags=["users"])


class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    password: str
    is_staff: bool = False
    role: Optional[str] = None


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    is_staff: Optional[bool] = None
    role: Optional[str] = None


@router.get("/")
async def list_users(user = Depends(verify_admin)) -> List[Dict[str, Any]]:
    """
    List all users with their last login information
    Requires administrator access
    """
    db = get_db()
    users_collection = db[UserModel.collection_name]
    
    users = list(users_collection.find(
        {},
        {
            'username': 1,
            'email': 1,
            'is_staff': 1,
            'role': 1,
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


@router.get("/roles")
async def list_roles(user = Depends(verify_admin)) -> List[Dict[str, Any]]:
    """
    List available roles
    For InvenTree: fetches from InvenTree API
    For Firebase: fetches from local roles collection
    """
    db = get_db()
    
    # Check if we have local roles (Firebase mode)
    roles_collection = db.get('roles')
    if roles_collection:
        roles = list(roles_collection.find())
        result = []
        for role in roles:
            result.append({
                'id': str(role['_id']),
                'name': role.get('name', ''),
                'description': role.get('description', '')
            })
        return result
    
    # Default roles for InvenTree mode
    return [
        {'id': 'admin', 'name': 'Administrator'},
        {'id': 'user', 'name': 'User'}
    ]


@router.post("/")
async def create_user(user_data: UserCreate, request: Request, current_user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Create a new user (admin only)
    """
    db = get_db()
    users_collection = db[UserModel.collection_name]
    
    # Check if username already exists
    existing = users_collection.find_one({'username': user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password
    password_hash = hashlib.sha256(user_data.password.encode()).hexdigest()
    
    # Create user document
    user_doc = {
        'username': user_data.username,
        'email': user_data.email,
        'password': password_hash,
        'is_staff': user_data.is_staff,
        'role': user_data.role,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'last_login': None
    }
    
    result = users_collection.insert_one(user_doc)
    user_doc['id'] = str(result.inserted_id)
    del user_doc['_id']
    del user_doc['password']  # Don't return password
    
    # Log action
    log_action(
        action='user_created',
        username=current_user['username'],
        request=request,
        resource_type='user',
        resource_id=user_doc['id'],
        resource_name=user_data.username,
        details={'is_staff': user_data.is_staff, 'role': user_data.role}
    )
    
    return user_doc


@router.get("/{user_id}")
async def get_user(user_id: str, current_user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Get user details (admin only)
    """
    db = get_db()
    users_collection = db[UserModel.collection_name]
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = users_collection.find_one({'_id': obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user['id'] = str(user['_id'])
    del user['_id']
    if 'password' in user:
        del user['password']
    
    if 'created_at' in user:
        user['created_at'] = user['created_at'].isoformat()
    if 'updated_at' in user:
        user['updated_at'] = user['updated_at'].isoformat()
    if 'last_login' in user and user['last_login']:
        user['last_login'] = user['last_login'].isoformat()
    
    return user


@router.put("/{user_id}")
async def update_user(user_id: str, user_data: UserUpdate, request: Request, current_user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Update user (admin only)
    """
    db = get_db()
    users_collection = db[UserModel.collection_name]
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    existing = users_collection.find_one({'_id': obj_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build update document
    update_doc = {}
    if user_data.username is not None:
        # Check if new username is taken
        if user_data.username != existing['username']:
            duplicate = users_collection.find_one({'username': user_data.username})
            if duplicate:
                raise HTTPException(status_code=400, detail="Username already exists")
        update_doc['username'] = user_data.username
    
    if user_data.email is not None:
        update_doc['email'] = user_data.email
    
    if user_data.password:
        update_doc['password'] = hashlib.sha256(user_data.password.encode()).hexdigest()
    
    if user_data.is_staff is not None:
        update_doc['is_staff'] = user_data.is_staff
    
    if user_data.role is not None:
        update_doc['role'] = user_data.role
    
    if update_doc:
        update_doc['updated_at'] = datetime.utcnow()
        users_collection.update_one({'_id': obj_id}, {'$set': update_doc})
    
    # Log action
    log_action(
        action='user_updated',
        username=current_user['username'],
        request=request,
        resource_type='user',
        resource_id=user_id,
        resource_name=user_data.username or existing['username'],
        details={'updated_fields': list(update_doc.keys())}
    )
    
    return {"message": "User updated successfully"}


@router.delete("/{user_id}")
async def delete_user(user_id: str, request: Request, current_user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Delete user (admin only)
    """
    db = get_db()
    users_collection = db[UserModel.collection_name]
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = users_collection.find_one({'_id': obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting yourself
    if user['username'] == current_user['username']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    username = user['username']
    users_collection.delete_one({'_id': obj_id})
    
    # Log action
    log_action(
        action='user_deleted',
        username=current_user['username'],
        request=request,
        resource_type='user',
        resource_id=user_id,
        resource_name=username
    )
    
    return {"message": "User deleted successfully"}
