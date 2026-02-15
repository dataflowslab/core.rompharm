"""
Analytics services for Articles
"""
from typing import List, Dict, Any, Optional
from bson import ObjectId
from src.backend.utils.db import get_db

def calculate_article_stock(article_id: str) -> Dict[str, float]:
    """
    Calculate stock metrics for an article
    """
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
        raise Exception(f"Failed to calculate stock: {str(e)}")

def get_article_allocations_data(article_id: str, order_type: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get allocations for an article from sales and purchase orders
    """
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
        return allocations
    except Exception as e:
        raise Exception(f"Failed to fetch allocations: {str(e)}")
