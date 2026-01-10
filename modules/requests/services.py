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


async def search_parts(db, search: Optional[str] = None) -> Dict[str, Any]:
    """Get list of parts from MongoDB depo_parts with search"""
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


async def get_part_stock_info(db, part_id: str) -> Dict[str, Any]:
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
        
        # Query depo_stocks using part_id and allowed states
        stock_records = list(db.depo_stocks.find({
            "part_id": part_oid,
            "state_id": {"$in": allowed_state_ids}
        }))
        
        if stock_records:
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
                    
                    # Get state name
                    state_name = ""
                    if state_id:
                        state = db.depo_stocks_states.find_one({"_id": state_id if isinstance(state_id, ObjectId) else ObjectId(state_id)})
                        if state:
                            state_name = state.get("name", "")
                    
                    batches.append({
                        "batch_code": batch_code,
                        "supplier_batch_code": stock.get("supplier_batch_code", ""),
                        "quantity": quantity,
                        "location_id": location_id,
                        "state_id": state_id_str,
                        "state_name": state_name,
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
        
        # Get all states where is_requestable = true
        requestable_states = list(db.depo_stocks_states.find({
            "is_requestable": True
        }))
        
        # If no requestable states found, return empty
        if not requestable_states:
            return {"batch_codes": []}
        
        requestable_state_ids = [state["_id"] for state in requestable_states]
        
        # Create state info map for later use
        state_info_map = {}
        for state in requestable_states:
            state_info_map[str(state["_id"])] = {
                "name": state.get("name", ""),
                "is_transferable": state.get("is_transferable", False),
                "is_requestable": state.get("is_requestable", False)
            }
        
        # Build query
        query = {
            "part_id": part_oid,
            "state_id": {"$in": requestable_state_ids},
            "quantity": {"$gt": 0}  # Only stock with quantity > 0
        }
        
        # Filter by location if provided (location_id is now ObjectId string)
        if location_id:
            try:
                location_oid = ObjectId(location_id)
                query["location_id"] = location_oid
            except:
                print(f"Warning: Invalid location_id format: {location_id}")
        
        # Query depo_stocks
        stock_records = list(db.depo_stocks.find(query))
        
        # Group by batch_code and aggregate quantities
        batch_map = {}
        for stock in stock_records:
            batch_code = stock.get("batch_code", "")
            state_id = str(stock.get("state_id", ""))
            
            if batch_code and batch_code.strip():
                if batch_code not in batch_map:
                    # Get state info
                    state_info = state_info_map.get(state_id, {
                        "name": "Unknown",
                        "is_transferable": False,
                        "is_requestable": False
                    })
                    
                    expiry = stock.get("expiry_date", "")
                    
                    batch_map[batch_code] = {
                        'batch_code': batch_code,
                        'value': batch_code,  # For Select component
                        'expiry_date': expiry,
                        'quantity': 0,
                        'location_id': str(stock.get("location_id", "")),
                        'state_id': state_id,
                        'state_name': state_info.get("name", ""),
                        'is_transferable': state_info.get("is_transferable", False),
                        'is_requestable': state_info.get("is_requestable", False)
                    }
                batch_map[batch_code]['quantity'] += stock.get("quantity", 0)
        
        # Add label after quantity is calculated
        batch_codes = []
        for batch in batch_map.values():
            batch['label'] = f"{batch['batch_code']} - Qty: {batch['quantity']} - Exp: {batch['expiry_date'] or 'N/A'}"
            batch_codes.append(batch)
        
        return {"batch_codes": batch_codes}
    except Exception as e:
        print(f"Error fetching batch codes: {e}")
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
