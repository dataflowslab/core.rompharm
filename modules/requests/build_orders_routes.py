"""
Build Orders routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime
from bson import ObjectId
from typing import Optional, Any

from src.backend.utils.db import get_db
from src.backend.utils.sections_permissions import (
    require_section,
    get_section_permissions,
    apply_scope_to_query,
    is_doc_in_scope
)
from src.backend.utils.approval_helpers import check_user_can_sign, normalize_officers
from src.backend.models.approval_flow_model import ApprovalFlowModel

from .build_orders_helpers import normalize_batch_code
from .utils import generate_request_reference


router = APIRouter(prefix="/build-orders", tags=["build-orders"])

DESTROYED_STATE_ID = "694322538728e4d75ae7278c"

CANCELED_TOKENS = [
    'canceled', 'cancelled', 'anulat', 'anulare', 'cancel', 'cancelare'
]

FAILED_TOKENS = [
    'failed', 'fail', 'esuat', 'refuz', 'refused', 'rejected', 'neconform'
]


def _is_canceled_state(state: Optional[dict]) -> bool:
    if not state:
        return False
    name = (state.get('name') or '').lower()
    slug = (state.get('slug') or '').lower()
    label = (state.get('label') or '').lower()
    haystack = f"{name} {slug} {label}"
    return any(token in haystack for token in CANCELED_TOKENS)


def _is_failed_state(state: Optional[dict]) -> bool:
    if not state:
        return False
    name = (state.get('name') or '').lower()
    slug = (state.get('slug') or '').lower()
    label = (state.get('label') or '').lower()
    haystack = f"{name} {slug} {label}"
    return any(token in haystack for token in FAILED_TOKENS) and not _is_canceled_state(state)


def _get_request_state(db, state_id):
    if not state_id:
        return None
    try:
        state_oid = ObjectId(state_id) if isinstance(state_id, str) else state_id
        return db.depo_requests_states.find_one({'_id': state_oid})
    except Exception:
        return None


def _fix_oid(value: Any):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, list):
        return [_fix_oid(v) for v in value]
    if isinstance(value, dict):
        return {k: _fix_oid(v) for k, v in value.items()}
    return value


def _ensure_build_order_scope(db, current_user: dict, build_order: dict) -> None:
    perms = get_section_permissions(db, current_user, "build-orders")
    if not is_doc_in_scope(db, current_user, perms, build_order, created_by_field="created_by"):
        raise HTTPException(status_code=403, detail="Access denied")


def _get_product_step_id(db, build_order: dict) -> Optional[str]:
    product_id = build_order.get("product_id")
    if not product_id:
        return None
    try:
        product_oid = ObjectId(product_id) if isinstance(product_id, str) else product_id
    except Exception:
        return None
    product = db.depo_parts.find_one({"_id": product_oid})
    if not product:
        return None
    step_id = product.get("production_step_id")
    if not step_id:
        return None
    return str(step_id)


def _apply_series_defaults(series: list, default_step_id: Optional[str]):
    for serie in series:
        if default_step_id:
            serie["production_step_id"] = default_step_id
        else:
            if isinstance(serie.get("production_step_id"), ObjectId):
                serie["production_step_id"] = str(serie.get("production_step_id"))
        if "saved_at" in serie and isinstance(serie["saved_at"], datetime):
            serie["saved_at"] = serie["saved_at"].isoformat()
    return series


def _signature_matches_officer(db, signature: dict, officer: dict) -> bool:
    if officer.get("type") == "person":
        return signature.get("user_id") == officer.get("reference")
    if officer.get("type") != "role":
        return False

    role_reference = officer.get("reference")
    role_id = None
    if isinstance(role_reference, str) and ObjectId.is_valid(role_reference):
        role_id = str(role_reference)
    else:
        role = db.roles.find_one({"slug": role_reference})
        if role:
            role_id = str(role.get("_id"))
    if not role_id:
        return False

    try:
        user = db.users.find_one({"_id": ObjectId(signature.get("user_id"))})
    except Exception:
        user = None
    if not user:
        return False
    user_role = user.get("role")
    if not user_role:
        return False
    return str(user_role) == role_id


def _is_serie_completed(db, flow: dict, signatures: list) -> bool:
    if not flow:
        return False
    must_sign = flow.get("must_sign_officers", []) or []
    can_sign = flow.get("can_sign_officers", []) or []
    min_signatures = int(flow.get("min_signatures", 1) or 0)
    if not can_sign:
        min_signatures = 0

    from src.backend.utils.approval_helpers import check_approval_completion
    required_ok, _, _ = check_approval_completion(db, must_sign, signatures)

    optional_count = 0
    for signature in signatures:
        if any(_signature_matches_officer(db, signature, officer) for officer in can_sign):
            optional_count += 1
    has_min = optional_count >= min_signatures

    return required_ok and has_min


def _build_officers_from_template(db, template: dict) -> tuple[list, list]:
    can_sign_officers = []
    must_sign_officers = []
    for officer in template.get("officers", []) or []:
        entry = {
            "type": officer.get("type", "person"),
            "reference": officer.get("reference", ""),
            "username": officer.get("username", ""),
            "action": officer.get("action", "can_sign")
        }
        action = str(entry.get("action") or "can_sign").strip().lower()
        if action == "must_sign":
            must_sign_officers.append(entry)
        else:
            can_sign_officers.append(entry)
    can_sign_officers = normalize_officers(db, can_sign_officers)
    must_sign_officers = normalize_officers(db, must_sign_officers)
    return can_sign_officers, must_sign_officers


def _match_prefix(batch_codes: list, prefix: str) -> bool:
    if not prefix:
        return False
    for code in batch_codes or []:
        _, _, code_prefix = normalize_batch_code(code)
        if code_prefix and code_prefix == prefix:
            return True
    return False


def _get_related_requests(db, prefix: str, open_only: bool = False):
    if not prefix:
        return []
    requests_cursor = db.depo_requests.find(
        {"batch_codes": {"$exists": True, "$ne": []}},
        {
            "reference": 1,
            "batch_codes": 1,
            "state_id": 1,
            "issue_date": 1,
            "created_at": 1,
            "open": 1,
            "items": 1,
            "product_id": 1,
            "recipe_part_id": 1,
            "destination": 1
        }
    )
    results = []
    for req in requests_cursor:
        if open_only and not req.get("open"):
            continue
        if _match_prefix(req.get("batch_codes", []), prefix):
            results.append(req)
    return results


def _build_requests_by_prefix(db, prefixes: set[str]):
    if not prefixes:
        return {}
    requests_cursor = db.depo_requests.find(
        {"batch_codes": {"$exists": True, "$ne": []}},
        {
            "reference": 1,
            "batch_codes": 1,
            "state_id": 1,
            "issue_date": 1,
            "created_at": 1,
            "open": 1
        }
    )
    result_map: dict[str, list] = {prefix: [] for prefix in prefixes}
    for req in requests_cursor:
        for code in req.get("batch_codes", []) or []:
            _, _, code_prefix = normalize_batch_code(code)
            if code_prefix in result_map:
                result_map[code_prefix].append(req)
    return result_map


@router.get("/states")
async def get_build_states(
    current_user: dict = Depends(require_section("build-orders"))
):
    db = get_db()
    states = list(db.depo_build_states.find().sort('order', 1))
    for state in states:
        state["_id"] = str(state["_id"])
    return {"results": states}


@router.get("")
@router.get("/")
async def list_build_orders(
    search: Optional[str] = None,
    state_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(require_section("build-orders"))
):
    db = get_db()
    build_orders_collection = db["depo_build_orders"]

    query = {}
    if state_id:
        try:
            query["state_id"] = ObjectId(state_id)
        except Exception:
            query["state_id"] = state_id

    date_query = None
    if date_from or date_to:
        date_query = {}
        if date_from:
            try:
                date_query["$gte"] = datetime.fromisoformat(f"{date_from}T00:00:00")
            except Exception:
                pass
        if date_to:
            try:
                date_query["$lte"] = datetime.fromisoformat(f"{date_to}T23:59:59")
            except Exception:
                pass
    if date_query:
        query["created_at"] = date_query

    perms = get_section_permissions(db, current_user, "build-orders")
    query = apply_scope_to_query(db, current_user, perms, query, created_by_field="created_by")

    build_orders = list(
        build_orders_collection
        .find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    # Prefetch related entities
    part_ids = set()
    location_ids = set()
    state_ids = set()
    for bo in build_orders:
        if bo.get("product_id"):
            part_ids.add(bo["product_id"])
        if bo.get("location_id"):
            location_ids.add(bo["location_id"])
        if bo.get("state_id"):
            state_ids.add(bo["state_id"])

    parts_map = {}
    if part_ids:
        parts = list(db.depo_parts.find({'_id': {'$in': list(part_ids)}}))
        for part in parts:
            parts_map[str(part["_id"])] = {
                "name": part.get("name", ""),
                "ipn": part.get("ipn", "")
            }

    locations_map = {}
    if location_ids:
        locations = list(db.depo_locations.find({'_id': {'$in': list(location_ids)}}))
        for loc in locations:
            locations_map[str(loc["_id"])] = loc.get("code", str(loc["_id"]))

    states_map = {}
    if state_ids:
        states = list(db.depo_build_states.find({'_id': {'$in': list(state_ids)}}))
        for st in states:
            states_map[str(st["_id"])] = st

    # Build request states map
    request_state_map = {}
    for st in db.depo_requests_states.find({}, {"name": 1}):
        request_state_map[str(st["_id"])] = st.get("name", "Unknown")

    prefixes = set()
    for bo in build_orders:
        prefix = bo.get("batch_prefix") or normalize_batch_code(bo.get("batch_code_text") or bo.get("batch_code"))[2]
        if prefix:
            prefixes.add(prefix)

    requests_by_prefix = _build_requests_by_prefix(db, prefixes)

    results = []
    for bo in build_orders:
        bo = _fix_oid(bo)
        prefix = bo.get("batch_prefix") or normalize_batch_code(bo.get("batch_code_text") or bo.get("batch_code"))[2]
        related_requests = requests_by_prefix.get(prefix, [])

        related_requests_out = []
        for req in related_requests:
            req_id = str(req["_id"])
            state_name = request_state_map.get(str(req.get("state_id")), "Unknown")
            related_requests_out.append({
                "_id": req_id,
                "reference": req.get("reference"),
                "created_at": req.get("created_at").isoformat() if isinstance(req.get("created_at"), datetime) else req.get("created_at"),
                "issue_date": req.get("issue_date").isoformat() if isinstance(req.get("issue_date"), datetime) else req.get("issue_date"),
                "state_name": state_name,
                "open": req.get("open")
            })

        group_codes = bo.get("grup", {}).get("batch_codes") or []
        campaign = len(group_codes) > 1
        product_detail = parts_map.get(str(bo.get("product_id")), {})
        state_detail = states_map.get(str(bo.get("state_id")), {})

        results.append({
            "_id": bo.get("_id"),
            "batch_code": bo.get("batch_code_text") or bo.get("batch_code"),
            "batch_prefix": prefix,
            "location_id": bo.get("location_id"),
            "location_name": locations_map.get(str(bo.get("location_id"))),
            "product_id": bo.get("product_id"),
            "product_name": product_detail.get("name"),
            "product_ipn": product_detail.get("ipn"),
            "state_id": bo.get("state_id"),
            "state_name": state_detail.get("name", "Unknown"),
            "campaign": campaign,
            "created_at": bo.get("created_at"),
            "requests": related_requests_out
        })

    # Search filter (post-join)
    if search:
        term = search.strip().lower()
        if term:
            results = [
                row for row in results
                if (str(row.get("batch_code", "")).lower().find(term) >= 0)
                or (str(row.get("product_name", "")).lower().find(term) >= 0)
                or (str(row.get("product_ipn", "")).lower().find(term) >= 0)
                or (str(row.get("location_name", "")).lower().find(term) >= 0)
            ]

    return {
        "results": results,
        "total": len(results),
        "skip": skip,
        "limit": limit
    }


@router.get("/{build_order_id}")
async def get_build_order(
    build_order_id: str,
    current_user: dict = Depends(require_section("build-orders"))
):
    db = get_db()
    try:
        build_oid = ObjectId(build_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid build order ID")

    build_order = db.depo_build_orders.find_one({"_id": build_oid})
    if not build_order:
        raise HTTPException(status_code=404, detail="Build order not found")

    _ensure_build_order_scope(db, current_user, build_order)

    _ensure_build_order_scope(db, current_user, build_order)

    _ensure_build_order_scope(db, current_user, build_order)

    _ensure_build_order_scope(db, current_user, build_order)

    _ensure_build_order_scope(db, current_user, build_order)

    build_order = _fix_oid(build_order)

    if build_order.get("product_id"):
        product = db.depo_parts.find_one({"_id": ObjectId(build_order["product_id"])})
        if product:
            build_order["product_detail"] = {
                "_id": str(product["_id"]),
                "name": product.get("name"),
                "ipn": product.get("ipn"),
                "description": product.get("description", ""),
                "production_step_id": str(product.get("production_step_id")) if product.get("production_step_id") else None
            }

    if build_order.get("location_id"):
        location = db.depo_locations.find_one({"_id": ObjectId(build_order["location_id"])})
        if location:
            build_order["location_detail"] = {
                "_id": str(location["_id"]),
                "name": location.get("code", str(location["_id"])),
                "code": location.get("code", "")
            }

    if build_order.get("state_id"):
        state = db.depo_build_states.find_one({"_id": ObjectId(build_order["state_id"])})
        if state:
            build_order["state_detail"] = {
                "_id": str(state["_id"]),
                "name": state.get("name", "Unknown"),
                "slug": state.get("slug", "")
            }

    group_codes = build_order.get("grup", {}).get("batch_codes") or []
    build_order["campaign"] = len(group_codes) > 1

    return build_order


@router.patch("/{build_order_id}")
async def update_build_order(
    build_order_id: str,
    request: Request,
    current_user: dict = Depends(require_section("build-orders"))
):
    db = get_db()
    try:
        build_oid = ObjectId(build_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid build order ID")

    build_order = db.depo_build_orders.find_one({"_id": build_oid})
    if not build_order:
        raise HTTPException(status_code=404, detail="Build order not found")

    body = await request.json()
    product_id = body.get("product_id")

    update_doc = {
        "updated_at": datetime.utcnow(),
        "updated_by": current_user.get("username")
    }
    unset_doc = {}

    if product_id:
        try:
            update_doc["product_id"] = ObjectId(product_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid product_id")
    else:
        unset_doc["product_id"] = ""

    update_payload = {"$set": update_doc}
    if unset_doc:
        update_payload["$unset"] = unset_doc

    db.depo_build_orders.update_one({"_id": build_oid}, update_payload)

    return {"success": True}


def _build_materials_from_requests(db, requests_list: list) -> list:
    materials = []
    part_ids = set()

    for req in requests_list:
        for item in req.get("items", []) or []:
            if item.get("part"):
                part_ids.add(item.get("part"))

    part_map = {}
    if part_ids:
        parts = list(db.depo_parts.find({"_id": {"$in": list(part_ids)}}))
        for part in parts:
            part_map[str(part["_id"])] = part.get("name", "")

    for req in requests_list:
        req_id = str(req["_id"])
        req_reference = req.get("reference")
        req_issue_date = req.get("issue_date")
        req_source = req.get("source")
        req_destination = req.get("destination")
        for index, item in enumerate(req.get("items", []) or []):
            part_id = item.get("part")
            part_name = part_map.get(str(part_id), "")
            materials.append({
                "part": str(part_id) if part_id is not None else None,
                "part_name": part_name,
                "batch": item.get("batch_code") or item.get("batch") or "",
                "received_qty": float(item.get("quantity") or 0),
                "used_qty": None,
                "request_id": req_id,
                "request_reference": req_reference,
                "request_issue_date": req_issue_date.isoformat() if isinstance(req_issue_date, datetime) else req_issue_date,
                "request_item_index": index,
                "source_location_id": str(req_source) if req_source is not None else None,
                "destination_location_id": str(req_destination) if req_destination is not None else None
            })
    return materials


def _material_key(material: dict) -> str:
    if material.get("request_id") is not None and material.get("request_item_index") is not None:
        return f"{material.get('request_id')}::{material.get('request_item_index')}"
    return f"{material.get('request_id','')}::{material.get('part','')}::{material.get('batch','')}"


def _build_remaining_materials(db, series: list) -> list:
    totals = {}
    request_ids = set()

    for serie in series or []:
        state = _get_request_state(db, serie.get("decision_status"))
        is_canceled = _is_canceled_state(state)
        for material in serie.get("materials", []) or []:
            key = _material_key(material)
            part_id = material.get("part")
            batch = material.get("batch") or ""
            request_id = material.get("request_id")
            request_item_index = material.get("request_item_index")

            entry = totals.setdefault(key, {
                "key": key,
                "part_id": str(part_id) if part_id is not None else None,
                "part_name": material.get("part_name", ""),
                "batch": batch,
                "request_id": str(request_id) if request_id is not None else None,
                "request_reference": material.get("request_reference"),
                "request_issue_date": material.get("request_issue_date"),
                "request_item_index": request_item_index,
                "source_location_id": material.get("source_location_id"),
                "destination_location_id": material.get("destination_location_id"),
                "total_received": 0.0,
                "total_used": 0.0
            })

            received_qty = float(material.get("received_qty") or 0)
            if received_qty > entry["total_received"]:
                entry["total_received"] = received_qty

            if request_id:
                request_ids.add(str(request_id))

            if not is_canceled:
                entry["total_used"] += float(material.get("used_qty") or 0)

    request_oids = []
    for rid in request_ids:
        try:
            request_oids.append(ObjectId(rid))
        except Exception:
            continue

    request_map = {}
    if request_oids:
        for req in db.depo_requests.find({"_id": {"$in": request_oids}}, {"source": 1, "destination": 1, "reference": 1, "issue_date": 1}):
            request_map[str(req["_id"])] = req

    location_ids = set()

    for entry in totals.values():
        req = request_map.get(entry.get("request_id") or "")
        if req:
            if not entry.get("request_reference"):
                entry["request_reference"] = req.get("reference")
            if not entry.get("request_issue_date"):
                issue_date = req.get("issue_date")
                entry["request_issue_date"] = issue_date.isoformat() if isinstance(issue_date, datetime) else issue_date
            if not entry.get("source_location_id"):
                source = req.get("source")
                entry["source_location_id"] = str(source) if source is not None else None
            if not entry.get("destination_location_id"):
                destination = req.get("destination")
                entry["destination_location_id"] = str(destination) if destination is not None else None

        if entry.get("source_location_id"):
            location_ids.add(entry.get("source_location_id"))

        entry["total_used"] = min(entry["total_used"], entry["total_received"])

    location_map = {}
    if location_ids:
        location_oids = []
        for lid in location_ids:
            try:
                location_oids.append(ObjectId(lid))
            except Exception:
                continue
        if location_oids:
            for loc in db.depo_locations.find({"_id": {"$in": location_oids}}, {"code": 1}):
                location_map[str(loc["_id"])] = loc.get("code") or str(loc["_id"])

    remaining_items = []
    for entry in totals.values():
        remaining_qty = max(0.0, entry["total_received"] - entry["total_used"])
        if remaining_qty <= 0:
            continue
        entry["remaining_qty"] = remaining_qty
        source_id = entry.get("source_location_id")
        if source_id:
            entry["source_location_name"] = location_map.get(source_id, source_id)
        remaining_items.append(entry)

    return remaining_items


def _merge_series_materials(series: list, base_materials: list) -> list:
    base_map = {_material_key(m): m for m in base_materials}
    for serie in series:
        existing = serie.get("materials", []) or []
        existing_map = {}
        for material in existing:
            key = _material_key(material)
            base = base_map.get(key)
            if base:
                for field in [
                    "part_name",
                    "batch",
                    "received_qty",
                    "request_reference",
                    "request_issue_date",
                    "request_id",
                    "request_item_index",
                    "source_location_id",
                    "destination_location_id",
                    "part"
                ]:
                    if material.get(field) in (None, "") and base.get(field) not in (None, ""):
                        material[field] = base.get(field)
            existing_map[key] = material

        merged = list(existing_map.values())
        for key, base in base_map.items():
            if key not in existing_map:
                merged.append(base)
        serie["materials"] = merged
    return series


def _build_series(batch_codes: list, base_materials: list, default_step_id: Optional[str] = None) -> list:
    series = []
    for code in batch_codes:
        series.append({
            "batch_code": code,
            "produced_qty": 0,
            "expiry_date": "",
            "production_step_id": default_step_id or "",
            "decision_status": "",
            "decision_reason": "",
            "signatures": [],
            "saved_at": None,
            "saved_by": None,
            "materials": base_materials
        })
    return series


def _normalize_batch_code_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _get_group_batch_codes(build_order: dict) -> list[str]:
    raw_codes = build_order.get("grup", {}).get("batch_codes") or [
        build_order.get("batch_code_text") or build_order.get("batch_code")
    ]
    cleaned = []
    seen = set()
    for code in raw_codes or []:
        text = _normalize_batch_code_value(code)
        if not text or text in seen:
            continue
        cleaned.append(text)
        seen.add(text)
    return cleaned


def _build_group_build_orders(db, batch_codes: list[str]) -> tuple[list[dict], dict[str, str]]:
    owner_by_code: dict[str, str] = {}
    if not batch_codes:
        return [], owner_by_code

    numeric_codes = []
    for code in batch_codes:
        if str(code).isdigit():
            try:
                numeric_codes.append(int(str(code)))
            except Exception:
                continue

    query_or = [{"batch_code_text": {"$in": batch_codes}}]
    if numeric_codes:
        query_or.append({"batch_code": {"$in": numeric_codes}})

    build_orders = list(db.depo_build_orders.find(
        {"$or": query_or},
        {"_id": 1, "batch_code_text": 1, "batch_code": 1}
    ))

    for bo in build_orders:
        code = _normalize_batch_code_value(bo.get("batch_code_text") or bo.get("batch_code"))
        if not code or code not in batch_codes:
            continue
        if code not in owner_by_code:
            owner_by_code[code] = str(bo["_id"])

    group_build_orders = [
        {"batch_code": code, "build_order_id": owner_by_code.get(code)}
        for code in batch_codes
        if owner_by_code.get(code)
    ]
    return group_build_orders, owner_by_code


def _as_naive_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
    except Exception:
        return None


def _collect_group_series(
    db,
    batch_codes: list[str],
    owner_by_code: dict[str, str],
    base_materials: list,
    default_step_id: Optional[str] = None
) -> tuple[list, list]:
    group_ids = []
    for build_order_id in owner_by_code.values():
        if isinstance(build_order_id, ObjectId):
            group_ids.append(build_order_id)
        elif isinstance(build_order_id, str) and ObjectId.is_valid(build_order_id):
            group_ids.append(ObjectId(build_order_id))

    productions = []
    if group_ids:
        productions = list(db.depo_build_production.find({"build_order_id": {"$in": group_ids}}))

    series_by_code: dict[str, dict] = {}
    rank_by_code: dict[str, tuple] = {}

    for production in productions:
        prod_updated = _as_naive_datetime(production.get("updated_at") or production.get("created_at")) or datetime.min
        prod_build_id = str(production.get("build_order_id"))
        for serie in production.get("series", []) or []:
            code = _normalize_batch_code_value(serie.get("batch_code"))
            if not code or code not in batch_codes:
                continue
            owner_match = 1 if owner_by_code.get(code) == prod_build_id else 0
            saved_at = _as_naive_datetime(serie.get("saved_at"))
            saved_flag = 1 if saved_at else 0
            rank = (owner_match, saved_flag, saved_at or datetime.min, prod_updated)
            if code not in rank_by_code or rank > rank_by_code[code]:
                series_by_code[code] = serie
                rank_by_code[code] = rank

    series = []
    for code in batch_codes:
        serie = series_by_code.get(code)
        if not serie:
            serie = {
                "batch_code": code,
                "produced_qty": 0,
                "expiry_date": "",
                "production_step_id": default_step_id or "",
                "decision_status": "",
                "decision_reason": "",
                "signatures": [],
                "saved_at": None,
                "saved_by": None,
                "materials": base_materials
            }
        series.append(serie)

    series = _merge_series_materials(series, base_materials)
    series = _apply_series_defaults(series, default_step_id)
    series = _fix_oid(series)
    return series, productions


@router.get("/{build_order_id}/production")
async def get_build_order_production(
    build_order_id: str,
    current_user: dict = Depends(require_section("build-orders"))
):
    db = get_db()
    try:
        build_oid = ObjectId(build_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid build order ID")

    build_order = db.depo_build_orders.find_one({"_id": build_oid})
    if not build_order:
        raise HTTPException(status_code=404, detail="Build order not found")

    default_step_id = _get_product_step_id(db, build_order)
    prefix = build_order.get("batch_prefix") or normalize_batch_code(build_order.get("batch_code_text") or build_order.get("batch_code"))[2]

    open_requests = _get_related_requests(db, prefix, open_only=True)
    base_materials = _build_materials_from_requests(db, open_requests)

    batch_codes = _get_group_batch_codes(build_order)
    current_batch_code = _normalize_batch_code_value(build_order.get("batch_code_text") or build_order.get("batch_code"))
    if not current_batch_code and batch_codes:
        current_batch_code = batch_codes[0]

    group_build_orders, owner_by_code = _build_group_build_orders(db, batch_codes)
    if current_batch_code:
        owner_by_code.setdefault(current_batch_code, str(build_oid))
    group_build_orders = [
        {"batch_code": code, "build_order_id": owner_by_code.get(code)}
        for code in batch_codes
        if owner_by_code.get(code)
    ]

    production = db.depo_build_production.find_one({"build_order_id": build_oid})
    if not production:
        init_codes = [current_batch_code] if current_batch_code else batch_codes
        production_data = {
            "build_order_id": build_oid,
            "series": _build_series(init_codes, base_materials, default_step_id),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        result = db.depo_build_production.insert_one(production_data)
        production = production_data
        production["_id"] = result.inserted_id

    series, _ = _collect_group_series(db, batch_codes, owner_by_code, base_materials, default_step_id)

    production_payload = _fix_oid(production)
    production_payload["series"] = series
    production_payload["group_build_orders"] = group_build_orders
    return production_payload


@router.get("/{build_order_id}/production-remaining")
async def get_build_order_production_remaining(
    build_order_id: str,
    current_user: dict = Depends(require_section("build-orders"))
):
    db = get_db()
    try:
        build_oid = ObjectId(build_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid build order ID")

    build_order = db.depo_build_orders.find_one({"_id": build_oid})
    if not build_order:
        raise HTTPException(status_code=404, detail="Build order not found")
    _ensure_build_order_scope(db, current_user, build_order)

    production = db.depo_build_production.find_one({"build_order_id": build_oid})
    if not production:
        raise HTTPException(status_code=404, detail="Production data not found")

    default_step_id = _get_product_step_id(db, build_order)
    prefix = build_order.get("batch_prefix") or normalize_batch_code(build_order.get("batch_code_text") or build_order.get("batch_code"))[2]
    open_requests = _get_related_requests(db, prefix, open_only=True)
    base_materials = _build_materials_from_requests(db, open_requests)

    batch_codes = _get_group_batch_codes(build_order)
    current_batch_code = _normalize_batch_code_value(build_order.get("batch_code_text") or build_order.get("batch_code"))
    group_build_orders, owner_by_code = _build_group_build_orders(db, batch_codes)
    if current_batch_code:
        owner_by_code.setdefault(current_batch_code, str(build_oid))

    series, productions = _collect_group_series(db, batch_codes, owner_by_code, base_materials, default_step_id)
    remaining_items = _build_remaining_materials(db, series)

    return_orders = []
    for prod in productions:
        if prod.get("return_orders"):
            return_orders = prod.get("return_orders") or []
            break

    return {
        "items": remaining_items,
        "return_orders": return_orders
    }


async def _execute_build_order_stock_movements(db, build_order: dict, series: list, current_user: dict, timestamp: datetime):
    product_id = build_order.get("product_id")
    location_id = build_order.get("location_id")

    if not product_id or not location_id:
        raise Exception("Product or location not found in build order")

    if isinstance(product_id, str):
        product_id = ObjectId(product_id)
    if isinstance(location_id, str):
        location_id = ObjectId(location_id)

    stocks_collection = db['depo_stocks']

    for serie in series:
        batch_code = serie.get('batch_code')
        materials = serie.get('materials', [])
        decision_status = serie.get('decision_status')
        state = _get_request_state(db, decision_status)
        is_canceled = _is_canceled_state(state)
        is_failed = _is_failed_state(state)
        if is_canceled:
            continue
        if not batch_code:
            continue

        for material in materials:
            part_id = material.get('part')
            used_qty = float(material.get('used_qty') or 0)
            material_batch = material.get('batch', '')
            if not part_id or used_qty <= 0:
                continue

            if isinstance(part_id, str):
                part_id = ObjectId(part_id)

            query = {
                'part_id': part_id,
                'location_id': location_id,
                'quantity': {'$gt': 0}
            }
            if material_batch:
                query['batch_code'] = material_batch

            material_stocks = list(stocks_collection.find(query).sort('created_at', 1))
            if not material_stocks:
                continue

            remaining_qty = used_qty
            for stock in material_stocks:
                if remaining_qty <= 0:
                    break
                available_qty = stock.get('quantity', 0)
                reduce_qty = min(remaining_qty, available_qty)

                stocks_collection.update_one(
                    {'_id': stock['_id']},
                    {'$inc': {'quantity': -reduce_qty}, '$set': {'updated_at': timestamp}}
                )

                db.logs.insert_one({
                    'collection': 'depo_stocks',
                    'action': 'build_order_consumption',
                    'build_order_id': str(build_order.get('_id')),
                    'part_id': str(part_id),
                    'quantity': -reduce_qty,
                    'location': str(location_id),
                    'batch_code': material_batch,
                    'produced_batch': batch_code,
                    'user': current_user.get('username'),
                    'timestamp': timestamp
                })

                remaining_qty -= reduce_qty

        produced_qty = float(serie.get('produced_qty') or 0)
        if produced_qty > 0:
            materials_used = []
            for material in materials:
                used_qty = float(material.get('used_qty') or 0)
                if used_qty <= 0:
                    continue
                materials_used.append({
                    'part_id': str(material.get('part')),
                    'part_name': material.get('part_name', ''),
                    'batch': material.get('batch', ''),
                    'quantity': used_qty
                })

            existing_stock = stocks_collection.find_one({
                'part_id': product_id,
                'location_id': location_id,
                'batch_code': batch_code
            })

            if existing_stock:
                stocks_collection.update_one(
                    {'_id': existing_stock['_id']},
                    {
                        '$inc': {'quantity': produced_qty},
                        '$set': {
                            'updated_at': timestamp,
                            'state_id': ObjectId(DESTROYED_STATE_ID) if is_failed else existing_stock.get('state_id'),
                            'production': {
                                'build_order_id': str(build_order.get('_id')),
                                'serie_batch': batch_code,
                                'materials_used': materials_used,
                                'produced_at': timestamp,
                                'production_step_id': serie.get('production_step_id'),
                                'decision_status': decision_status
                            }
                        }
                    }
                )
            else:
                rompharm_supplier_id = ObjectId("694a1b9f297c9dde6d70661c")
                quarantined_state_id = ObjectId("694322878728e4d75ae72790")
                destroyed_state_id = ObjectId(DESTROYED_STATE_ID)

                new_stock = {
                    'part_id': product_id,
                    'location_id': location_id,
                    'quantity': produced_qty,
                    'batch_code': batch_code,
                    'supplier_id': rompharm_supplier_id,
                    'state_id': destroyed_state_id if is_failed else quarantined_state_id,
                    'notes': f"Produced from build order {build_order.get('batch_code_text') or build_order.get('batch_code')}",
                    'created_at': timestamp,
                    'updated_at': timestamp,
                    'created_by': current_user.get('username'),
                    'updated_by': current_user.get('username'),
                    'production': {
                        'build_order_id': str(build_order.get('_id')),
                        'serie_batch': batch_code,
                        'materials_used': materials_used,
                        'produced_at': timestamp,
                        'production_step_id': serie.get('production_step_id'),
                        'decision_status': decision_status
                    }
                }
                if serie.get('expiry_date'):
                    try:
                        new_stock['expiry_date'] = datetime.fromisoformat(str(serie.get('expiry_date')).replace('Z', '+00:00'))
                    except Exception:
                        new_stock['expiry_date'] = serie.get('expiry_date')
                stocks_collection.insert_one(new_stock)

            db.logs.insert_one({
                'collection': 'depo_stocks',
                'action': 'build_order_output',
                'build_order_id': str(build_order.get('_id')),
                'part_id': str(product_id),
                'quantity': produced_qty,
                'location': str(location_id),
                'batch_code': batch_code,
                'user': current_user.get('username'),
                'timestamp': timestamp
            })


@router.post("/{build_order_id}/production")
async def save_build_order_production(
    build_order_id: str,
    request: Request,
    current_user: dict = Depends(require_section("build-orders"))
):
    db = get_db()
    try:
        build_oid = ObjectId(build_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid build order ID")

    build_order = db.depo_build_orders.find_one({"_id": build_oid})
    if not build_order:
        raise HTTPException(status_code=404, detail="Build order not found")

    body = await request.json()
    series = body.get("series", [])
    current_batch_code = _normalize_batch_code_value(build_order.get("batch_code_text") or build_order.get("batch_code"))
    if current_batch_code:
        series = [s for s in series if _normalize_batch_code_value(s.get("batch_code")) == current_batch_code]
        conflict = db.depo_build_production.find_one({
            "build_order_id": {"$ne": build_oid},
            "series": {"$elemMatch": {
                "batch_code": current_batch_code,
                "saved_at": {"$exists": True, "$ne": None}
            }}
        })
        if conflict:
            raise HTTPException(status_code=400, detail="Series already saved in another build order")

    if not series:
        raise HTTPException(status_code=400, detail="No valid production series found for this build order")

    default_step_id = _get_product_step_id(db, build_order)
    if default_step_id:
        for serie in series:
            if not serie.get("production_step_id"):
                serie["production_step_id"] = default_step_id

    timestamp = datetime.utcnow()
    existing = db.depo_build_production.find_one({"build_order_id": build_oid})
    if existing:
        existing_series_map = {str(s.get("batch_code")): s for s in existing.get("series", []) or []}
        for serie in series:
            key = str(serie.get("batch_code"))
            existing_serie = existing_series_map.get(key, {})
            if existing_serie.get("saved_at") and not serie.get("saved_at"):
                serie["saved_at"] = existing_serie.get("saved_at")
                serie["saved_by"] = existing_serie.get("saved_by")
            if existing_serie.get("signatures") and not serie.get("signatures"):
                serie["signatures"] = existing_serie.get("signatures")
            existing_series_map[key] = serie
        series = list(existing_series_map.values())

        db.depo_build_production.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "series": series,
                "updated_at": timestamp,
                "updated_by": current_user.get("username")
            }}
        )
        production_id = str(existing["_id"])
    else:
        production_data = {
            "build_order_id": build_oid,
            "series": series,
            "created_at": timestamp,
            "created_by": current_user.get("username"),
            "updated_at": timestamp,
            "updated_by": current_user.get("username")
        }
        result = db.depo_build_production.insert_one(production_data)
        production_id = str(result.inserted_id)

    return {
        "success": True,
        "production_id": production_id,
        "message": "Build order production saved successfully"
    }


@router.get("/{build_order_id}/production-flow")
async def get_build_order_production_flow(
    build_order_id: str,
    current_user: dict = Depends(require_section("build-orders"))
):
    db = get_db()
    flow = db.approval_flows.find_one({
        "object_type": "build_order_production",
        "object_id": build_order_id
    })

    try:
        production_flow_id = ObjectId("694a1ae3297c9dde6d70661a")

        template = db.approval_templates.find_one({"_id": production_flow_id})
        if not template:
            template = db.approval_flows.find_one({"_id": production_flow_id})

        can_sign_officers = []
        must_sign_officers = []
        min_signatures = 1
        config_slug = "production"

        if template:
            if template.get("officers"):
                can_sign_officers, must_sign_officers = _build_officers_from_template(db, template)
                min_signatures = template.get("min_signatures", 1)
            else:
                can_sign_officers = template.get("can_sign_officers", []) or []
                must_sign_officers = template.get("must_sign_officers", []) or []
                min_signatures = template.get("min_signatures", 1)
            config_slug = template.get("config_slug", "production")
        if not can_sign_officers:
            min_signatures = 0
        else:
            print(f"[BUILD_ORDERS] Warning: Production template {production_flow_id} not found in approval_templates or approval_flows")

        if not flow and template:
            flow_data = {
                "object_type": "build_order_production",
                "object_source": "depo_build_orders",
                "object_id": build_order_id,
                "flow_type": "production",
                "config_slug": config_slug,
                "template_id": str(production_flow_id),
                "min_signatures": min_signatures,
                "can_sign_officers": can_sign_officers,
                "must_sign_officers": must_sign_officers,
                "signatures": [],
                "status": "pending",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            result = db.approval_flows.insert_one(flow_data)
            flow = db.approval_flows.find_one({"_id": result.inserted_id})
        elif flow and template:
            has_officers = bool(flow.get("can_sign_officers") or flow.get("must_sign_officers"))
            if not has_officers and (can_sign_officers or must_sign_officers):
                db.approval_flows.update_one(
                    {"_id": ObjectId(flow["_id"])},
                    {"$set": {
                        "can_sign_officers": can_sign_officers,
                        "must_sign_officers": must_sign_officers,
                        "min_signatures": min_signatures,
                        "updated_at": datetime.utcnow(),
                        "template_id": str(production_flow_id),
                        "config_slug": config_slug
                    }}
                )
                flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
            elif not template and not flow:
                pass
    except Exception as e:
        print(f"[BUILD_ORDERS] Failed to auto-create production flow: {e}")

    if not flow:
        return {"flow": None}

    flow["_id"] = str(flow["_id"])
    for signature in flow.get("signatures", []):
        user = db.users.find_one({"_id": ObjectId(signature["user_id"])})
        if user:
            signature["user_name"] = user.get("name") or user.get("username")

    return {"flow": flow}


@router.post("/{build_order_id}/production-series-sign")
async def sign_build_order_series(
    build_order_id: str,
    request: Request,
    current_user: dict = Depends(require_section("build-orders"))
):
    db = get_db()
    body = await request.json()
    batch_code = body.get("batch_code")
    serie_payload = body.get("serie") or {}
    if not batch_code:
        raise HTTPException(status_code=400, detail="batch_code is required")

    try:
        build_oid = ObjectId(build_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid build order ID")

    build_order = db.depo_build_orders.find_one({"_id": build_oid})
    if not build_order:
        raise HTTPException(status_code=404, detail="Build order not found")
    _ensure_build_order_scope(db, current_user, build_order)

    current_batch_code = _normalize_batch_code_value(build_order.get("batch_code_text") or build_order.get("batch_code"))
    if current_batch_code and _normalize_batch_code_value(batch_code) != current_batch_code:
        raise HTTPException(status_code=400, detail="You can only sign the current build order batch code")
    if current_batch_code:
        conflict = db.depo_build_production.find_one({
            "build_order_id": {"$ne": build_oid},
            "series": {"$elemMatch": {
                "batch_code": current_batch_code,
                "saved_at": {"$exists": True, "$ne": None}
            }}
        })
        if conflict:
            raise HTTPException(status_code=400, detail="Series already saved in another build order")

    production = db.depo_build_production.find_one({"build_order_id": build_oid})
    if not production:
        raise HTTPException(status_code=404, detail="Production data not found")

    series = production.get("series", [])
    serie_index = next((i for i, s in enumerate(series) if str(s.get("batch_code")) == str(batch_code)), None)
    if serie_index is None:
        raise HTTPException(status_code=404, detail="Production series not found")

    serie = series[serie_index]
    if serie.get("saved_at"):
        raise HTTPException(status_code=400, detail="Series already saved")

    serie_candidate = serie.copy()
    allowed_fields = [
        "produced_qty",
        "expiry_date",
        "production_step_id",
        "decision_status",
        "decision_reason",
        "materials"
    ]
    for field in allowed_fields:
        if field in serie_payload:
            serie_candidate[field] = serie_payload.get(field)

    default_step_id = _get_product_step_id(db, build_order) if build_order else None
    if not serie_candidate.get("production_step_id") and default_step_id:
        serie_candidate["production_step_id"] = default_step_id

    decision_status = serie_candidate.get("decision_status")
    if not decision_status:
        raise HTTPException(status_code=400, detail="Decision status is required before signing")

    state = _get_request_state(db, decision_status)
    is_canceled = _is_canceled_state(state)
    is_failed = _is_failed_state(state)

    if state and state.get("needs_comment") and not str(serie_candidate.get("decision_reason") or "").strip():
        raise HTTPException(status_code=400, detail="Comment is required for this decision")

    if not (is_canceled or is_failed) and not serie_candidate.get("expiry_date"):
        raise HTTPException(status_code=400, detail="Expiration date is required")
    if not is_canceled and not serie_candidate.get("production_step_id"):
        raise HTTPException(status_code=400, detail="Production step is required")

    produced_qty = float(serie_candidate.get("produced_qty") or 0)
    if produced_qty <= 0 and not is_canceled:
        raise HTTPException(status_code=400, detail="Produced quantity is required")

    flow = db.approval_flows.find_one({
        "object_type": "build_order_production",
        "object_id": build_order_id
    })

    if not flow:
        raise HTTPException(status_code=404, detail="No production flow found")

    user_id = str(current_user["_id"])
    existing_signature = next(
        (s for s in serie.get("signatures", []) if s.get("user_id") == user_id),
        None
    )
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this series")

    user_role_id = current_user.get("role")
    can_sign = check_user_can_sign(
        db,
        user_id,
        user_role_id,
        flow.get("must_sign_officers", []),
        flow.get("can_sign_officers", [])
    )

    if not can_sign:
        raise HTTPException(status_code=403, detail="You are not authorized to sign")

    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="build_order_production_series",
        object_id=f"{build_order_id}:{batch_code}",
        timestamp=timestamp
    )

    signature = {
        "user_id": user_id,
        "username": current_user.get("username"),
        "signed_at": timestamp,
        "signature_hash": signature_hash,
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent")
    }

    serie_signatures = serie_candidate.get("signatures", []) or []
    serie_signatures.append(signature)
    serie_candidate["signatures"] = serie_signatures
    series[serie_index] = serie_candidate

    db.depo_build_production.update_one(
        {"_id": production["_id"]},
        {"$set": {
            "series": series,
            "updated_at": timestamp,
            "updated_by": current_user.get("username")
        }}
    )

    try:
        prefix = build_order.get("batch_prefix") or normalize_batch_code(build_order.get("batch_code_text") or build_order.get("batch_code"))[2]
        open_requests = _get_related_requests(db, prefix, open_only=True)
        base_materials = _build_materials_from_requests(db, open_requests)
        batch_codes = _get_group_batch_codes(build_order)
        _, owner_by_code = _build_group_build_orders(db, batch_codes)
        if current_batch_code:
            owner_by_code.setdefault(current_batch_code, str(build_oid))
        group_series, _ = _collect_group_series(db, batch_codes, owner_by_code, base_materials, default_step_id)
        _update_requests_open_status(db, group_series)
    except Exception as e:
        print(f"[BUILD_ORDERS] Warning: Failed to update requests open status: {e}")

    return {"series": series}


@router.post("/{build_order_id}/production-series-save")
async def save_build_order_series(
    build_order_id: str,
    request: Request,
    current_user: dict = Depends(require_section("build-orders"))
):
    db = get_db()
    body = await request.json()
    batch_code = body.get("batch_code")
    serie_payload = body.get("serie") or {}
    if not batch_code:
        raise HTTPException(status_code=400, detail="batch_code is required")

    try:
        build_oid = ObjectId(build_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid build order ID")

    build_order = db.depo_build_orders.find_one({"_id": build_oid})
    if not build_order:
        raise HTTPException(status_code=404, detail="Build order not found")

    production = db.depo_build_production.find_one({"build_order_id": build_oid})
    if not production:
        raise HTTPException(status_code=404, detail="Production data not found")

    series = production.get("series", [])
    serie_index = next((i for i, s in enumerate(series) if str(s.get("batch_code")) == str(batch_code)), None)
    if serie_index is None:
        raise HTTPException(status_code=404, detail="Production series not found")

    serie = series[serie_index]
    if serie.get("saved_at"):
        raise HTTPException(status_code=400, detail="Series already saved")

    serie_candidate = serie.copy()
    allowed_fields = [
        "produced_qty",
        "expiry_date",
        "production_step_id",
        "decision_status",
        "decision_reason",
        "materials"
    ]
    for field in allowed_fields:
        if field in serie_payload:
            serie_candidate[field] = serie_payload.get(field)

    default_step_id = _get_product_step_id(db, build_order)
    if not serie_candidate.get("production_step_id") and default_step_id:
        serie_candidate["production_step_id"] = default_step_id

    decision_status = serie_candidate.get("decision_status")
    if not decision_status:
        raise HTTPException(status_code=400, detail="Decision status is required before saving")

    state = _get_request_state(db, decision_status)
    is_canceled = _is_canceled_state(state)
    is_failed = _is_failed_state(state)

    if state and state.get("needs_comment") and not str(serie_candidate.get("decision_reason") or "").strip():
        raise HTTPException(status_code=400, detail="Comment is required for this decision")

    if not (is_canceled or is_failed) and not serie_candidate.get("expiry_date"):
        raise HTTPException(status_code=400, detail="Expiration date is required")
    if not is_canceled and not serie_candidate.get("production_step_id"):
        raise HTTPException(status_code=400, detail="Production step is required")

    produced_qty = float(serie_candidate.get("produced_qty") or 0)
    if produced_qty <= 0 and not is_canceled:
        raise HTTPException(status_code=400, detail="Produced quantity is required")

    flow = db.approval_flows.find_one({
        "object_type": "build_order_production",
        "object_id": build_order_id
    })
    if not flow:
        raise HTTPException(status_code=404, detail="No production flow found")

    user_id = str(current_user["_id"])
    user_role_id = current_user.get("role")
    can_sign = check_user_can_sign(
        db,
        user_id,
        user_role_id,
        flow.get("must_sign_officers", []),
        flow.get("can_sign_officers", [])
    )
    if not can_sign:
        raise HTTPException(status_code=403, detail="You are not authorized to save this series")

    if not _is_serie_completed(db, flow, serie_candidate.get("signatures", []) or []):
        raise HTTPException(status_code=400, detail="Series must be fully signed before saving")

    timestamp = datetime.utcnow()
    serie_candidate["saved_at"] = timestamp
    serie_candidate["saved_by"] = current_user.get("username")

    series[serie_index] = serie_candidate
    db.depo_build_production.update_one(
        {"_id": production["_id"]},
        {"$set": {
            "series": series,
            "updated_at": timestamp,
            "updated_by": current_user.get("username")
        }}
    )

    try:
        await _execute_build_order_stock_movements(db, build_order, [serie_candidate], current_user, timestamp)
    except Exception as e:
        print(f"[BUILD_ORDERS] Warning: Stock movements failed: {e}")

    return {"series": series}


@router.post("/{build_order_id}/production-return")
async def create_build_order_return_orders(
    build_order_id: str,
    request: Request,
    current_user: dict = Depends(require_section("build-orders"))
):
    db = get_db()
    try:
        build_oid = ObjectId(build_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid build order ID")

    build_order = db.depo_build_orders.find_one({"_id": build_oid})
    if not build_order:
        raise HTTPException(status_code=404, detail="Build order not found")

    current_batch_code = _normalize_batch_code_value(build_order.get("batch_code_text") or build_order.get("batch_code"))
    if current_batch_code:
        conflict = db.depo_build_production.find_one({
            "build_order_id": {"$ne": build_oid},
            "series": {"$elemMatch": {
                "batch_code": current_batch_code,
                "saved_at": {"$exists": True, "$ne": None}
            }}
        })
        if conflict:
            raise HTTPException(status_code=400, detail="Series already saved in another build order")

    production = db.depo_build_production.find_one({"build_order_id": build_oid})
    if not production:
        raise HTTPException(status_code=404, detail="Production data not found")

    default_step_id = _get_product_step_id(db, build_order)
    prefix = build_order.get("batch_prefix") or normalize_batch_code(build_order.get("batch_code_text") or build_order.get("batch_code"))[2]
    open_requests = _get_related_requests(db, prefix, open_only=True)
    base_materials = _build_materials_from_requests(db, open_requests)

    batch_codes = _get_group_batch_codes(build_order)
    current_batch_code = _normalize_batch_code_value(build_order.get("batch_code_text") or build_order.get("batch_code"))
    _, owner_by_code = _build_group_build_orders(db, batch_codes)
    if current_batch_code:
        owner_by_code.setdefault(current_batch_code, str(build_oid))

    series, productions = _collect_group_series(db, batch_codes, owner_by_code, base_materials, default_step_id)

    for prod in productions:
        if prod.get("return_orders"):
            return {"return_orders": prod.get("return_orders")}

    if any(not serie.get("saved_at") for serie in series):
        raise HTTPException(status_code=400, detail="All series must be saved before creating return orders")

    body = await request.json()
    items = body.get("items", []) or []
    if not items:
        raise HTTPException(status_code=400, detail="Return items are required")

    remaining_items = _build_remaining_materials(db, series)
    remaining_map = {item["key"]: item for item in remaining_items}

    build_location = build_order.get("location_id")
    if not build_location:
        raise HTTPException(status_code=400, detail="Build order missing location")
    if isinstance(build_location, str) and ObjectId.is_valid(build_location):
        build_location = ObjectId(build_location)

    batch_code = build_order.get("batch_code_text") or build_order.get("batch_code") or str(build_order_id)
    date_str = datetime.utcnow().date().isoformat()
    item_note = f"Rest from build order #{batch_code}/{date_str}"

    items_by_destination: dict[str, list] = {}
    return_qty_map = {}

    for item in items:
        return_qty = float(item.get("return_qty") or 0)
        if return_qty <= 0:
            continue
        part_id = item.get("part_id") or item.get("part")
        material_stub = {
            "request_id": item.get("request_id"),
            "request_item_index": item.get("request_item_index"),
            "part": part_id,
            "batch": item.get("batch") or item.get("batch_code") or ""
        }
        key = item.get("key") or _material_key(material_stub)
        remaining_entry = remaining_map.get(key)
        if not remaining_entry:
            raise HTTPException(status_code=400, detail=f"Unknown material key: {key}")

        if not part_id:
            part_id = remaining_entry.get("part_id")

        remaining_qty = float(remaining_entry.get("remaining_qty") or 0)
        return_qty = max(0.0, min(return_qty, remaining_qty))
        if return_qty <= 0:
            continue

        destination = remaining_entry.get("source_location_id")
        if not destination:
            raise HTTPException(status_code=400, detail="Missing source location for return item")

        return_qty_map[key] = return_qty
        items_by_destination.setdefault(str(destination), []).append({
            "part": str(part_id),
            "quantity": return_qty,
            "init_q": return_qty,
            "batch_code": remaining_entry.get("batch") or "",
            "notes": item_note
        })

    if not items_by_destination:
        raise HTTPException(status_code=400, detail="No valid return quantities provided")

    timestamp = datetime.utcnow()
    created_orders = []

    for destination, payload_items in items_by_destination.items():
        reference = generate_request_reference(db)
        return_doc = {
            "reference": reference,
            "source": build_location,
            "destination": ObjectId(destination) if ObjectId.is_valid(destination) else destination,
            "items": payload_items,
            "line_items": len(payload_items),
            "status": "Pending",
            "notes": item_note,
            "issue_date": timestamp,
            "created_at": timestamp,
            "updated_at": timestamp,
            "created_by": current_user.get("username"),
            "build_order_id": build_oid,
            "build_order_batch": batch_code
        }
        result = db.depo_requests.insert_one(return_doc)
        created_orders.append({
            "request_id": str(result.inserted_id),
            "reference": reference,
            "source": str(build_location),
            "destination": destination
        })

    unused_materials = []
    for entry in remaining_items:
        key = entry.get("key")
        remaining_qty = float(entry.get("remaining_qty") or 0)
        return_qty = float(return_qty_map.get(key, 0))
        lost_qty = max(0.0, remaining_qty - return_qty)
        unused_materials.append({
            "key": key,
            "part": entry.get("part_id"),
            "batch": entry.get("batch"),
            "request_id": entry.get("request_id"),
            "request_item_index": entry.get("request_item_index"),
            "remaining_qty": remaining_qty,
            "return_qty": return_qty,
            "lost_qty": lost_qty,
            "source_location_id": entry.get("source_location_id")
        })

    group_ids = []
    for build_order_id in owner_by_code.values():
        if isinstance(build_order_id, ObjectId):
            group_ids.append(build_order_id)
        elif isinstance(build_order_id, str) and ObjectId.is_valid(build_order_id):
            group_ids.append(ObjectId(build_order_id))

    if group_ids:
        db.depo_build_production.update_many(
            {"build_order_id": {"$in": group_ids}},
            {"$set": {
                "unused_materials": unused_materials,
                "return_orders": created_orders,
                "updated_at": timestamp,
                "updated_by": current_user.get("username")
            }}
        )
    else:
        db.depo_build_production.update_one(
            {"_id": production["_id"]},
            {"$set": {
                "unused_materials": unused_materials,
                "return_orders": created_orders,
                "updated_at": timestamp,
                "updated_by": current_user.get("username")
            }}
        )

    return {"return_orders": created_orders}


def _update_requests_open_status(db, series: list):
    used_by_request_item = {}
    for serie in series:
        if not serie.get("signatures"):
            continue
        for material in serie.get("materials", []) or []:
            key = _material_key(material)
            used_by_request_item[key] = used_by_request_item.get(key, 0) + float(material.get("used_qty") or 0)

    requests_status = {}
    for serie in series:
        for material in serie.get("materials", []) or []:
            req_id = material.get("request_id")
            if not req_id:
                continue
            key = _material_key(material)
            required_qty = float(material.get("received_qty") or 0)
            used_qty = used_by_request_item.get(key, 0)
            consumed = used_qty >= required_qty and required_qty > 0
            req_entry = requests_status.setdefault(req_id, {"all_consumed": True})
            if not consumed:
                req_entry["all_consumed"] = False

    for req_id, data in requests_status.items():
        if data.get("all_consumed"):
            try:
                db.depo_requests.update_one(
                    {"_id": ObjectId(req_id)},
                    {"$set": {"open": False, "updated_at": datetime.utcnow()}}
                )
            except Exception:
                pass
