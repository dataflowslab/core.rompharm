"""
Permission checking utilities with support for route::methods::scope format
Adapted from model/backend to work with our procurement system
"""
from typing import Dict, Any, Optional, List
from fastapi import HTTPException


def parse_permission(permission: str) -> Dict[str, Any]:
    """
    Parse permission string into components
    
    Format: route::methods or route::methods::scope
    Examples:
        - "procurement/referate/_::*" -> route="procurement/referate/_", methods=["*"], scope=None
        - "procurement/referate/_::GET,POST" -> route="procurement/referate/_", methods=["GET", "POST"], scope=None
        - "dashboard/_::*" -> route="dashboard/_", methods=["*"], scope=None
    
    Args:
        permission: Permission string
        
    Returns:
        Dict with 'route', 'methods', and 'scope' keys
    """
    parts = permission.split("::")
    
    if len(parts) < 2:
        # Handle old format or invalid format
        return {
            "route": permission,
            "methods": ["*"],
            "scope": None
        }
    
    route = parts[0]
    methods_str = parts[1]
    scope = parts[2] if len(parts) >= 3 else None
    
    # Parse methods
    if methods_str == "*":
        methods = ["*"]
    else:
        methods = [m.strip().upper() for m in methods_str.split(",")]
    
    return {
        "route": route,
        "methods": methods,
        "scope": scope
    }


def route_matches(route: str, pattern: str) -> bool:
    """
    Check if a route matches a permission pattern
    
    Args:
        route: Actual route (e.g., "procurement/referate", "admin/users")
        pattern: Permission pattern (e.g., "procurement/_", "procurement/referate/_")
        
    Returns:
        True if route matches pattern
    """
    # Exact match
    if route == pattern:
        return True
    
    # Wildcard match: "procurement/_" matches "procurement/anything"
    if pattern.endswith("/_"):
        prefix = pattern[:-2]  # Remove "/_"
        if route == prefix or route.startswith(prefix + "/"):
            return True
    
    # Wildcard match: "procurement/referate/_" matches "procurement/referate" and "procurement/referate/anything"
    if "/_" in pattern:
        prefix = pattern.replace("/_", "")
        if route == prefix or route.startswith(prefix + "/") or route.startswith(prefix):
            return True
    
    return False


def check_route_permission(
    user_permissions: List[str],
    required_route: str,
    required_method: str = "GET"
) -> Optional[str]:
    """
    Check if user has permission for a specific route and method
    
    Args:
        user_permissions: List of permission strings from user's role sections
        required_route: Route to check (e.g., "procurement/referate", "admin/users")
        required_method: HTTP method (GET, POST, PUT, DELETE, PATCH)
        
    Returns:
        Scope if permission granted ("own", "all", or empty string for full access)
        None if permission denied
    """
    required_method = required_method.upper()
    
    for permission in user_permissions:
        try:
            parsed = parse_permission(permission)
            route_pattern = parsed["route"]
            allowed_methods = parsed["methods"]
            scope = parsed["scope"]
            
            # Check if route matches
            if not route_matches(required_route, route_pattern):
                continue
            
            # Check if method matches
            if "*" not in allowed_methods and required_method not in allowed_methods:
                continue
            
            # Permission granted - return scope (use "all" for None to distinguish from "no permission")
            return scope if scope else "all"
            
        except (ValueError, IndexError):
            # Skip invalid permissions
            continue
    
    # No matching permission found
    return None


def get_user_permissions_from_role(role_doc: Dict[str, Any], section: str) -> List[str]:
    """
    Extract permissions for a specific section from role document
    
    Args:
        role_doc: Role document from MongoDB
        section: Section ID to get permissions for (e.g., "procurement/referate")
        
    Returns:
        List of permission strings for that section
    """
    sections = role_doc.get('sections', [])
    
    if not isinstance(sections, list):
        return []
    
    for section_obj in sections:
        if isinstance(section_obj, dict):
            if section_obj.get('id') == section:
                return section_obj.get('permissions', [])
    
    return []


def verify_route_access(
    user_permissions: List[str],
    route: str,
    method: str = "GET"
) -> bool:
    """
    Verify if user has permission to access a route
    
    Args:
        user_permissions: List of permission strings from user's role
        route: Route being accessed
        method: HTTP method
        
    Returns:
        True if access granted
        
    Raises:
        HTTPException: If access denied
    """
    scope = check_route_permission(user_permissions, route, method)
    
    if scope is None:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: No permission for {method} {route}"
        )
    
    return True


def build_query_with_scope(
    base_query: Dict[str, Any],
    user_id: str,
    user_deps: List[str],
    scope: Optional[str]
) -> Dict[str, Any]:
    """
    Apply scope filter to MongoDB query
    
    Args:
        base_query: Original MongoDB query
        user_id: Current user's ID
        user_deps: User's departments
        scope: Permission scope ("own", "dep", "all", or None)
        
    Returns:
        Modified query with scope filter
    """
    query = base_query.copy()
    
    if scope == "own":
        # User can only see their own documents
        query['user_id'] = user_id
    elif scope == "dep":
        # User can see documents from their departments + own
        if user_deps:
            query['$or'] = [
                {'user_id': user_id},
                {'departament': {'$in': user_deps}},
                {'dept_id': {'$in': user_deps}}
            ]
        else:
            # No departments, only own
            query['user_id'] = user_id
    # else: scope is "all" or None - no filter needed
    
    return query


def check_document_access(
    document: Dict[str, Any],
    user_id: str,
    user_deps: List[str],
    scope: Optional[str]
) -> bool:
    """
    Check if user can access a specific document based on scope
    
    Args:
        document: MongoDB document
        user_id: Current user's ID
        user_deps: User's departments
        scope: Permission scope ("own", "dep", "all", or None)
        
    Returns:
        True if user has access, False otherwise
    """
    if scope == "own":
        # Check if user created this document
        return document.get('user_id') == user_id or document.get('created_by') == user_id
    elif scope == "dep":
        # Check if document is from user's department or created by user
        doc_dept = document.get('departament') or document.get('dept_id') or document.get('departament_id')
        doc_user = document.get('user_id') or document.get('created_by')
        
        if doc_user == user_id:
            return True
        if doc_dept and doc_dept in user_deps:
            return True
        return False
    
    # scope is "all" or None - full access
    return True


def get_all_user_permissions(role_doc: Dict[str, Any]) -> List[str]:
    """
    Get all permissions from a role document
    
    Args:
        role_doc: Role document from MongoDB
        
    Returns:
        List of all permission strings
    """
    sections = role_doc.get('sections', [])
    all_permissions = []
    
    if isinstance(sections, list):
        for section_obj in sections:
            if isinstance(section_obj, dict):
                permissions = section_obj.get('permissions', [])
                all_permissions.extend(permissions)
            elif isinstance(section_obj, str):
                # Handle string permissions (like "my-submissions/_::*")
                all_permissions.append(section_obj)
    
    return all_permissions
