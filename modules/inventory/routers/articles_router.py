"""
Articles/Parts Router
CRUD operations for articles and parts
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token
from modules.inventory.services.common import serialize_doc

router = APIRouter(prefix="/articles", tags=["articles"])


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


@router.get("/parts")
async def get_parts(
    request: Request,
    search: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    is_salable: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    sort_by: Optional[str] = Query("name"),
    sort_order: Optional[str] = Query("asc"),
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get list of parts (alias for articles) from MongoDB with search, pagination and sorting"""
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
            parts_suppliers_collection = db['depo_parts_suppliers']
            supplier_parts = list(parts_suppliers_collection.find({'supplier_id': ObjectId(supplier_id)}))
            part_ids = [sp['part_id'] for sp in supplier_parts]
            
            if part_ids:
                if query:
                    query = {'$and': [query, {'_id': {'$in': part_ids}}]}
                else:
                    query = {'_id': {'$in': part_ids}}
            else:
                return {'results': [], 'total': 0, 'skip': skip, 'limit': limit}
        except Exception as e:
            print(f"Invalid supplier_id: {supplier_id}, error: {e}")

    # Filter by salable flag if requested
    if is_salable is not None:
        query['is_salable'] = bool(is_salable)
    
    # Build sort
    sort_direction = 1 if sort_order == 'asc' else -1
    sort = [(sort_by, sort_direction)]
    
    try:
        total = collection.count_documents(query)
        cursor = collection.find(query).sort(sort).skip(skip).limit(limit)
        parts = list(cursor)
        
        return {
            'results': serialize_doc(parts),
            'total': total,
            'skip': skip,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch parts: {str(e)}")


@router.get("")
async def get_articles(
    request: Request,
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    sort_by: Optional[str] = Query("name"),
    sort_order: Optional[str] = Query("asc"),
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get list of articles from MongoDB with search, category filter, pagination and sorting"""
    collection = db['depo_parts']
    
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'ipn': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}}
        ]
    
    if category:
        query['category_id'] = ObjectId(category)
    
    sort_direction = 1 if sort_order == 'asc' else -1
    sort = [(sort_by, sort_direction)]
    
    try:
        total = collection.count_documents(query)
        cursor = collection.find(query).sort(sort).skip(skip).limit(limit)
        articles = list(cursor)
        
        # Enrich with System UM and Category details
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
            
            if article.get('category_id'):
                category = categories_collection.find_one({'_id': article['category_id']})
                if category:
                    article['category_detail'] = {'name': category.get('name', '')}
        
        return {
            'results': serialize_doc(articles),
            'total': total,
            'skip': skip,
            'limit': limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch articles: {str(e)}")


@router.get("/{article_id}")
async def get_article(
    request: Request,
    article_id: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get a specific article by ID"""
    try:
        article = db['depo_parts'].find_one({'_id': ObjectId(article_id)})
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        return serialize_doc(article)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch article: {str(e)}")


@router.post("")
async def create_article(
    request: Request,
    article_data: ArticleCreateRequest,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Create a new article"""
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
    
    if article_data.default_location_id:
        doc['default_location_id'] = ObjectId(article_data.default_location_id)
    if article_data.default_expiry is not None:
        doc['default_expiry'] = article_data.default_expiry
    if article_data.minimum_stock is not None:
        doc['minimum_stock'] = article_data.minimum_stock
    if article_data.supplier_id:
        doc['supplier_id'] = ObjectId(article_data.supplier_id)
    
    try:
        result = db['depo_parts'].insert_one(doc)
        doc['_id'] = result.inserted_id
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create article: {str(e)}")


@router.put("/{article_id}")
async def update_article(
    request: Request,
    article_id: str,
    article_data: ArticleUpdateRequest,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Update an existing article"""
    update_doc = {}
    
    # Map all optional fields
    field_mapping = {
        'name': 'name', 'ipn': 'ipn', 'um': 'um', 'description': 'description',
        'notes': 'notes', 'keywords': 'keywords', 'link': 'link',
        'default_expiry': 'default_expiry', 'minimum_stock': 'minimum_stock',
        'is_component': 'is_component', 'is_assembly': 'is_assembly',
        'is_testable': 'is_testable', 'is_salable': 'is_salable',
        'is_active': 'is_active', 'storage_conditions': 'storage_conditions',
        'regulated': 'regulated', 'lotallexp': 'lotallexp',
        'selection_method': 'selection_method', 'manufacturer_ipn': 'manufacturer_ipn',
        'total_delivery_time': 'total_delivery_time'
    }
    
    for field, db_field in field_mapping.items():
        value = getattr(article_data, field, None)
        if value is not None:
            update_doc[db_field] = value
    
    # Handle ObjectId fields
    if article_data.default_location_id is not None:
        update_doc['default_location_id'] = ObjectId(article_data.default_location_id) if article_data.default_location_id else None
    if article_data.category_id is not None:
        update_doc['category_id'] = ObjectId(article_data.category_id) if article_data.category_id else None
    if article_data.manufacturer_id is not None:
        update_doc['manufacturer_id'] = ObjectId(article_data.manufacturer_id) if article_data.manufacturer_id else None
    if article_data.system_um_id is not None:
        update_doc['system_um_id'] = ObjectId(article_data.system_um_id) if article_data.system_um_id else None
    
    if not update_doc:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        result = db['depo_parts'].update_one({'_id': ObjectId(article_id)}, {'$set': update_doc})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Article not found")
        
        updated_article = db['depo_parts'].find_one({'_id': ObjectId(article_id)})
        return serialize_doc(updated_article)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update article: {str(e)}")


@router.delete("/{article_id}")
async def delete_article(
    request: Request,
    article_id: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Delete an article"""
    try:
        result = db['depo_parts'].delete_one({'_id': ObjectId(article_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Article not found")
        return {'success': True, 'message': 'Article deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete article: {str(e)}")


# Article-specific endpoints
@router.get("/{article_id}/recipes")
async def get_article_recipes(
    request: Request,
    article_id: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get all recipes that use this article"""
    try:
        recipes = list(db['depo_recipes'].find({
            '$or': [
                {'items.part_id': ObjectId(article_id)},
                {'items.alternatives.part_id': ObjectId(article_id)},
                {'part_id': ObjectId(article_id)}
            ]
        }).sort('rev_date', -1))
        
        # Enrich with product details
        for recipe in recipes:
            if recipe.get('part_id'):
                part_id = recipe['part_id'] if isinstance(recipe['part_id'], ObjectId) else ObjectId(recipe['part_id'])
                part = db['depo_parts'].find_one({'_id': part_id})
                if part:
                    recipe['product_code'] = part.get('ipn', '')
                    recipe['product_name'] = part.get('name', '')
        
        return serialize_doc(recipes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch recipes: {str(e)}")


@router.get("/{article_id}/stock-calculations")
async def get_article_stock_calculations(
    request: Request,
    article_id: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Calculate stock metrics for an article"""
    try:
        part_oid = ObjectId(article_id)
        
        # Total Stock
        total_stock_result = list(db['depo_stocks'].aggregate([
            {'$match': {'part_id': part_oid}},
            {'$group': {'_id': None, 'total': {'$sum': '$quantity'}}}
        ]))
        total_stock = total_stock_result[0]['total'] if total_stock_result else 0
        
        # Quarantined Stock
        quarantine_state_ids = [
            ObjectId('694322758728e4d75ae7278f'),
            ObjectId('694322878728e4d75ae72790')
        ]
        quarantine_result = list(db['depo_stocks'].aggregate([
            {'$match': {'part_id': part_oid, 'state_id': {'$in': quarantine_state_ids}}},
            {'$group': {'_id': None, 'total': {'$sum': '$quantity'}}}
        ]))
        quarantined_stock = quarantine_result[0]['total'] if quarantine_result else 0
        
        # Sales Stock
        sales_stock = 0
        sales_orders = list(db['depo_sales_orders'].find({'status': {'$nin': ['Cancelled', 'Completed']}}))
        for order in sales_orders:
            for item in order.get('items', []):
                if item.get('part_id') == part_oid:
                    sales_stock += item.get('quantity', 0)
        
        # Future Stock
        future_stock = 0
        purchase_orders = list(db['depo_purchase_orders'].find({'status': {'$nin': ['Cancelled', 'Completed']}}))
        for order in purchase_orders:
            for item in order.get('items', []):
                if item.get('part_id') == part_oid:
                    future_stock += item.get('quantity', 0)
        
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


@router.get("/{article_id}/allocations")
async def get_article_allocations(
    request: Request,
    article_id: str,
    order_type: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get allocations for an article from sales and purchase orders"""
    try:
        part_oid = ObjectId(article_id)
        allocations = []
        
        if order_type is None or order_type == 'sales':
            sales_orders = list(db['depo_sales_orders'].find({'status': {'$nin': ['Cancelled', 'Completed']}}))
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
        
        if order_type is None or order_type == 'purchase':
            purchase_orders = list(db['depo_purchase_orders'].find({'status': {'$nin': ['Cancelled', 'Completed']}}))
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
        
        allocations.sort(key=lambda x: x.get('date', ''), reverse=True)
        return serialize_doc(allocations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch allocations: {str(e)}")


@router.get("/{article_id}/suppliers")
async def get_article_suppliers(
    request: Request,
    article_id: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Get all suppliers for an article"""
    try:
        suppliers = list(db['depo_parts_suppliers'].find({'part_id': ObjectId(article_id)}))
        
        for supplier in suppliers:
            if supplier.get('supplier_id'):
                company = db['depo_companies'].find_one({'_id': supplier['supplier_id']})
                if company:
                    supplier['supplier_detail'] = {'name': company.get('name', '')}
        
        return serialize_doc(suppliers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch article suppliers: {str(e)}")


@router.post("/{article_id}/suppliers")
async def add_article_supplier(
    request: Request,
    article_id: str,
    supplier_data: ArticleSupplierRequest,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Add a supplier to an article"""
    supplier = db['depo_companies'].find_one({'_id': ObjectId(supplier_data.supplier_id)})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    existing = db['depo_parts_suppliers'].find_one({
        'part_id': ObjectId(article_id),
        'supplier_id': ObjectId(supplier_data.supplier_id)
    })
    if existing:
        raise HTTPException(status_code=400, detail="This supplier is already added to this article")
    
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
        result = db['depo_parts_suppliers'].insert_one(doc)
        doc['_id'] = result.inserted_id
        doc['supplier_detail'] = {'name': supplier.get('name', '')}
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add supplier: {str(e)}")


@router.put("/{article_id}/suppliers/{supplier_relation_id}")
async def update_article_supplier(
    request: Request,
    article_id: str,
    supplier_relation_id: str,
    supplier_data: ArticleSupplierUpdateRequest,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Update supplier information for an article"""
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
    
    if len(update_doc) == 2:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        result = db['depo_parts_suppliers'].update_one(
            {'_id': ObjectId(supplier_relation_id), 'part_id': ObjectId(article_id)},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Supplier relationship not found")
        
        updated = db['depo_parts_suppliers'].find_one({'_id': ObjectId(supplier_relation_id)})
        if updated and updated.get('supplier_id'):
            company = db['depo_companies'].find_one({'_id': updated['supplier_id']})
            if company:
                updated['supplier_detail'] = {'name': company.get('name', '')}
        
        return serialize_doc(updated)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update supplier: {str(e)}")


@router.delete("/{article_id}/suppliers/{supplier_relation_id}")
async def remove_article_supplier(
    request: Request,
    article_id: str,
    supplier_relation_id: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Remove a supplier from an article"""
    try:
        result = db['depo_parts_suppliers'].delete_one({
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
