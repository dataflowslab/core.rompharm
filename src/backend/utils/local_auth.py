"""
Local Authentication Service
Autentificare bazată pe MongoDB (fără InvenTree)
"""
import base64
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from bson import ObjectId
import jwt

from .db import get_db
from .config import load_config


def generate_salt() -> str:
    """Generează salt pentru parole"""
    return secrets.token_hex(16)


def hash_password(password: str, salt: str) -> str:
    """Hash password cu salt folosind base64"""
    # Combine password + salt
    combined = f"{password}{salt}"
    # Hash cu SHA256
    hashed = hashlib.sha256(combined.encode()).digest()
    # Encode în base64
    return base64.b64encode(hashed).decode()


def verify_password(password: str, salt: str, hashed_password: str) -> bool:
    """Verifică parola"""
    return hash_password(password, salt) == hashed_password


def generate_token(user_id: str, username: str) -> str:
    """Generează JWT token"""
    config = load_config()
    secret_key = config.get('app', {}).get('secret_key', 'default-secret-key')
    
    payload = {
        'user_id': user_id,
        'username': username,
        'exp': datetime.utcnow() + timedelta(days=30),  # Token valid 30 zile
        'iat': datetime.utcnow()
    }
    
    token = jwt.encode(payload, secret_key, algorithm='HS256')
    return token


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verifică JWT token"""
    try:
        config = load_config()
        secret_key = config.get('app', {}).get('secret_key', 'default-secret-key')
        
        payload = jwt.decode(token, secret_key, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Autentifică user și returnează user data + token
    """
    db = get_db()
    users_collection = db['users']
    
    # Find user
    user = users_collection.find_one({'username': username})
    
    if not user:
        return None
    
    # Check if active
    if not user.get('is_active', True):
        return None
    
    # Verify password
    salt = user.get('salt')
    hashed_password = user.get('password')
    
    if not salt or not hashed_password:
        return None
    
    if not verify_password(password, salt, hashed_password):
        return None
    
    # Generate token
    token = generate_token(str(user['_id']), username)
    
    # Update user with token
    users_collection.update_one(
        {'_id': user['_id']},
        {
            '$set': {
                'token': token,
                'last_login': datetime.utcnow()
            }
        }
    )
    
    # Get role info
    role_data = None
    if user.get('role'):
        roles_collection = db['roles']
        role = roles_collection.find_one({'_id': ObjectId(user['role'])})
        if role:
            role_data = {
                '_id': str(role['_id']),
                'name': role.get('name'),
                'slug': role.get('slug'),
                'items': role.get('items', [])  # Permission items
            }
    
    # Return user data
    return {
        '_id': str(user['_id']),
        'username': user['username'],
        'firstname': user.get('firstname', ''),
        'lastname': user.get('lastname', ''),
        'name': f"{user.get('firstname', '')} {user.get('lastname', '')}".strip(),
        'email': user.get('email'),
        'is_active': user.get('is_active', True),
        'mobile': user.get('mobile', True),  # Default True as requested
        'role': role_data,
        'token': token,
        'access_token': token  # Alias pentru compatibilitate
    }


def get_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Obține user din token
    """
    payload = verify_token(token)
    
    if not payload:
        return None
    
    db = get_db()
    users_collection = db['users']
    
    user_id = payload.get('user_id')
    
    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
    except:
        return None
    
    if not user:
        return None
    
    # Check if active
    if not user.get('is_active', True):
        return None
    
    # Get role info
    role_data = None
    if user.get('role'):
        roles_collection = db['roles']
        try:
            role = roles_collection.find_one({'_id': ObjectId(user['role'])})
            if role:
                role_data = {
                    '_id': str(role['_id']),
                    'name': role.get('name'),
                    'slug': role.get('slug'),
                    'items': role.get('items', [])  # Permission items
                }
        except:
            pass
    
    return {
        '_id': str(user['_id']),
        'username': user['username'],
        'firstname': user.get('firstname', ''),
        'lastname': user.get('lastname', ''),
        'name': f"{user.get('firstname', '')} {user.get('lastname', '')}".strip(),
        'email': user.get('email'),
        'is_staff': user.get('is_staff', False),
        'is_active': user.get('is_active', True),
        'mobile': user.get('mobile', True),  # Default True as requested
        'role': role_data
    }


def create_user(
    username: str,
    password: str,
    firstname: str,
    lastname: str,
    role_id: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    is_staff: bool = False,
    is_active: bool = True,
    mobile: bool = True
) -> Dict[str, Any]:
    """
    Creare user nou
    """
    db = get_db()
    users_collection = db['users']
    
    # Check if username exists
    existing = users_collection.find_one({'username': username})
    if existing:
        raise ValueError("Username already exists")
    
    # Generate salt and hash password
    salt = generate_salt()
    hashed_password = hash_password(password, salt)
    
    # Create user document
    user_doc = {
        'username': username,
        'password': hashed_password,
        'salt': salt,
        'firstname': firstname,
        'lastname': lastname,
        'role': ObjectId(role_id),  # Use 'role' not 'role_id'
        'email': email,
        'phone': phone,
        'is_staff': is_staff,
        'is_active': is_active,
        'mobile': mobile,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    result = users_collection.insert_one(user_doc)
    user_doc['_id'] = str(result.inserted_id)
    
    return user_doc
