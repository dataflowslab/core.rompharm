import argparse
import os
import sys
from datetime import datetime

from bson import ObjectId

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT_DIR)

from src.backend.utils.db import get_db


def _now():
    return datetime.utcnow()


def _build_admin_menu():
    return [
        {"id": "dashboard", "label": "Dashboard", "icon": "IconDashboard", "path": "/dashboard", "order": 1},
        {"id": "requests", "label": "Requests", "icon": "IconClipboardList", "path": "/requests", "order": 2},
        {"id": "recipes", "label": "Recipes", "icon": "IconChefHat", "path": "/recipes", "order": 3},
        {"id": "build-orders", "label": "Build orders", "icon": "IconBox", "path": "/build-orders", "order": 4},
        {"id": "build-simulation", "label": "Build simulation", "icon": "IconArrowsExchange", "path": "/build-simulation", "order": 5},
        {"id": "stocks", "label": "Stocks", "icon": "IconStack2", "path": "/inventory/stocks", "order": 6},
        {
            "id": "inventory",
            "label": "Inventory",
            "icon": "IconPackage",
            "path": "/inventory",
            "order": 7,
            "submenu": [
                {"id": "inventory_articles", "label": "Articles", "path": "/inventory/articles", "icon": "IconPackage", "order": 1},
                {"id": "inventory_suppliers", "label": "Suppliers", "path": "/inventory/suppliers", "icon": "IconShoppingCart", "order": 2},
                {"id": "inventory_manufacturers", "label": "Manufacturers", "path": "/inventory/manufacturers", "icon": "IconPackage", "order": 3},
                {"id": "inventory_clients", "label": "Clients", "path": "/inventory/clients", "icon": "IconUsers", "order": 4},
                {"id": "inventory_locations", "label": "Locations", "path": "/inventory/locations", "icon": "IconBox", "order": 5},
                {"id": "inventory_categories", "label": "Categories", "path": "/inventory/categories", "icon": "IconFileText", "order": 6},
            ],
        },
        {"id": "procurement", "label": "Procurement", "icon": "IconShoppingCart", "path": "/procurement", "order": 8},
        {"id": "sales", "label": "Sales", "icon": "IconTruckDelivery", "path": "/sales", "order": 9},
        {"id": "returns", "label": "Returns", "icon": "IconArrowsExchange", "path": "/returns", "order": 10},
        {"id": "withdrawals", "label": "Withdrawals", "icon": "IconBox", "path": "/withdrawals", "order": 11},
        {"id": "deliveries", "label": "Deliveries", "icon": "IconTruckDelivery", "path": "/deliveries", "order": 12},
        {"id": "notifications", "label": "Notifications", "icon": "IconBell", "path": "/notifications", "order": 13},
        {"id": "users", "label": "Users", "icon": "IconUsers", "path": "/users", "order": 14},
        {"id": "roles", "label": "Roles", "icon": "IconShieldLock", "path": "/roles", "order": 15},
        {"id": "audit", "label": "Audit Log", "icon": "IconFileText", "path": "/audit", "order": 16},
    ]


def _build_section_chief_menu():
    return [
        {"id": "requests", "label": "Requests", "icon": "IconClipboardList", "path": "/requests", "order": 1},
        {"id": "build-orders", "label": "Build orders", "icon": "IconBox", "path": "/build-orders", "order": 2},
        {"id": "stocks", "label": "Stocks", "icon": "IconStack2", "path": "/inventory/stocks", "order": 3},
    ]


def _upsert_role(db, slug, name, sections, menu_items, apply_changes: bool):
    role = db.roles.find_one({"slug": slug})
    payload = {
        "slug": slug,
        "name": name,
        "sections": sections,
        "menu_items": menu_items,
        "updated_at": _now(),
    }

    if not apply_changes:
        print(f"[DRY RUN] Would upsert role '{slug}' with sections and menu_items.")
        return

    if role:
        db.roles.update_one({"_id": role["_id"]}, {"$set": payload})
        print(f"Updated role '{slug}' ({role['_id']})")
        return

    payload["created_at"] = _now()
    result = db.roles.insert_one(payload)
    print(f"Inserted role '{slug}' ({result.inserted_id})")


def main():
    parser = argparse.ArgumentParser(description="Migrate roles to sections/menu_items")
    parser.add_argument("--apply", action="store_true", help="Apply changes to database")
    args = parser.parse_args()

    db = get_db()

    admin_sections = {"*": ["*"]}
    section_chief_sections = {
        "requests": ["get", "post", "patch", "delete", "dep"],
        "build-orders": ["get", "post", "patch", "delete", "dep"],
        "inventory/stocks": ["get"],
    }

    _upsert_role(
        db=db,
        slug="admin",
        name="Admin",
        sections=admin_sections,
        menu_items=_build_admin_menu(),
        apply_changes=args.apply,
    )

    _upsert_role(
        db=db,
        slug="section-chief",
        name="Section chief",
        sections=section_chief_sections,
        menu_items=_build_section_chief_menu(),
        apply_changes=args.apply,
    )

    if not args.apply:
        print("Dry run complete. Re-run with --apply to update the database.")


if __name__ == "__main__":
    main()
