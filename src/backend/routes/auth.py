"""
Authentication routes
"""
from fastapi import APIRouter, Depends, Header, Request, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.backend.services.auth_service import AuthService
# Use absolute imports
from src.backend.utils.db import get_db

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
def login(request_data: LoginRequest, request: Request):
    """
    Authenticate user
    """
    # Delegate to Service Layer
    # Note: This route is now synchronous (def) to allow FastAPI to run it in a threadpool
    login_result = AuthService.login(request_data.username, request_data.password, request)
    return LoginResponse(**login_result)


def verify_token(authorization: Optional[str] = Header(None)):
    """
    Dependency to verify authentication token
    Returns normalized user data with consistent types
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    # Extract token from "Token <token>" or "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() not in ['token', 'bearer']:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = parts[1]
    
    # Verify via Service
    user_data = AuthService.verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return _normalize_user_data(user_data)


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


def verify_admin(authorization: Optional[str] = Header(None)):
    """
    Dependency to verify user is administrator
    """
    user = verify_token(authorization)
    
    if not user.get('is_staff', False):
        raise HTTPException(status_code=403, detail="Administrator access required")
    
    return user


@router.get("/verify")
def verify(user = Depends(verify_token)):
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
def get_current_user(user = Depends(verify_token)):
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
def refresh_status(user = Depends(verify_token)):
    """
    Refresh user's staff status
    For localhost mode, staff status is managed locally in the database
    """
    return {
        'username': user['username'],
        'is_staff': user.get('is_staff', False),
        'message': 'Staff status is managed locally'
    }


@router.get("/dashboard/shortcuts")
def get_dashboard_shortcuts(user = Depends(verify_token)):
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
