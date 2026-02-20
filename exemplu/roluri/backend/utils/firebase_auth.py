"""
Firebase Authentication integration
Used when identity_server = 'firebase' in config.yaml
"""
import os
from typing import Dict, Any, Optional

try:
    import firebase_admin
    from firebase_admin import credentials, auth
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("Warning: firebase-admin not installed. Install with: pip install firebase-admin")


_firebase_initialized = False


from .config import load_config


def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    global _firebase_initialized
    
    if _firebase_initialized:
        return
    
    if not FIREBASE_AVAILABLE:
        raise RuntimeError("firebase-admin package not installed")
    
    config = load_config()
    firebase_config = config.get('firebase', {})
    
    admin_sdk_path = firebase_config.get('admin_sdk_json')
    if not admin_sdk_path:
        raise RuntimeError("Firebase admin_sdk_json path not configured in config.yaml")
    
    # Make path absolute if relative
    if not os.path.isabs(admin_sdk_path):
        admin_sdk_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', admin_sdk_path)
    
    if not os.path.exists(admin_sdk_path):
        raise RuntimeError(f"Firebase admin SDK file not found: {admin_sdk_path}")
    
    cred = credentials.Certificate(admin_sdk_path)
    firebase_admin.initialize_app(cred)
    _firebase_initialized = True
    print("Firebase Admin SDK initialized")


def verify_firebase_token(id_token: str) -> Dict[str, Any]:
    """
    Verify Firebase ID token
    Returns decoded token with user info
    """
    if not FIREBASE_AVAILABLE:
        raise RuntimeError("Firebase not available")
    
    if not _firebase_initialized:
        initialize_firebase()
    
    try:
        decoded_token = auth.verify_id_token(id_token)
        return {
            'uid': decoded_token['uid'],
            'email': decoded_token.get('email'),
            'email_verified': decoded_token.get('email_verified', False),
            'name': decoded_token.get('name'),
            'picture': decoded_token.get('picture')
        }
    except Exception as e:
        raise ValueError(f"Invalid Firebase token: {str(e)}")


def get_firebase_user(uid: str) -> Optional[Dict[str, Any]]:
    """
    Get Firebase user by UID
    """
    if not FIREBASE_AVAILABLE:
        raise RuntimeError("Firebase not available")
    
    if not _firebase_initialized:
        initialize_firebase()
    
    try:
        user = auth.get_user(uid)
        return {
            'uid': user.uid,
            'email': user.email,
            'email_verified': user.email_verified,
            'display_name': user.display_name,
            'photo_url': user.photo_url,
            'disabled': user.disabled,
            'created_at': user.user_metadata.creation_timestamp,
            'last_sign_in': user.user_metadata.last_sign_in_timestamp
        }
    except Exception as e:
        print(f"Error getting Firebase user: {e}")
        return None


def create_firebase_user(email: str, password: str, display_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new Firebase user
    """
    if not FIREBASE_AVAILABLE:
        raise RuntimeError("Firebase not available")
    
    if not _firebase_initialized:
        initialize_firebase()
    
    try:
        user = auth.create_user(
            email=email,
            password=password,
            display_name=display_name,
            email_verified=False
        )
        return {
            'uid': user.uid,
            'email': user.email,
            'display_name': user.display_name
        }
    except Exception as e:
        raise ValueError(f"Failed to create Firebase user: {str(e)}")


def update_firebase_user(uid: str, email: Optional[str] = None, password: Optional[str] = None, 
                         display_name: Optional[str] = None, disabled: Optional[bool] = None) -> Dict[str, Any]:
    """
    Update Firebase user
    """
    if not FIREBASE_AVAILABLE:
        raise RuntimeError("Firebase not available")
    
    if not _firebase_initialized:
        initialize_firebase()
    
    try:
        update_data = {}
        if email is not None:
            update_data['email'] = email
        if password is not None:
            update_data['password'] = password
        if display_name is not None:
            update_data['display_name'] = display_name
        if disabled is not None:
            update_data['disabled'] = disabled
        
        user = auth.update_user(uid, **update_data)
        return {
            'uid': user.uid,
            'email': user.email,
            'display_name': user.display_name
        }
    except Exception as e:
        raise ValueError(f"Failed to update Firebase user: {str(e)}")


def delete_firebase_user(uid: str) -> bool:
    """
    Delete Firebase user
    """
    if not FIREBASE_AVAILABLE:
        raise RuntimeError("Firebase not available")
    
    if not _firebase_initialized:
        initialize_firebase()
    
    try:
        auth.delete_user(uid)
        return True
    except Exception as e:
        print(f"Error deleting Firebase user: {e}")
        return False


def list_firebase_users(max_results: int = 1000) -> list:
    """
    List all Firebase users
    """
    if not FIREBASE_AVAILABLE:
        raise RuntimeError("Firebase not available")
    
    if not _firebase_initialized:
        initialize_firebase()
    
    try:
        users = []
        page = auth.list_users(max_results=max_results)
        
        for user in page.users:
            users.append({
                'uid': user.uid,
                'email': user.email,
                'email_verified': user.email_verified,
                'display_name': user.display_name,
                'disabled': user.disabled
            })
        
        return users
    except Exception as e:
        print(f"Error listing Firebase users: {e}")
        return []


def is_firebase_enabled() -> bool:
    """Check if Firebase is enabled in config"""
    try:
        config = load_config()
        identity_config = config.get('identity_server')
        if isinstance(identity_config, dict):
            provider = identity_config.get('provider', 'internal')
        elif isinstance(identity_config, str):
            provider = identity_config
        else:
            provider = 'internal'
        return provider == 'firebase'
    except Exception:
        return False
