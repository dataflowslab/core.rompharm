"""
Inventory Module - Articles, Stocks, Suppliers, Manufacturers, Clients
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId

# Import from core
from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token

router = APIRouter(prefix="/modules/inventory/api", tags=["inventory"])


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == '_id' or key.endswith('_id'):
                result[key] = str(value) if value else None
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = [serialize_doc(item) if isinstance(item, dict) else item for item in value]
            else:
                result[key] = value
        return result
    return doc


# Pydantic models
class ArticleCreateRequest(BaseModel):
    name: str
    ipn: str
    default_location_id: Optional[str] = None
    um: str
    supplier_id: Optional[str] = None
    notes: Optional[str] = ""
    default_expiry: Optional[int] = None
    minimum_stock: Optional[float] = None
    is_component: bool = True
    is_assembly: bool = True
    is_testable: bool = True
    is_salable: bool = False
    is_active: bool = True


class ArticleUpdateRequest(BaseModel):
    name: Optional[str] = None
    ipn: Optional[str] = None
    default_location_id: Optional[str] = None
    um: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    keywords: Optional[List[str]] = None
    link: Optional[str] = None
    default_expiry: Optional[int] = None
    minimum_stock: Optional[float] = None
    is_component: Optional[bool] = None
    is_assembly: Optional[bool] = None
    is_testable: Optional[bool] = None
    is_salable: Optional[bool] = None
    is_active: Optional[bool] = None
    storage_conditions: Optional[str] = None
    regulated: Optional[bool] = None
    lotallexp: Optional[bool] = None
    selection_method: Optional[str] = None
    category_id: Optional[str] = None
    manufacturer_id: Optional[str] = None
    manufacturer_ipn: Optional[str] = None
    system_um_id: Optional[str] = None
    total_delivery_time: Optional[str] = None


@router.get("/parts")
async def get_parts(
    request: Request,
    search: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    sort_by: Optional[str] = Query("name"),
    sort_order: Optional[str] = Query("asc"),
    current_user: dict = Depends(verify_token)
):
    """Get list of parts (alias for articles) from MongoDB with search, pagination and sorting"""
    db = get_db()
    collection = db['depo_parts']
    
    # Build query - only show active parts
    query = {'is_active': True}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'ipn': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}}
        ]
    
    # Filter by supplier if provided
    if supplier_id:
        try:
            # Find parts that have this supplier in depo_parts_suppliers collection
            parts_suppliers_collection = db['depo_parts_suppliers']
            supplier_parts = list(parts_suppliers_collection.find({'supplier_id': ObjectId(supplier_id)}))
            part_ids = [sp['part_id'] for sp in supplier_parts]
            
            if part_ids:
                # Add to query - parts must be in the supplier's parts list
                if query:
                    query = {'$and': [query, {'_id': {'$in': part_ids}}]}
                else:
                    query = {'_id': {'$in': part_ids}}
            else:
                # No parts for this supplier, return empty result
                return {
                    'results': [],
                    'total': 0,
                    'skip': skip,
                    'limit': limit
                }
        except Exception as e:
            # If supplier_id is invalid, just ignore the filter
            print(f"Invalid supplier_id: {supplier_id}, error: {e}")
            pass
    
    # Build sort
    sort_direction = 1 if sort_order == 'asc' else -1
    sort = [(sort_by, sort_direction)]
    
    try:
        # Get total count
        total = collection.count_documents(query)
        
        # Get paginated results
        cursor = collection.find(query).sort(sort).skip(skip).limit(limit)
        parts = list(cursor)
        
        # Serialize results
        serialized_parts = serialize_doc(parts)
        
        return {
            'results': serialized_parts,
            'total': total,
            'skip': skip,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch parts: {str(e)}")


@router.get("/articles")
async def get_articles(
    request: Request,
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    sort_by: Optional[str] = Query("name"),
    sort_order: Optional[str] = Query("asc"),
    current_user: dict = Depends(verify_token)
):
    """Get list of articles from MongoDB with search, category filter, pagination and sorting"""
    db = get_db()
    collection = db['depo_parts']
    
    # Build query
    query = {}
    
    # Search filter
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'ipn': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}}
        ]
    
    # Category filter
    if category:
        query['category_id'] = ObjectId(category)
    
    # Build sort
    sort_direction = 1 if sort_order == 'asc' else -1
    sort = [(sort_by, sort_direction)]
    
    try:
        # Get total count
        total = collection.count_documents(query)
        
        # Get paginated results
        cursor = collection.find(query).sort(sort).skip(skip).limit(limit)
        articles = list(cursor)
        
        # Enrich with System UM details
        ums_collection = db['depo_ums']
        categories_collection = db['depo_categories']
        for article in articles:
            if article.get('system_um_id'):
                um = ums_collection.find_one({'_id': article['system_um_id']})
                if um:
                    article['system_um_detail'] = {
                        'name': um.get('name', ''),
                        'abrev': um.get('abrev', ''),
                        'symbol': um.get('symbol', '')
                    }
            
            # Enrich with Category details
            if article.get('category_id'):
                category = categories_collection.find_one({'_id': article['category_id']})
                if category:
                    article['category_detail'] = {
                        'name': category.get('name', '')
                    }
        
        # Serialize results
        serialized_articles = serialize_doc(articles)
        
        return {
            'results': serialized_articles,
            'total': total,
            'skip': skip,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch articles: {str(e)}")


@router.get("/articles/{article_id}")
async def get_article(
    request: Request,
    article_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific article by ID"""
    db = get_db()
    collection = db['depo_parts']
    
    try:
        article = collection.find_one({'_id': ObjectId(article_id)})
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        return serialize_doc(article)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch article: {str(e)}")


