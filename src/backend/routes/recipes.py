"""
Recipes Routes
Production recipes management with ingredients and alternatives
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from ..utils.db import get_db
from .auth import verify_token
from ..models.recipe_model import RecipeModel, RecipeItem, RecipeLogModel

router = APIRouter()


def log_recipe_change(db, recipe_id: str, action: str, changes: dict, user: str, 
                      ip_address: str = None, user_agent: str = None):
    """Log recipe change to audit trail"""
    log_entry = RecipeLogModel.create(
        recipe_id=recipe_id,
        action=action,
        changes=changes,
        user=user,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db[RecipeLogModel.Config.collection_name].insert_one(log_entry)


@router.get("/api/recipes")
async def list_recipes(
    search: Optional[str] = None,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """List all recipes with optional search"""
    try:
        # Get all recipes
        recipes = list(db[RecipeModel.Config.collection_name].find())
        
        # Get product IDs
        product_ids = [r["id"] for r in recipes]
        
        # Get product details from depo_parts
        parts = list(db.depo_parts.find({"id": {"$in": product_ids}}))
        parts_map = {p["id"]: p for p in parts}
        
        # Enrich recipes with product info
        result = []
        for recipe in recipes:
            product = parts_map.get(recipe["id"], {})
            recipe_data = {
                "_id": str(recipe["_id"]),
                "id": recipe["id"],
                "name": product.get("name", f"Product {recipe['id']}"),
                "code": product.get("ipn", ""),
                "items_count": len(recipe.get("items", [])),
                "created_at": recipe.get("created_at"),
                "created_by": recipe.get("created_by"),
                "updated_at": recipe.get("updated_at"),
                "updated_by": recipe.get("updated_by")
            }
            
            # Apply search filter
            if search:
                search_lower = search.lower()
                if (search_lower in recipe_data["name"].lower() or 
                    search_lower in recipe_data["code"].lower()):
                    result.append(recipe_data)
            else:
                result.append(recipe_data)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/recipes/{recipe_id}")
async def get_recipe(
    recipe_id: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get recipe details"""
    try:
        recipe = db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Get product details
        product = db.depo_parts.find_one({"id": recipe["id"]})
        
        # Get all part IDs from items (recursive)
        def collect_part_ids(items):
            ids = []
            for item in items:
                if item.get("type") == 1 and item.get("id"):
                    ids.append(item["id"])
                if item.get("items"):
                    ids.extend(collect_part_ids(item["items"]))
            return ids
        
        part_ids = collect_part_ids(recipe.get("items", []))
        parts = list(db.depo_parts.find({"id": {"$in": part_ids}}))
        parts_map = {p["id"]: p for p in parts}
        
        # Enrich items with part details
        def enrich_items(items):
            enriched = []
            for item in items:
                enriched_item = dict(item)
                if item.get("type") == 1 and item.get("id"):
                    part = parts_map.get(item["id"], {})
                    enriched_item["part_detail"] = {
                        "name": part.get("name", f"Part {item['id']}"),
                        "IPN": part.get("IPN", "")
                    }
                if item.get("items"):
                    enriched_item["items"] = enrich_items(item["items"])
                enriched.append(enriched_item)
            return enriched
        
        recipe["_id"] = str(recipe["_id"])
        recipe["product_detail"] = {
            "name": product.get("name", f"Product {recipe['id']}") if product else f"Product {recipe['id']}",
            "IPN": product.get("IPN", "") if product else ""
        }
        recipe["items"] = enrich_items(recipe.get("items", []))
        
        return recipe
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/recipes")
async def create_recipe(
    data: dict,
    request: Request,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Create new recipe"""
    try:
        product_id = data.get("product_id")
        if not product_id:
            raise HTTPException(status_code=400, detail="product_id is required")
        
        # Check if recipe already exists
        existing = db[RecipeModel.Config.collection_name].find_one({"id": product_id})
        if existing:
            raise HTTPException(status_code=400, detail="Recipe already exists for this product")
        
        # Create recipe
        recipe_doc = RecipeModel.create(
            product_id=product_id,
            created_by=current_user["username"]
        )
        
        result = db[RecipeModel.Config.collection_name].insert_one(recipe_doc)
        recipe_id = str(result.inserted_id)
        
        # Log creation
        log_recipe_change(
            db=db,
            recipe_id=recipe_id,
            action="create",
            changes={"product_id": product_id},
            user=current_user["username"],
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        return {"_id": recipe_id, "message": "Recipe created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/recipes/{recipe_id}/items")
async def add_item(
    recipe_id: str,
    data: dict,
    request: Request,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Add item to recipe"""
    try:
        recipe = db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Create new item
        new_item = {
            "type": data.get("type", 1),
            "q": data.get("q", 1),
            "start": datetime.fromisoformat(data.get("start")) if data.get("start") else datetime.utcnow(),
            "fin": datetime.fromisoformat(data.get("fin")) if data.get("fin") else None,
            "mandatory": data.get("mandatory", True),
            "rev": data.get("rev", 0),
            "rev_date": datetime.fromisoformat(data.get("rev_date")) if data.get("rev_date") else datetime.utcnow(),
            "notes": data.get("notes")
        }
        
        if data.get("type") == 1:
            new_item["id"] = data.get("product_id")
        else:
            new_item["items"] = []
        
        # Add item to recipe
        db[RecipeModel.Config.collection_name].update_one(
            {"_id": ObjectId(recipe_id)},
            {
                "$push": {"items": new_item},
                "$set": {
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user["username"]
                }
            }
        )
        
        # Log change
        log_recipe_change(
            db=db,
            recipe_id=recipe_id,
            action="add_item",
            changes={"item": new_item},
            user=current_user["username"],
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        return {"message": "Item added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/recipes/{recipe_id}/items/{item_index}")
async def update_item(
    recipe_id: str,
    item_index: int,
    data: dict,
    request: Request,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Update item in recipe"""
    try:
        recipe = db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        items = recipe.get("items", [])
        if item_index < 0 or item_index >= len(items):
            raise HTTPException(status_code=404, detail="Item not found")
        
        old_item = dict(items[item_index])
        
        # Update item fields
        if data.get("type") == 1:
            items[item_index]["id"] = data.get("product_id", items[item_index].get("id"))
            items[item_index]["q"] = data.get("q", items[item_index].get("q"))
            items[item_index]["start"] = datetime.fromisoformat(data.get("start")) if data.get("start") else items[item_index].get("start")
            items[item_index]["fin"] = datetime.fromisoformat(data.get("fin")) if data.get("fin") else items[item_index].get("fin")
        
        items[item_index]["mandatory"] = data.get("mandatory", items[item_index].get("mandatory"))
        items[item_index]["notes"] = data.get("notes", items[item_index].get("notes"))
        
        # Update recipe
        db[RecipeModel.Config.collection_name].update_one(
            {"_id": ObjectId(recipe_id)},
            {
                "$set": {
                    "items": items,
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user["username"]
                }
            }
        )
        
        # Log change
        log_recipe_change(
            db=db,
            recipe_id=recipe_id,
            action="update_item",
            changes={"item_index": item_index, "old_item": old_item, "new_item": items[item_index]},
            user=current_user["username"],
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        return {"message": "Item updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/recipes/{recipe_id}/items/{item_index}")
async def remove_item(
    recipe_id: str,
    item_index: int,
    request: Request,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Remove item from recipe"""
    try:
        recipe = db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        items = recipe.get("items", [])
        if item_index < 0 or item_index >= len(items):
            raise HTTPException(status_code=404, detail="Item not found")
        
        removed_item = items[item_index]
        items.pop(item_index)
        
        # Update recipe
        db[RecipeModel.Config.collection_name].update_one(
            {"_id": ObjectId(recipe_id)},
            {
                "$set": {
                    "items": items,
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user["username"]
                }
            }
        )
        
        # Log change
        log_recipe_change(
            db=db,
            recipe_id=recipe_id,
            action="remove_item",
            changes={"item_index": item_index, "removed_item": removed_item},
            user=current_user["username"],
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        return {"message": "Item removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/recipes/{recipe_id}/items/{item_index}/alternatives")
async def add_alternative(
    recipe_id: str,
    item_index: int,
    data: dict,
    request: Request,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Add alternative to group (Type 2 item)"""
    try:
        recipe = db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        items = recipe.get("items", [])
        if item_index < 0 or item_index >= len(items):
            raise HTTPException(status_code=404, detail="Item not found")
        
        parent_item = items[item_index]
        if parent_item.get("type") != 2:
            raise HTTPException(status_code=400, detail="Can only add alternatives to Type 2 (group) items")
        
        # Create new alternative
        new_alternative = {
            "type": 1,
            "id": data.get("product_id"),
            "q": data.get("q", 1),
            "start": datetime.fromisoformat(data.get("start")) if data.get("start") else datetime.utcnow(),
            "fin": datetime.fromisoformat(data.get("fin")) if data.get("fin") else None,
            "notes": data.get("notes")
        }
        
        # Add to items array
        if "items" not in parent_item:
            parent_item["items"] = []
        parent_item["items"].append(new_alternative)
        
        # Update recipe
        db[RecipeModel.Config.collection_name].update_one(
            {"_id": ObjectId(recipe_id)},
            {
                "$set": {
                    "items": items,
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user["username"]
                }
            }
        )
        
        # Log change
        log_recipe_change(
            db=db,
            recipe_id=recipe_id,
            action="add_alternative",
            changes={"item_index": item_index, "alternative": new_alternative},
            user=current_user["username"],
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        return {"message": "Alternative added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/recipes/{recipe_id}/items/{item_index}/alternatives/{alt_index}")
async def update_alternative(
    recipe_id: str,
    item_index: int,
    alt_index: int,
    data: dict,
    request: Request,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Update alternative in group"""
    try:
        recipe = db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        items = recipe.get("items", [])
        if item_index < 0 or item_index >= len(items):
            raise HTTPException(status_code=404, detail="Item not found")
        
        parent_item = items[item_index]
        if parent_item.get("type") != 2:
            raise HTTPException(status_code=400, detail="Item is not a group")
        
        alternatives = parent_item.get("items", [])
        if alt_index < 0 or alt_index >= len(alternatives):
            raise HTTPException(status_code=404, detail="Alternative not found")
        
        old_alt = dict(alternatives[alt_index])
        
        # Update alternative fields
        alternatives[alt_index]["id"] = data.get("product_id", alternatives[alt_index].get("id"))
        alternatives[alt_index]["q"] = data.get("q", alternatives[alt_index].get("q"))
        alternatives[alt_index]["start"] = datetime.fromisoformat(data.get("start")) if data.get("start") else alternatives[alt_index].get("start")
        alternatives[alt_index]["fin"] = datetime.fromisoformat(data.get("fin")) if data.get("fin") else alternatives[alt_index].get("fin")
        alternatives[alt_index]["notes"] = data.get("notes", alternatives[alt_index].get("notes"))
        
        parent_item["items"] = alternatives
        
        # Update recipe
        db[RecipeModel.Config.collection_name].update_one(
            {"_id": ObjectId(recipe_id)},
            {
                "$set": {
                    "items": items,
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user["username"]
                }
            }
        )
        
        # Log change
        log_recipe_change(
            db=db,
            recipe_id=recipe_id,
            action="update_alternative",
            changes={"item_index": item_index, "alt_index": alt_index, "old_alternative": old_alt, "new_alternative": alternatives[alt_index]},
            user=current_user["username"],
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        return {"message": "Alternative updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/recipes/{recipe_id}/items/{item_index}/alternatives/{alt_index}")
async def remove_alternative(
    recipe_id: str,
    item_index: int,
    alt_index: int,
    request: Request,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Remove alternative from group"""
    try:
        recipe = db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        items = recipe.get("items", [])
        if item_index < 0 or item_index >= len(items):
            raise HTTPException(status_code=404, detail="Item not found")
        
        parent_item = items[item_index]
        if parent_item.get("type") != 2:
            raise HTTPException(status_code=400, detail="Item is not a group")
        
        alternatives = parent_item.get("items", [])
        if alt_index < 0 or alt_index >= len(alternatives):
            raise HTTPException(status_code=404, detail="Alternative not found")
        
        removed_alt = alternatives[alt_index]
        alternatives.pop(alt_index)
        parent_item["items"] = alternatives
        
        # Update recipe
        db[RecipeModel.Config.collection_name].update_one(
            {"_id": ObjectId(recipe_id)},
            {
                "$set": {
                    "items": items,
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user["username"]
                }
            }
        )
        
        # Log change
        log_recipe_change(
            db=db,
            recipe_id=recipe_id,
            action="remove_alternative",
            changes={"item_index": item_index, "alt_index": alt_index, "removed_alternative": removed_alt},
            user=current_user["username"],
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        return {"message": "Alternative removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/recipes/parts")
async def search_parts(
    search: Optional[str] = None,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Search parts from depo_parts"""
    try:
        query = {}
        if search:
            query = {
                "$or": [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"IPN": {"$regex": search, "$options": "i"}}
                ]
            }
        
        parts = list(db.depo_parts.find(query).limit(50))
        
        return [
            {
                "id": p["id"],
                "name": p.get("name", ""),
                "IPN": p.get("IPN", "")
            }
            for p in parts
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/recipes/{recipe_id}/increment-version")
async def increment_version(
    recipe_id: str,
    request: Request,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Increment recipe version (revision)"""
    try:
        recipe = db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        old_rev = recipe.get("rev", 0)
        new_rev = old_rev + 1
        
        # Update recipe
        db[RecipeModel.Config.collection_name].update_one(
            {"_id": ObjectId(recipe_id)},
            {
                "$set": {
                    "rev": new_rev,
                    "rev_date": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user["username"]
                }
            }
        )
        
        # Log change
        log_recipe_change(
            db=db,
            recipe_id=recipe_id,
            action="increment_version",
            changes={"old_rev": old_rev, "new_rev": new_rev},
            user=current_user["username"],
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        return {"message": "Version incremented successfully", "new_rev": new_rev}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/recipes/{recipe_id}/logs")
async def get_recipe_logs(
    recipe_id: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get recipe change history"""
    try:
        logs = list(db[RecipeLogModel.Config.collection_name].find(
            {"recipe_id": recipe_id}
        ).sort("timestamp", -1))
        
        for log in logs:
            log["_id"] = str(log["_id"])
        
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))