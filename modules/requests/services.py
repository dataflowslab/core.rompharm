"""
Service functions for requests module - external API calls and business logic
"""
import requests
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import HTTPException
from bson import ObjectId
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from src.backend.utils.serializers import serialize_doc
from src.backend.utils.stock_utils import get_transactionable_state_ids, is_stock_transactionable

from src.backend.utils.config import load_config


async def fetch_stock_locations(current_user: dict, db=None) -> Dict[str, Any]:
    """Get list of stock locations from MongoDB depo_locations"""
    from src.backend.utils.db import get_db
    
    if db is None:
        db = get_db()
    
    locations_collection = db['depo_locations']
    
    try:
        locations = list(locations_collection.find())
        
        # Convert ObjectId to string and format for frontend
        results = []
        for loc in locations:
            loc_id = str(loc['_id'])
            results.append({
                '_id': loc_id,
                'name': loc.get('code', str(loc['_id'])),  # Use code as name
                'code': loc.get('code', ''),
                'description': loc.get('description', '')
            })
        
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock locations: {str(e)}")


async def search_parts(
    db,
    search: Optional[str] = None,
    location_id: Optional[str] = None,
    is_assembly: Optional[bool] = None
) -> Dict[str, Any]:
    """Get list of parts from MongoDB depo_parts with search, optionally filtered by location stock"""
    if not search or len(search.strip()) < 2:
        return {"results": [], "count": 0}
    
    try:
        search_term = search.strip()
        
        # Search in depo_parts collection by name or IPN (case-insensitive)
        query = {
            "$or": [
                {"name": {"$regex": search_term, "$options": "i"}},
                {"ipn": {"$regex": search_term, "$options": "i"}}
            ]
        }

        if is_assembly is not None:
            query["is_assembly"] = is_assembly

        # Optional filter: only parts that have requestable stock in a specific location
        # Special case: allow assemblies regardless of location availability
        if location_id:
            try:
                location_oid = ObjectId(location_id)
                location_values = [location_oid, location_id]
            except Exception:
                return {"results": [], "count": 0}

            requestable_states = list(db.depo_stocks_states.find({
                "is_requestable": True
            }, {"_id": 1}))
            allowed_state_ids = [state["_id"] for state in requestable_states]
            part_ids = []
            if allowed_state_ids:
                part_ids = db.depo_stocks.distinct(
                    "part_id",
                    {
                        "location_id": {"$in": location_values},
                        "state_id": {"$in": allowed_state_ids},
                        "quantity": {"$gt": 0}
                    }
                )

            # Include assemblies regardless of location stock availability
            location_or_assembly = {
                "$or": [
                    {"_id": {"$in": part_ids}},
                    {"is_assembly": True}
                ]
            }
            query = {"$and": [query, location_or_assembly]}
        
        parts = list(db.depo_parts.find(query).limit(30))
        
        # Use serialize_doc to automatically add 'value' field
        serialized_parts = serialize_doc(parts)
        
        # Map 'ipn' to 'IPN' for frontend compatibility
        results = []
        for part in serialized_parts:
            results.append({
                "_id": part.get("_id"),
                "value": part.get("value"),  # Added by serialize_doc
                "name": part.get("name", ""),
                "IPN": part.get("ipn", "")  # Map 'ipn' to 'IPN'
            })
        
        return {
            "results": results,
            "count": len(results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch parts: {str(e)}")


async def get_part_stock_info(db, part_id: str, location_id: Optional[str] = None) -> Dict[str, Any]:
    """Get stock information for a part from MongoDB depo_stocks with batches
    
    Shows stock with states where is_requestable = true
    Uses part_id as ObjectId string directly
    """
    try:
        # Convert part_id string to ObjectId
        try:
            part_oid = ObjectId(part_id)
        except:
            return {
                "_id": part_id,
                "total": 0,
                "in_sales": 0,
                "in_builds": 0,
                "in_procurement": 0,
                "available": 0,
                "batches": []
            }
        
        # Get all states where is_requestable = true
        requestable_states = list(db.depo_stocks_states.find({
            "is_requestable": True
        }))
        
        # If no requestable states found, return empty
        if not requestable_states:
            return {
                "part_id": part_id,
                "total": 0,
                "in_sales": 0,
                "in_builds": 0,
                "in_procurement": 0,
                "available": 0,
                "batches": []
            }
        
        allowed_state_ids = [state["_id"] for state in requestable_states]

        state_info_map = {}
        for state in requestable_states:
            state_info_map[str(state["_id"])] = {
                "name": state.get("name", ""),
                "color": state.get("color", "gray"),
                "is_transferable": state.get("is_transferable", False),
                "is_requestable": state.get("is_requestable", False)
            }
        
        # Optional location filter
        location_oid = None
        if location_id:
            try:
                location_oid = ObjectId(location_id)
            except Exception:
                return {
                    "part_id": part_id,
                    "total": 0,
                    "in_sales": 0,
                    "in_builds": 0,
                    "in_procurement": 0,
                    "available": 0,
                    "batches": []
                }

        base_query = {
            "part_id": part_oid,
            "state_id": {"$in": allowed_state_ids}
        }

        stock_records = list(db.depo_stocks.find(base_query))
        stock_map = {s.get('_id'): s for s in stock_records if s.get('_id')}

        balances = []
        receipt_stock_ids = set()
        if stock_map:
            balances_query: Dict[str, Any] = {
                "stock_id": {"$in": list(stock_map.keys())}
            }
            if location_oid:
                balances_query["location_id"] = location_oid
            balances = list(db.depo_stocks_balances.find(balances_query))

            movements = list(db.depo_stocks_movements.find(
                {"stock_id": {"$in": list(stock_map.keys())}},
                {"stock_id": 1, "movement_type": 1}
            ))
            for mov in movements:
                if str(mov.get("movement_type", "")).upper() == "RECEIPT":
                    receipt_stock_ids.add(mov.get("stock_id"))

        balances_by_stock: Dict[ObjectId, Dict[ObjectId, float]] = {}
        for bal in balances:
            stock_id = bal.get("stock_id")
            loc_id = bal.get("location_id")
            if not stock_id or not loc_id:
                continue
            if location_oid and loc_id != location_oid:
                continue
            balances_by_stock.setdefault(stock_id, {})
            balances_by_stock[stock_id][loc_id] = balances_by_stock[stock_id].get(loc_id, 0) + bal.get("quantity", 0)

        stock_records = []
        for stock in stock_map.values():
            stock_id = stock.get("_id")
            base_qty = stock.get("quantity")
            if base_qty is None:
                base_qty = stock.get("initial_quantity", 0)
            base_qty = base_qty or 0
            base_location = stock.get("location_id") or stock.get("initial_location_id")

            has_receipt = stock_id in receipt_stock_ids
            stock_balances = balances_by_stock.get(stock_id, {})

            if stock_balances:
                for loc_id, bal_qty in stock_balances.items():
                    qty = bal_qty
                    if not has_receipt and base_location and loc_id == base_location:
                        qty += base_qty
                    if qty > 0:
                        stock_copy = stock.copy()
                        stock_copy["location_id"] = loc_id
                        stock_copy["quantity"] = qty
                        stock_records.append(stock_copy)

                if not has_receipt and base_location and base_location not in stock_balances and base_qty > 0:
                    if not location_oid or base_location == location_oid:
                        stock_copy = stock.copy()
                        stock_copy["location_id"] = base_location
                        stock_copy["quantity"] = base_qty
                        stock_records.append(stock_copy)
            else:
                if base_location and base_qty > 0:
                    if not location_oid or base_location == location_oid:
                        stock_copy = stock.copy()
                        stock_copy["location_id"] = base_location
                        stock_copy["quantity"] = base_qty
                        stock_records.append(stock_copy)
        
        if stock_records:
            location_ids = list(set([stock.get("location_id") for stock in stock_records if stock.get("location_id")]))
            locations = list(db.depo_locations.find({"_id": {"$in": location_ids}})) if location_ids else []
            location_map = {str(loc["_id"]): loc.get("code", loc.get("name", str(loc["_id"]))) for loc in locations}

            parent_ids = set()
            for loc in locations:
                if loc.get("parent_id"):
                    parent_ids.add(loc.get("parent_id"))
            parents = list(db.depo_locations.find({"_id": {"$in": list(parent_ids)}})) if parent_ids else []
            parent_map = {str(loc["_id"]): loc.get("code", loc.get("name", str(loc["_id"]))) for loc in parents}

            location_parent_map = {}
            for loc in locations:
                loc_id_str = str(loc.get("_id"))
                parent_id = loc.get("parent_id")
                if parent_id:
                    parent_id_str = str(parent_id)
                    location_parent_map[loc_id_str] = {
                        "parent_id": parent_id_str,
                        "parent_name": parent_map.get(parent_id_str, parent_id_str)
                    }
                else:
                    location_parent_map[loc_id_str] = {
                        "parent_id": None,
                        "parent_name": None
                    }

            # Calculate totals
            total = sum(s.get("quantity", 0) for s in stock_records)
            
            # Group batches by batch_code (don't group by location - show all entries)
            batches = []
            for stock in stock_records:
                quantity = stock.get("quantity", 0)
                if quantity > 0:
                    batch_code = stock.get("batch_code", "")
                    
                    # Extract location_id
                    location = stock.get("location_id")
                    if isinstance(location, ObjectId):
                        location_id = str(location)
                    elif isinstance(location, dict) and "$oid" in location:
                        location_id = location["$oid"]
                    else:
                        location_id = str(location) if location else ""
                    
                    # Extract state_id
                    state_id = stock.get("state_id")
                    if isinstance(state_id, ObjectId):
                        state_id_str = str(state_id)
                    else:
                        state_id_str = str(state_id) if state_id else ""

                    is_transactionable = is_stock_transactionable(state_id)
                    
                    # Get state info
                    state_info = state_info_map.get(state_id_str, {})
                    location_name = location_map.get(location_id, location_id)
                    parent_info = location_parent_map.get(location_id, {})
                    
                    batches.append({
                        "batch_code": batch_code,
                        "supplier_batch_code": stock.get("supplier_batch_code", ""),
                        "quantity": quantity,
                        "location_id": location_id,
                        "location_name": location_name,
                        "location_parent_id": parent_info.get("parent_id"),
                        "location_parent_name": parent_info.get("parent_name"),
                        "state_id": state_id_str,
                        "state_name": state_info.get("name", ""),
                        "state_color": state_info.get("color", "gray"),
                        "is_transferable": state_info.get("is_transferable", False),
                        "is_requestable": state_info.get("is_requestable", False),
                        "is_transactionable": is_transactionable,
                        "expiry_date": stock.get("expiry_date", ""),
                        "batch_date": stock.get("batch_date", "")
                    })
            
            return {
                "part_id": part_id,
                "total": total,
                "in_sales": 0,  # TODO: Calculate from allocations
                "in_builds": 0,  # TODO: Calculate from allocations
                "in_procurement": 0,  # TODO: Calculate from allocations
                "available": total,  # For now, total = available
                "batches": batches
            }
        else:
            # No stock records found
            return {
                "part_id": part_id,
                "total": 0,
                "in_sales": 0,
                "in_builds": 0,
                "in_procurement": 0,
                "available": 0,
                "batches": []
            }
    except Exception as e:
        print(f"[ERROR] Failed to fetch stock info for part {part_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock info: {str(e)}")


async def fetch_part_bom(current_user: dict, part_id: str, db=None) -> Dict[str, Any]:
    """Get BOM (Bill of Materials) for a part from MongoDB depo_bom using ObjectId"""
    from src.backend.utils.db import get_db
    
    if db is None:
        db = get_db()
    
    try:
        # Convert part_id string to ObjectId
        try:
            part_oid = ObjectId(part_id)
        except:
            return {"results": []}
        
        # Get BOM items from depo_bom collection
        bom_items = list(db.depo_bom.find({"part_id": part_oid}))
        
        # Format results
        results = []
        for bom_item in bom_items:
            sub_part_id = bom_item.get("sub_part_id")
            if sub_part_id:
                # Get sub-part details
                sub_part = db.depo_parts.find_one({"_id": sub_part_id})
                if sub_part:
                    results.append({
                        "_id": str(bom_item.get("_id")),
                        "part": part_id,
                        "sub_part": sub_part.get("id"),
                        "sub_part_detail": {
                            "_id": str(sub_part.get("_id")),
                            "name": sub_part.get("name", ""),
                            "IPN": sub_part.get("ipn", "")
                        },
                        "quantity": bom_item.get("quantity", 1),
                        "reference": bom_item.get("reference", ""),
                        "note": bom_item.get("note", "")
                    })
        
        return {"results": results}
    except Exception as e:
        print(f"Error fetching BOM: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch BOM: {str(e)}")


async def fetch_part_batch_codes(current_user: dict, part_id: str, location_id: Optional[str] = None, db=None) -> Dict[str, Any]:
    """Get available batch codes for a part from MongoDB depo_stocks using ObjectId
    
    Returns batch codes where state has is_requestable = true
    Also includes state info (is_transferable, name) for frontend validation
    Groups by batch_code and location_id to show all available locations
    """
    from src.backend.utils.db import get_db
    
    if db is None:
        db = get_db()
    
    try:
        # Convert part_id string to ObjectId
        try:
            part_oid = ObjectId(part_id)
        except:
            return {"batch_codes": []}
        
        # Get transactionable state IDs (global filter for all stock operations)
        transactionable_state_ids = get_transactionable_state_ids()
        
        # Get state details for these IDs
        requestable_states = list(db.depo_stocks_states.find({
            "_id": {"$in": transactionable_state_ids}
        }))
        
        # If no states found, return empty
        if not requestable_states:
            print(f"[BATCH_CODES] No transactionable states found")
            return {"batch_codes": []}
        
        print(f"[BATCH_CODES] Found {len(requestable_states)} transactionable states")
        
        # Create state info map for later use
        state_info_map = {}
        for state in requestable_states:
            state_info_map[str(state["_id"])] = {
                "name": state.get("name", ""),
                "color": state.get("color", "gray"),
                "is_transferable": state.get("is_transferable", False),
                "is_requestable": state.get("is_requestable", False)
            }
        
        # Build base query (ledger-first; no quantity filter here)
        base_query = {
            "part_id": part_oid,
            "state_id": {"$in": transactionable_state_ids}
        }

        stock_records = list(db.depo_stocks.find(base_query))
        stock_map = {s.get('_id'): s for s in stock_records if s.get('_id')}

        balances = []
        receipt_stock_ids = set()
        location_oid = None

        if location_id:
            try:
                location_oid = ObjectId(location_id)
                print(f"[BATCH_CODES] Filtering by location: {location_id}")
            except:
                print(f"[BATCH_CODES] Warning: Invalid location_id format: {location_id}")
                location_oid = None

        if stock_map:
            balances_query: Dict[str, Any] = {
                "stock_id": {"$in": list(stock_map.keys())}
            }
            if location_oid:
                balances_query["location_id"] = location_oid
            balances = list(db.depo_stocks_balances.find(balances_query))

            # Identify stocks that already have RECEIPT movements (ledger initialized)
            movements = list(db.depo_stocks_movements.find(
                {"stock_id": {"$in": list(stock_map.keys())}},
                {"stock_id": 1, "movement_type": 1}
            ))
            for mov in movements:
                if str(mov.get("movement_type", "")).upper() == "RECEIPT":
                    receipt_stock_ids.add(mov.get("stock_id"))

        balances_by_stock: Dict[ObjectId, Dict[ObjectId, float]] = {}
        for bal in balances:
            stock_id = bal.get("stock_id")
            loc_id = bal.get("location_id")
            if not stock_id or not loc_id:
                continue
            if location_oid and loc_id != location_oid:
                continue
            balances_by_stock.setdefault(stock_id, {})
            balances_by_stock[stock_id][loc_id] = balances_by_stock[stock_id].get(loc_id, 0) + bal.get("quantity", 0)

        stock_records = []
        for stock in stock_map.values():
            stock_id = stock.get("_id")
            base_qty = stock.get("quantity")
            if base_qty is None:
                base_qty = stock.get("initial_quantity", 0)
            base_qty = base_qty or 0
            base_location = stock.get("location_id") or stock.get("initial_location_id")

            has_receipt = stock_id in receipt_stock_ids
            stock_balances = balances_by_stock.get(stock_id, {})

            if stock_balances:
                for loc_id, bal_qty in stock_balances.items():
                    qty = bal_qty
                    if not has_receipt and base_location and loc_id == base_location:
                        qty += base_qty
                    if qty > 0:
                        stock_copy = stock.copy()
                        stock_copy["location_id"] = loc_id
                        stock_copy["quantity"] = qty
                        stock_records.append(stock_copy)

                if not has_receipt and base_location and base_location not in stock_balances and base_qty > 0:
                    if not location_oid or base_location == location_oid:
                        stock_copy = stock.copy()
                        stock_copy["location_id"] = base_location
                        stock_copy["quantity"] = base_qty
                        stock_records.append(stock_copy)
            else:
                if base_location and base_qty > 0:
                    if not location_oid or base_location == location_oid:
                        stock_copy = stock.copy()
                        stock_copy["location_id"] = base_location
                        stock_copy["quantity"] = base_qty
                        stock_records.append(stock_copy)

        print(f"[BATCH_CODES] Computed {len(stock_records)} stock records for part {part_id}")
        
        # Get location names
        location_ids = list(set([stock.get("location_id") for stock in stock_records if stock.get("location_id")]))
        locations = list(db.depo_locations.find({"_id": {"$in": location_ids}})) if location_ids else []
        location_map = {str(loc["_id"]): loc.get("code", loc.get("name", str(loc["_id"]))) for loc in locations}

        parent_ids = set()
        for loc in locations:
            if loc.get("parent_id"):
                parent_ids.add(loc.get("parent_id"))
        parents = list(db.depo_locations.find({"_id": {"$in": list(parent_ids)}})) if parent_ids else []
        parent_map = {str(loc["_id"]): loc.get("code", loc.get("name", str(loc["_id"]))) for loc in parents}

        location_parent_map = {}
        for loc in locations:
            loc_id_str = str(loc.get("_id"))
            parent_id = loc.get("parent_id")
            if parent_id:
                parent_id_str = str(parent_id)
                location_parent_map[loc_id_str] = {
                    "parent_id": parent_id_str,
                    "parent_name": parent_map.get(parent_id_str, parent_id_str)
                }
            else:
                location_parent_map[loc_id_str] = {
                    "parent_id": None,
                    "parent_name": None
                }
        
        # Group by batch_code and location_id to show separate entries per location
        batch_location_map = {}
        for stock in stock_records:
            batch_code = stock.get("batch_code", "")
            location_id = str(stock.get("location_id", ""))
            state_id = str(stock.get("state_id", ""))
            
            if batch_code and batch_code.strip():
                # Create unique key for batch + location combination
                key = f"{batch_code}_{location_id}"
                
                if key not in batch_location_map:
                    # Get state info
                    state_info = state_info_map.get(state_id, {
                        "name": "Unknown",
                        "is_transferable": False,
                        "is_requestable": False
                    })
                    
                    expiry = stock.get("expiry_date", "")
                    location_name = location_map.get(location_id, location_id)
                    parent_info = location_parent_map.get(location_id, {})
                    is_transactionable = is_stock_transactionable(stock.get("state_id"))
                    
                    batch_location_map[key] = {
                        'batch_code': batch_code,
                        'value': batch_code,  # For Select component
                        'expiry_date': expiry,
                        'quantity': 0,
                        'location_id': location_id,
                        'location_name': location_name,
                        'location_parent_id': parent_info.get("parent_id"),
                        'location_parent_name': parent_info.get("parent_name"),
                        'state_id': state_id,
                        'state_name': state_info.get("name", ""),
                        'state_color': state_info.get("color", "gray"),
                        'is_transferable': state_info.get("is_transferable", False),
                        'is_requestable': state_info.get("is_requestable", False),
                        'is_transactionable': is_transactionable
                    }
                batch_location_map[key]['quantity'] += stock.get("quantity", 0)
        
        # Add label after quantity is calculated
        batch_codes = []
        for batch in batch_location_map.values():
            batch['label'] = f"{batch['batch_code']} ({batch['quantity']} buc) - {batch['location_name']}"
            batch_codes.append(batch)
        
        print(f"[BATCH_CODES] Returning {len(batch_codes)} batch codes")
        return {"batch_codes": batch_codes}
    except Exception as e:
        print(f"[BATCH_CODES] Error fetching batch codes: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch batch codes: {str(e)}")


async def fetch_part_recipe(db, current_user: dict, part_id: str) -> Dict[str, Any]:
    """
    Get recipe for a part (with fallback to BOM if no recipe exists)
    Uses part_id as ObjectId string
    """
    # Convert part_id string to ObjectId
    try:
        part_oid = ObjectId(part_id)
    except:
        raise HTTPException(status_code=404, detail="Invalid part ID")

    # Try to get recipe from depo_recipes using part_id (ObjectId)
    recipe = db.depo_recipes.find_one({"part_id": part_oid})

    if recipe:
        current_date = datetime.utcnow()

        # Collect all part_ids (ObjectIds) recursively
        def collect_part_ids(items):
            ids = []
            for item in items:
                if item.get("type") == 1 and item.get("part_id"):
                    part_id_val = item["part_id"]
                    if isinstance(part_id_val, ObjectId):
                        ids.append(part_id_val)
                    else:
                        ids.append(ObjectId(part_id_val))
                if item.get("items"):
                    ids.extend(collect_part_ids(item["items"]))
            return ids

        part_ids = collect_part_ids(recipe.get("items", []))
        parts = list(
            db.depo_parts.find({"_id": {"$in": part_ids}})
        )
        parts_map = {p["_id"]: p for p in parts}

        # Process recipe items
        def process_items(items):
            valid_items = []

            for item in items:
                start = item.get("start")
                fin = item.get("fin")

                is_valid = True
                if start and start > current_date:
                    is_valid = False
                if fin and fin < current_date:
                    is_valid = False

                if not is_valid:
                    continue

                processed_item = {
                    "type": item.get("type"),
                    "mandatory": item.get("mandatory", True),
                    "notes": item.get("notes"),
                }

                if item.get("type") == 1:
                    item_part_id = item.get("part_id")
                    if isinstance(item_part_id, ObjectId):
                        part_oid_key = item_part_id
                    else:
                        part_oid_key = ObjectId(item_part_id)
                    
                    part_data = parts_map.get(part_oid_key, {})
                    
                    # Skip items where part doesn't exist in depo_parts
                    if not part_data:
                        print(f"[WARNING] Recipe item references non-existent part: {str(part_oid_key)}")
                        continue
                    
                    processed_item.update({
                        "part_id": str(part_data.get("_id")),  # ObjectId string
                        "name": part_data.get("name", ""),
                        "IPN": part_data.get("ipn", ""),
                        "quantity": item.get("q", 1),
                    })
                else:
                    alternatives = process_items(item.get("items", []))
                    if alternatives:
                        processed_item["alternatives"] = alternatives

                valid_items.append(processed_item)

            return valid_items

        processed_items = process_items(recipe.get("items", []))

        return {
            "source": "recipe",
            "recipe_id": str(recipe["_id"]),
            "recipe_part_id": str(part_oid),
            "items": processed_items,
        }

    # No recipe found - try BOM from MongoDB
    bom_result = await fetch_part_bom(current_user, part_id, db)
    bom_items = bom_result.get("results", [])
    
    if bom_items:
        # Convert BOM format to recipe format
        result = []
        for item in bom_items:
            result.append({
                "type": 1,
                "part": item.get("sub_part"),
                "name": item.get("sub_part_detail", {}).get("name", ""),
                "IPN": item.get("sub_part_detail", {}).get("IPN", ""),
                "quantity": item.get("quantity", 1),
                "mandatory": True,
            })
        
        return {
            "source": "bom",
            "items": result,
        }
    
    # No recipe and no BOM found
    return {
        "source": "none",
        "items": []
    }
