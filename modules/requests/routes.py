"""
Requests routes for internal stock transfer requests
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from datetime import datetime
import requests
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.utils.config import load_config
from src.backend.utils.sections_permissions import (
    require_section,
    get_section_permissions,
    apply_scope_to_query,
    is_doc_in_scope
)

from .models import RequestCreate, RequestUpdate
from .utils import generate_request_reference
from .services import (
    fetch_stock_locations,
    search_parts,
    get_part_stock_info,
    fetch_part_bom,
    fetch_part_batch_codes,
    fetch_part_recipe
)
from .approval_routes import router as approval_router
from .build_orders_routes import router as build_orders_router
from .build_orders_helpers import ensure_build_orders_for_request


router = APIRouter(prefix="/modules/requests/api", tags=["requests"])


def _normalize_user_locations(locations) -> list:
    normalized = []
    if not locations:
        return normalized
    for loc in locations:
        if isinstance(loc, ObjectId):
            normalized.append(str(loc))
        elif isinstance(loc, dict) and loc.get("$oid"):
            normalized.append(str(loc.get("$oid")))
        elif isinstance(loc, str):
            normalized.append(loc)
    return normalized


def _get_user_location_ids(db, current_user: dict) -> list:
    locations = _normalize_user_locations(current_user.get("locations"))
    if locations:
        return locations
    user_id = current_user.get("_id") or current_user.get("user_id")
    if not user_id:
        return []
    try:
        user_doc = db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user_doc = None
    if not user_doc:
        return []
    return _normalize_user_locations(user_doc.get("locations"))


def _ensure_request_scope(db, current_user: dict, request_doc: dict) -> None:
    perms = get_section_permissions(db, current_user, "requests")
    if not is_doc_in_scope(db, current_user, perms, request_doc, created_by_field="created_by"):
        raise HTTPException(status_code=403, detail="Access denied")

# Include approval routes
# Include approval routes
router.include_router(approval_router)
router.include_router(build_orders_router)

# Include transfer execution routes
from .transfer_routes import router as transfer_router
router.include_router(transfer_router)


# ==================== STOCK LOCATIONS ====================

@router.get("/states")
async def get_request_states(
    current_user: dict = Depends(require_section("requests"))
):
    """Get list of request states from MongoDB depo_requests_states"""
    db = get_db()
    states_collection = db['depo_requests_states']
    
    states = list(states_collection.find().sort('level', 1))
    
    # Convert ObjectIds to strings
    for state in states:
        state['_id'] = str(state['_id'])
    
    return {"results": states}


@router.get("/production-steps")
async def get_production_steps(
    current_user: dict = Depends(require_section("requests")),
    db = Depends(get_db)
):
    """Get list of production steps from MongoDB depo_production_steps"""
    steps_collection = db['depo_production_steps']
    steps = list(steps_collection.find().sort([('order', 1), ('name', 1)]))

    for step in steps:
        if '_id' in step:
            step['_id'] = str(step['_id'])

    return {"results": steps}


@router.get("/stock-locations")
async def get_stock_locations(
    request: Request,
    current_user: dict = Depends(require_section("requests")),
    db = Depends(get_db)
):
    """Get list of stock locations from MongoDB depo_locations"""
    return await fetch_stock_locations(current_user, db)


# ==================== PARTS ====================

@router.get("/parts")
async def get_parts(
    request: Request,
    search: Optional[str] = None,
    location_id: Optional[str] = None,
    is_assembly: Optional[bool] = None,
    current_user: dict = Depends(require_section("requests")),
    db = Depends(get_db)
):
    """Get list of parts from MongoDB depo_parts with search"""
    return await search_parts(db, search, location_id, is_assembly)


@router.get("/parts/{part_id}/stock-info")
async def get_part_stock_info_route(
    part_id: str,
    location_id: Optional[str] = None,
    current_user: dict = Depends(require_section("requests")),
    db = Depends(get_db)
):
    """Get stock information for a part from MongoDB depo_stocks with batches using ObjectId"""
    return await get_part_stock_info(db, part_id, location_id)


@router.get("/parts/{part_id}/bom")
async def get_part_bom(
    part_id: str,
    current_user: dict = Depends(require_section("requests")),
    db = Depends(get_db)
):
    """Get BOM (Bill of Materials) for a part from MongoDB depo_bom using ObjectId"""
    return await fetch_part_bom(current_user, part_id, db)


@router.get("/parts/{part_id}/batch-codes")
async def get_part_batch_codes(
    part_id: str,
    location_id: Optional[str] = None,
    current_user: dict = Depends(require_section("requests")),
    db = Depends(get_db)
):
    """Get available batch codes for a part from MongoDB depo_stocks using ObjectId
    
    Note: location_id is optional - if not provided, searches all locations
    """
    # Optional location filter
    return await fetch_part_batch_codes(current_user, part_id, location_id, db)


@router.get("/parts/{part_id}/recipe")
async def get_part_recipe(
    part_id: str,
    current_user: dict = Depends(require_section("requests")),
    db = Depends(get_db)
):
    """Get recipe for a part (with fallback to BOM if no recipe exists) using ObjectId"""
    return await fetch_part_recipe(db, current_user, part_id)


# ==================== REQUESTS CRUD ====================

@router.get("/")
async def list_requests(
    has_batch_codes: Optional[bool] = None,
    has_production: Optional[bool] = None,
    search: Optional[str] = None,
    state_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    extra: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(require_section("requests"))
):
    """List all requests with location names from depo_locations"""
    db = get_db()
    requests_collection = db['depo_requests']
    locations_collection = db['depo_locations']
    parts_collection = db['depo_parts']
    
    query = {}
    if has_batch_codes:
        query["items.batch_code"] = {"$exists": True, "$ne": None}

    candidate_ids = None

    if has_production:
        production_collection = db['depo_production']
        prod_docs = list(production_collection.find(
            {"series": {"$exists": True, "$ne": []}},
            {"request_id": 1}
        ))
        prod_ids = [doc.get("request_id") for doc in prod_docs if doc.get("request_id")]
        candidate_ids = set(prod_ids)

    if extra:
        extra_value = extra.strip().lower()
        if extra_value == "open_orders":
            production_collection = db['depo_production']
            prod_docs = list(production_collection.find(
                {"series": {"$exists": True, "$ne": []}},
                {"request_id": 1, "series": 1, "return_order_id": 1, "return_order_reference": 1}
            ))
            open_ids = []
            for prod in prod_docs:
                series = prod.get("series", []) or []
                has_consumption = False
                for serie in series:
                    for material in (serie.get("materials") or []):
                        if (material.get("used_qty") or 0) > 0:
                            has_consumption = True
                            break
                    if has_consumption:
                        break
                has_return = prod.get("return_order_id") or prod.get("return_order_reference")
                if (not has_consumption) or (not has_return):
                    if prod.get("request_id"):
                        open_ids.append(prod.get("request_id"))

            extra_ids = set(open_ids)
            candidate_ids = extra_ids if candidate_ids is None else candidate_ids.intersection(extra_ids)

    if candidate_ids is not None:
        query["_id"] = {"$in": list(candidate_ids)}

    if state_id:
        try:
            query["state_id"] = ObjectId(state_id)
        except Exception:
            query["state_id"] = state_id

    # Date range filter on created_at
    if date_from or date_to:
        date_query = {}
        if date_from:
            try:
                if len(date_from) == 10:
                    date_query["$gte"] = datetime.fromisoformat(f"{date_from}T00:00:00")
                else:
                    date_query["$gte"] = datetime.fromisoformat(date_from)
            except Exception:
                pass
        if date_to:
            try:
                if len(date_to) == 10:
                    date_query["$lte"] = datetime.fromisoformat(f"{date_to}T23:59:59")
                else:
                    date_query["$lte"] = datetime.fromisoformat(date_to)
            except Exception:
                pass
        if date_query:
            query["created_at"] = date_query

    # Search filter
    if search:
        search = search.strip()
        if search:
            or_clauses = [
                {'reference': {'$regex': search, '$options': 'i'}},
                {'notes': {'$regex': search, '$options': 'i'}},
                {'items.batch_code': {'$regex': search, '$options': 'i'}},
            ]

            # Match locations by name/code
            locs = list(locations_collection.find({
                '$or': [
                    {'name': {'$regex': search, '$options': 'i'}},
                    {'code': {'$regex': search, '$options': 'i'}}
                ]
            }, {'_id': 1}))
            if locs:
                loc_ids = [l['_id'] for l in locs]
                loc_variants = loc_ids + [str(x) for x in loc_ids]
                or_clauses.append({'source': {'$in': loc_variants}})
                or_clauses.append({'destination': {'$in': loc_variants}})

            # Match parts by name or IPN
            parts = list(parts_collection.find({
                '$or': [
                    {'name': {'$regex': search, '$options': 'i'}},
                    {'ipn': {'$regex': search, '$options': 'i'}}
                ]
            }, {'_id': 1}))
            if parts:
                part_ids = [p['_id'] for p in parts]
                part_variants = part_ids + [str(x) for x in part_ids]
                or_clauses.append({'items.part': {'$in': part_variants}})

            query["$or"] = or_clauses

    perms = get_section_permissions(db, current_user, "requests")
    query = apply_scope_to_query(db, current_user, perms, query, created_by_field="created_by")

    total = requests_collection.count_documents(query)
    requests_list = list(
        requests_collection
        .find(query)
        .sort('created_at', -1)
        .skip(skip)
        .limit(limit)
    )
    
    # Get all unique location ObjectIds
    location_oids = set()
    for req in requests_list:
        if req.get('source'):
            try:
                location_oids.add(ObjectId(req['source']) if isinstance(req['source'], str) else req['source'])
            except:
                pass
        if req.get('destination'):
            try:
                location_oids.add(ObjectId(req['destination']) if isinstance(req['destination'], str) else req['destination'])
            except:
                pass
    
    # Fetch all locations from MongoDB
    location_map = {}
    if location_oids:
        try:
            locations = list(locations_collection.find({'_id': {'$in': list(location_oids)}}))
            for loc in locations:
                loc_id = str(loc['_id'])
                location_map[loc_id] = loc.get('code', str(loc['_id']))
        except Exception as e:
            print(f"Warning: Failed to fetch locations: {e}")
    
    # Helper to recursively convert ObjectId to string
    def fix_oid(obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, list):
            return [fix_oid(x) for x in obj]
        if isinstance(obj, dict):
            return {k: fix_oid(v) for k, v in obj.items()}
        return obj

    # Get all unique part ObjectIds from items and product_id
    part_oids = set()
    for req in requests_list:
        # Get parts from items
        if req.get('items'):
            for item in req['items']:
                if item.get('part'):
                    try:
                        part_oids.add(ObjectId(item['part']) if isinstance(item['part'], str) else item['part'])
                    except:
                        pass
        # Get product_id
        if req.get('product_id'):
            try:
                part_oids.add(ObjectId(req['product_id']) if isinstance(req['product_id'], str) else req['product_id'])
            except:
                pass
    
    # Fetch all parts from MongoDB
    part_map = {}
    if part_oids:
        try:
            parts = list(parts_collection.find({'_id': {'$in': list(part_oids)}}))
            for part in parts:
                part_id = str(part['_id'])
                part_map[part_id] = {
                    'name': part.get('name', ''),
                    'IPN': part.get('ipn', ''),
                    'ipn': part.get('ipn', '')
                }
        except Exception as e:
            print(f"Warning: Failed to fetch parts: {e}")
    
    # Process each request
    processed_list = []
    
    for req in requests_list:
        # Apply recursive conversion first
        req = fix_oid(req)
        
        # Helper to safely get value (now strings)
        def get_val(doc, key):
            val = doc.get(key)
            return val if val else None

        # Add source name
        source_id = get_val(req, 'source')
        if source_id:
            req['source_name'] = location_map.get(source_id, source_id)
            
        # Add destination name
        dest_id = get_val(req, 'destination')
        if dest_id:
            req['destination_name'] = location_map.get(dest_id, dest_id)

        # Populate items with part_detail (at least first item)
        if req.get('items') and len(req['items']) > 0:
            for item in req['items']:
                if item.get('part'):
                    part_id = str(item['part'])
                    if part_id in part_map:
                        item['part_detail'] = part_map[part_id]
        
        # Populate product_detail if product_id exists
        if req.get('product_id'):
            product_id = str(req['product_id'])
            if product_id in part_map:
                req['product_detail'] = part_map[product_id]
        
        # Get state info from state_id and set status
        # Note: fix_oid already converted state_id to string if it was ObjectId
        if req.get('state_id'):
            states_collection = db['depo_requests_states']
            try:
                # We need ObjectId for lookup
                state_id_obj = ObjectId(req['state_id'])
                state = states_collection.find_one({'_id': state_id_obj})
                if state:
                    # Set status from state name
                    req['status'] = state.get('name', 'Unknown')
            except Exception as e:
                print(f"[ERROR] Failed to lookup state for request {req.get('_id')}: {e}")
        if not req.get('status'):
            req['status'] = 'Pending'
        
        # Handle dates that might be datetime objects (fix_oid doesn't touch datetime unless we add it)
        # But fix_oid above didn't handle datetime.
        # Let's verify if pymongo returns datetime or strings. It returns datetime.
        # We should handle datetime in fix_oid or separately.
        
        # Let's perform manual datetime conversion as before to be safe/consistent
        if 'created_at' in req and isinstance(req['created_at'], datetime):
            req['created_at'] = req['created_at'].isoformat()
        if 'updated_at' in req and isinstance(req['updated_at'], datetime):
            req['updated_at'] = req['updated_at'].isoformat()
        if 'issue_date' in req and isinstance(req['issue_date'], datetime):
            req['issue_date'] = req['issue_date'].isoformat()
            
        processed_list.append(req)
    
    return {
        "results": processed_list,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{request_id}")
async def get_request(
    request_id: str,
    current_user: dict = Depends(require_section("requests"))
):
    """Get a specific request by ID with location and part details from MongoDB"""
    db = get_db()
    requests_collection = db['depo_requests']
    locations_collection = db['depo_locations']
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    req = requests_collection.find_one({'_id': req_obj_id})
    
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    _ensure_request_scope(db, current_user, req)
    
    # Convert source and destination ObjectIds to strings
    if req.get('source'):
        if isinstance(req['source'], ObjectId):
            req['source'] = str(req['source'])
    
    if req.get('destination'):
        if isinstance(req['destination'], ObjectId):
            req['destination'] = str(req['destination'])
    
    # Get source location details from MongoDB
    if req.get('source'):
        try:
            source_oid = ObjectId(req['source'])
            source_loc = locations_collection.find_one({'_id': source_oid})
            if source_loc:
                req['source_detail'] = {
                    '_id': str(source_loc['_id']),
                    'name': source_loc.get('code', str(source_loc['_id'])),
                    'code': source_loc.get('code', ''),
                    'description': source_loc.get('description', '')
                }
        except Exception as e:
            print(f"Warning: Failed to get source location: {e}")
    
    # Get destination location details from MongoDB
    if req.get('destination'):
        try:
            dest_oid = ObjectId(req['destination'])
            dest_loc = locations_collection.find_one({'_id': dest_oid})
            if dest_loc:
                req['destination_detail'] = {
                    '_id': str(dest_loc['_id']),
                    'name': dest_loc.get('code', str(dest_loc['_id'])),
                    'code': dest_loc.get('code', ''),
                    'description': dest_loc.get('description', '')
                }
        except Exception as e:
            print(f"Warning: Failed to get destination location: {e}")

    # Get initial destination details if request was rejected/returned
    if req.get('reception_initial_destination'):
        try:
            init_dest = req.get('reception_initial_destination')
            init_dest_oid = ObjectId(init_dest) if isinstance(init_dest, str) else init_dest
            init_dest_loc = locations_collection.find_one({'_id': init_dest_oid})
            if init_dest_loc:
                req['reception_initial_destination_detail'] = {
                    '_id': str(init_dest_loc['_id']),
                    'name': init_dest_loc.get('code', str(init_dest_loc['_id'])),
                    'code': init_dest_loc.get('code', ''),
                    'description': init_dest_loc.get('description', '')
                }
                if isinstance(req.get('reception_initial_destination'), ObjectId):
                    req['reception_initial_destination'] = str(req.get('reception_initial_destination'))
        except Exception as e:
            print(f"Warning: Failed to get initial destination: {e}")
    
    # Get part details for each item from MongoDB depo_parts
    if req.get('items'):
        parts_collection = db['depo_parts']
        for item in req['items']:
            if item.get('part'):
                try:
                    part = None
                    # Try ObjectId first
                    part_oid = ObjectId(item['part']) if isinstance(item['part'], str) else item['part']
                    part = parts_collection.find_one({"_id": part_oid})
                    # Fallback to legacy numeric ID
                    if not part:
                        part_val = str(item['part'])
                        if part_val.isdigit():
                            part = parts_collection.find_one({"id": int(part_val)})
                    if part:
                        item['part_detail'] = {
                            '_id': str(part['_id']),
                            'name': part.get('name', ''),
                            'IPN': part.get('ipn', ''),
                            'description': part.get('description', ''),
                            'active': part.get('active', True),
                            'assembly': part.get('assembly', False),
                            'component': part.get('component', False),
                            'purchaseable': part.get('purchaseable', False),
                            'salable': part.get('salable', False),
                            'trackable': part.get('trackable', False),
                            'virtual': part.get('virtual', False)
                        }
                except Exception as e:
                    print(f"Warning: Failed to get part details: {e}")
            if item.get('location_id') and isinstance(item.get('location_id'), ObjectId):
                item['location_id'] = str(item['location_id'])
    
    # Get product details if product_id exists (for recipe-based requests)
    if req.get('product_id'):
        parts_collection = db['depo_parts']
        try:
            product_oid = ObjectId(req['product_id']) if isinstance(req['product_id'], str) else req['product_id']
            product = parts_collection.find_one({"_id": product_oid})
            if product:
                req['product_detail'] = {
                    '_id': str(product['_id']),
                    'name': product.get('name', ''),
                    'IPN': product.get('ipn', ''),
                    'description': product.get('description', '')
                }
        except Exception as e:
            print(f"Warning: Failed to get product details: {e}")
    
    # Convert all ObjectIds to strings
    req['_id'] = str(req['_id'])
    
    # Get state level and order from depo_requests_states using state_id
    if req.get('state_id'):
        states_collection = db['depo_requests_states']
        try:
            state_id_obj = req['state_id'] if isinstance(req['state_id'], ObjectId) else ObjectId(req['state_id'])
            state = states_collection.find_one({'_id': state_id_obj})
            if state:
                req['state_level'] = state.get('workflow_level', 0)  # Use workflow_level not level
                req['state_order'] = state.get('order', 0)  # Add order field
                # Populate state_detail
                req['state_detail'] = {
                    '_id': str(state['_id']),
                    'name': state.get('name', 'Unknown'),
                    'slug': state.get('slug', ''),
                    'workflow_level': state.get('workflow_level', 0),
                    'order': state.get('order', 0)
                }
                # Also set status from state if not present
                if not req.get('status'):
                    req['status'] = state.get('name', 'Unknown')
            else:
                req['state_level'] = 0
                req['state_order'] = 0
        except Exception as e:
            print(f"[ERROR] Failed to lookup state: {e}")
            req['state_level'] = 0
            req['state_order'] = 0
    else:
        req['state_level'] = 0
        req['state_order'] = 0

    if not req.get('status'):
        req['status'] = 'Pending'
    
    # Convert state_id if present
    if 'state_id' in req and isinstance(req['state_id'], ObjectId):
        req['state_id'] = str(req['state_id'])

    if 'reception_initial_destination' in req and isinstance(req['reception_initial_destination'], ObjectId):
        req['reception_initial_destination'] = str(req['reception_initial_destination'])
    if 'reception_rejected_state_id' in req and isinstance(req['reception_rejected_state_id'], ObjectId):
        req['reception_rejected_state_id'] = str(req['reception_rejected_state_id'])
    if isinstance(req.get('reception_rejected_by'), dict):
        user_id = req['reception_rejected_by'].get('user_id')
        if isinstance(user_id, ObjectId):
            req['reception_rejected_by']['user_id'] = str(user_id)
    
    # Convert recipe ObjectIds if present
    if 'recipe_id' in req and isinstance(req['recipe_id'], ObjectId):
        req['recipe_id'] = str(req['recipe_id'])
    if 'recipe_part_id' in req and isinstance(req['recipe_part_id'], ObjectId):
        req['recipe_part_id'] = str(req['recipe_part_id'])
    if 'build_order_id' in req and isinstance(req['build_order_id'], ObjectId):
        req['build_order_id'] = str(req['build_order_id'])
    
    # Convert status_log ObjectIds to strings
    if 'status_log' in req and req['status_log']:
        for log_entry in req['status_log']:
            if 'status_id' in log_entry and isinstance(log_entry['status_id'], ObjectId):
                log_entry['status_id'] = str(log_entry['status_id'])
            if 'created_at' in log_entry and isinstance(log_entry['created_at'], datetime):
                log_entry['created_at'] = log_entry['created_at'].isoformat()
    
    # Convert datetime to ISO format
    if 'created_at' in req and isinstance(req['created_at'], datetime):
        req['created_at'] = req['created_at'].isoformat()
    if 'updated_at' in req and isinstance(req['updated_at'], datetime):
        req['updated_at'] = req['updated_at'].isoformat()
    if 'issue_date' in req and isinstance(req['issue_date'], datetime):
        req['issue_date'] = req['issue_date'].isoformat()
    
    return req


@router.get("/{request_id}/movements")
async def get_request_movements(
    request_id: str,
    current_user: dict = Depends(require_section("requests"))
):
    """Get stock movements associated with a request (transfer/in-transit)"""
    db = get_db()

    try:
        req_oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    req_doc = db.depo_requests.find_one({"_id": req_oid})
    if not req_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    _ensure_request_scope(db, current_user, req_doc)

    movements = list(db.depo_stocks_movements.find({
        'document_id': {'$in': [req_oid, request_id]},
        'document_type': {'$regex': 'REQUEST', '$options': 'i'}
    }))

    if not movements:
        return {"results": []}

    # Prepare lookups
    state_ids = set()
    location_ids = set()
    for mov in movements:
        if mov.get('state_id'):
            state_ids.add(mov.get('state_id'))
        for loc_key in ('from_location_id', 'to_location_id', 'source_id', 'destination_id'):
            if mov.get(loc_key):
                location_ids.add(mov.get(loc_key))

    state_map = {}
    if state_ids:
        states = list(db.depo_stocks_states.find({'_id': {'$in': list(state_ids)}}))
        for st in states:
            state_map[str(st['_id'])] = {
                'name': st.get('name', ''),
                'color': st.get('color', 'gray')
            }

    location_map = {}
    if location_ids:
        locations = list(db.depo_locations.find({'_id': {'$in': list(location_ids)}}))
        for loc in locations:
            location_map[str(loc['_id'])] = loc.get('code', loc.get('name', str(loc['_id'])))

    # Serialize + enrich
    results = []
    for mov in movements:
        mov['_id'] = str(mov['_id'])
        for key in ('stock_id', 'part_id', 'document_id', 'state_id', 'from_location_id', 'to_location_id', 'source_id', 'destination_id'):
            if mov.get(key):
                mov[key] = str(mov[key])

        state_detail = state_map.get(mov.get('state_id'))
        if state_detail:
            mov['state_detail'] = state_detail

        source_id = mov.get('source_id') or mov.get('from_location_id')
        dest_id = mov.get('destination_id') or mov.get('to_location_id')
        mov['source_name'] = location_map.get(source_id, source_id)
        mov['destination_name'] = location_map.get(dest_id, dest_id)

        if mov.get('created_at') and isinstance(mov.get('created_at'), datetime):
            mov['created_at'] = mov['created_at'].isoformat()
        if mov.get('date') and isinstance(mov.get('date'), datetime):
            mov['date'] = mov['date'].isoformat()

        results.append(mov)

    return {"results": results}


@router.post("/")
async def create_request(
    request_data: RequestCreate,
    current_user: dict = Depends(require_section("requests"))
):
    """Create a new request"""
    db = get_db()
    requests_collection = db['depo_requests']
    
    # Validate source != destination
    if request_data.source == request_data.destination:
        raise HTTPException(status_code=400, detail="Source and destination cannot be the same")

    # Enforce destination access if user has assigned locations
    allowed_destinations = _get_user_location_ids(db, current_user)
    if allowed_destinations and str(request_data.destination) not in allowed_destinations:
        raise HTTPException(status_code=403, detail="Destination location not allowed for current user")
    
    # Generate reference
    reference = generate_request_reference(db)
    
    # Create request document
    # Set init_q (initial quantity) for each item if not provided
    items_with_init_q = []
    for item in request_data.items:
        item_dict = item.dict()
        # Enforce item location to match request source if provided
        if item_dict.get("location_id") and str(item_dict.get("location_id")) != str(request_data.source):
            raise HTTPException(status_code=400, detail="Item location must match request source")
        if item_dict.get('init_q') is None:
            item_dict['init_q'] = item_dict['quantity']  # Save initial quantity
        items_with_init_q.append(item_dict)
    
    request_doc = {
        'reference': reference,
        'source': request_data.source,
        'destination': request_data.destination,
        'items': items_with_init_q,
        'line_items': len(request_data.items),
        'notes': request_data.notes or '',
        'labels': request_data.labels or [],
        'issue_date': datetime.utcnow(),
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }
    
    # Add recipe information if provided
    if request_data.recipe_id:
        request_doc['recipe_id'] = ObjectId(request_data.recipe_id)
    if request_data.recipe_part_id:
        request_doc['recipe_part_id'] = ObjectId(request_data.recipe_part_id)
    if request_data.product_id:
        request_doc['product_id'] = request_data.product_id
    if request_data.product_quantity:
        request_doc['product_quantity'] = request_data.product_quantity
    
    result = requests_collection.insert_one(request_doc)
    request_id = str(result.inserted_id)
    request_doc['_id'] = request_id
    
    # Convert all ObjectIds to strings
    if 'recipe_id' in request_doc and isinstance(request_doc['recipe_id'], ObjectId):
        request_doc['recipe_id'] = str(request_doc['recipe_id'])
    if 'recipe_part_id' in request_doc and isinstance(request_doc['recipe_part_id'], ObjectId):
        request_doc['recipe_part_id'] = str(request_doc['recipe_part_id'])
    
    # Convert datetime to ISO format
    request_doc['created_at'] = request_doc['created_at'].isoformat()
    request_doc['updated_at'] = request_doc['updated_at'].isoformat()
    request_doc['issue_date'] = request_doc['issue_date'].isoformat()
    
    # Auto-create approval flow
    try:
        # Get request approval config from MongoDB (use operations flow config)
        config_collection = db['config']
        approval_config = config_collection.find_one({'slug': 'requests_operations_flow'})
        
        if approval_config and 'items' in approval_config:
            # Get the operations flow config (first item with slug='operations')
            flow_config = None
            for item in approval_config.get('items', []):
                if item.get('slug') == 'operations' and item.get('enabled', True):
                    flow_config = item
                    break
            
            if flow_config:
                # Build can_sign list
                can_sign_officers = []
                for user in flow_config.get('can_sign', []):
                    can_sign_officers.append({
                        "type": "person",
                        "reference": user.get('user_id'),
                        "username": user.get('username'),
                        "action": "can_sign"
                    })
                
                # Build must_sign list
                must_sign_officers = []
                for user in flow_config.get('must_sign', []):
                    must_sign_officers.append({
                        "type": "person",
                        "reference": user.get('user_id'),
                        "username": user.get('username'),
                        "action": "must_sign"
                    })
                
                flow_data = {
                    "object_type": "stock_request",
                    "object_source": "depo_request",
                    "object_id": request_id,
                    "config_slug": flow_config.get('slug'),
                    "min_signatures": flow_config.get('min_signatures', 1),
                    "can_sign_officers": can_sign_officers,
                    "must_sign_officers": must_sign_officers,
                    "signatures": [],
                    "status": "pending",
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                db.approval_flows.insert_one(flow_data)
                print(f"[REQUESTS] Auto-created approval flow for request {request_id}")
    except Exception as e:
        print(f"[REQUESTS] Warning: Failed to auto-create approval flow: {e}")
        # Don't fail the request creation if approval flow creation fails
    
    return request_doc


@router.patch("/{request_id}")
async def update_request(
    request_id: str,
    request_data: RequestUpdate,
    current_user: dict = Depends(require_section("requests"))
):
    """Update a request"""
    db = get_db()
    requests_collection = db['depo_requests']
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    # Get existing request
    existing = requests_collection.find_one({'_id': req_obj_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Request not found")

    _ensure_request_scope(db, current_user, existing)

    # Determine source for validation (new or existing)
    existing_source = existing.get('source')
    if isinstance(existing_source, ObjectId):
        existing_source = str(existing_source)
    source_value = request_data.source if request_data.source is not None else existing_source

    # Enforce destination access if user has assigned locations
    if request_data.destination is not None:
        allowed_destinations = _get_user_location_ids(db, current_user)
        if allowed_destinations and str(request_data.destination) not in allowed_destinations:
            raise HTTPException(status_code=403, detail="Destination location not allowed for current user")

    # Enforce item location to match source if items are provided
    if request_data.items is not None:
        for item in request_data.items:
            loc_id = item.location_id if hasattr(item, "location_id") else None
            if loc_id and source_value and str(loc_id) != str(source_value):
                raise HTTPException(status_code=400, detail="Item location must match request source")
    
    # Prepare update
    update_data = {
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username')
    }
    unset_data = {'status': ""}
    
    if request_data.source is not None:
        update_data['source'] = request_data.source
    if request_data.destination is not None:
        update_data['destination'] = request_data.destination
    if request_data.notes is not None:
        update_data['notes'] = request_data.notes
    if request_data.labels is not None:
        update_data['labels'] = request_data.labels
    if request_data.batch_codes is not None:
        update_data['batch_codes'] = request_data.batch_codes
        if request_data.batch_codes:
            update_data['open'] = True
        else:
            unset_data['open'] = ""
    if request_data.issue_date is not None:
        # Parse date string to datetime
        try:
            update_data['issue_date'] = datetime.fromisoformat(request_data.issue_date.replace('Z', '+00:00'))
        except:
            update_data['issue_date'] = datetime.utcnow()
    if request_data.items is not None:
        # Convert items to dict and ensure init_q is set
        items_data = []
        for item in request_data.items:
            item_dict = item.dict()
            # Ensure init_q is set if not provided
            if item_dict.get('init_q') is None and item_dict.get('quantity') is not None:
                item_dict['init_q'] = item_dict['quantity']
            items_data.append(item_dict)
        
        update_data['items'] = items_data
        update_data['line_items'] = len(request_data.items)
    
    # Validate source != destination if both are being updated
    source = update_data.get('source', existing.get('source'))
    destination = update_data.get('destination', existing.get('destination'))
    if source == destination:
        raise HTTPException(status_code=400, detail="Source and destination cannot be the same")
    
    try:
        update_doc = {'$set': update_data}
        if unset_data:
            update_doc['$unset'] = unset_data
        requests_collection.update_one(
            {'_id': req_obj_id},
            update_doc
        )
    except Exception as e:
        print(f"[ERROR] Failed to update request: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=422, detail=f"Failed to update request: {str(e)}")
    
    # Get updated request
    updated = requests_collection.find_one({'_id': req_obj_id})
    updated['_id'] = str(updated['_id'])

    # If batch codes were updated and request is already approved, ensure build orders exist
    try:
        if request_data.batch_codes is not None and request_data.batch_codes:
            state_doc = None
            if updated.get('state_id'):
                state_doc = db.depo_requests_states.find_one({'_id': updated['state_id']})
            state_slug = (state_doc.get('slug') if state_doc else '') or ''
            state_name = (state_doc.get('name') if state_doc else '') or ''
            if state_slug.lower() == 'approved' or state_name.lower() == 'approved':
                ensure_build_orders_for_request(db, updated, datetime.utcnow())
    except Exception as e:
        print(f"[REQUESTS] Warning: Failed to ensure build orders on update: {e}")
    
    # Convert state_id if present
    if 'state_id' in updated and isinstance(updated['state_id'], ObjectId):
        updated['state_id'] = str(updated['state_id'])
    
    # Convert source and destination ObjectIds to strings
    if updated.get('source') and isinstance(updated['source'], ObjectId):
        updated['source'] = str(updated['source'])
    if updated.get('destination') and isinstance(updated['destination'], ObjectId):
        updated['destination'] = str(updated['destination'])
    
    # Convert recipe ObjectIds if present
    if 'recipe_id' in updated and isinstance(updated['recipe_id'], ObjectId):
        updated['recipe_id'] = str(updated['recipe_id'])
    if 'recipe_part_id' in updated and isinstance(updated['recipe_part_id'], ObjectId):
        updated['recipe_part_id'] = str(updated['recipe_part_id'])
    
    # Populate part_detail for items
    if 'items' in updated and updated['items']:
        parts_collection = db['depo_parts']
        for item in updated['items']:
            if 'part' in item:
                try:
                    part = None
                    part_oid = ObjectId(item['part']) if isinstance(item['part'], str) else item['part']
                    part = parts_collection.find_one({"_id": part_oid})
                    if not part:
                        part_val = str(item['part'])
                        if part_val.isdigit():
                            part = parts_collection.find_one({"id": int(part_val)})
                    if part:
                        item['part_detail'] = {
                            '_id': str(part['_id']),
                            'name': part.get('name', ''),
                            'IPN': part.get('ipn', ''),
                            'description': part.get('description', ''),
                            'active': part.get('active', True)
                        }
                except:
                    pass
            if item.get('location_id') and isinstance(item.get('location_id'), ObjectId):
                item['location_id'] = str(item['location_id'])
    
    # Convert status_log ObjectIds to strings
    if 'status_log' in updated and updated['status_log']:
        for log_entry in updated['status_log']:
            if 'status_id' in log_entry and isinstance(log_entry['status_id'], ObjectId):
                log_entry['status_id'] = str(log_entry['status_id'])
            if 'created_at' in log_entry and isinstance(log_entry['created_at'], datetime):
                log_entry['created_at'] = log_entry['created_at'].isoformat()
    
    # Convert datetime to ISO format
    if 'created_at' in updated and isinstance(updated['created_at'], datetime):
        updated['created_at'] = updated['created_at'].isoformat()
    if 'updated_at' in updated and isinstance(updated['updated_at'], datetime):
        updated['updated_at'] = updated['updated_at'].isoformat()
    if 'issue_date' in updated and isinstance(updated['issue_date'], datetime):
        updated['issue_date'] = updated['issue_date'].isoformat()
    
    return updated


@router.delete("/{request_id}")
async def delete_request(
    request_id: str,
    current_user: dict = Depends(require_section("requests"))
):
    """Delete a request"""
    db = get_db()
    requests_collection = db['depo_requests']
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    existing = requests_collection.find_one({'_id': req_obj_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Request not found")
    _ensure_request_scope(db, current_user, existing)

    result = requests_collection.delete_one({'_id': req_obj_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {"success": True, "message": "Request deleted successfully"}
