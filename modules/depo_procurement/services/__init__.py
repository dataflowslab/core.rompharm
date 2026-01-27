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
from .approval_flow import (
    get_order_approval_flow,
    create_order_approval_flow,
    sign_purchase_order,
    remove_order_signature
)
from .qc_records import (
    get_qc_records,
    create_qc_record,
    update_qc_record
)
from .received_stock_approval import (
    get_received_stock_approval_flow,
    create_received_stock_approval_flow,
    sign_received_stock,
    remove_received_stock_signature
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
    # Approval Flow
    'get_order_approval_flow',
    'create_order_approval_flow',
    'sign_purchase_order',
    'remove_order_signature',
    # Received Stock Approval Flow
    'get_received_stock_approval_flow',
    'create_received_stock_approval_flow',
    'sign_received_stock',
    'remove_received_stock_signature',
    # QC Records
    'get_qc_records',
    'create_qc_record',
    'update_qc_record',
]
