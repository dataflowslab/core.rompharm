"""
Authentication routes
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel
from typing import Optional, Tuple
from datetime import datetime
import jwt
from bson import ObjectId

# Try relative imports first, fall back to absolute imports for module compatibility
try:
    from ..utils.db import get_db
    from ..utils.firebase_auth import verify_firebase_token
    from ..utils.config import load_config
    from ..utils.jwt_tokens import create_access_token, decode_access_token
    from ..utils.passwords import verify_password, hash_password
    from ..models.user_model import UserModel
    from ..utils.audit import log_action
except ImportError:
    # Fallback for when imported from external modules
    from utils.db import get_db
    from utils.firebase_auth import verify_firebase_token
    from utils.config import load_config
    from utils.jwt_tokens import create_access_token, decode_access_token
    from utils.passwords import verify_password, hash_password
    from models.user_model import UserModel
    from utils.audit import log_action

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _get_identity_provider(config: dict) -> str:
    """Resolve identity provider from config (string or dict)."""
    identity_config = config.get('identity_server')

    if isinstance(identity_config, dict):
        provider = identity_config.get('provider', 'internal')
    elif isinstance(identity_config, str):
        provider = identity_config
    else:
        provider = 'internal'

    if provider not in ['internal', 'firebase']:
        provider = 'internal'

    return provider


class LoginRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    firebase_token: Optional[str] = None
    domain: Optional[str] = None


class LoginResponse(BaseModel):
    token: str
    username: str
    name: Optional[str] = None
    role_id: Optional[str] = None
    role_name: Optional[str] = None
    message: str


def _get_role_info(db, user: dict) -> Tuple[Optional[str], Optional[str]]:
    role_id = user.get('role') or user.get('local_role')
    role_name = None
    if role_id:
        role_doc = None
        try:
            if ObjectId.is_valid(str(role_id)):
                role_doc = db.roles.find_one({'_id': ObjectId(role_id)})
        except Exception:
            role_doc = None
        if not role_doc:
            role_doc = db.roles.find_one({'name': role_id})
        if role_doc:
            role_name = role_doc.get('name') or None
    return (str(role_id) if role_id else None, role_name)


@router.post("/login/local", response_model=LoginResponse)
async def login_local(request_data: LoginRequest, request: Request):
    """
    Authenticate with local database (username/password)
    Independent of external identity provider
    Supports multi-tenant with domain field
    """
    if not request_data.username or not request_data.password:
        raise HTTPException(status_code=400, detail="Username and password required")
    
    # Get database connection with domain support
    db = get_db(domain=request_data.domain)
    users_collection = db[UserModel.collection_name]
    
    # Find user by username
    user = users_collection.find_one({'username': request_data.username})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Check if user has a local password
    if 'password' not in user:
        raise HTTPException(
            status_code=401,
            detail="This user does not have local authentication enabled. Please use the configured identity provider."
        )

    # Verify password (with legacy upgrade)
    is_valid, needs_upgrade = verify_password(request_data.password, user.get('password', ''))
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Update user metadata and upgrade password hash if needed
    update_doc = {
        'last_login': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'domain': request_data.domain  # Save domain for session
    }
    if needs_upgrade:
        update_doc['password'] = hash_password(request_data.password)

    users_collection.update_one(
        {'username': request_data.username},
        {'$set': update_doc}
    )

    role_id, role_name = _get_role_info(db, user)

    token = create_access_token({
        'sub': user['username'],
        'username': user['username'],
        'role': role_id,
        'domain': request_data.domain
    })
    
    # Log login action
    log_action(
        action='login',
        username=request_data.username,
        request=request,
        details={'identity_server': 'local', 'role': role_name or role_id}
    )
    
    return LoginResponse(
        token=token,
        username=user['username'],
        name=user.get('name') or user.get('email') or user['username'],
        role_id=role_id,
        role_name=role_name,
        message="Login successful"
    )


@router.post("/login", response_model=LoginResponse)
async def login(request_data: LoginRequest, request: Request):
    """
    Authenticate based on configuration (internal or Firebase)
    """
    config = load_config()
    provider = _get_identity_provider(config)
    
    # If provider is internal, use local authentication
    if provider == 'internal':
        return await login_local(request_data, request)
    
    if provider == 'firebase':
        # Firebase authentication
        if not request_data.firebase_token:
            raise HTTPException(status_code=400, detail="Firebase token required")
        
        try:
            firebase_user = verify_firebase_token(request_data.firebase_token)
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {str(e)}")
        
        username = firebase_user['email']
        name = firebase_user.get('name') or firebase_user.get('email')

        db = get_db(domain=request_data.domain)
        users_collection = db[UserModel.collection_name]
        existing_user = users_collection.find_one({'username': username})
        
    else:
        # Local authentication - redirect to /login/local
        raise HTTPException(
            status_code=400, 
            detail="Please use /api/auth/login/local for local authentication"
        )
    
    # Save or update user in database (common for both providers)
    db = get_db(domain=request_data.domain)
    users_collection = db[UserModel.collection_name]
    roles_collection = db['roles']
    
    existing_user = users_collection.find_one({'username': username})
    
    if existing_user:
        # Update existing user
        update_data = {
            'updated_at': datetime.utcnow(),
            'last_login': datetime.utcnow(),
            'domain': request_data.domain
        }
        
        # Update name if provided
        if name:
            update_data['name'] = name
        
        # If user doesn't have a role yet, assign a default role
        if not existing_user.get('local_role') and not existing_user.get('role'):
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
        user_role = roles_collection.find_one({'name': 'standard user'})
        if user_role:
            local_role = str(user_role['_id'])
        
        user_doc = UserModel.create(username, '', local_role=local_role)
        user_doc['domain'] = request_data.domain
        users_collection.insert_one(user_doc)
    
    # Log login action
    log_action(
        action='login',
        username=username,
        request=request,
        details={'identity_server': provider}
    )

    user_doc = users_collection.find_one({'username': username}) or {}
    role_id, role_name = _get_role_info(db, user_doc)

    token = create_access_token({
        'sub': username,
        'username': username,
        'role': role_id,
        'domain': request_data.domain
    })

    return LoginResponse(
        token=token,
        username=username,
        name=name,
        role_id=role_id,
        role_name=role_name,
        message="Login successful"
    )


async def verify_token(authorization: Optional[str] = Header(None)):
    """
    Dependency to verify authentication token
    Returns user with domain information for multi-tenant support
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    # Extract token from "Token <token>" or "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() not in ['token', 'bearer']:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = parts[1]
    
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    username = payload.get('username') or payload.get('sub')
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    domain = payload.get('domain')
    db = get_db(domain=domain)
    users_collection = db[UserModel.collection_name]
    user = users_collection.find_one({'username': username})

    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    user['domain'] = domain
    return user


