"""
Normalize approval officers references to ObjectId strings.
Applies to approval_templates.officers and approval_flows officers lists.
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
from src.backend.utils.approval_helpers import normalize_officers


def _is_oid(value) -> bool:
    try:
        return ObjectId.is_valid(str(value))
    except Exception:
        return False


def _normalize_officers_list(db, officers, label: str, field: str):
    original = officers or []
    sanitized = []
    for officer in original:
        if not isinstance(officer, dict):
            sanitized.append(officer)
            continue
        updated = officer.copy()
        officer_type = (updated.get("type") or "").strip().lower()
        if officer_type == "role":
            ref = updated.get("reference")
            if isinstance(ref, str):
                cleaned = ref.strip().strip(",").strip()
                if cleaned != ref:
                    updated["reference"] = cleaned
        sanitized.append(updated)

    normalized = normalize_officers(db, sanitized)
    changed = normalized != original

    issues = []
    for idx, officer in enumerate(normalized):
        if not isinstance(officer, dict):
            continue
        officer_type = (officer.get("type") or "").strip().lower()
        reference = officer.get("reference")
        if officer_type in {"person", "user", "role"}:
            if reference is None or not _is_oid(reference):
                issues.append(f"{label}.{field}[{idx}] unresolved reference: {reference}")
    return normalized, changed, issues


def _process_templates(db, apply: bool):
    templates = list(db.approval_templates.find({}))
    updated = 0
    issues = []

    for template in templates:
        template_id = str(template.get("_id"))
        officers = template.get("officers", [])
        normalized, changed, template_issues = _normalize_officers_list(
            db, officers, f"template:{template_id}", "officers"
        )
        issues.extend(template_issues)

        if changed:
            updated += 1
            if apply:
                db.approval_templates.update_one(
                    {"_id": ObjectId(template_id)},
                    {"$set": {
                        "officers": normalized,
                        "updated_at": datetime.utcnow()
                    }}
                )

    return len(templates), updated, issues


def _process_flows(db, apply: bool):
    flows = list(db.approval_flows.find({}))
    updated = 0
    issues = []
    fields = ["can_sign_officers", "must_sign_officers", "required_officers", "optional_officers"]

    for flow in flows:
        flow_id = str(flow.get("_id"))
        update_data = {}
        flow_issues = []

        for field in fields:
            if field not in flow:
                continue
            if not isinstance(flow.get(field), list):
                continue
            normalized, changed, field_issues = _normalize_officers_list(
                db, flow.get(field), f"flow:{flow_id}", field
            )
            flow_issues.extend(field_issues)
            if changed:
                update_data[field] = normalized

        if update_data:
            updated += 1
            update_data["updated_at"] = datetime.utcnow()
            if apply:
                db.approval_flows.update_one(
                    {"_id": ObjectId(flow_id)},
                    {"$set": update_data}
                )

        issues.extend(flow_issues)

    return len(flows), updated, issues


def main():
    parser = argparse.ArgumentParser(description="Normalize approval officers references to ObjectId strings.")
    parser.add_argument("--apply", action="store_true", help="Apply updates to the database.")
    parser.add_argument("--only", choices=["templates", "flows", "all"], default="all")
    args = parser.parse_args()

    db = get_db()

    total_templates = updated_templates = 0
    total_flows = updated_flows = 0
    all_issues = []

    if args.only in {"templates", "all"}:
        total_templates, updated_templates, issues = _process_templates(db, args.apply)
        all_issues.extend(issues)

    if args.only in {"flows", "all"}:
        total_flows, updated_flows, issues = _process_flows(db, args.apply)
        all_issues.extend(issues)

    print("=== Normalize Approval Officers ===")
    print(f"Templates scanned: {total_templates}, updated: {updated_templates}")
    print(f"Flows scanned: {total_flows}, updated: {updated_flows}")

    if all_issues:
        print("\nUnresolved references:")
        for issue in all_issues:
            print(f"- {issue}")
    else:
        print("\nNo unresolved references found.")

    if not args.apply:
        print("\nDry-run complete. Re-run with --apply to update the database.")


if __name__ == "__main__":
    main()
