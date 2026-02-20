"""
Permission helpers for checking user access to resources
Updated to use new route::methods::scope format
"""
from typing import Dict, Any, List, Optional
from bson import ObjectId
from .permissions import (
    get_user_permissions_from_role,
    check_route_permission,
    get_all_user_permissions
)


def _resolve_role_doc(db, role_id: str) -> Optional[Dict[str, Any]]:
    if not role_id:
        return None
    role_doc = None
    if ObjectId.is_valid(str(role_id)):
        role_doc = db.roles.find_one({'_id': ObjectId(role_id)})
    if not role_doc:
        role_doc = db.roles.find_one({'name': role_id})
    return role_doc


def is_admin_user(user: Dict[str, Any]) -> bool:
    """
    Check if user has administrator role.
    Access control is role-based only.
    """
    role_id = user.get('role') or user.get('local_role')
    if not role_id:
        return False

    from utils.db import get_db
    db = get_db(domain=user.get('domain'))
    try:
        role_doc = _resolve_role_doc(db, role_id)
    except Exception:
        role_doc = None

    if not role_doc:
        return False

    role_name = str(role_doc.get('name', '')).strip().lower()
    if role_name in ['admin', 'administrator']:
        return True
    if role_doc.get('is_admin') is True:
        return True
    if role_doc.get('full_access') is True:
        return True
    return False


def has_permission(user: Dict[str, Any], section: str, permission: str) -> bool:
    """
    Check if user has specific permission for a section
    
    Args:
        user: User dict with role information
        section: Section path (e.g., 'procurement/referate')
        permission: Permission to check (VIEW, ADD, EDIT, DELETE, OWNDATA, DEPDATA)
    
    Returns:
        bool: True if user has permission
    """
    # Admin has all permissions
    if is_admin_user(user):
        return True
    
    # Get user's role
    role = user.get('role') or user.get('local_role')
    if not role:
        return False
    
    # Get role permissions from database
    from utils.db import get_db
    db = get_db(domain=user.get('domain'))
    
    try:
        role_doc = db.roles.find_one({'_id': ObjectId(role)})
        if not role_doc:
            return False
        
        sections = role_doc.get('sections', {})
        if section not in sections:
            return False
        
        permissions = sections[section]
        return permission in permissions
    except:
        return False


def get_user_permissions(user: Dict[str, Any], section: str) -> List[str]:
    """
    Get all permissions for a user in a specific section
    Supports both old (list) and new (dict) sections format
    
    Args:
        user: User dict with role information
        section: Section path (e.g., 'procurement/referate')
    
    Returns:
        List[str]: List of permissions (VIEW, ADD, EDIT, DELETE, OWNDATA, DEPDATA)
    """
    # Admin has all permissions
    if is_admin_user(user):
        return ['VIEW', 'ADD', 'EDIT', 'DELETE', 'OWNDATA', 'DEPDATA']

    # Get user's role
    role = user.get('role') or user.get('local_role')
    if not role:
        return []
    
    # Get role permissions from database
    from utils.db import get_db
    db = get_db(domain=user.get('domain'))
    
    try:
        role_doc = _resolve_role_doc(db, role)
        if not role_doc:
            return []

        role_name = str(role_doc.get('name', '')).lower()
        if role_name in ['admin', 'administrator']:
            return ['VIEW', 'ADD', 'EDIT', 'DELETE', 'OWNDATA', 'DEPDATA']
        
        sections = role_doc.get('sections', {})
        
        # NEW FORMAT (dict): {'procurement/referate': ['VIEW', 'ADD', ...]}
        if isinstance(sections, dict):
            return sections.get(section, [])
        
        # OLD FORMAT (list): [{'id': 'procurement', 'permissions': ['procurement/referate::VIEW', ...]}]
        elif isinstance(sections, list):
            # Search for section in list format
            for section_obj in sections:
                if isinstance(section_obj, dict):
                    section_id = section_obj.get('id', '')
                    permissions_list = section_obj.get('permissions', [])
                    
                    # Check if any permission matches our section
                    perms = []
                    for perm in permissions_list:
                        # Format: "procurement/referate::VIEW" or "procurement/_::*"
                        if perm.startswith(section + '::'):
                            # Extract permission type
                            perm_type = perm.split('::')[1]
                            if perm_type == '*':
                                perms = ['VIEW', 'ADD', 'EDIT', 'DELETE']
                            else:
                                perms.append(perm_type)
                        elif perm == section + '/_::*':
                            perms = ['VIEW', 'ADD', 'EDIT', 'DELETE']
                    
                    if perms:
                        return perms
            
            return []
        
        return []
    except:
        return []


