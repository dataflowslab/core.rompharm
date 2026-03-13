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
        
        if officer["type"] == "person":
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
    
    for officer in all_officers:
        if officer["type"] == "person" and officer["reference"] == user_id:
            return True
        
        elif officer["type"] == "role" and user_role_id:
            role_reference = officer["reference"]

            # reference is role id (preferred)
            if _is_object_id(role_reference):
                if str(user_role_id) == str(role_reference):
                    return True

            # reference is role slug (legacy)
            role = db.roles.find_one({"_id": ObjectId(user_role_id)})
            if role and role.get("slug") == role_reference:
                return True
    
    return False
