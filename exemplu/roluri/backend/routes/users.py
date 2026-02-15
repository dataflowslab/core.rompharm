"""
Users routes
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import math
from bson import ObjectId
from datetime import datetime
import hashlib

from ..utils.db import get_db
from ..models.user_model import UserModel
from ..routes.auth import verify_admin, verify_token
from ..utils.audit import log_action

router = APIRouter(prefix="/api/users", tags=["users"])


class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    name: Optional[str] = None
    password: str
    role: Optional[str] = None
    deps: Optional[List[str]] = []  # List of department IDs


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    deps: Optional[List[str]] = None  # List of department IDs


@router.get("/")
async def list_users(
    page: Optional[int] = None,
    limit: Optional[int] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    user = Depends(verify_admin)
) -> Any:
    """
    List all users with their last login information and role names
    Requires administrator access
    """
    db = get_db(domain=user.get('domain'))
    users_collection = db[UserModel.collection_name]
    
    projection = {
        'username': 1,
        'email': 1,
        'name': 1,
        'role': 1,
        'local_role': 1,
        'deps': 1,
        'last_login': 1,
        'created_at': 1,
        'updated_at': 1
    }

    has_params = any(param is not None for param in [page, limit, search, sort_by, sort_order])

    if not has_params:
        users = list(users_collection.find({}, projection).sort('last_login', -1))
    else:
        page = page or 1
        limit = limit or 10
        page = max(page, 1)
        limit = max(limit, 1)

        query: Dict[str, Any] = {}
        if search:
            regex = {'$regex': search, '$options': 'i'}
            query['$or'] = [
                {'username': regex},
                {'email': regex},
                {'name': regex},
            ]

        sort_by = sort_by or 'last_login'
        sort_order = (sort_order or 'desc').lower()
        sort_dir = -1 if sort_order == 'desc' else 1

        if sort_by == 'role_name':
            users = list(users_collection.find(query, projection))
        else:
            sort_map = {
                'username': 'username',
                'email': 'email',
                'name': 'name',
                'last_login': 'last_login',
                'created_at': 'created_at',
                'updated_at': 'updated_at',
            }
            sort_field = sort_map.get(sort_by, 'last_login')
            users = list(
                users_collection.find(query, projection)
                .sort(sort_field, sort_dir)
                .skip((page - 1) * limit)
                .limit(limit)
            )
    
    # Convert ObjectId to string and format dates
    for user_doc in users:
        user_doc['id'] = str(user_doc['_id'])
        del user_doc['_id']
        
        # Get role name if role ID exists
        role_id = user_doc.get('role') or user_doc.get('local_role')
        if role_id:
            try:
                role = db.roles.find_one({'_id': ObjectId(role_id)})
                if role:
                    user_doc['role_name'] = role.get('name', '')
                else:
                    user_doc['role_name'] = ''
            except:
                user_doc['role_name'] = ''
        else:
            user_doc['role_name'] = ''
        
        if 'created_at' in user_doc:
            user_doc['created_at'] = user_doc['created_at'].isoformat()
        if 'updated_at' in user_doc:
            user_doc['updated_at'] = user_doc['updated_at'].isoformat()
        if 'last_login' in user_doc and user_doc['last_login']:
            user_doc['last_login'] = user_doc['last_login'].isoformat()

    if not has_params:
        return users

    if sort_by == 'role_name':
        users.sort(key=lambda u: (u.get('role_name') or '').lower(), reverse=sort_dir == -1)
        total = len(users)
        start = (page - 1) * limit
        end = start + limit
        items = users[start:end]
    else:
        total = users_collection.count_documents(query)
        items = users

    pages = math.ceil(total / limit) if limit else 1
    return {
        'items': items,
        'total': total,
        'page': page,
        'pages': pages,
        'limit': limit,
    }


@router.get("/select")
async def list_users_for_select(current_user = Depends(verify_token)) -> List[Dict[str, Any]]:
    """
    List users for select dropdowns (authenticated users only)
    Returns minimal fields (id, username, email)
    """
    db = get_db(domain=current_user.get('domain'))
    users_collection = db[UserModel.collection_name]

    users = list(users_collection.find(
        {},
        {
            'username': 1,
            'email': 1
        }
    ).sort('username', 1))

    result = []
    for user_doc in users:
        result.append({
            'id': str(user_doc['_id']),
            'username': user_doc.get('username', ''),
            'email': user_doc.get('email', '')
        })

    return result


@router.get("/roles")
async def list_roles(user = Depends(verify_admin)) -> List[Dict[str, Any]]:
    """
    List available roles from local roles collection
    """
    db = get_db(domain=user.get('domain'))
    
    try:
        roles = list(db['roles'].find())
        result = []
        for role in roles:
            result.append({
                'id': str(role['_id']),
                'name': role.get('name', ''),
                'description': role.get('description', '')
            })
        return result
    except Exception as e:
        print(f"Error loading roles: {e}")
        return []


@router.get("/departments")
async def list_departments(user = Depends(verify_admin)) -> List[Dict[str, Any]]:
    """
    List all departments from procurement_departamente collection
    Requires administrator access
    """
    db = get_db(domain=user.get('domain'))
    
    try:
        departments = list(db.procurement_departamente.find().sort('nume', 1))
        
        result = []
        for dept in departments:
            result.append({
                'id': str(dept['_id']),
                'nume': dept.get('nume', ''),
                'cod': dept.get('cod', ''),
                'descriere': dept.get('descriere', '')
            })
        
        return result
        
    except Exception as e:
        print(f"Error loading departments: {e}")
        return []


@router.post("/")
async def create_user(user_data: UserCreate, request: Request, current_user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Create a new user (admin only)
    """
    db = get_db(domain=current_user.get('domain'))
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
        'name': user_data.name,
        'password': password_hash,
        'role': user_data.role,
        'deps': user_data.deps or [],
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
        details={'role': user_data.role}
    )
    
    return user_doc


@router.get("/{user_id}")
async def get_user(user_id: str, current_user = Depends(verify_admin)) -> Dict[str, Any]:
    """
    Get user details (admin only)
    """
    db = get_db(domain=current_user.get('domain'))
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
    db = get_db(domain=current_user.get('domain'))
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

    if user_data.name is not None:
        update_doc['name'] = user_data.name
    
    if user_data.password:
        update_doc['password'] = hashlib.sha256(user_data.password.encode()).hexdigest()
    
    if user_data.role is not None:
        update_doc['role'] = user_data.role
    
    if user_data.deps is not None:
        update_doc['deps'] = user_data.deps
    
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
    db = get_db(domain=current_user.get('domain'))
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