async def verify_admin(authorization: Optional[str] = Header(None)):
    """
    Dependency to verify user is administrator
    """
    user = await verify_token(authorization)
    
    try:
        from utils.permission_helpers import is_admin_user
    except ImportError:
        from ..utils.permission_helpers import is_admin_user

    if not is_admin_user(user):
        print(f"Access denied for user {user['username']}: role={user.get('role') or user.get('local_role')}")
        raise HTTPException(status_code=403, detail="Administrator access required")
    
    return user


@router.get("/methods")
async def get_auth_methods():
    """
    Get available authentication methods
    Public endpoint
    """
    config = load_config()
    provider = _get_identity_provider(config)
    
    return {
        'primary': provider,
        'local_enabled': True,  # Local auth is always available
        'firebase_enabled': provider == 'firebase',
        'internal_enabled': provider == 'internal'
    }


@router.get("/domains")
async def get_available_domains():
    """
    Get list of available domains (databases)
    Public endpoint for login page
    """
    try:
        from ..utils.db import list_domains
    except ImportError:
        from utils.db import list_domains
    
    try:
        domains = list_domains()
        return {
            'domains': domains,
            'total': len(domains)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching domains: {str(e)}")


@router.get("/verify")
async def verify(user = Depends(verify_token)):
    """
    Verify if current token is valid and return user info
    """
    db = get_db(domain=user.get('domain'))
    role_id, role_name = _get_role_info(db, user)
    return {
        'valid': True,
        'username': user['username'],
        'name': user.get('name'),
        'role_id': role_id,
        'role_name': role_name
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
