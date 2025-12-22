"""
DEPO Procurement Module - Services
"""
from .purchase_orders import (
    get_purchase_orders_list,
    get_purchase_order_by_id,
    create_new_purchase_order
)
from .order_items import (
    get_order_items,
    add_order_item,
    update_order_item,
    update_order_item_by_id,
    delete_order_item,
    delete_order_item_by_id
)
from .stock_receiving import (
    receive_stock_item,
    get_received_stock_items
)
from .attachments import (
    get_order_attachments,
    upload_order_attachment,
    delete_order_attachment
)
from .order_state import (
    change_order_state,
    check_and_auto_finish_order
)

__all__ = [
    # Purchase Orders
    'get_purchase_orders_list',
    'get_purchase_order_by_id',
    'create_new_purchase_order',
    # Order Items
    'get_order_items',
    'add_order_item',
    'update_order_item',
    'update_order_item_by_id',
    'delete_order_item',
    'delete_order_item_by_id',
    # Stock Receiving
    'receive_stock_item',
    'get_received_stock_items',
    # Attachments
    'get_order_attachments',
    'upload_order_attachment',
    'delete_order_attachment',
    # Order State
    'change_order_state',
    'check_and_auto_finish_order',
]
