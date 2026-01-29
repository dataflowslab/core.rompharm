"""
Authentication routes
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from ..utils.db import get_db
from ..utils.config import load_config
from ..utils.inventree_auth import get_inventree_user_info, verify_inventree_token, get_user_staff_status
from ..utils.local_auth import authenticate_user, get_user_from_token
from ..utils.audit import log_action

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str
    is_staff: bool
    name: Optional[str] = None
    message: str


@router.post("/login", response_model=LoginResponse)
async def login(request_data: LoginRequest, request: Request):
    """
    Authenticate user (localhost or InvenTree based on config)
    """
    config = load_config()
    identity_server = config.get('identity_server', 'inventree')
    
    if identity_server == 'localhost':
        # Local authentication
        user_info = authenticate_user(request_data.username, request_data.password)
        
        if not user_info:
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials. Please check your username and password."
            )
        
        # Log login action
        log_action(
            action='login',
            username=request_data.username,
            request=request,
            details={'is_staff': user_info.get('is_staff', False), 'identity_server': 'localhost'}
        )
        
        return LoginResponse(
            token=user_info['access_token'],
            username=user_info['username'],
            is_staff=user_info.get('is_staff', False),
            name=user_info.get('name'),
            message="Login successful"
        )
    
    else:
        # InvenTree authentication
        try:
            user_info = get_inventree_user_info(request_data.username, request_data.password)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to connect to InvenTree: {str(e)}"
            )
        
        if not user_info:
            raise HTTPException(
                status_code=401,
                detail="Invalid InvenTree credentials. Please check your username and password."
            )
        
        token = user_info['token']
        is_staff = user_info['is_staff']
        name = user_info.get('name')
        
        # Save or update user in database
        db = get_db()
        users_collection = db['users']
        roles_collection = db['roles']
        
        existing_user = users_collection.find_one({'username': request_data.username})
        
        if existing_user:
            # Update existing user
            update_data = {
                'token': token,
                'is_staff': is_staff,
                'updated_at': datetime.utcnow(),
                'last_login': datetime.utcnow()
            }
            
            # Update name if provided
            if name:
                update_data['name'] = name
            
            # If user doesn't have a role yet, assign one based on is_staff
            if not existing_user.get('local_role'):
                if is_staff:
                    admin_role = roles_collection.find_one({'name': 'admin'})
                    if admin_role:
                        update_data['local_role'] = str(admin_role['_id'])
                else:
                    user_role = roles_collection.find_one({'name': 'standard user'})
                    if user_role:
                        update_data['local_role'] = str(user_role['_id'])
            
            users_collection.update_one(
                {'username': request_data.username},
                {'$set': update_data}
            )
        else:
            # Create new user with role assignment
            local_role = None
            if is_staff:
                admin_role = roles_collection.find_one({'name': 'admin'})
                if admin_role:
                    local_role = str(admin_role['_id'])
            else:
                user_role = roles_collection.find_one({'name': 'standard user'})
                if user_role:
                    local_role = str(user_role['_id'])
            
            # Create user document manually
            user_doc = {
                'username': request_data.username,
                'token': token,
                'is_staff': is_staff,
                'local_role': local_role,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            users_collection.insert_one(user_doc)
        
        # Log login action
        log_action(
            action='login',
            username=request_data.username,
            request=request,
            details={'is_staff': is_staff, 'identity_server': 'inventree'}
        )
        
        return LoginResponse(
            token=token,
            username=request_data.username,
            is_staff=is_staff,
            name=name,
            message="Login successful"
        )


async def verify_token(authorization: Optional[str] = Header(None)):
    """
    Dependency to verify authentication token (localhost or InvenTree)
    Returns normalized user data with consistent types
    """
    from bson import ObjectId
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    # Extract token from "Token <token>" or "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() not in ['token', 'bearer']:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = parts[1]
    
    config = load_config()
    identity_server = config.get('identity_server', 'inventree')
    
    if identity_server == 'localhost':
        # Verify JWT token
        user_data = get_user_from_token(token)
        
        if not user_data:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        # ✅ Normalize user data
        return _normalize_user_data(user_data)
    
    else:
        # Verify token exists in database (InvenTree)
        db = get_db()
        users_collection = db['users']
        user = users_collection.find_one({'token': token})
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # ✅ Normalize user data
        return _normalize_user_data(user)


def _normalize_user_data(user: dict) -> dict:
    """
    Normalize user data to ensure consistent types across the application
    - _id: always string
    - role: always string (ObjectId converted to string)
    - All ObjectId fields converted to strings
    """
    from bson import ObjectId
    
    normalized = user.copy()
    
    # Normalize _id to string
    if '_id' in normalized:
        if isinstance(normalized['_id'], ObjectId):
            normalized['_id'] = str(normalized['_id'])
    
    # Normalize role field (can be 'role' or 'local_role')
    role_field = normalized.get('role') or normalized.get('local_role')
    if role_field:
        if isinstance(role_field, ObjectId):
            normalized['role'] = str(role_field)
        elif isinstance(role_field, dict) and '_id' in role_field:
            normalized['role'] = str(role_field['_id'])
        elif isinstance(role_field, str):
            normalized['role'] = role_field
        else:
            normalized['role'] = None
        
        # Ensure both 'role' and 'local_role' are set for compatibility
        if 'local_role' not in normalized:
            normalized['local_role'] = normalized['role']
    
    return normalized


async def verify_admin(authorization: Optional[str] = Header(None)):
    """
    Dependency to verify user is administrator
    Staff status is determined from local database only (no InvenTree calls)
    """
    user = await verify_token(authorization)
    
    if not user.get('is_staff', False):
        print(f"Access denied for user {user['username']}: is_staff={user.get('is_staff')}")
        raise HTTPException(status_code=403, detail="Administrator access required")
    
    return user


@router.get("/verify")
async def verify(user = Depends(verify_token)):
    """
    Verify if current token is valid and return user info
    """
    return {
        'valid': True,
        'username': user['username'],
        'name': user.get('name'),
        'is_staff': user.get('is_staff', False)
    }


@router.get("/me")
async def get_current_user(user = Depends(verify_token)):
    """
    Get current user information
    """
    return {
        '_id': str(user['_id']),
        'username': user['username'],
        'name': user.get('name'),
        'is_staff': user.get('is_staff', False),
        'staff': user.get('is_staff', False),
        'local_role': user.get('local_role')
    }


@router.post("/refresh-status")
async def refresh_status(user = Depends(verify_token)):
    """
    Refresh user's staff status from InvenTree (only works when identity_server is 'inventree')
    For localhost mode, staff status is managed locally in the database
    """
    config = load_config()
    identity_server = config.get('identity_server', 'inventree')
    
    if identity_server == 'localhost':
        # For localhost mode, just return current status from database
        return {
            'username': user['username'],
            'is_staff': user.get('is_staff', False),
            'message': 'Staff status is managed locally (localhost mode)'
        }
    
    # InvenTree mode - refresh from InvenTree
    staff_status = get_user_staff_status(user['token'])
    
    if staff_status is None:
        raise HTTPException(status_code=500, detail="Failed to get staff status from InvenTree")
    
    # Update user in database
    db = get_db()
    users_collection = db['users']
    users_collection.update_one(
        {'token': user['token']},
        {
            '$set': {
                'is_staff': staff_status,
                'updated_at': datetime.utcnow()
            }
        }
    )
    
    return {
        'username': user['username'],
        'is_staff': staff_status,
        'message': 'Staff status updated successfully'
    }


@router.get("/dashboard/shortcuts")
async def get_dashboard_shortcuts(user = Depends(verify_token)):
    """
    Get dashboard shortcuts for current user based on their role
    """
    from bson import ObjectId
    
    db = get_db()
    
    # Get user's role (check both 'role' and 'local_role' for compatibility)
    user_role = user.get('role') or user.get('local_role')
    if not user_role:
        return {'forms': []}
    
    # Get dashboard config for this role
    # Try both string and ObjectId comparison
    dashboard_collection = db['dashboard']
    
    # First try with string comparison
    dashboard_config = dashboard_collection.find_one({'role': user_role})
    
    # If not found, try with ObjectId
    if not dashboard_config:
        try:
            dashboard_config = dashboard_collection.find_one({'role': ObjectId(user_role)})
        except:
            pass
    
    if not dashboard_config or 'forms' not in dashboard_config:
        return {'forms': []}
    
    # Get form details
    forms_collection = db['forms']
    form_slugs = dashboard_config['forms']
    
    forms = []
    for slug in form_slugs:
        form = forms_collection.find_one({'slug': slug})
        if form:
            forms.append({
                'slug': slug,
                'title': form.get('title', slug),
                'description': form.get('description', '')
            })
    
    return {'forms': forms}
