"""
Normalize users.role and users.local_role to ObjectId strings.
"""
import argparse
import os
import sys
from datetime import datetime
from bson import ObjectId

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from src.backend.utils.db import get_db


def _is_oid(value) -> bool:
    try:
        return ObjectId.is_valid(str(value))
    except Exception:
        return False


def _normalize_role_field(db, value):
    if value is None:
        return None
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        if "$oid" in value and _is_oid(value.get("$oid")):
            return str(value.get("$oid"))
        if "_id" in value and _is_oid(value.get("_id")):
            return str(value.get("_id"))
    if isinstance(value, str):
        if _is_oid(value):
            return str(value)
        role = db.roles.find_one({"slug": value})
        if role and role.get("_id"):
            return str(role.get("_id"))
    return value


def main():
    parser = argparse.ArgumentParser(description="Normalize users.role and users.local_role to ObjectId strings.")
    parser.add_argument("--apply", action="store_true", help="Apply updates to the database.")
    args = parser.parse_args()

    db = get_db()
    users = list(db.users.find({}))
    updated = 0
    unresolved = []

    for user in users:
        user_id = str(user.get("_id"))
        update_data = {}

        for field in ["role", "local_role"]:
            if field in user:
                normalized = _normalize_role_field(db, user.get(field))
                if normalized != user.get(field):
                    update_data[field] = normalized
                if isinstance(normalized, str) and not _is_oid(normalized):
                    unresolved.append(f"user:{user_id}.{field} unresolved: {normalized}")

        if update_data:
            updated += 1
            update_data["updated_at"] = datetime.utcnow()
            if args.apply:
                db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})

    print("=== Normalize User Roles ===")
    print(f"Users scanned: {len(users)}, updated: {updated}")

    if unresolved:
        print("\nUnresolved role references:")
        for item in unresolved:
            print(f"- {item}")
    else:
        print("\nNo unresolved role references found.")

    if not args.apply:
        print("\nDry-run complete. Re-run with --apply to update the database.")


if __name__ == "__main__":
    main()
