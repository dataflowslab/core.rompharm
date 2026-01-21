"""
Categories routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token
from .utils import serialize_doc, CategoryCreateRequest, CategoryUpdateRequest

router = APIRouter()


@router.get("/categories")
async def get_categories(
    request: Request,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of categories with parent details populated"""
    db = get_db()
    collection = db['depo_categories']
    
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}}
        ]
    
    try:
        cursor = collection.find(query).sort('name', 1)
        categories = list(cursor)
        
        for category in categories:
            if category.get('parent_id'):
                parent = collection.find_one({'_id': category['parent_id']})
                if parent:
                    category['parent_detail'] = {'name': parent.get('name', '')}
        
        return serialize_doc(categories)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")


@router.post("/categories")
async def create_category(
    request: Request,
    category_data: CategoryCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new category"""
    db = get_db()
    collection = db['depo_categories']
    
    doc = {
        'name': category_data.name,
        'description': category_data.description or '',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username', 'system'),
        'updated_by': current_user.get('username', 'system')
    }
    
    if category_data.parent_id:
        parent = collection.find_one({'_id': ObjectId(category_data.parent_id)})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
        doc['parent_id'] = ObjectId(category_data.parent_id)
    
    try:
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        
        if doc.get('parent_id'):
            parent = collection.find_one({'_id': doc['parent_id']})
            if parent:
                doc['parent_detail'] = {'name': parent.get('name', '')}
        
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create category: {str(e)}")


@router.put("/categories/{category_id}")
async def update_category(
    request: Request,
    category_id: str,
    category_data: CategoryUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an existing category"""
    db = get_db()
    collection = db['depo_categories']
    
    update_doc = {
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username', 'system')
    }
    
    if category_data.name is not None:
        update_doc['name'] = category_data.name
    
    if category_data.description is not None:
        update_doc['description'] = category_data.description
    
    if category_data.parent_id is not None:
        if category_data.parent_id == '':
            update_doc['parent_id'] = None
        else:
            parent = collection.find_one({'_id': ObjectId(category_data.parent_id)})
            if not parent:
                raise HTTPException(status_code=404, detail="Parent category not found")
            
            if category_data.parent_id == category_id:
                raise HTTPException(status_code=400, detail="A category cannot be its own parent")
            
            def is_descendant(target_id: str, ancestor_id: str) -> bool:
                target = collection.find_one({'_id': ObjectId(target_id)})
                if not target:
                    return False
                if target.get('parent_id') and str(target['parent_id']) == ancestor_id:
                    return True
                if target.get('parent_id'):
                    return is_descendant(str(target['parent_id']), ancestor_id)
                return False
            
            if is_descendant(category_data.parent_id, category_id):
                raise HTTPException(status_code=400, detail="Cannot set a descendant as parent")
            
            update_doc['parent_id'] = ObjectId(category_data.parent_id)
    
    if len(update_doc) == 2:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        result = collection.update_one({'_id': ObjectId(category_id)}, {'$set': update_doc})
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Category not found")
        
        updated_category = collection.find_one({'_id': ObjectId(category_id)})
        if updated_category and updated_category.get('parent_id'):
            parent = collection.find_one({'_id': updated_category['parent_id']})
            if parent:
                updated_category['parent_detail'] = {'name': parent.get('name', '')}
        
        return serialize_doc(updated_category)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update category: {str(e)}")


@router.delete("/categories/{category_id}")
async def delete_category(
    request: Request,
    category_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a category (only if it has no children and no articles)"""
    db = get_db()
    categories_collection = db['depo_categories']
    parts_collection = db['depo_parts']
    
    try:
        children_count = categories_collection.count_documents({'parent_id': ObjectId(category_id)})
        if children_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete category with {children_count} subcategories"
            )
        
        articles_count = parts_collection.count_documents({'category_id': ObjectId(category_id)})
        if articles_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete category with {articles_count} articles"
            )
        
        result = categories_collection.delete_one({'_id': ObjectId(category_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Category not found")
        
        return {'success': True, 'message': 'Category deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete category: {str(e)}")
