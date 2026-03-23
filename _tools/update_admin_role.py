"""
Update admin role with sections and menu_items template.
"""
import os
import sys
from datetime import datetime
import json
from bson import ObjectId
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from src.backend.utils.db import get_db


def _load_admin_menu() -> list:
    menu_path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            '..',
            'src',
            'frontend',
            'src',
            'config',
            'admin_menu.json'
        )
    )
    if not os.path.exists(menu_path):
        print(f"WARNING: Admin menu template not found at: {menu_path}")
        return []
    try:
        with open(menu_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception as exc:
        print(f"WARNING: Failed to load admin menu template: {exc}")
        return []


def update_admin_role() -> None:
    db = get_db()
    roles_collection = db['roles']

    admin_role = roles_collection.find_one({'slug': 'admin'})
    if not admin_role:
        print("ERROR: Admin role not found.")
        return

    admin_menu = _load_admin_menu()

    update_data = {
        'sections': {'*': ['*']},
        'menu_items': admin_menu,
        'updated_at': datetime.utcnow()
    }

    roles_collection.update_one(
        {'_id': ObjectId(admin_role['_id'])},
        {'$set': update_data}
    )

    print("OK: Admin role updated with sections and menu_items.")


if __name__ == "__main__":
    update_admin_role()
