"""
Permission checking utilities
Verificare permisiuni bazate pe role
"""
from typing import Optional, List
from bson import ObjectId
from .db import get_db


def has_permission(user: dict, permission_slug: str) -> bool:
    """
    Verifică dacă user-ul are o anumită permisiune
    
    Args:
        user: User dict (trebuie să conțină 'role' cu ObjectId sau dict cu 'items')
        permission_slug: Slug-ul permisiunii (ex: 'requests:view:all')
    
    Returns:
        True dacă user-ul are permisiunea, False altfel
    """
    # Sysadmin are acces la tot
    if user.get('role'):
        role = user['role']
        
        # Dacă role e dict (din get_user_from_token)
        if isinstance(role, dict):
            role_slug = role.get('slug')
            if role_slug == 'sysadmin':
                return True
            
            # Check items
            items = role.get('items', [])
            return permission_slug in items
        
        # Dacă role e ObjectId (din DB direct)
        elif isinstance(role, ObjectId):
            db = get_db()
            roles_collection = db['roles']
            role_doc = roles_collection.find_one({'_id': role})
            
            if role_doc:
                if role_doc.get('slug') == 'sysadmin':
                    return True
                
                items = role_doc.get('items', [])
                return permission_slug in items
    
    return False


def has_any_permission(user: dict, permission_slugs: List[str]) -> bool:
    """
    Verifică dacă user-ul are cel puțin una din permisiunile specificate
    
    Args:
        user: User dict
        permission_slugs: Listă de slug-uri de permisiuni
    
    Returns:
        True dacă user-ul are cel puțin o permisiune, False altfel
    """
    for slug in permission_slugs:
        if has_permission(user, slug):
            return True
    return False


def has_all_permissions(user: dict, permission_slugs: List[str]) -> bool:
    """
    Verifică dacă user-ul are toate permisiunile specificate
    
    Args:
        user: User dict
        permission_slugs: Listă de slug-uri de permisiuni
    
    Returns:
        True dacă user-ul are toate permisiunile, False altfel
    """
    for slug in permission_slugs:
        if not has_permission(user, slug):
            return False
    return True


def get_user_permissions(user: dict) -> List[str]:
    """
    Obține lista de permisiuni ale user-ului
    
    Args:
        user: User dict
    
    Returns:
        Listă de slug-uri de permisiuni
    """
    if user.get('role'):
        role = user['role']
        
        # Dacă role e dict
        if isinstance(role, dict):
            if role.get('slug') == 'sysadmin':
                # Sysadmin are toate permisiunile
                db = get_db()
                roles_items = db['roles_items']
                all_items = list(roles_items.find({}, {'slug': 1}))
                return [item['slug'] for item in all_items]
            
            return role.get('items', [])
        
        # Dacă role e ObjectId
        elif isinstance(role, ObjectId):
            db = get_db()
            roles_collection = db['roles']
            role_doc = roles_collection.find_one({'_id': role})
            
            if role_doc:
                if role_doc.get('slug') == 'sysadmin':
                    # Sysadmin are toate permisiunile
                    roles_items = db['roles_items']
                    all_items = list(roles_items.find({}, {'slug': 1}))
                    return [item['slug'] for item in all_items]
                
                return role_doc.get('items', [])
    
    return []


def can_view_all_requests(user: dict) -> bool:
    """Verifică dacă user-ul poate vedea toate request-urile"""
    return has_permission(user, 'requests:view:all')


def can_view_own_requests(user: dict) -> bool:
    """Verifică dacă user-ul poate vedea propriile request-uri"""
    return has_permission(user, 'requests:view:own')


def can_add_own_requests(user: dict) -> bool:
    """Verifică dacă user-ul poate adăuga propriile request-uri"""
    return has_permission(user, 'requests:add:own')


def can_add_all_requests(user: dict) -> bool:
    """Verifică dacă user-ul poate adăuga request-uri pentru oricine"""
    return has_permission(user, 'requests:add:all')


def can_edit_own_requests(user: dict) -> bool:
    """Verifică dacă user-ul poate edita propriile request-uri"""
    return has_permission(user, 'requests:edit:own')


def can_edit_all_requests(user: dict) -> bool:
    """Verifică dacă user-ul poate edita toate request-urile"""
    return has_permission(user, 'requests:edit:all')


def can_view_dashboard(user: dict) -> bool:
    """Verifică dacă user-ul poate vedea dashboard-ul"""
    return has_permission(user, 'dashboard:view')
