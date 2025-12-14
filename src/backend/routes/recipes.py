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
        recipes = await db[RecipeModel.Config.collection_name].find().to_list(length=1000)
        
        # Get product IDs
        product_ids = [r["id"] for r in recipes]
        
        # Get product details from depo_parts
        parts = await db.depo_parts.find({"id": {"$in": product_ids}}).to_list(length=1000)
        parts_map = {p["id"]: p for p in parts}
        
        # Enrich recipes with product info
        result = []
        for recipe in recipes:
            product = parts_map.get(recipe["id"], {})
            recipe_data = {
                "_id": str(recipe["_id"]),
                "id": recipe["id"],
                "name": product.get("name", f"Product {recipe['id']}"),
                "code": product.get("IPN", ""),
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
        recipe = await db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Get product details
        product = await db.depo_parts.find_one({"id": recipe["id"]})
        
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
        parts = await db.depo_parts.find({"id": {"$in": part_ids}}).to_list(length=1000)
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
        existing = await db[RecipeModel.Config.collection_name].find_one({"id": product_id})
        if existing:
            raise HTTPException(status_code=400, detail="Recipe already exists for this product")
        
        # Create recipe
        recipe_doc = RecipeModel.create(
            product_id=product_id,
            created_by=current_user["username"]
        )
        
        result = await db[RecipeModel.Config.collection_name].insert_one(recipe_doc)
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
        recipe = await db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
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
        await db[RecipeModel.Config.collection_name].update_one(
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
        recipe = await db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
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
        await db[RecipeModel.Config.collection_name].update_one(
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
        recipe = await db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        items = recipe.get("items", [])
        if item_index < 0 or item_index >= len(items):
            raise HTTPException(status_code=404, detail="Item not found")
        
        removed_item = items[item_index]
        items.pop(item_index)
        
        # Update recipe
        await db[RecipeModel.Config.collection_name].update_one(
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
        recipe = await db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
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
        await db[RecipeModel.Config.collection_name].update_one(
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
        recipe = await db[RecipeModel.Config.collection_name].find_one({"_id": ObjectId(recipe_id)})
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
        await db[RecipeModel.Config.collection_name].update_one(
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
        
        parts = await db.depo_parts.find(query).limit(50).to_list(length=50)
        
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


@router.get("/api/recipes/{recipe_id}/logs")
async def get_recipe_logs(
    recipe_id: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get recipe change history"""
    try:
        logs = await db[RecipeLogModel.Config.collection_name].find(
            {"recipe_id": recipe_id}
        ).sort("timestamp", -1).to_list(length=100)
        
        for log in logs:
            log["_id"] = str(log["_id"])
        
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
 
  
 @ r o u t e r . p o s t ( " / a p i / r e c i p e s / { r e c i p e _ i d } / i n c r e m e n t - v e r s i o n " )  
 a s y n c   d e f   i n c r e m e n t _ v e r s i o n (  
         r e c i p e _ i d :   s t r ,  
         r e q u e s t :   R e q u e s t ,  
         c u r r e n t _ u s e r :   d i c t   =   D e p e n d s ( v e r i f y _ t o k e n ) ,  
         d b   =   D e p e n d s ( g e t _ d b )  
 ) :  
         " " " I n c r e m e n t   r e c i p e   v e r s i o n " " "  
         f r o m   d a t e t i m e   i m p o r t   d a t e t i m e  
         f r o m   b s o n   i m p o r t   O b j e c t I d  
          
         t r y :  
                 r e c i p e   =   a w a i t   d b . d e p o _ r e c i p e s . f i n d _ o n e ( { " _ i d " :   O b j e c t I d ( r e c i p e _ i d ) } )  
                 i f   n o t   r e c i p e :  
                         r a i s e   H T T P E x c e p t i o n ( s t a t u s _ c o d e = 4 0 4 ,   d e t a i l = " R e c i p e   n o t   f o u n d " )  
                  
                 n e w _ r e v   =   r e c i p e . g e t ( " r e v " ,   0 )   +   1  
                  
                 a w a i t   d b . d e p o _ r e c i p e s . u p d a t e _ o n e (  
                         { " _ i d " :   O b j e c t I d ( r e c i p e _ i d ) } ,  
                         {  
                                 " $ s e t " :   {  
                                         " r e v " :   n e w _ r e v ,  
                                         " r e v _ d a t e " :   d a t e t i m e . u t c n o w ( ) ,  
                                         " u p d a t e d _ a t " :   d a t e t i m e . u t c n o w ( ) ,  
                                         " u p d a t e d _ b y " :   c u r r e n t _ u s e r [ " u s e r n a m e " ]  
                                 }  
                         }  
                 )  
                  
                 #   L o g   c h a n g e  
                 f r o m   . . m o d e l s . r e c i p e _ m o d e l   i m p o r t   R e c i p e L o g M o d e l  
                 l o g _ e n t r y   =   R e c i p e L o g M o d e l . c r e a t e (  
                         r e c i p e _ i d = r e c i p e _ i d ,  
                         a c t i o n = " i n c r e m e n t _ v e r s i o n " ,  
                         c h a n g e s = { " o l d _ r e v " :   r e c i p e . g e t ( " r e v " ,   0 ) ,   " n e w _ r e v " :   n e w _ r e v } ,  
                         u s e r = c u r r e n t _ u s e r [ " u s e r n a m e " ] ,  
                         i p _ a d d r e s s = r e q u e s t . c l i e n t . h o s t ,  
                         u s e r _ a g e n t = r e q u e s t . h e a d e r s . g e t ( " u s e r - a g e n t " )  
                 )  
                 a w a i t   d b . d e p o _ r e c i p e s _ l o g s . i n s e r t _ o n e ( l o g _ e n t r y )  
                  
                 r e t u r n   { " m e s s a g e " :   " V e r s i o n   i n c r e m e n t e d   s u c c e s s f u l l y " ,   " n e w _ r e v " :   n e w _ r e v }  
         e x c e p t   H T T P E x c e p t i o n :  
                 r a i s e  
         e x c e p t   E x c e p t i o n   a s   e :  
                 r a i s e   H T T P E x c e p t i o n ( s t a t u s _ c o d e = 5 0 0 ,   d e t a i l = s t r ( e ) )  
  
  
 @ r o u t e r . p o s t ( " / a p i / r e c i p e s / { r e c i p e _ i d } / d u p l i c a t e " )  
 a s y n c   d e f   d u p l i c a t e _ r e c i p e (  
         r e c i p e _ i d :   s t r ,  
         d a t a :   d i c t ,  
         r e q u e s t :   R e q u e s t ,  
         c u r r e n t _ u s e r :   d i c t   =   D e p e n d s ( v e r i f y _ t o k e n ) ,  
         d b   =   D e p e n d s ( g e t _ d b )  
 ) :  
         " " " D u p l i c a t e   r e c i p e   w i t h   n e w   p r o d u c t " " "  
         f r o m   d a t e t i m e   i m p o r t   d a t e t i m e  
         f r o m   b s o n   i m p o r t   O b j e c t I d  
          
         t r y :  
                 n e w _ p r o d u c t _ i d   =   d a t a . g e t ( " p r o d u c t _ i d " )  
                 i f   n o t   n e w _ p r o d u c t _ i d :  
                         r a i s e   H T T P E x c e p t i o n ( s t a t u s _ c o d e = 4 0 0 ,   d e t a i l = " p r o d u c t _ i d   i s   r e q u i r e d " )  
                  
                 #   C h e c k   i f   r e c i p e   a l r e a d y   e x i s t s   f o r   n e w   p r o d u c t  
                 e x i s t i n g   =   a w a i t   d b . d e p o _ r e c i p e s . f i n d _ o n e ( { " i d " :   n e w _ p r o d u c t _ i d } )  
                 i f   e x i s t i n g :  
                         r a i s e   H T T P E x c e p t i o n ( s t a t u s _ c o d e = 4 0 0 ,   d e t a i l = " R e c i p e   a l r e a d y   e x i s t s   f o r   t h i s   p r o d u c t " )  
                  
                 #   G e t   s o u r c e   r e c i p e  
                 s o u r c e _ r e c i p e   =   a w a i t   d b . d e p o _ r e c i p e s . f i n d _ o n e ( { " _ i d " :   O b j e c t I d ( r e c i p e _ i d ) } )  
                 i f   n o t   s o u r c e _ r e c i p e :  
                         r a i s e   H T T P E x c e p t i o n ( s t a t u s _ c o d e = 4 0 4 ,   d e t a i l = " S o u r c e   r e c i p e   n o t   f o u n d " )  
                  
                 #   C r e a t e   n e w   r e c i p e  
                 n e w _ r e c i p e   =   {  
                         " i d " :   n e w _ p r o d u c t _ i d ,  
                         " r e v " :   0 ,  
                         " r e v _ d a t e " :   d a t e t i m e . u t c n o w ( ) ,  
                         " i t e m s " :   s o u r c e _ r e c i p e . g e t ( " i t e m s " ,   [ ] ) ,  
                         " c r e a t e d _ a t " :   d a t e t i m e . u t c n o w ( ) ,  
                         " c r e a t e d _ b y " :   c u r r e n t _ u s e r [ " u s e r n a m e " ] ,  
                         " u p d a t e d _ a t " :   d a t e t i m e . u t c n o w ( ) ,  
                         " u p d a t e d _ b y " :   c u r r e n t _ u s e r [ " u s e r n a m e " ]  
                 }  
                  
                 r e s u l t   =   a w a i t   d b . d e p o _ r e c i p e s . i n s e r t _ o n e ( n e w _ r e c i p e )  
                 n e w _ r e c i p e _ i d   =   s t r ( r e s u l t . i n s e r t e d _ i d )  
                  
                 #   L o g   c r e a t i o n  
                 f r o m   . . m o d e l s . r e c i p e _ m o d e l   i m p o r t   R e c i p e L o g M o d e l  
                 l o g _ e n t r y   =   R e c i p e L o g M o d e l . c r e a t e (  
                         r e c i p e _ i d = n e w _ r e c i p e _ i d ,  
                         a c t i o n = " d u p l i c a t e " ,  
                         c h a n g e s = { " s o u r c e _ r e c i p e _ i d " :   r e c i p e _ i d ,   " n e w _ p r o d u c t _ i d " :   n e w _ p r o d u c t _ i d } ,  
                         u s e r = c u r r e n t _ u s e r [ " u s e r n a m e " ] ,  
                         i p _ a d d r e s s = r e q u e s t . c l i e n t . h o s t ,  
                         u s e r _ a g e n t = r e q u e s t . h e a d e r s . g e t ( " u s e r - a g e n t " )  
                 )  
                 a w a i t   d b . d e p o _ r e c i p e s _ l o g s . i n s e r t _ o n e ( l o g _ e n t r y )  
                  
                 r e t u r n   { " _ i d " :   n e w _ r e c i p e _ i d ,   " m e s s a g e " :   " R e c i p e   d u p l i c a t e d   s u c c e s s f u l l y " }  
         e x c e p t   H T T P E x c e p t i o n :  
                 r a i s e  
         e x c e p t   E x c e p t i o n   a s   e :  
                 r a i s e   H T T P E x c e p t i o n ( s t a t u s _ c o d e = 5 0 0 ,   d e t a i l = s t r ( e ) )  
 