"""
Locations routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token
from .utils import serialize_doc, LocationCreateRequest, LocationUpdateRequest

router = APIRouter()


@router.get("/locations")
async def get_locations(
    request: Request,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of locations with parent details populated"""
    db = get_db()
    collection = db['depo_locations']
    
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}}
        ]
    
    try:
        cursor = collection.find(query).sort('name', 1)
        locations = list(cursor)
        
        # Populate parent details
        for location in locations:
            if location.get('parent_id'):
                parent = collection.find_one({'_id': location['parent_id']})
                if parent:
                    location['parent_detail'] = {'name': parent.get('name', '')}
        
        return serialize_doc(locations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch locations: {str(e)}")


@router.post("/locations")
async def create_location(
    request: Request,
    location_data: LocationCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new location"""
    db = get_db()
    collection = db['depo_locations']
    
    doc = {
        'name': location_data.name,
        'description': location_data.description or '',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username', 'system'),
        'updated_by': current_user.get('username', 'system')
    }
    
    if location_data.parent_id:
        parent = collection.find_one({'_id': ObjectId(location_data.parent_id)})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent location not found")
        doc['parent_id'] = ObjectId(location_data.parent_id)
    
    try:
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        
        if doc.get('parent_id'):
            parent = collection.find_one({'_id': doc['parent_id']})
            if parent:
                doc['parent_detail'] = {'name': parent.get('name', '')}
        
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create location: {str(e)}")


@router.put("/locations/{location_id}")
async def update_location(
    request: Request,
    location_id: str,
    location_data: LocationUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an existing location"""
    db = get_db()
    collection = db['depo_locations']
    
    update_doc = {
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username', 'system')
    }
    
    if location_data.name is not None:
        update_doc['name'] = location_data.name
    
    if location_data.description is not None:
        update_doc['description'] = location_data.description
    
    if location_data.parent_id is not None:
        if location_data.parent_id == '':
            update_doc['parent_id'] = None
        else:
            parent = collection.find_one({'_id': ObjectId(location_data.parent_id)})
            if not parent:
                raise HTTPException(status_code=404, detail="Parent location not found")
            
            if location_data.parent_id == location_id:
                raise HTTPException(status_code=400, detail="A location cannot be its own parent")
            
            # Check circular references
            def is_descendant(target_id: str, ancestor_id: str) -> bool:
                target = collection.find_one({'_id': ObjectId(target_id)})
                if not target:
                    return False
                if target.get('parent_id') and str(target['parent_id']) == ancestor_id:
                    return True
                if target.get('parent_id'):
                    return is_descendant(str(target['parent_id']), ancestor_id)
                return False
            
            if is_descendant(location_data.parent_id, location_id):
                raise HTTPException(status_code=400, detail="Cannot set a descendant as parent")
            
            update_doc['parent_id'] = ObjectId(location_data.parent_id)
    
    if len(update_doc) == 2:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        result = collection.update_one({'_id': ObjectId(location_id)}, {'$set': update_doc})
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Location not found")
        
        updated_location = collection.find_one({'_id': ObjectId(location_id)})
        if updated_location and updated_location.get('parent_id'):
            parent = collection.find_one({'_id': updated_location['parent_id']})
            if parent:
                updated_location['parent_detail'] = {'name': parent.get('name', '')}
        
        return serialize_doc(updated_location)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update location: {str(e)}")


@router.delete("/locations/{location_id}")
async def delete_location(
    request: Request,
    location_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a location (only if it has no children and no stocks)"""
    db = get_db()
    locations_collection = db['depo_locations']
    stocks_collection = db['depo_stocks']
    
    try:
        children_count = locations_collection.count_documents({'parent_id': ObjectId(location_id)})
        if children_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete location with {children_count} sublocations"
            )
        
        stocks_count = stocks_collection.count_documents({'location_id': ObjectId(location_id)})
        if stocks_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete location with {stocks_count} stock items"
            )
        
        result = locations_collection.delete_one({'_id': ObjectId(location_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Location not found")
        
        return {'success': True, 'message': 'Location deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete location: {str(e)}")
