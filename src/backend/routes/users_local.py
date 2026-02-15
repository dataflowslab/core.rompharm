"""
Users Routes - Local Authentication
CRUD pentru users cu autentificare localhost
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from bson import ObjectId
from datetime import datetime

from src.backend.utils.db import get_db
from src.backend.utils.local_auth import create_user, hash_password, generate_salt
from src.backend.models.user_model import UserCreate, UserUpdate
from src.backend.routes.auth import verify_admin

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/")
def list_users(
    current_user: dict = Depends(verify_admin)
):
    """List all users"""
    db = get_db()
    users_collection = db['users']
    roles_collection = db['roles']
    
    users = list(users_collection.find())
    
    # Populate role info
    for user in users:
        user['_id'] = str(user['_id'])
        
        # Remove sensitive data
        user.pop('password', None)
        user.pop('salt', None)
        user.pop('token', None)
        
        # Get role
        if user.get('role_id'):
            try:
                role = roles_collection.find_one({'_id': ObjectId(user['role_id'])})
                if role:
                    user['role'] = {
                        '_id': str(role['_id']),
                        'name': role.get('name'),
                        'slug': role.get('slug')
                    }
                user['role_id'] = str(user['role_id'])
            except:
                pass
        
        # Format dates
        if user.get('created_at'):
            user['created_at'] = user['created_at'].isoformat()
        if user.get('updated_at'):
            user['updated_at'] = user['updated_at'].isoformat()
        if user.get('last_login'):
            user['last_login'] = user['last_login'].isoformat()
    
    return {"results": users}


@router.get("/{user_id}")
def get_user(
    user_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Get user by ID"""
    db = get_db()
    users_collection = db['users']
    roles_collection = db['roles']
    
    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user['_id'] = str(user['_id'])
    
    # Remove sensitive data
    user.pop('password', None)
    user.pop('salt', None)
    user.pop('token', None)
    
    # Get role
    if user.get('role_id'):
        try:
            role = roles_collection.find_one({'_id': ObjectId(user['role_id'])})
            if role:
                user['role'] = {
                    '_id': str(role['_id']),
                    'name': role.get('name'),
                    'slug': role.get('slug')
                }
            user['role_id'] = str(user['role_id'])
        except:
            pass
    
    # Format dates
    if user.get('created_at'):
        user['created_at'] = user['created_at'].isoformat()
    if user.get('updated_at'):
        user['updated_at'] = user['updated_at'].isoformat()
    if user.get('last_login'):
        user['last_login'] = user['last_login'].isoformat()
    
    return user


@router.post("/")
def create_new_user(
    user_data: UserCreate,
    current_user: dict = Depends(verify_admin)
):
    """Create new user"""
    try:
        user = create_user(
            username=user_data.username,
            password=user_data.password,
            firstname=user_data.firstname,
            lastname=user_data.lastname,
            role_id=user_data.role_id,
            email=user_data.email,
            phone=user_data.phone,
            is_staff=user_data.is_staff,
            is_active=user_data.is_active,
            mobile=user_data.mobile
        )
        
        # Remove sensitive data
        user.pop('password', None)
        user.pop('salt', None)
        
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")


@router.put("/{user_id}")
def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: dict = Depends(verify_admin)
):
    """Update user"""
    db = get_db()
    users_collection = db['users']
    
    try:
        user_oid = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Check if exists
    existing = users_collection.find_one({'_id': user_oid})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build update
    update_data = {'updated_at': datetime.utcnow()}
    
    if user_data.firstname is not None:
        update_data['firstname'] = user_data.firstname
    if user_data.lastname is not None:
        update_data['lastname'] = user_data.lastname
    if user_data.role_id is not None:
        update_data['role_id'] = ObjectId(user_data.role_id)
    if user_data.email is not None:
        update_data['email'] = user_data.email
    if user_data.phone is not None:
        update_data['phone'] = user_data.phone
    if user_data.is_active is not None:
        update_data['is_active'] = user_data.is_active
    if user_data.is_staff is not None:
        update_data['is_staff'] = user_data.is_staff
    if user_data.mobile is not None:
        update_data['mobile'] = user_data.mobile
    
    # Update password if provided
    if user_data.password:
        salt = generate_salt()
        hashed_password = hash_password(user_data.password, salt)
        update_data['password'] = hashed_password
        update_data['salt'] = salt
    
    # Update
    users_collection.update_one(
        {'_id': user_oid},
        {'$set': update_data}
    )
    
    # Get updated user -- MANUAL CALL INSTEAD OF ASYNC AWAIT
    return get_user(user_id, current_user)


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Delete user"""
    db = get_db()
    users_collection = db['users']
    
    try:
        user_oid = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    result = users_collection.delete_one({'_id': user_oid})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "User deleted successfully"}