@router.post("/articles")
async def create_article(
    request: Request,
    article_data: ArticleCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new article"""
    db = get_db()
    collection = db['depo_parts']
    
    # Build document
    doc = {
        'name': article_data.name,
        'ipn': article_data.ipn,
        'um': article_data.um,
        'notes': article_data.notes,
        'description': '',
        'files': [],
        'keywords': [],
        'link': '',
        'is_component': article_data.is_component,
        'is_assembly': article_data.is_assembly,
        'is_testable': article_data.is_testable,
        'is_salable': article_data.is_salable,
        'is_active': article_data.is_active,
        'storage_conditions': '',
        'regulated': False,
        'lotallexp': False,
        'selection_method': 'FIFO'
    }
    
    # Optional fields
    if article_data.default_location_id:
        doc['default_location_id'] = ObjectId(article_data.default_location_id)
    
    if article_data.default_expiry is not None:
        doc['default_expiry'] = article_data.default_expiry
    
    if article_data.minimum_stock is not None:
        doc['minimum_stock'] = article_data.minimum_stock
    
    if article_data.supplier_id:
        doc['supplier_id'] = ObjectId(article_data.supplier_id)
    
    try:
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create article: {str(e)}")


@router.put("/articles/{article_id}")
async def update_article(
    request: Request,
    article_id: str,
    article_data: ArticleUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an existing article"""
    db = get_db()
    collection = db['depo_parts']
    
    # Build update document
    update_doc = {}
    
    if article_data.name is not None:
        update_doc['name'] = article_data.name
    if article_data.ipn is not None:
        update_doc['ipn'] = article_data.ipn
    if article_data.um is not None:
        update_doc['um'] = article_data.um
    if article_data.description is not None:
        update_doc['description'] = article_data.description
    if article_data.notes is not None:
        update_doc['notes'] = article_data.notes
    if article_data.keywords is not None:
        update_doc['keywords'] = article_data.keywords
    if article_data.link is not None:
        update_doc['link'] = article_data.link
    if article_data.default_expiry is not None:
        update_doc['default_expiry'] = article_data.default_expiry
    if article_data.minimum_stock is not None:
        update_doc['minimum_stock'] = article_data.minimum_stock
    if article_data.is_component is not None:
        update_doc['is_component'] = article_data.is_component
    if article_data.is_assembly is not None:
        update_doc['is_assembly'] = article_data.is_assembly
    if article_data.is_testable is not None:
        update_doc['is_testable'] = article_data.is_testable
    if article_data.is_salable is not None:
        update_doc['is_salable'] = article_data.is_salable
    if article_data.is_active is not None:
        update_doc['is_active'] = article_data.is_active
    if article_data.storage_conditions is not None:
        update_doc['storage_conditions'] = article_data.storage_conditions
    if article_data.regulated is not None:
        update_doc['regulated'] = article_data.regulated
    if article_data.lotallexp is not None:
        update_doc['lotallexp'] = article_data.lotallexp
    if article_data.selection_method is not None:
        update_doc['selection_method'] = article_data.selection_method
    
    if article_data.default_location_id is not None:
        update_doc['default_location_id'] = ObjectId(article_data.default_location_id) if article_data.default_location_id else None
    
    if article_data.category_id is not None:
        update_doc['category_id'] = ObjectId(article_data.category_id) if article_data.category_id else None
    
    if article_data.manufacturer_id is not None:
        update_doc['manufacturer_id'] = ObjectId(article_data.manufacturer_id) if article_data.manufacturer_id else None
    
    if article_data.manufacturer_ipn is not None:
        update_doc['manufacturer_ipn'] = article_data.manufacturer_ipn
    
    if article_data.system_um_id is not None:
        update_doc['system_um_id'] = ObjectId(article_data.system_um_id) if article_data.system_um_id else None
    
    if article_data.total_delivery_time is not None:
        update_doc['total_delivery_time'] = article_data.total_delivery_time
    
    if not update_doc:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        result = collection.update_one(
            {'_id': ObjectId(article_id)},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Return updated document
        updated_article = collection.find_one({'_id': ObjectId(article_id)})
        return serialize_doc(updated_article)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update article: {str(e)}")


@router.delete("/articles/{article_id}")
async def delete_article(
    request: Request,
    article_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete an article"""
    db = get_db()
    collection = db['depo_parts']
    
    try:
        result = collection.delete_one({'_id': ObjectId(article_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Article not found")
        
        return {'success': True, 'message': 'Article deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete article: {str(e)}")


@router.get("/locations")
async def get_locations(
    request: Request,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of locations from MongoDB with parent details populated"""
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


class LocationCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None


class LocationUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None


@router.post("/locations")
async def create_location(
    request: Request,
    location_data: LocationCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new location"""
    db = get_db()
    collection = db['depo_locations']
    
    # Build document
    doc = {
        'name': location_data.name,
        'description': location_data.description or '',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username', 'system'),
        'updated_by': current_user.get('username', 'system')
    }
    
    # Add parent_id if provided
    if location_data.parent_id:
        # Validate parent exists
        parent = collection.find_one({'_id': ObjectId(location_data.parent_id)})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent location not found")
        doc['parent_id'] = ObjectId(location_data.parent_id)
    
    try:
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        
        # Populate parent detail if exists
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
    
    # Build update document
    update_doc = {
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username', 'system')
    }
    
    if location_data.name is not None:
        update_doc['name'] = location_data.name
    
    if location_data.description is not None:
        update_doc['description'] = location_data.description
    
    # Handle parent_id update
    if location_data.parent_id is not None:
        if location_data.parent_id == '':
            # Remove parent (make it root)
            update_doc['parent_id'] = None
        else:
            # Validate parent exists
            parent = collection.find_one({'_id': ObjectId(location_data.parent_id)})
            if not parent:
                raise HTTPException(status_code=404, detail="Parent location not found")
            
            # Prevent self-parenting
            if location_data.parent_id == location_id:
                raise HTTPException(status_code=400, detail="A location cannot be its own parent")
            
            # Prevent circular references (check if new parent is a descendant)
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
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot set a descendant as parent (circular reference)"
                )
            
            update_doc['parent_id'] = ObjectId(location_data.parent_id)
    
    if len(update_doc) == 2:  # Only updated_at and updated_by
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        result = collection.update_one(
            {'_id': ObjectId(location_id)},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Location not found")
        
        # Return updated document with parent detail
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
        # Check if location has children
        children_count = locations_collection.count_documents({'parent_id': ObjectId(location_id)})
        if children_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete location with {children_count} sublocations. Delete or move them first."
            )
        
        # Check if location has stocks
        stocks_count = stocks_collection.count_documents({'location_id': ObjectId(location_id)})
        if stocks_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete location with {stocks_count} stock items. Move or delete them first."
            )
        
        # Delete location
        result = locations_collection.delete_one({'_id': ObjectId(location_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Location not found")
        
        return {'success': True, 'message': 'Location deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete location: {str(e)}")


@router.get("/companies")
async def get_companies(
    request: Request,
    search: Optional[str] = Query(None),
    is_supplier: Optional[bool] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of companies from MongoDB"""
    db = get_db()
    collection = db['depo_companies']
    
    query = {}
    if search:
        query['name'] = {'$regex': search, '$options': 'i'}
    if is_supplier is not None:
        query['is_supplier'] = is_supplier
    
    try:
        cursor = collection.find(query).sort('name', 1)
        companies = list(cursor)
        return serialize_doc(companies)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch companies: {str(e)}")


@router.get("/system-ums")
async def get_system_ums(
    request: Request,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of system units of measure from MongoDB"""
    db = get_db()
    collection = db['depo_ums']
    
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'symbol': {'$regex': search, '$options': 'i'}}
        ]
    
    try:
        cursor = collection.find(query).sort('name', 1)
        ums = list(cursor)
        return serialize_doc(ums)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch system UMs: {str(e)}")


@router.get("/categories")
async def get_categories(
    request: Request,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of categories from MongoDB with parent details populated"""
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
        
        # Populate parent details
        for category in categories:
            if category.get('parent_id'):
                parent = collection.find_one({'_id': category['parent_id']})
                if parent:
                    category['parent_detail'] = {'name': parent.get('name', '')}
        
        return serialize_doc(categories)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")


class CategoryCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None


@router.post("/categories")
async def create_category(
    request: Request,
    category_data: CategoryCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new category"""
    db = get_db()
    collection = db['depo_categories']
    
    # Build document
    doc = {
        'name': category_data.name,
        'description': category_data.description or '',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username', 'system'),
        'updated_by': current_user.get('username', 'system')
    }
    
    # Add parent_id if provided
    if category_data.parent_id:
        # Validate parent exists
        parent = collection.find_one({'_id': ObjectId(category_data.parent_id)})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
        doc['parent_id'] = ObjectId(category_data.parent_id)
    
    try:
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        
        # Populate parent detail if exists
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
    
    # Build update document
    update_doc = {
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username', 'system')
    }
    
    if category_data.name is not None:
        update_doc['name'] = category_data.name
    
    if category_data.description is not None:
        update_doc['description'] = category_data.description
    
    # Handle parent_id update
    if category_data.parent_id is not None:
        if category_data.parent_id == '':
            # Remove parent (make it root)
            update_doc['parent_id'] = None
        else:
            # Validate parent exists
            parent = collection.find_one({'_id': ObjectId(category_data.parent_id)})
            if not parent:
                raise HTTPException(status_code=404, detail="Parent category not found")
            
            # Prevent self-parenting
            if category_data.parent_id == category_id:
                raise HTTPException(status_code=400, detail="A category cannot be its own parent")
            
            # Prevent circular references (check if new parent is a descendant)
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
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot set a descendant as parent (circular reference)"
                )
            
            update_doc['parent_id'] = ObjectId(category_data.parent_id)
    
    if len(update_doc) == 2:  # Only updated_at and updated_by
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        result = collection.update_one(
            {'_id': ObjectId(category_id)},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Return updated document with parent detail
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
        # Check if category has children
        children_count = categories_collection.count_documents({'parent_id': ObjectId(category_id)})
        if children_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete category with {children_count} subcategories. Delete or move them first."
            )
        
        # Check if category has articles
        articles_count = parts_collection.count_documents({'category_id': ObjectId(category_id)})
        if articles_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete category with {articles_count} articles. Move or delete them first."
            )
        
        # Delete category
        result = categories_collection.delete_one({'_id': ObjectId(category_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Category not found")
        
        return {'success': True, 'message': 'Category deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete category: {str(e)}")


@router.get("/articles/{article_id}/recipes")
async def get_article_recipes(
    request: Request,
    article_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get all recipes that use this article"""
    db = get_db()
    recipes_collection = db['depo_recipes']
    parts_collection = db['depo_parts']
    
    try:
        # Find recipes where this article is used in items
        # Check both single items (type 1) and alternatives (type 2)
        # part_id is stored as ObjectId in depo_recipes
        recipes = list(recipes_collection.find({
            '$or': [
                {'items.part_id': ObjectId(article_id)},
                {'items.alternatives.part_id': ObjectId(article_id)},
                {'part_id': ObjectId(article_id)}
            ]
        }).sort('rev_date', -1))
        
        # Enrich recipes with product details from depo_parts
        for recipe in recipes:
            if recipe.get('part_id'):
                # part_id is already an ObjectId in the recipe document
                part_id = recipe['part_id'] if isinstance(recipe['part_id'], ObjectId) else ObjectId(recipe['part_id'])
                part = parts_collection.find_one({'_id': part_id})
                if part:
                    recipe['product_code'] = part.get('ipn', '')
                    recipe['product_name'] = part.get('name', '')
        
        return serialize_doc(recipes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch recipes: {str(e)}")


@router.get("/articles/{article_id}/stock-calculations")
async def get_article_stock_calculations(
    request: Request,
    article_id: str,
    current_user: dict = Depends(verify_token)
):
    """Calculate stock metrics for an article"""
    db = get_db()
    stocks_collection = db['depo_stocks']
    sales_orders_collection = db['depo_sales_orders']
    purchase_orders_collection = db['depo_purchase_orders']
    
    try:
        part_oid = ObjectId(article_id)
        
        # 1. Total Stock = sum of all stock quantities
        total_stock_pipeline = [
            {'$match': {'part_id': part_oid}},
            {'$group': {'_id': None, 'total': {'$sum': '$quantity'}}}
        ]
        total_stock_result = list(stocks_collection.aggregate(total_stock_pipeline))
        total_stock = total_stock_result[0]['total'] if total_stock_result else 0
        
        # 2. Quarantined Stock = stock with specific state_ids
        quarantine_state_ids = [
            ObjectId('694322758728e4d75ae7278f'),
            ObjectId('694322878728e4d75ae72790')
        ]
        quarantine_pipeline = [
            {'$match': {
                'part_id': part_oid,
                'state_id': {'$in': quarantine_state_ids}
            }},
            {'$group': {'_id': None, 'total': {'$sum': '$quantity'}}}
        ]
        quarantine_result = list(stocks_collection.aggregate(quarantine_pipeline))
        quarantined_stock = quarantine_result[0]['total'] if quarantine_result else 0
        
        # 3. Sales Stock = allocated in sales orders
        sales_stock = 0
        sales_orders = list(sales_orders_collection.find({'status': {'$nin': ['Cancelled', 'Completed']}}))
        for order in sales_orders:
            for item in order.get('items', []):
                if item.get('part_id') == part_oid:
                    sales_stock += item.get('quantity', 0)
        
        # 4. Future Stock = in purchase orders (procurement)
        future_stock = 0
        purchase_orders = list(purchase_orders_collection.find({'status': {'$nin': ['Cancelled', 'Completed']}}))
        for order in purchase_orders:
            for item in order.get('items', []):
                if item.get('part_id') == part_oid:
                    future_stock += item.get('quantity', 0)
        
        # 5. Available Stock = Total - Sales - Quarantine
        available_stock = total_stock - sales_stock - quarantined_stock
        
        return {
            'total_stock': total_stock,
            'sales_stock': sales_stock,
            'future_stock': future_stock,
            'quarantined_stock': quarantined_stock,
            'available_stock': available_stock
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate stock: {str(e)}")


@router.get("/articles/{article_id}/allocations")
async def get_article_allocations(
    request: Request,
    article_id: str,
    order_type: Optional[str] = Query(None),  # 'sales', 'purchase', or None for all
    current_user: dict = Depends(verify_token)
):
    """Get allocations for an article from sales and purchase orders"""
    db = get_db()
    sales_orders_collection = db['depo_sales_orders']
    purchase_orders_collection = db['depo_purchase_orders']
    
    try:
        part_oid = ObjectId(article_id)
        allocations = []
        
        # Get sales allocations if requested
        if order_type is None or order_type == 'sales':
            sales_orders = list(sales_orders_collection.find({'status': {'$nin': ['Cancelled', 'Completed']}}))
            for order in sales_orders:
                for item in order.get('items', []):
                    if item.get('part_id') == part_oid:
                        allocations.append({
                            '_id': str(order['_id']),
                            'type': 'sales',
                            'order_ref': order.get('reference', ''),
                            'customer': order.get('customer_name', ''),
                            'quantity': item.get('quantity', 0),
                            'status': order.get('status', ''),
                            'date': order.get('created_at', ''),
                            'notes': item.get('notes', '')
                        })
        
        # Get purchase allocations if requested
        if order_type is None or order_type == 'purchase':
            purchase_orders = list(purchase_orders_collection.find({'status': {'$nin': ['Cancelled', 'Completed']}}))
            for order in purchase_orders:
                for item in order.get('items', []):
                    if item.get('part_id') == part_oid:
                        allocations.append({
                            '_id': str(order['_id']),
                            'type': 'purchase',
                            'order_ref': order.get('reference', ''),
                            'supplier': order.get('supplier_name', ''),
                            'quantity': item.get('quantity', 0),
                            'status': order.get('status', ''),
                            'date': order.get('created_at', ''),
                            'notes': item.get('notes', '')
                        })
        
        # Sort by date descending
        allocations.sort(key=lambda x: x.get('date', ''), reverse=True)
        
        return serialize_doc(allocations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch allocations: {str(e)}")


class ArticleSupplierRequest(BaseModel):
    supplier_id: str
    supplier_code: Optional[str] = ""
    um: Optional[str] = ""
    notes: Optional[str] = ""
    price: Optional[float] = 0
    currency: Optional[str] = "EUR"


class ArticleSupplierUpdateRequest(BaseModel):
    supplier_code: Optional[str] = None
    um: Optional[str] = None
    notes: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None


@router.get("/articles/{article_id}/suppliers")
async def get_article_suppliers(
    request: Request,
    article_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get all suppliers for an article"""
    db = get_db()
    collection = db['depo_parts_suppliers']
    companies_collection = db['depo_companies']
    
    try:
        # Find all supplier relationships for this article
        suppliers = list(collection.find({'part_id': ObjectId(article_id)}))
        
        # Populate supplier details
        for supplier in suppliers:
            if supplier.get('supplier_id'):
                company = companies_collection.find_one({'_id': supplier['supplier_id']})
                if company:
                    supplier['supplier_detail'] = {'name': company.get('name', '')}
        
        return serialize_doc(suppliers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch article suppliers: {str(e)}")


@router.post("/articles/{article_id}/suppliers")
async def add_article_supplier(
    request: Request,
    article_id: str,
    supplier_data: ArticleSupplierRequest,
    current_user: dict = Depends(verify_token)
):
    """Add a supplier to an article"""
    db = get_db()
    collection = db['depo_parts_suppliers']
    companies_collection = db['depo_companies']
    
    # Validate supplier exists
    supplier = companies_collection.find_one({'_id': ObjectId(supplier_data.supplier_id)})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Check if relationship already exists
    existing = collection.find_one({
        'part_id': ObjectId(article_id),
        'supplier_id': ObjectId(supplier_data.supplier_id)
    })
    if existing:
        raise HTTPException(status_code=400, detail="This supplier is already added to this article")
    
    # Build document
    doc = {
        'part_id': ObjectId(article_id),
        'supplier_id': ObjectId(supplier_data.supplier_id),
        'supplier_code': supplier_data.supplier_code or '',
        'um': supplier_data.um or '',
        'notes': supplier_data.notes or '',
        'price': supplier_data.price or 0,
        'currency': supplier_data.currency or 'EUR',
        'created_at': datetime.utcnow(),
        'created_by': current_user.get('username', 'system'),
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username', 'system')
    }
    
    try:
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        doc['supplier_detail'] = {'name': supplier.get('name', '')}
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add supplier: {str(e)}")


@router.put("/articles/{article_id}/suppliers/{supplier_relation_id}")
async def update_article_supplier(
    request: Request,
    article_id: str,
    supplier_relation_id: str,
    supplier_data: ArticleSupplierUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update supplier information for an article"""
    db = get_db()
    collection = db['depo_parts_suppliers']
    
    # Build update document
    update_doc = {
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username', 'system')
    }
    
    if supplier_data.supplier_code is not None:
        update_doc['supplier_code'] = supplier_data.supplier_code
    if supplier_data.um is not None:
        update_doc['um'] = supplier_data.um
    if supplier_data.notes is not None:
        update_doc['notes'] = supplier_data.notes
    if supplier_data.price is not None:
        update_doc['price'] = supplier_data.price
    if supplier_data.currency is not None:
        update_doc['currency'] = supplier_data.currency
    
    if len(update_doc) == 2:  # Only updated_at and updated_by
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        result = collection.update_one(
            {'_id': ObjectId(supplier_relation_id), 'part_id': ObjectId(article_id)},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Supplier relationship not found")
        
        # Return updated document
        updated = collection.find_one({'_id': ObjectId(supplier_relation_id)})
        
        # Populate supplier detail
        if updated and updated.get('supplier_id'):
            companies_collection = db['depo_companies']
            company = companies_collection.find_one({'_id': updated['supplier_id']})
            if company:
                updated['supplier_detail'] = {'name': company.get('name', '')}
        
        return serialize_doc(updated)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update supplier: {str(e)}")


@router.delete("/articles/{article_id}/suppliers/{supplier_relation_id}")
async def remove_article_supplier(
    request: Request,
    article_id: str,
    supplier_relation_id: str,
    current_user: dict = Depends(verify_token)
):
    """Remove a supplier from an article"""
    db = get_db()
    collection = db['depo_parts_suppliers']
    
    try:
        result = collection.delete_one({
            '_id': ObjectId(supplier_relation_id),
            'part_id': ObjectId(article_id)
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Supplier relationship not found")
        
        return {'success': True, 'message': 'Supplier removed successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove supplier: {str(e)}")


@router.get("/stocks")
async def get_stocks(
    request: Request,
    search: Optional[str] = Query(None),
    part_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token)
):
    """Get list of stocks with enriched data including supplier information"""
    from modules.inventory.services import get_stocks_list
    return await get_stocks_list(search, skip, limit, part_id)


@router.get("/stocks/{stock_id}")
async def get_stock(
    request: Request,
    stock_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific stock entry with enriched data"""
    from modules.inventory.services import get_stock_by_id
    return await get_stock_by_id(stock_id)


class StockCreateRequest(BaseModel):
    part_id: str
    quantity: float
    location_id: str
    batch_code: Optional[str] = None
    supplier_batch_code: Optional[str] = None
    status: Optional[int] = 65  # Default to Quarantine
    supplier_um_id: Optional[str] = "694813b6297c9dde6d7065b7"  # Default supplier UM
    notes: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expected_quantity: Optional[float] = None
    expiry_date: Optional[str] = None
    reset_date: Optional[str] = None
    containers: Optional[List[Dict[str, Any]]] = None
    containers_cleaned: Optional[bool] = False
    supplier_ba_no: Optional[str] = None
    supplier_ba_date: Optional[str] = None
    accord_ba: Optional[bool] = False
    is_list_supplier: Optional[bool] = False
    clean_transport: Optional[bool] = False
    temperature_control: Optional[bool] = False
    temperature_conditions_met: Optional[bool] = False


@router.post("/stocks")
async def create_stock(
    request: Request,
    stock_data: StockCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new stock item"""
    db = get_db()
    collection = db['depo_stocks']
    
    # Validate part exists
    parts_collection = db['depo_parts']
    part = parts_collection.find_one({'_id': ObjectId(stock_data.part_id)})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    
    # Validate location exists
    locations_collection = db['depo_locations']
    location = locations_collection.find_one({'_id': ObjectId(stock_data.location_id)})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    # Build stock document with all fields
    doc = {
        'part_id': ObjectId(stock_data.part_id),
        'quantity': stock_data.quantity,
        'location_id': ObjectId(stock_data.location_id),
        'batch_code': stock_data.batch_code or '',
        'supplier_batch_code': stock_data.supplier_batch_code or '',
        'status': stock_data.status or 65,
        'notes': stock_data.notes or '',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username', 'system'),
        'updated_by': current_user.get('username', 'system')
    }
    
    # Add supplier_um_id if provided
    if stock_data.supplier_um_id:
        doc['supplier_um_id'] = ObjectId(stock_data.supplier_um_id)
    
    # Add optional fields if provided
    if stock_data.manufacturing_date:
        doc['manufacturing_date'] = stock_data.manufacturing_date
    if stock_data.expected_quantity is not None:
        doc['expected_quantity'] = stock_data.expected_quantity
    if stock_data.expiry_date:
        doc['expiry_date'] = stock_data.expiry_date
    if stock_data.reset_date:
        doc['reset_date'] = stock_data.reset_date
    if stock_data.containers:
        doc['containers'] = stock_data.containers
    if stock_data.containers_cleaned is not None:
        doc['containers_cleaned'] = stock_data.containers_cleaned
    if stock_data.supplier_ba_no:
        doc['supplier_ba_no'] = stock_data.supplier_ba_no
    if stock_data.supplier_ba_date:
        doc['supplier_ba_date'] = stock_data.supplier_ba_date
    if stock_data.accord_ba is not None:
        doc['accord_ba'] = stock_data.accord_ba
    if stock_data.is_list_supplier is not None:
        doc['is_list_supplier'] = stock_data.is_list_supplier
    if stock_data.clean_transport is not None:
        doc['clean_transport'] = stock_data.clean_transport
    if stock_data.temperature_control is not None:
        doc['temperature_control'] = stock_data.temperature_control
    if stock_data.temperature_conditions_met is not None:
        doc['temperature_conditions_met'] = stock_data.temperature_conditions_met
    
    try:
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create stock: {str(e)}")


# Supplier models
class SupplierAddressRequest(BaseModel):
    name: str
    country: Optional[str] = ""
    city: Optional[str] = ""
    address: Optional[str] = ""
    description: Optional[str] = ""
    contact: Optional[str] = ""
    email: Optional[str] = ""


class SupplierContactRequest(BaseModel):
    name: str
    role: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""


class SupplierCreateRequest(BaseModel):
    name: str
    code: Optional[str] = ""
    is_supplier: bool = True
    is_manufacturer: bool = False
    is_client: bool = False
    vatno: Optional[str] = ""
    regno: Optional[str] = ""
    payment_conditions: Optional[str] = ""
    addresses: Optional[List[Dict[str, Any]]] = []
    contacts: Optional[List[Dict[str, Any]]] = []


class SupplierUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_supplier: Optional[bool] = None
    is_manufacturer: Optional[bool] = None
    is_client: Optional[bool] = None
    vatno: Optional[str] = None
    regno: Optional[str] = None
    payment_conditions: Optional[str] = None
    addresses: Optional[List[Dict[str, Any]]] = None
    contacts: Optional[List[Dict[str, Any]]] = None


class SupplierPartRequest(BaseModel):
    part_id: str
    supplier_code: Optional[str] = ""
    currency: Optional[str] = "EUR"


class SupplierPartUpdateRequest(BaseModel):
    supplier_code: Optional[str] = None
    currency: Optional[str] = None


@router.get("/suppliers")
async def get_suppliers(
    request: Request,
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token)
):
    """Get list of suppliers (companies with is_supplier=true)"""
    from modules.inventory.services import get_suppliers_list
    return await get_suppliers_list(search, skip, limit)


@router.get("/suppliers/{supplier_id}")
async def get_supplier(
    request: Request,
    supplier_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific supplier by ID"""
    from modules.inventory.services import get_supplier_by_id
    return await get_supplier_by_id(supplier_id)


@router.post("/suppliers")
async def create_supplier(
    request: Request,
    supplier_data: SupplierCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new supplier"""
    from modules.inventory.services import create_supplier as create_supplier_service
    return await create_supplier_service(supplier_data.dict(), current_user)


@router.put("/suppliers/{supplier_id}")
async def update_supplier(
    request: Request,
    supplier_id: str,
    supplier_data: SupplierUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an existing supplier"""
    from modules.inventory.services import update_supplier as update_supplier_service
    # Only include fields that were actually provided
    update_dict = {k: v for k, v in supplier_data.dict().items() if v is not None}
    return await update_supplier_service(supplier_id, update_dict, current_user)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    request: Request,
    supplier_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a supplier"""
    from modules.inventory.services import delete_supplier as delete_supplier_service
    return await delete_supplier_service(supplier_id)


@router.get("/suppliers/{supplier_id}/parts")
async def get_supplier_parts(
    request: Request,
    supplier_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get parts associated with a supplier"""
    from modules.inventory.services import get_supplier_parts as get_supplier_parts_service
    return await get_supplier_parts_service(supplier_id)


@router.post("/suppliers/{supplier_id}/parts")
async def add_supplier_part(
    request: Request,
    supplier_id: str,
    part_data: SupplierPartRequest,
    current_user: dict = Depends(verify_token)
):
    """Add a part to supplier's parts list"""
    from modules.inventory.services import add_supplier_part as add_supplier_part_service
    return await add_supplier_part_service(supplier_id, part_data.dict())


@router.put("/suppliers/{supplier_id}/parts/{part_id}")
async def update_supplier_part(
    request: Request,
    supplier_id: str,
    part_id: str,
    part_data: SupplierPartUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update supplier-specific data for a part"""
    from modules.inventory.services import update_supplier_part as update_supplier_part_service
    update_dict = {k: v for k, v in part_data.dict().items() if v is not None}
    return await update_supplier_part_service(supplier_id, part_id, update_dict)


@router.delete("/suppliers/{supplier_id}/parts/{part_id}")
async def remove_supplier_part(
    request: Request,
    supplier_id: str,
    part_id: str,
    current_user: dict = Depends(verify_token)
):
    """Remove a part from supplier's parts list"""
    from modules.inventory.services import remove_supplier_part as remove_supplier_part_service
    return await remove_supplier_part_service(supplier_id, part_id)


# Manufacturers routes (reuse supplier logic)
@router.get("/manufacturers")
async def get_manufacturers(
    request: Request,
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token)
):
    """Get list of manufacturers (companies with is_manufacturer=true)"""
    from modules.inventory.services import get_manufacturers_list
    return await get_manufacturers_list(search, skip, limit)


@router.get("/manufacturers/{manufacturer_id}")
async def get_manufacturer(
    request: Request,
    manufacturer_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific manufacturer by ID"""
    from modules.inventory.services import get_supplier_by_id
    return await get_supplier_by_id(manufacturer_id)


@router.post("/manufacturers")
async def create_manufacturer(
    request: Request,
    manufacturer_data: SupplierCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new manufacturer"""
    from modules.inventory.services import create_supplier as create_supplier_service
    return await create_supplier_service(manufacturer_data.dict(), current_user)


@router.put("/manufacturers/{manufacturer_id}")
async def update_manufacturer(
    request: Request,
    manufacturer_id: str,
    manufacturer_data: SupplierUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an existing manufacturer"""
    from modules.inventory.services import update_supplier as update_supplier_service
    update_dict = {k: v for k, v in manufacturer_data.dict().items() if v is not None}
    return await update_supplier_service(manufacturer_id, update_dict, current_user)


@router.delete("/manufacturers/{manufacturer_id}")
async def delete_manufacturer(
    request: Request,
    manufacturer_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a manufacturer"""
    from modules.inventory.services import delete_supplier as delete_supplier_service
    return await delete_supplier_service(manufacturer_id)


# Clients routes (reuse supplier logic)
@router.get("/clients")
async def get_clients(
    request: Request,
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token)
):
    """Get list of clients (companies with is_client=true)"""
    from modules.inventory.services import get_clients_list
    return await get_clients_list(search, skip, limit)


@router.get("/clients/{client_id}")
async def get_client(
    request: Request,
    client_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific client by ID"""
    from modules.inventory.services import get_supplier_by_id
    return await get_supplier_by_id(client_id)


@router.post("/clients")
async def create_client(
    request: Request,
    client_data: SupplierCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new client"""
    from modules.inventory.services import create_supplier as create_supplier_service
    return await create_supplier_service(client_data.dict(), current_user)


@router.put("/clients/{client_id}")
async def update_client(
    request: Request,
    client_id: str,
    client_data: SupplierUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an existing client"""
    from modules.inventory.services import update_supplier as update_supplier_service
    update_dict = {k: v for k, v in client_data.dict().items() if v is not None}
    return await update_supplier_service(client_id, update_dict, current_user)


@router.delete("/clients/{client_id}")
async def delete_client(
    request: Request,
    client_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a client"""
    from modules.inventory.services import delete_supplier as delete_supplier_service
    return await delete_supplier_service(client_id)
