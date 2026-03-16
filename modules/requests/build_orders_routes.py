"""
Build Orders routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime
from bson import ObjectId
from typing import Optional, Any

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_admin, verify_token
from src.backend.utils.approval_helpers import check_user_can_sign
from src.backend.models.approval_flow_model import ApprovalFlowModel

from .build_orders_helpers import normalize_batch_code


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
    current_user: dict = Depends(verify_admin)
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
    current_user: dict = Depends(verify_admin)
):
    db = get_db()
    build_orders_collection = db["depo_build_orders"]

    query = {}
    if state_id:
        try:
            query["state_id"] = ObjectId(state_id)
        except Exception:
            query["state_id"] = state_id

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
    current_user: dict = Depends(verify_admin)
):
    db = get_db()
    try:
        build_oid = ObjectId(build_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid build order ID")

    build_order = db.depo_build_orders.find_one({"_id": build_oid})
    if not build_order:
        raise HTTPException(status_code=404, detail="Build order not found")

    build_order = _fix_oid(build_order)

    if build_order.get("product_id"):
        product = db.depo_parts.find_one({"_id": ObjectId(build_order["product_id"])})
        if product:
            build_order["product_detail"] = {
                "_id": str(product["_id"]),
                "name": product.get("name"),
                "ipn": product.get("ipn"),
                "description": product.get("description", "")
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

    return build_order


@router.patch("/{build_order_id}")
async def update_build_order(
    build_order_id: str,
    request: Request,
    current_user: dict = Depends(verify_admin)
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
                "request_item_index": index
            })
    return materials


def _material_key(material: dict) -> str:
    if material.get("request_id") is not None and material.get("request_item_index") is not None:
        return f"{material.get('request_id')}::{material.get('request_item_index')}"
    return f"{material.get('request_id','')}::{material.get('part','')}::{material.get('batch','')}"


def _merge_series_materials(series: list, base_materials: list) -> list:
    base_map = {_material_key(m): m for m in base_materials}
    for serie in series:
        existing = serie.get("materials", []) or []
        existing_map = {_material_key(m): m for m in existing}

        merged = list(existing_map.values())
        for key, base in base_map.items():
            if key not in existing_map:
                merged.append(base)
        serie["materials"] = merged
    return series


def _build_series(batch_codes: list, base_materials: list) -> list:
    series = []
    for code in batch_codes:
        series.append({
            "batch_code": code,
            "produced_qty": 0,
            "expiry_date": "",
            "production_step_id": "",
            "decision_status": "",
            "decision_reason": "",
            "signatures": [],
            "materials": base_materials
        })
    return series


@router.get("/{build_order_id}/production")
async def get_build_order_production(
    build_order_id: str,
    current_user: dict = Depends(verify_admin)
):
    db = get_db()
    try:
        build_oid = ObjectId(build_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid build order ID")

    build_order = db.depo_build_orders.find_one({"_id": build_oid})
    if not build_order:
        raise HTTPException(status_code=404, detail="Build order not found")

    build_order = _fix_oid(build_order)
    prefix = build_order.get("batch_prefix") or normalize_batch_code(build_order.get("batch_code_text") or build_order.get("batch_code"))[2]

    open_requests = _get_related_requests(db, prefix, open_only=True)
    base_materials = _build_materials_from_requests(db, open_requests)

    production = db.depo_build_production.find_one({"build_order_id": build_oid})

    batch_codes = build_order.get("grup", {}).get("batch_codes") or [build_order.get("batch_code_text") or build_order.get("batch_code")]
    batch_codes = [str(c) for c in batch_codes if str(c)]

    if production:
        production = _fix_oid(production)
        series = production.get("series", [])
        series = _merge_series_materials(series, base_materials)

        existing_codes = {str(s.get("batch_code")) for s in series}
        for code in batch_codes:
            if str(code) not in existing_codes:
                series.append({
                    "batch_code": code,
                    "produced_qty": 0,
                    "expiry_date": "",
                    "production_step_id": "",
                    "decision_status": "",
                    "decision_reason": "",
                    "signatures": [],
                    "materials": base_materials
                })

        production["series"] = series
        return production

    production_data = {
        "build_order_id": build_oid,
        "series": _build_series(batch_codes, base_materials),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    result = db.depo_build_production.insert_one(production_data)
    production_data["_id"] = str(result.inserted_id)
    production_data["build_order_id"] = str(build_oid)
    return production_data


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
    current_user: dict = Depends(verify_admin)
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

    timestamp = datetime.utcnow()
    existing = db.depo_build_production.find_one({"build_order_id": build_oid})
    if existing:
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

    try:
        await _execute_build_order_stock_movements(db, build_order, series, current_user, timestamp)
    except Exception as e:
        print(f"[BUILD_ORDERS] Warning: Stock movements failed: {e}")

    return {
        "success": True,
        "production_id": production_id,
        "message": "Build order production saved successfully"
    }


@router.get("/{build_order_id}/production-flow")
async def get_build_order_production_flow(
    build_order_id: str,
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    flow = db.approval_flows.find_one({
        "object_type": "build_order_production",
        "object_id": build_order_id
    })

    if not flow:
        try:
            production_flow_id = ObjectId("694a1ae3297c9dde6d70661a")
            existing_flow = db.approval_flows.find_one({"_id": production_flow_id})

            if existing_flow:
                flow_data = {
                    "object_type": "build_order_production",
                    "object_source": "depo_build_orders",
                    "object_id": build_order_id,
                    "flow_type": "production",
                    "config_slug": existing_flow.get("config_slug", "production"),
                    "template_id": str(production_flow_id),
                    "min_signatures": existing_flow.get("min_signatures", 1),
                    "can_sign_officers": existing_flow.get("can_sign_officers", []),
                    "must_sign_officers": existing_flow.get("must_sign_officers", []),
                    "signatures": [],
                    "status": "pending",
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                result = db.approval_flows.insert_one(flow_data)
                flow = db.approval_flows.find_one({"_id": result.inserted_id})
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
    current_user: dict = Depends(verify_token)
):
    db = get_db()
    body = await request.json()
    batch_code = body.get("batch_code")
    if not batch_code:
        raise HTTPException(status_code=400, detail="batch_code is required")

    try:
        build_oid = ObjectId(build_order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid build order ID")

    production = db.depo_build_production.find_one({"build_order_id": build_oid})
    if not production:
        raise HTTPException(status_code=404, detail="Production data not found")

    series = production.get("series", [])
    serie_index = next((i for i, s in enumerate(series) if str(s.get("batch_code")) == str(batch_code)), None)
    if serie_index is None:
        raise HTTPException(status_code=404, detail="Production series not found")

    serie = series[serie_index]
    decision_status = serie.get("decision_status")
    if not decision_status:
        raise HTTPException(status_code=400, detail="Decision status is required before signing")

    state = _get_request_state(db, decision_status)
    is_canceled = _is_canceled_state(state)
    is_failed = _is_failed_state(state)

    if state and state.get("needs_comment") and not str(serie.get("decision_reason") or "").strip():
        raise HTTPException(status_code=400, detail="Comment is required for this decision")

    if not (is_canceled or is_failed) and not serie.get("expiry_date"):
        raise HTTPException(status_code=400, detail="Expiration date is required")
    if not is_canceled and not serie.get("production_step_id"):
        raise HTTPException(status_code=400, detail="Production step is required")

    produced_qty = float(serie.get("produced_qty") or 0)
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

    user_role_id = current_user.get("role") or current_user.get("local_role")
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

    serie_signatures = serie.get("signatures", [])
    serie_signatures.append(signature)
    serie["signatures"] = serie_signatures
    series[serie_index] = serie

    db.depo_build_production.update_one(
        {"_id": production["_id"]},
        {"$set": {
            "series": series,
            "updated_at": timestamp,
            "updated_by": current_user.get("username")
        }}
    )

    try:
        _update_requests_open_status(db, series)
    except Exception as e:
        print(f"[BUILD_ORDERS] Warning: Failed to update requests open status: {e}")

    return {"series": series}


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
