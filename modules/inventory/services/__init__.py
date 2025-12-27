"""
Inventory Services
Servicii pentru gestionare inventar
"""
from .common import serialize_doc, validate_object_id, build_search_query, paginate_results
from .stocks_service import (
    get_stocks_list,
    get_stock_by_id,
    create_stock,
    update_stock,
    transfer_stock,
    adjust_stock,
    consume_stock
)

__all__ = [
    # Common
    'serialize_doc',
    'validate_object_id',
    'build_search_query',
    'paginate_results',
    
    # Stocks
    'get_stocks_list',
    'get_stock_by_id',
    'create_stock',
    'update_stock',
    'transfer_stock',
    'adjust_stock',
    'consume_stock',
]
