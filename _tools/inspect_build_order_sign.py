"""
Inspect build order production signing prerequisites.
"""
import argparse
import os
import sys
from bson import ObjectId

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from src.backend.utils.db import get_db


def _oid(value):
    try:
        return ObjectId(value)
    except Exception:
        return None


def _role_label(db, reference):
    if isinstance(reference, str) and ObjectId.is_valid(reference):
        role = db.roles.find_one({"_id": ObjectId(reference)}, {"slug": 1, "name": 1})
        if role:
            return f"{reference} (slug={role.get('slug')})"
    return str(reference)


def main():
    parser = argparse.ArgumentParser(description="Inspect build order production signing prerequisites.")
    parser.add_argument("--build-order-id", required=True)
    args = parser.parse_args()

    db = get_db()

    build_oid = _oid(args.build_order_id)
    if not build_oid:
        print("Invalid build order id")
        return

    build_order = db.depo_build_orders.find_one({"_id": build_oid})
    if not build_order:
        print("Build order not found")
        return

    product = None
    product_step_id = None
    if build_order.get("product_id"):
        prod_oid = _oid(build_order.get("product_id"))
        if prod_oid:
            product = db.depo_parts.find_one({"_id": prod_oid}, {"name": 1, "ipn": 1, "production_step_id": 1})
            if product and product.get("production_step_id"):
                product_step_id = str(product.get("production_step_id"))

    print("=== Build Order ===")
    print(f"id: {args.build_order_id}")
    print(f"reference: {build_order.get('reference')}")
    print(f"product_id: {build_order.get('product_id')}")
    if product:
        print(f"product: {product.get('name')} ({product.get('ipn')})")
    print(f"product.production_step_id: {product_step_id}")

    flow = db.approval_flows.find_one({
        "object_type": "build_order_production",
        "object_id": args.build_order_id
    })

    print("\n=== Approval Flow (build_order_production) ===")
    if not flow:
        print("Flow not found")
    else:
        print(f"flow_id: {flow.get('_id')}")
        print(f"min_signatures: {flow.get('min_signatures')}")
        print("must_sign_officers:")
        for officer in flow.get("must_sign_officers", []) or []:
            ref = _role_label(db, officer.get("reference"))
            print(f" - type={officer.get('type')} reference={ref} username={officer.get('username')}")
        print("can_sign_officers:")
        for officer in flow.get("can_sign_officers", []) or []:
            ref = _role_label(db, officer.get("reference"))
            print(f" - type={officer.get('type')} reference={ref} username={officer.get('username')}")

    production = db.depo_build_production.find_one({"build_order_id": build_oid})
    print("\n=== Production Series ===")
    if not production:
        print("Production document not found")
    else:
        for serie in production.get("series", []) or []:
            print(f"- batch_code: {serie.get('batch_code')}")
            print(f"  decision_status: {serie.get('decision_status')}")
            print(f"  produced_qty: {serie.get('produced_qty')}")
            print(f"  expiry_date: {serie.get('expiry_date')}")
            print(f"  production_step_id: {serie.get('production_step_id')}")
            print(f"  signatures: {len(serie.get('signatures', []) or [])}")
            print(f"  saved_at: {serie.get('saved_at')}")


if __name__ == "__main__":
    main()
