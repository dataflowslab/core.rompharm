"""
InvenTree authentication utilities
"""
import requests
from requests.auth import HTTPBasicAuth
from typing import Optional, Dict
import yaml
import os


def load_config():
    """Load configuration from config.yaml"""
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'config', 'config.yaml')
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def get_inventree_user_info(username: str, password: str) -> Optional[Dict]:
    """
    Authenticate with InvenTree and get user info including token
    
    Args:
        username: InvenTree username
        password: InvenTree password
        
    Returns:
        Dict with token and is_staff if successful, None otherwise
        
    Raises:
        Exception: If connection to InvenTree fails
    """
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    
    # InvenTree uses HTTP Basic Auth to get token via GET request
    token_url = f"{inventree_url}/api/user/token/"
    
    print(f"Attempting to authenticate with InvenTree at: {token_url}")
    
    try:
        response = requests.get(
            token_url,
            auth=HTTPBasicAuth(username, password),
            timeout=10
        )
        
        print(f"InvenTree response status: {response.status_code}")
        print(f"InvenTree response headers: {response.headers}")
        print(f"InvenTree response text (first 500 chars): {response.text[:500]}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                token = data.get('token')
                
                if not token:
                    return None
                
                # Get user details to check if staff
                user_info_url = f"{inventree_url}/api/user/me/"
                user_response = requests.get(
                    user_info_url,
                    headers={'Authorization': f'Token {token}'},
                    timeout=10
                )
                
                is_staff = False
                name = None
                if user_response.status_code == 200:
                    user_data = user_response.json()
                    print(f"User data from InvenTree: {user_data}")
                    is_staff = user_data.get('is_staff', False) or user_data.get('is_superuser', False)
                    
                    # Build full name from first_name and last_name
                    first_name = user_data.get('first_name', '').strip()
                    last_name = user_data.get('last_name', '').strip()
                    if first_name and last_name:
                        name = f"{first_name} {last_name}"
                    elif first_name:
                        name = first_name
                    elif last_name:
                        name = last_name
                    
                    print(f"Determined is_staff: {is_staff} (is_staff={user_data.get('is_staff')}, is_superuser={user_data.get('is_superuser')})")
                    print(f"User name: {name}")
                else:
                    print(f"Failed to get user info: {user_response.status_code} - {user_response.text[:200]}")
                
                return {
                    'token': token,
                    'is_staff': is_staff,
                    'name': name
                }
            except ValueError as e:
                print(f"Failed to parse JSON response: {e}")
                print(f"Response content: {response.text}")
                raise Exception(f"InvenTree returned invalid JSON response. Server might be misconfigured.")
        elif response.status_code == 400:
            # Bad request - invalid credentials
            print(f"Invalid credentials for user: {username}")
            return None
        elif response.status_code == 401:
            # Unauthorized
            print(f"Unauthorized: Invalid credentials for user: {username}")
            return None
        elif response.status_code == 404:
            # Endpoint not found
            print(f"InvenTree endpoint not found: {token_url}")
            raise Exception(f"InvenTree API endpoint not found. Please check InvenTree URL in config: {inventree_url}")
        else:
            # Other error
            print(f"InvenTree returned status {response.status_code}: {response.text[:200]}")
            raise Exception(f"InvenTree server error (status {response.status_code}). Please check InvenTree configuration.")
            
    except requests.exceptions.ConnectionError as e:
        print(f"Cannot connect to InvenTree at {inventree_url}: {e}")
        raise Exception(f"Cannot connect to InvenTree server at {inventree_url}")
    except requests.exceptions.Timeout as e:
        print(f"Timeout connecting to InvenTree: {e}")
        raise Exception("InvenTree server timeout - please try again")
    except Exception as e:
        print(f"Error getting InvenTree token: {e}")
        raise Exception(f"Unexpected error: {str(e)}")


def verify_inventree_token(token: str) -> bool:
    """
    Verify if an InvenTree token is valid
    
    Args:
        token: Token to verify
        
    Returns:
        True if valid, False otherwise
    """
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    
    # Try to access a protected endpoint
    try:
        response = requests.get(
            f"{inventree_url}/api/user/me/",
            headers={'Authorization': f'Token {token}'},
            timeout=10
        )
        
        print(f"Token verification status: {response.status_code}")
        if response.status_code != 200:
            print(f"Token verification failed: {response.text[:200]}")
        
        return response.status_code == 200
    except Exception as e:
        print(f"Error verifying InvenTree token: {e}")
        return False


def get_user_staff_status(token: str) -> Optional[bool]:
    """
    Get user's staff status from InvenTree
    
    Args:
        token: InvenTree token
        
    Returns:
        True if user is staff/superuser, False otherwise, None if error
    """
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    
    try:
        response = requests.get(
            f"{inventree_url}/api/user/me/",
            headers={'Authorization': f'Token {token}'},
            timeout=10
        )
        
        if response.status_code == 200:
            user_data = response.json()
            print(f"Staff status check - User data: {user_data}")
            is_staff = user_data.get('is_staff', False) or user_data.get('is_superuser', False)
            print(f"Staff status: {is_staff}")
            return is_staff
        else:
            print(f"Failed to get staff status: {response.status_code}")
            return None
    except Exception as e:
        print(f"Error getting staff status: {e}")
        return None
