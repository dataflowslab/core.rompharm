"""
Global approval flow helpers
Reusable functions for approval flow logic across all modules
"""
from bson import ObjectId
from typing import List, Dict, Any


def _is_object_id(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return ObjectId.is_valid(value)
    except Exception:
        return False


def _normalize_officer_type(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"user", "person"}:
        return "person"
    if raw == "role":
        return "role"
    return raw or "person"


def _extract_oid(value: Any) -> str | None:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        if "$oid" in value and _is_object_id(value.get("$oid")):
            return str(value.get("$oid"))
        if "_id" in value and _is_object_id(value.get("_id")):
            return str(value.get("_id"))
    if isinstance(value, str) and _is_object_id(value):
        return str(value)
    return None


def normalize_officers(db, officers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Normalize officers list:
    - type: "person" or "role"
    - reference: always ObjectId string (user_id or role_id)
    """
    normalized: List[Dict[str, Any]] = []
    for officer in officers or []:
        if not isinstance(officer, dict):
            normalized.append(officer)
            continue

        current_type = _normalize_officer_type(officer.get("type"))
        reference = officer.get("reference")

        normalized_officer = officer.copy()
        normalized_officer["type"] = current_type

        ref_oid = _extract_oid(reference)
        if ref_oid:
            normalized_officer["reference"] = ref_oid
            normalized.append(normalized_officer)
            continue

        if current_type == "role" and isinstance(reference, str):
            role = db.roles.find_one({"slug": reference})
            if role and role.get("_id"):
                normalized_officer["reference"] = str(role.get("_id"))
        elif current_type == "person" and isinstance(reference, str):
            user = db.users.find_one({"username": reference})
            if not user and "@" in reference:
                user = db.users.find_one({"email": reference})
            if user and user.get("_id"):
                normalized_officer["reference"] = str(user.get("_id"))

        normalized.append(normalized_officer)

    return normalized


def check_approval_completion(
    db,
    required_officers: List[Dict[str, Any]],
    signatures: List[Dict[str, Any]]
) -> tuple[bool, int, int]:
    """
    Check if all required officers have signed
    
    Supports both "person" and "role" type officers:
    - person: Checks if specific user_id has signed
    - role: Checks if ANY user with that role has signed
    
    Args:
        db: MongoDB database connection
        required_officers: List of required officers (type, reference, action)
        signatures: List of signatures (user_id, username, signed_at, etc.)
    
    Returns:
        tuple: (is_complete, signed_count, required_count)
    """
    required_signed = 0
    required_count = len(required_officers)
    
    for officer in required_officers:
        has_signed = False
        
        if officer["type"] in {"person", "user"}:
            # Check if this specific person has signed
            if any(s["user_id"] == officer["reference"] for s in signatures):
                has_signed = True
        
        elif officer["type"] == "role":
            # Check if anyone with this role has signed
            role_reference = officer["reference"]

            if _is_object_id(role_reference):
                # reference is role id (preferred)
                role_id = str(role_reference)
                for sig in signatures:
                    user = db.users.find_one({"_id": ObjectId(sig["user_id"])})
                    if user:
                        user_role = user.get("role") or user.get("local_role")
                        if user_role is not None and str(user_role) == role_id:
                            has_signed = True
                            break
            else:
                # reference is role slug (legacy)
                role_slug = role_reference
                role = db.roles.find_one({"slug": role_slug})
                if role:
                    role_id = str(role["_id"])
                    # Check if any signature is from a user with this role
                    for sig in signatures:
                        user = db.users.find_one({"_id": ObjectId(sig["user_id"])})
                        if user:
                            user_role = user.get("role") or user.get("local_role")
                            if user_role is not None and str(user_role) == role_id:
                                has_signed = True
                                break
        
        if has_signed:
            required_signed += 1
    
    is_complete = required_signed == required_count
    return is_complete, required_signed, required_count


def check_user_can_sign(
    db,
    user_id: str,
    user_role_id: str,
    required_officers: List[Dict[str, Any]],
    optional_officers: List[Dict[str, Any]] = None
) -> bool:
    """
    Check if user is authorized to sign based on officers lists
    
    Args:
        db: MongoDB database connection
        user_id: User's ID (string)
        user_role_id: User's role ID (string, already normalized)
        required_officers: List of required officers
        optional_officers: List of optional officers (can be None)
    
    Returns:
        bool: True if user can sign, False otherwise
    """
    all_officers = required_officers.copy()
    if optional_officers:
        all_officers.extend(optional_officers)

    user_role_slug = None
    user_username = None
    try:
        user_doc = db.users.find_one({"_id": ObjectId(user_id)})
        if user_doc:
            user_username = user_doc.get("username")
            role_value = user_doc.get("role") or user_doc.get("local_role")
            if role_value:
                if _is_object_id(role_value):
                    role_doc = db.roles.find_one({"_id": ObjectId(role_value)})
                    if role_doc:
                        user_role_slug = role_doc.get("slug")
                else:
                    user_role_slug = str(role_value)
    except Exception:
        pass

    if not user_role_slug and user_role_id and not _is_object_id(user_role_id):
        user_role_slug = str(user_role_id)
    
    for officer in all_officers:
        if officer["type"] in {"person", "user"} and officer["reference"] == user_id:
            return True
        if officer["type"] in {"person", "user"}:
            officer_username = officer.get("username")
            if officer_username and user_username and officer_username == user_username:
                return True
        
        elif officer["type"] == "role":
            role_reference = officer["reference"]

            # reference is role id (preferred)
            if _is_object_id(role_reference):
                if user_role_id and str(user_role_id) == str(role_reference):
                    return True

            # reference is role slug (legacy)
            role_slug = str(role_reference).strip().lower()
            if user_role_slug and str(user_role_slug).strip().lower() == role_slug:
                return True

            if user_role_id and not _is_object_id(user_role_id):
                if str(user_role_id).strip().lower() == role_slug:
                    return True

            if user_role_id and _is_object_id(user_role_id):
                role = db.roles.find_one({"_id": ObjectId(user_role_id)})
                if role and role.get("slug") == role_reference:
                    return True
    
    return False
