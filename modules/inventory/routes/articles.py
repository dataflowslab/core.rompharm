"""
Articles/Parts routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token
from .utils import (
    serialize_doc,
    ArticleCreateRequest,
    ArticleUpdateRequest,
    ArticleSupplierRequest,
    ArticleSupplierUpdateRequest
)

router = APIRouter()


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
    """Get list of parts (alias for articles)"""
    db = get_db()
    collection = db['depo_parts']
    
    query = {'is_active': True}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'ipn': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}}
        ]
    
    if supplier_id:
        try:
            parts_suppliers_collection = db['depo_parts_suppliers']
            supplier_parts = list(parts_suppliers_collection.find({'supplier_id': ObjectId(supplier_id)}))
            part_ids = [sp['part_id'] for sp in supplier_parts]
            
            if part_ids:
                query = {'$and': [query, {'_id': {'$in': part_ids}}]}
            else:
                return {'results': [], 'total': 0, 'skip': skip, 'limit': limit}
        except Exception as e:
            print(f"Invalid supplier_id: {supplier_id}, error: {e}")
    
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
    """Get list of articles"""
    db = get_db()
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
        
        # Enrich with System UM, Category details, and Total Stock
        ums_collection = db['depo_ums']
        categories_collection = db['depo_categories']
        stocks_collection = db['depo_stocks']
        
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
            
            # Calculate total stock
            total_stock_pipeline = [
                {'$match': {'part_id': article['_id']}},
                {'$group': {'_id': None, 'total': {'$sum': '$quantity'}}}
            ]
            total_stock_result = list(stocks_collection.aggregate(total_stock_pipeline))
            article['total_stock'] = total_stock_result[0]['total'] if total_stock_result else 0
        
        return {
            'results': serialize_doc(articles),
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
    
    doc = {
        'name': article_data.name,
        'ipn': article_data.ipn,
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
    if article_data.system_um_id:
        doc['system_um_id'] = ObjectId(article_data.system_um_id)
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
    
    update_doc = {}
    
    # Simple fields
    for field in ['name', 'ipn', 'um', 'description', 'notes', 'keywords', 'link', 
                  'minimum_stock', 'is_component', 'is_assembly', 'is_testable', 
                  'is_salable', 'is_active', 'storage_conditions', 'regulated', 
                  'lotallexp', 'selection_method', 'manufacturer_ipn', 
                  'total_delivery_time', 'payment_condition']:
        value = getattr(article_data, field, None)
        if value is not None:
            update_doc[field] = value
    
    # ObjectId fields
    for field in ['default_location_id', 'category_id', 'manufacturer_id', 'system_um_id']:
        value = getattr(article_data, field, None)
        if value is not None:
            update_doc[field] = ObjectId(value) if value else None
    
    if not update_doc:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        result = collection.update_one(
            {'_id': ObjectId(article_id)},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Article not found")
        
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


# Article-related endpoints (recipes, stock calculations, allocations, suppliers)

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
        recipes = list(recipes_collection.find({
            '$or': [
                {'items.part_id': ObjectId(article_id)},
                {'items.alternatives.part_id': ObjectId(article_id)},
                {'part_id': ObjectId(article_id)}
            ]
        }).sort('rev_date', -1))
        
        for recipe in recipes:
            if recipe.get('part_id'):
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
        
        # Total Stock
        total_stock_pipeline = [
            {'$match': {'part_id': part_oid}},
            {'$group': {'_id': None, 'total': {'$sum': '$quantity'}}}
        ]
        total_stock_result = list(stocks_collection.aggregate(total_stock_pipeline))
        total_stock = total_stock_result[0]['total'] if total_stock_result else 0
        
        # Quarantined Stock
        quarantine_state_ids = [
            ObjectId('694322758728e4d75ae7278f'),
            ObjectId('694322878728e4d75ae72790')
        ]
        quarantine_pipeline = [
            {'$match': {'part_id': part_oid, 'state_id': {'$in': quarantine_state_ids}}},
            {'$group': {'_id': None, 'total': {'$sum': '$quantity'}}}
        ]
        quarantine_result = list(stocks_collection.aggregate(quarantine_pipeline))
        quarantined_stock = quarantine_result[0]['total'] if quarantine_result else 0
        
        # Sales Stock
        sales_stock = 0
        sales_orders = list(sales_orders_collection.find({'status': {'$nin': ['Cancelled', 'Completed']}}))
        for order in sales_orders:
            for item in order.get('items', []):
                if item.get('part_id') == part_oid:
                    sales_stock += item.get('quantity', 0)
        
        # Future Stock
        future_stock = 0
        purchase_orders = list(purchase_orders_collection.find({'status': {'$nin': ['Cancelled', 'Completed']}}))
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


@router.get("/articles/{article_id}/allocations")
async def get_article_allocations(
    request: Request,
    article_id: str,
    order_type: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get allocations for an article from sales and purchase orders"""
    db = get_db()
    sales_orders_collection = db['depo_sales_orders']
    purchase_orders_collection = db['depo_purchase_orders']
    
    try:
        part_oid = ObjectId(article_id)
        allocations = []
        
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
        
        allocations.sort(key=lambda x: x.get('date', ''), reverse=True)
        
        return serialize_doc(allocations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch allocations: {str(e)}")


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
        suppliers = list(collection.find({'part_id': ObjectId(article_id)}))
        
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
    
    supplier = companies_collection.find_one({'_id': ObjectId(supplier_data.supplier_id)})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    existing = collection.find_one({
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
    
    update_doc = {
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username', 'system')
    }
    
    for field in ['supplier_code', 'um', 'notes', 'price', 'currency']:
        value = getattr(supplier_data, field, None)
        if value is not None:
            update_doc[field] = value
    
    if len(update_doc) == 2:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        result = collection.update_one(
            {'_id': ObjectId(supplier_relation_id), 'part_id': ObjectId(article_id)},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Supplier relationship not found")
        
        updated = collection.find_one({'_id': ObjectId(supplier_relation_id)})
        
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
