"""
Section-based permission utilities (sections + menu_items)
"""
from typing import Dict, List, Optional, Callable
from bson import ObjectId
from fastapi import Depends, HTTPException, Request

from src.backend.utils.db import get_db

PUBLIC_SECTIONS = {"dashboard", "notifications"}


def _is_object_id(value: Optional[str]) -> bool:
    if value is None:
        return False
    try:
        return ObjectId.is_valid(str(value))
    except Exception:
        return False


def _normalize_sections(sections: Optional[dict]) -> Dict[str, List[str]]:
    if not isinstance(sections, dict):
        return {}
    normalized: Dict[str, List[str]] = {}
    for key, value in sections.items():
        if key is None:
            continue
        perms: List[str] = []
        if isinstance(value, list):
            perms = [str(x) for x in value if x is not None]
        elif isinstance(value, str):
            perms = [value]
        normalized[str(key)] = perms
    return normalized


def get_role_sections(db, user: dict) -> Dict[str, List[str]]:
    if isinstance(user.get("role_sections"), dict):
        return _normalize_sections(user.get("role_sections"))

    role_value = user.get("role")
    if isinstance(role_value, dict) and isinstance(role_value.get("sections"), dict):
        return _normalize_sections(role_value.get("sections"))

    role_doc = None
    if _is_object_id(role_value):
        try:
            role_doc = db.roles.find_one({"_id": ObjectId(str(role_value))})
        except Exception:
            role_doc = None
    elif isinstance(role_value, str):
        role_doc = db.roles.find_one({"slug": role_value})

    if role_doc and isinstance(role_doc.get("sections"), dict):
        return _normalize_sections(role_doc.get("sections"))

    return {}


def get_role_menu_items(db, user: dict) -> list:
    if isinstance(user.get("role_menu_items"), list):
        return user.get("role_menu_items") or []

    role_value = user.get("role")
    if isinstance(role_value, dict) and isinstance(role_value.get("menu_items"), list):
        return role_value.get("menu_items") or []

    role_doc = None
    if _is_object_id(role_value):
        try:
            role_doc = db.roles.find_one({"_id": ObjectId(str(role_value))})
        except Exception:
            role_doc = None
    elif isinstance(role_value, str):
        role_doc = db.roles.find_one({"slug": role_value})

    if role_doc and isinstance(role_doc.get("menu_items"), list):
        return role_doc.get("menu_items") or []

    return []


def get_section_permissions(db, user: dict, section: str) -> List[str]:
    sections = get_role_sections(db, user)
    if "*" in sections:
        perms = sections.get("*") or []
        return [str(p) for p in perms]
    perms = sections.get(section) or []
    return [str(p) for p in perms]


def _method_to_action(method: str) -> str:
    method = (method or "").upper()
    if method == "GET":
        return "get"
    if method == "POST":
        return "post"
    if method in {"PUT", "PATCH"}:
        return "patch"
    if method == "DELETE":
        return "delete"
    return "get"


def is_action_allowed(perms: List[str], action: str) -> bool:
    action = str(action).lower()
    perms_lower = {str(p).lower() for p in perms}
    if "*" in perms_lower:
        return True
    if action == "get":
        return "get" in perms_lower or "own" in perms_lower or "dep" in perms_lower
    return action in perms_lower


def get_section_scope(perms: List[str]) -> Optional[str]:
    perms_lower = {str(p).lower() for p in perms}
    if "*" in perms_lower:
        return "all"
    if "dep" in perms_lower:
        return "dep"
    if "own" in perms_lower:
        return "own"
    if perms_lower.intersection({"get", "post", "patch", "delete"}):
        return "all"
    return None


def get_department_usernames(db, current_user: dict) -> List[str]:
    locations = current_user.get("locations") or []
    loc_oids = []
    for loc in locations:
        if _is_object_id(loc):
            loc_oids.append(ObjectId(str(loc)))
    if not loc_oids:
        return [current_user.get("username")] if current_user.get("username") else []

    users = list(db.users.find({"locations": {"$in": loc_oids}}, {"username": 1}))
    usernames = [u.get("username") for u in users if u.get("username")]
    if current_user.get("username") and current_user.get("username") not in usernames:
        usernames.append(current_user.get("username"))
    return usernames


def apply_scope_to_query(
    db,
    current_user: dict,
    perms: List[str],
    query: dict,
    created_by_field: str = "created_by"
) -> dict:
    scope = get_section_scope(perms)
    if scope == "all" or scope is None:
        return query
    username = current_user.get("username")
    if scope == "own" and username:
        query[created_by_field] = username
        return query
    if scope == "dep":
        usernames = get_department_usernames(db, current_user)
        if usernames:
            query[created_by_field] = {"$in": usernames}
        return query
    return query


def is_doc_in_scope(
    db,
    current_user: dict,
    perms: List[str],
    doc: dict,
    created_by_field: str = "created_by"
) -> bool:
    scope = get_section_scope(perms)
    if scope == "all" or scope is None:
        return True
    creator = doc.get(created_by_field)
    if not creator:
        return False
    if scope == "own":
        return creator == current_user.get("username")
    if scope == "dep":
        usernames = get_department_usernames(db, current_user)
        return creator in usernames
    return False


def require_section(section: str, action: Optional[str] = None) -> Callable:
    # Local import to avoid circular dependency with routes.auth
    from src.backend.routes.auth import verify_token

    def _dependency(
        request: Request,
        current_user: dict = Depends(verify_token),
        db = Depends(get_db)
    ):
        if section in PUBLIC_SECTIONS:
            return current_user
        perms = get_section_permissions(db, current_user, section)
        required_action = action or _method_to_action(request.method)
        if not is_action_allowed(perms, required_action):
            raise HTTPException(status_code=403, detail="Access denied")
        return current_user

    return _dependency
