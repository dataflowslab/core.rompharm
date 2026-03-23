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
from src.backend.utils.sections_permissions import require_section

router = APIRouter(prefix="/api/users", tags=["users"])


def _normalize_locations(value) -> list:
    normalized = []
    if not value:
        return normalized
    for loc in value:
        if isinstance(loc, ObjectId):
            normalized.append(str(loc))
        elif isinstance(loc, dict) and loc.get("$oid"):
            normalized.append(str(loc.get("$oid")))
        elif isinstance(loc, str):
            normalized.append(loc)
    return normalized


def _coerce_locations(value) -> list:
    normalized = []
    if not value:
        return normalized
    for loc in value:
        if isinstance(loc, ObjectId):
            normalized.append(loc)
            continue
        if isinstance(loc, dict) and loc.get("$oid"):
            try:
                normalized.append(ObjectId(loc.get("$oid")))
            except Exception:
                continue
            continue
        if isinstance(loc, str):
            try:
                normalized.append(ObjectId(loc))
            except Exception:
                continue
    return normalized


def _resolve_role_id(user_doc: dict) -> Optional[ObjectId]:
    role_value = user_doc.get('role') or user_doc.get('role_id')
    if not role_value:
        return None
    if isinstance(role_value, ObjectId):
        return role_value
    if isinstance(role_value, dict) and role_value.get("$oid"):
        return ObjectId(role_value.get("$oid"))
    try:
        return ObjectId(role_value)
    except Exception:
        return None


@router.get("/")
def list_users(
    current_user: dict = Depends(require_section("users"))
):
    """List all users"""
    db = get_db()
    users_collection = db['users']
    roles_collection = db['roles']
    
    users = list(users_collection.find())
    
    # Populate role info
    for user in users:
        user['_id'] = str(user['_id'])
        user['id'] = user['_id']
        
        # Remove sensitive data
        user.pop('password', None)
        user.pop('salt', None)
        user.pop('token', None)
        
        # Get role (support both role and role_id)
        role_id = _resolve_role_id(user)
        if role_id:
            try:
                role = roles_collection.find_one({'_id': role_id})
                if role:
                    user['role'] = {
                        '_id': str(role['_id']),
                        'name': role.get('name'),
                        'slug': role.get('slug')
                    }
                user['role_id'] = str(role_id)
            except Exception:
                pass

        user['locations'] = _normalize_locations(user.get('locations'))
        
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
    current_user: dict = Depends(require_section("users"))
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
    user['id'] = user['_id']
    
    # Remove sensitive data
    user.pop('password', None)
    user.pop('salt', None)
    user.pop('token', None)
    
    # Get role (support both role and role_id)
    role_id = _resolve_role_id(user)
    if role_id:
        try:
            role = roles_collection.find_one({'_id': role_id})
            if role:
                user['role'] = {
                    '_id': str(role['_id']),
                    'name': role.get('name'),
                    'slug': role.get('slug')
                }
            user['role_id'] = str(role_id)
        except Exception:
            pass

    user['locations'] = _normalize_locations(user.get('locations'))
    
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
    current_user: dict = Depends(require_section("users"))
):
    """Create new user"""
    try:
        user = create_user(
            username=user_data.username,
            password=user_data.password,
            name=user_data.name,
            firstname=user_data.firstname,
            lastname=user_data.lastname,
            role_id=user_data.role_id,
            email=user_data.email,
            phone=user_data.phone,
            is_active=user_data.is_active,
            mobile=user_data.mobile,
            locations=user_data.locations
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
    current_user: dict = Depends(require_section("users"))
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
    
    payload = user_data.dict(exclude_unset=True)
    update_data = {'updated_at': datetime.utcnow()}
    unset_data = {}

    def _should_unset(value: Optional[str]) -> bool:
        if value is None:
            return True
        if isinstance(value, str) and value.strip() == '':
            return True
        return False

    if 'username' in payload and payload.get('username') is not None and payload.get('username') != existing.get('username'):
        username_exists = users_collection.find_one({'username': payload.get('username')})
        if username_exists:
            raise HTTPException(status_code=400, detail="Username already exists")
        update_data['username'] = payload.get('username')

    if 'name' in payload:
        if _should_unset(payload.get('name')):
            unset_data['name'] = ''
        else:
            update_data['name'] = payload.get('name')

    if 'firstname' in payload:
        if _should_unset(payload.get('firstname')):
            unset_data['firstname'] = ''
        else:
            update_data['firstname'] = payload.get('firstname')

    if 'lastname' in payload:
        if _should_unset(payload.get('lastname')):
            unset_data['lastname'] = ''
        else:
            update_data['lastname'] = payload.get('lastname')

    if 'local_role' in payload:
        if _should_unset(payload.get('local_role')):
            unset_data['local_role'] = ''
        else:
            update_data['local_role'] = payload.get('local_role')

    if 'role_id' in payload:
        role_id_value = payload.get('role_id')
        if role_id_value:
            update_data['role'] = ObjectId(role_id_value)
            update_data['role_id'] = ObjectId(role_id_value)

    if 'email' in payload:
        update_data['email'] = payload.get('email')
    if 'phone' in payload:
        update_data['phone'] = payload.get('phone')
    if 'is_active' in payload:
        update_data['is_active'] = payload.get('is_active')
    if 'mobile' in payload:
        update_data['mobile'] = payload.get('mobile')
    if 'locations' in payload:
        update_data['locations'] = _coerce_locations(payload.get('locations'))
    
    # Update password if provided
    if user_data.password:
        salt = generate_salt()
        hashed_password = hash_password(user_data.password, salt)
        update_data['password'] = hashed_password
        update_data['salt'] = salt
    
    update_doc = {'$set': update_data}
    if unset_data:
        update_doc['$unset'] = unset_data

    users_collection.update_one({'_id': user_oid}, update_doc)
    
    # Get updated user -- MANUAL CALL INSTEAD OF ASYNC AWAIT
    return get_user(user_id, current_user)


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    current_user: dict = Depends(require_section("users"))
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