def build_query_filter(user: Dict[str, Any], section: str, base_query: Optional[Dict] = None) -> Dict:
    """
    Build MongoDB query filter based on user permissions
    
    Args:
        user: User dict with role and deps information
        section: Section path (e.g., 'procurement/referate')
        base_query: Base query to extend (optional)
    
    Returns:
        Dict: MongoDB query filter
    """
    query = base_query.copy() if base_query else {}
    
    # Admin sees everything
    if is_admin_user(user):
        return query
    
    permissions = get_user_permissions(user, section)
    
    # If user has DEPDATA, filter by department
    if 'DEPDATA' in permissions:
        user_deps = user.get('deps', [])
        if user_deps:
            # User sees documents from their departments
            query['$or'] = [
                {'user_id': str(user.get('_id', ''))},  # Own documents
                {'departament_id': {'$in': user_deps}},  # Department documents
                {'dept_id': {'$in': user_deps}},  # Alternative field name
            ]
        else:
            # No departments assigned, only own data
            query['user_id'] = str(user.get('_id', ''))
    
    # If user has only OWNDATA, filter by user_id
    elif 'OWNDATA' in permissions:
        query['user_id'] = str(user.get('_id', ''))
    
    # If user has VIEW but no OWNDATA/DEPDATA, they can see all
    # (This is for roles that should see everything but not edit)
    
    return query


def can_access_document(user: Dict[str, Any], section: str, document: Dict[str, Any]) -> bool:
    """
    Check if user can access a specific document
    
    Args:
        user: User dict with role and deps information
        section: Section path (e.g., 'procurement/referate')
        document: Document to check access for
    
    Returns:
        bool: True if user can access document
    """
    # Admin can access everything
    if is_admin_user(user):
        return True
    
    permissions = get_user_permissions(user, section)
    
    # No VIEW permission
    if 'VIEW' not in permissions:
        return False
    
    # If user has DEPDATA, check department
    if 'DEPDATA' in permissions:
        user_deps = user.get('deps', [])
        doc_dept = document.get('departament_id') or document.get('dept_id')
        doc_user_id = document.get('user_id')
        
        # Can access if it's their document or from their department
        if doc_user_id == str(user.get('_id', '')):
            return True
        if doc_dept and doc_dept in user_deps:
            return True
        return False
    
    # If user has only OWNDATA, check user_id
    if 'OWNDATA' in permissions:
        return document.get('user_id') == str(user.get('_id', ''))
    
    # If user has VIEW but no OWNDATA/DEPDATA, they can see all
    return True


def can_edit_document(user: Dict[str, Any], section: str, document: Dict[str, Any]) -> bool:
    """
    Check if user can edit a specific document
    
    Args:
        user: User dict with role and deps information
        section: Section path (e.g., 'procurement/referate')
        document: Document to check edit access for
    
    Returns:
        bool: True if user can edit document
    """
    # Admin can edit everything
    if is_admin_user(user):
        return True
    
    permissions = get_user_permissions(user, section)
    
    # No EDIT permission
    if 'EDIT' not in permissions:
        return False
    
    # Check if user can access the document first
    if not can_access_document(user, section, document):
        return False
    
    return True


def can_delete_document(user: Dict[str, Any], section: str, document: Dict[str, Any]) -> bool:
    """
    Check if user can delete a specific document
    
    Args:
        user: User dict with role and deps information
        section: Section path (e.g., 'procurement/referate')
        document: Document to check delete access for
    
    Returns:
        bool: True if user can delete document
    """
    # Admin can delete everything
    if is_admin_user(user):
        return True
    
    permissions = get_user_permissions(user, section)
    
    # No DELETE permission
    if 'DELETE' not in permissions:
        return False
    
    # Check if user can access the document first
    if not can_access_document(user, section, document):
        return False
    
    return True
