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
    supplier_id: Optional[str] = None


@router.get("/articles")
async def get_articles(
    request: Request,
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    sort_by: Optional[str] = Query("name"),
    sort_order: Optional[str] = Query("asc"),
    current_user: dict = Depends(verify_token)
):
    """Get list of articles from MongoDB with search, pagination and sorting"""
    db = get_db()
    collection = db['depo_parts']
    
    # Build query
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'ipn': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}}
        ]
    
    # Build sort
    sort_direction = 1 if sort_order == 'asc' else -1
    sort = [(sort_by, sort_direction)]
    
    try:
        # Get total count
        total = collection.count_documents(query)
        
        # Get paginated results
        cursor = collection.find(query).sort(sort).skip(skip).limit(limit)
        articles = list(cursor)
        
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
    
    if article_data.supplier_id is not None:
        update_doc['supplier_id'] = ObjectId(article_data.supplier_id) if article_data.supplier_id else None
    
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
    """Get list of locations from MongoDB"""
    db = get_db()
    collection = db['depo_locations']
    
    query = {}
    if search:
        query['name'] = {'$regex': search, '$options': 'i'}
    
    try:
        cursor = collection.find(query).sort('name', 1)
        locations = list(cursor)
        return serialize_doc(locations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch locations: {str(e)}")


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


@router.get("/categories")
async def get_categories(
    request: Request,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of categories from MongoDB"""
    db = get_db()
    collection = db['depo_categories']
    
    query = {}
    if search:
        query['name'] = {'$regex': search, '$options': 'i'}
    
    try:
        cursor = collection.find(query).sort('name', 1)
        categories = list(cursor)
        return serialize_doc(categories)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")


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
