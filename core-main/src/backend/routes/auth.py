"""
Authentication routes
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import yaml
import os
import hashlib
import secrets

# Try relative imports first, fall back to absolute imports for module compatibility
try:
    from ..utils.db import get_db
    from ..utils.inventree_auth import get_inventree_user_info, verify_inventree_token, get_user_staff_status
    from ..utils.firebase_auth import verify_firebase_token, is_firebase_enabled
    from ..models.user_model import UserModel
    from ..utils.audit import log_action
except ImportError:
    # Fallback for when imported from external modules
    from utils.db import get_db
    from utils.inventree_auth import get_inventree_user_info, verify_inventree_token, get_user_staff_status
    from utils.firebase_auth import verify_firebase_token, is_firebase_enabled
    from models.user_model import UserModel
    from utils.audit import log_action

router = APIRouter(prefix="/api/auth", tags=["auth"])


def load_config():
    """Load configuration from config.yaml"""
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'config', 'config.yaml')
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


class LoginRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    firebase_token: Optional[str] = None


class LoginResponse(BaseModel):
    token: str
    username: str
    is_staff: bool
    name: Optional[str] = None
    message: str


@router.post("/login/local", response_model=LoginResponse)
async def login_local(request_data: LoginRequest, request: Request):
    """
    Authenticate with local database (username/password)
    Independent of InvenTree or Firebase
    """
    if not request_data.username or not request_data.password:
        raise HTTPException(status_code=400, detail="Username and password required")
    
    db = get_db()
    users_collection = db[UserModel.collection_name]
    
    # Find user by username
    user = users_collection.find_one({'username': request_data.username})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Check if user has a local password
    if 'password' not in user:
        raise HTTPException(
            status_code=401, 
            detail="This user does not have local authentication enabled. Please use InvenTree or Firebase login."
        )
    
    # Verify password
    password_hash = hashlib.sha256(request_data.password.encode()).hexdigest()
    if user['password'] != password_hash:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Generate new token if user doesn't have one or update existing
    if 'token' not in user or not user['token']:
        token = secrets.token_urlsafe(32)
    else:
        token = user['token']
    
    # Update user with new token and last login
    users_collection.update_one(
        {'username': request_data.username},
        {
            '$set': {
                'token': token,
                'last_login': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
        }
    )
    
    # Log login action
    log_action(
        action='login',
        username=request_data.username,
        request=request,
        details={'is_staff': user.get('is_staff', False), 'identity_server': 'local'}
    )
    
    return LoginResponse(
        token=token,
        username=user['username'],
        is_staff=user.get('is_staff', False),
        name=user.get('name') or user.get('email') or user['username'],
        message="Login successful"
    )


@router.post("/login", response_model=LoginResponse)
async def login(request_data: LoginRequest, request: Request):
    """
    Authenticate with InvenTree or Firebase based on configuration
    For local authentication, use /login/local endpoint
    """
    config = load_config()
    identity_server = config.get('identity_server', 'inventree')
    
    if identity_server == 'firebase':
        # Firebase authentication
        if not request_data.firebase_token:
            raise HTTPException(status_code=400, detail="Firebase token required")
        
        try:
            firebase_user = verify_firebase_token(request_data.firebase_token)
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {str(e)}")
        
        username = firebase_user['email']
        token = request_data.firebase_token
        name = firebase_user.get('name') or firebase_user.get('email')
        
        # Check if user exists in local DB to determine is_staff
        db = get_db()
        users_collection = db[UserModel.collection_name]
        existing_user = users_collection.find_one({'username': username})
        is_staff = existing_user.get('is_staff', False) if existing_user else False
        
    else:
        # InvenTree authentication
        if not request_data.username or not request_data.password:
            raise HTTPException(status_code=400, detail="Username and password required")
        
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
        
        username = request_data.username
        token = user_info['token']
        is_staff = user_info['is_staff']
        name = user_info.get('name')
    
    # Save or update user in database (common for both providers)
    db = get_db()
    users_collection = db[UserModel.collection_name]
    roles_collection = db['roles']
    
    existing_user = users_collection.find_one({'username': username})
    
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
            {'username': username},
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
        
        user_doc = UserModel.create(username, token, is_staff, local_role=local_role)
        users_collection.insert_one(user_doc)
    
    # Log login action
    log_action(
        action='login',
        username=username,
        request=request,
        details={'is_staff': is_staff, 'identity_server': identity_server}
    )
    
    return LoginResponse(
        token=token,
        username=username,
        is_staff=is_staff,
        name=name,
        message="Login successful"
    )


async def verify_token(authorization: Optional[str] = Header(None)):
    """
    Dependency to verify authentication token
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    # Extract token from "Token <token>" or "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() not in ['token', 'bearer']:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = parts[1]
    
    # Verify token exists in database
    db = get_db()
    users_collection = db[UserModel.collection_name]
    user = users_collection.find_one({'token': token})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return user


async def verify_admin(authorization: Optional[str] = Header(None)):
    """
    Dependency to verify user is administrator
    Also updates staff status from InvenTree if needed (only for InvenTree users)
    """
    user = await verify_token(authorization)
    
    # Only refresh status from InvenTree if user doesn't have a local password
    # (meaning they authenticate via InvenTree)
    has_local_password = 'password' in user and user['password']
    
    if not has_local_password:
        # Check if we need to refresh staff status from InvenTree
        should_refresh = False
        if not user.get('is_staff', False):
            should_refresh = True
        elif 'updated_at' in user:
            from datetime import timedelta
            last_update = user['updated_at']
            if datetime.utcnow() - last_update > timedelta(minutes=5):
                should_refresh = True
        
        if should_refresh:
            print(f"Refreshing staff status for user {user['username']}")
            staff_status = get_user_staff_status(user['token'])
            
            if staff_status is not None:
                # Update user in database
                db = get_db()
                users_collection = db[UserModel.collection_name]
                users_collection.update_one(
                    {'token': user['token']},
                    {
                        '$set': {
                            'is_staff': staff_status,
                            'updated_at': datetime.utcnow()
                        }
                    }
                )
                user['is_staff'] = staff_status
                print(f"Updated staff status to: {staff_status}")
    
    if not user.get('is_staff', False):
        print(f"Access denied for user {user['username']}: is_staff={user.get('is_staff')}")
        raise HTTPException(status_code=403, detail="Administrator access required")
    
    return user


@router.get("/methods")
async def get_auth_methods():
    """
    Get available authentication methods
    Public endpoint
    """
    config = load_config()
    identity_server = config.get('identity_server', 'inventree')
    
    return {
        'primary': identity_server,
        'local_enabled': True,  # Local auth is always available
        'inventree_enabled': identity_server == 'inventree',
        'firebase_enabled': identity_server == 'firebase'
    }


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


@router.post("/refresh-status")
async def refresh_status(user = Depends(verify_token)):
    """
    Refresh user's staff status from InvenTree
    """
    staff_status = get_user_staff_status(user['token'])
    
    if staff_status is None:
        raise HTTPException(status_code=500, detail="Failed to get staff status from InvenTree")
    
    # Update user in database
    db = get_db()
    users_collection = db[UserModel.collection_name]
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
