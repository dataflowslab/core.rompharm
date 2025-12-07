"""
DEPO Procurement Module - InvenTree integration
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import requests
import yaml
import os

# Import from core
from src.backend.utils.db import get_db
from src.backend.utils.config import load_config, get_config_value
from src.backend.routes.auth import verify_token

router = APIRouter(prefix="/modules/depo_procurement/api", tags=["depo_procurement"])


def get_inventree_headers(user: dict) -> Dict[str, str]:
    """Get headers for InvenTree API requests"""
    token = user.get('token')
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated with InvenTree")
    
    return {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }


# Pydantic models
class NewSupplierRequest(BaseModel):
    name: str
    currency: str = "EUR"
    tax_id: Optional[str] = None
    is_supplier: bool = True
    is_manufacturer: bool = False
    cod: Optional[str] = None
    reg_code: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None


class PurchaseOrderRequest(BaseModel):
    supplier: int
    reference: Optional[str] = None
    description: Optional[str] = None
    supplier_reference: Optional[str] = None
    currency: Optional[str] = None
    issue_date: Optional[str] = None
    target_date: Optional[str] = None
    destination: Optional[int] = None
    notes: Optional[str] = None


class PurchaseOrderItemRequest(BaseModel):
    part: int
    quantity: float
    purchase_price: Optional[float] = None
    reference: Optional[str] = None
    destination: Optional[int] = None
    purchase_price_currency: Optional[str] = None
    notes: Optional[str] = None


class PurchaseOrderItemUpdateRequest(BaseModel):
    quantity: Optional[float] = None
    purchase_price: Optional[float] = None
    reference: Optional[str] = None
    destination: Optional[int] = None
    purchase_price_currency: Optional[str] = None
    notes: Optional[str] = None


@router.get("/suppliers")
async def get_suppliers(
    request: Request,
    search: Optional[str] = None,
    current_user: dict = Depends(verify_token)
):
    """Get list of suppliers from InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    params = {
        'is_supplier': 'true'
    }
    if search:
        params['search'] = search
    
    try:
        response = requests.get(
            f"{inventree_url}/api/company/",
            headers=headers,
            params=params,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch suppliers: {str(e)}")


@router.post("/suppliers")
async def create_supplier(
    request: Request,
    supplier_data: NewSupplierRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new supplier in InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    # Create company in InvenTree
    company_payload = {
        'name': supplier_data.name,
        'is_supplier': supplier_data.is_supplier,
        'is_manufacturer': supplier_data.is_manufacturer,
        'currency': supplier_data.currency
    }
    
    try:
        # Create company
        response = requests.post(
            f"{inventree_url}/api/company/",
            headers=headers,
            json=company_payload,
            timeout=10
        )
        response.raise_for_status()
        company = response.json()
        company_id = company.get('pk') or company.get('id')
        
        # Add primary address if provided
        if supplier_data.address or supplier_data.country or supplier_data.city:
            address_payload = {
                'company': company_id,
                'primary': True
            }
            if supplier_data.address:
                address_payload['line1'] = supplier_data.address
            if supplier_data.country:
                address_payload['country'] = supplier_data.country
            if supplier_data.city:
                address_payload['postal_city'] = supplier_data.city
            
            try:
                addr_response = requests.post(
                    f"{inventree_url}/api/company/address/",
                    headers=headers,
                    json=address_payload,
                    timeout=10
                )
                addr_response.raise_for_status()
            except Exception as e:
                print(f"Warning: Failed to create address: {e}")
        
        # Add custom fields via plugin if provided
        custom_fields = {}
        if supplier_data.cod:
            custom_fields['cod'] = supplier_data.cod
        if supplier_data.reg_code:
            custom_fields['reg_code'] = supplier_data.reg_code
        if supplier_data.tax_id:
            custom_fields['tax_id'] = supplier_data.tax_id
        
        if custom_fields:
            try:
                plugin_response = requests.post(
                    f"{inventree_url}/plugin/dataflows-depo-companies/api/extra/company/{company_id}/update/",
                    headers=headers,
                    json={'fields': custom_fields},
                    timeout=10
                )
                plugin_response.raise_for_status()
            except Exception as e:
                print(f"Warning: Failed to set custom fields: {e}")
        
        return company
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to create supplier: {str(e)}")


@router.get("/stock-locations")
async def get_stock_locations(
    request: Request,
    current_user: dict = Depends(verify_token)
):
    """Get list of stock locations from InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        response = requests.get(
            f"{inventree_url}/api/stock/location/",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock locations: {str(e)}")


@router.get("/purchase-orders")
async def get_purchase_orders(
    request: Request,
    current_user: dict = Depends(verify_token)
):
    """Get list of purchase orders from InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        response = requests.get(
            f"{inventree_url}/api/order/po/",
            headers=headers,
            params={'supplier_detail': 'true'},
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch purchase orders: {str(e)}")


@router.get("/purchase-orders/{order_id}")
async def get_purchase_order(
    request: Request,
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get a specific purchase order from InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        response = requests.get(
            f"{inventree_url}/api/order/po/{order_id}/",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch purchase order: {str(e)}")


@router.post("/purchase-orders")
async def create_purchase_order(
    request: Request,
    order_data: PurchaseOrderRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new purchase order in InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    payload = {
        'supplier': order_data.supplier,
    }
    
    # Auto-generate reference if not provided
    if not order_data.reference:
        try:
            # Get all purchase orders to find the next number
            po_list_response = requests.get(
                f"{inventree_url}/api/order/po/",
                headers=headers,
                timeout=10
            )
            po_list_response.raise_for_status()
            po_list = po_list_response.json()
            
            # Extract numbers from existing PO references
            max_num = 0
            if isinstance(po_list, list):
                orders = po_list
            else:
                orders = po_list.get('results', [])
            
            for po in orders:
                ref = po.get('reference', '')
                if ref.startswith('PO-'):
                    try:
                        num = int(ref.replace('PO-', ''))
                        max_num = max(max_num, num)
                    except ValueError:
                        continue
            
            # Generate next reference
            next_num = max_num + 1
            payload['reference'] = f"PO-{next_num:04d}"
            print(f"[PROCUREMENT] Auto-generated reference: {payload['reference']}")
        except Exception as e:
            print(f"[PROCUREMENT] Warning: Could not auto-generate reference: {e}")
            # If auto-generation fails, let InvenTree handle it
    else:
        payload['reference'] = order_data.reference
    
    if order_data.description:
        payload['description'] = order_data.description
    if order_data.supplier_reference:
        payload['supplier_reference'] = order_data.supplier_reference
    if order_data.currency:
        payload['order_currency'] = order_data.currency
    if order_data.issue_date:
        payload['issue_date'] = order_data.issue_date
    if order_data.target_date:
        payload['target_date'] = order_data.target_date
    if order_data.destination:
        payload['destination'] = order_data.destination
    if order_data.notes:
        payload['notes'] = order_data.notes
    
    try:
        response = requests.post(
            f"{inventree_url}/api/order/po/",
            headers=headers,
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        error_detail = str(e)
        if hasattr(e.response, 'text'):
            error_detail = f"{error_detail}: {e.response.text}"
        raise HTTPException(status_code=500, detail=f"Failed to create purchase order: {error_detail}")


@router.get("/purchase-orders/{order_id}/items")
async def get_purchase_order_items(
    request: Request,
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get items for a purchase order with complete part details"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        # Get po-line items with part_detail
        response = requests.get(
            f"{inventree_url}/api/order/po-line/",
            headers=headers,
            params={'order': order_id, 'part_detail': 'true'},
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        # InvenTree 1.0.1 returns list directly, not dict with results
        if isinstance(data, list):
            results = data
        else:
            results = data.get('results', [])
        
        # part_detail already contains IPN and name - no need to fetch again!
        # Just ensure the data structure is consistent
        print(f"Successfully got {len(results)} items with part details")
        
        # Return in the same format (list or dict with results)
        if isinstance(data, list):
            return {'results': results}
        return data
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch purchase order items: {str(e)}")


@router.post("/purchase-orders/{order_id}/items")
async def add_purchase_order_item(
    request: Request,
    order_id: int,
    item_data: PurchaseOrderItemRequest,
    current_user: dict = Depends(verify_token)
):
    """Add an item to a purchase order"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    # First, get the purchase order to know the supplier
    try:
        po_response = requests.get(
            f"{inventree_url}/api/order/po/{order_id}/",
            headers=headers,
            timeout=10
        )
        po_response.raise_for_status()
        purchase_order = po_response.json()
        supplier_id = purchase_order.get('supplier')
        print(f"[PROCUREMENT] Order {order_id} supplier: {supplier_id}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get purchase order: {str(e)}")
    
    # Get or create supplier part association
    supplier_part_id = None
    try:
        supplier_parts_response = requests.get(
            f"{inventree_url}/api/company/part/",
            headers=headers,
            params={'part': item_data.part, 'supplier': supplier_id},
            timeout=10
        )
        supplier_parts_response.raise_for_status()
        supplier_parts_data = supplier_parts_response.json()
        
        # Handle both list and dict responses
        if isinstance(supplier_parts_data, list):
            supplier_parts = supplier_parts_data
        else:
            supplier_parts = supplier_parts_data.get('results', [])
        
        # If association exists, use it
        if supplier_parts and len(supplier_parts) > 0:
            supplier_part_id = supplier_parts[0].get('pk') or supplier_parts[0].get('id')
            print(f"[PROCUREMENT] Found existing supplier_part: {supplier_part_id}")
        else:
            # Create supplier part association
            print(f"[PROCUREMENT] Creating supplier_part association for part {item_data.part} and supplier {supplier_id}")
            
            supplier_part_payload = {
                'part': item_data.part,
                'supplier': supplier_id,
                'SKU': f"SUP-{supplier_id}-{item_data.part}"
            }
            
            create_response = requests.post(
                f"{inventree_url}/api/company/part/",
                headers=headers,
                json=supplier_part_payload,
                timeout=10
            )
            create_response.raise_for_status()
            created_supplier_part = create_response.json()
            supplier_part_id = created_supplier_part.get('pk') or created_supplier_part.get('id')
            print(f"[PROCUREMENT] Created supplier_part: {supplier_part_id}")
            
    except Exception as e:
        print(f"[PROCUREMENT] Error with supplier_part: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get/create supplier part association: {str(e)}")
    
    if not supplier_part_id:
        raise HTTPException(status_code=500, detail="Could not determine supplier_part ID")
    
    # Now add the item to purchase order using supplier_part
    payload = {
        'order': order_id,
        'part': supplier_part_id,  # InvenTree 1.0.1 expects supplier_part ID here
        'quantity': item_data.quantity
    }
    
    if item_data.purchase_price is not None:
        payload['purchase_price'] = item_data.purchase_price
    if item_data.reference:
        payload['reference'] = item_data.reference
    if item_data.destination:
        payload['destination'] = item_data.destination
    if item_data.purchase_price_currency:
        payload['purchase_price_currency'] = item_data.purchase_price_currency
    if item_data.notes:
        payload['notes'] = item_data.notes
    
    print(f"[PROCUREMENT] Adding line item with payload: {payload}")
    
    try:
        response = requests.post(
            f"{inventree_url}/api/order/po-line/",
            headers=headers,
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        error_detail = str(e)
        if hasattr(e.response, 'text'):
            error_detail = f"{error_detail}: {e.response.text}"
        print(f"[PROCUREMENT] Error adding line item: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to add item to purchase order: {error_detail}")


@router.put("/purchase-orders/{order_id}/items/{item_id}")
async def update_purchase_order_item(
    request: Request,
    order_id: int,
    item_id: int,
    item_data: PurchaseOrderItemUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an item in a purchase order"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    payload = {}
    
    if item_data.quantity is not None:
        payload['quantity'] = item_data.quantity
    if item_data.purchase_price is not None:
        payload['purchase_price'] = item_data.purchase_price
    if item_data.reference is not None:
        payload['reference'] = item_data.reference
    if item_data.destination is not None:
        payload['destination'] = item_data.destination
    if item_data.purchase_price_currency is not None:
        payload['purchase_price_currency'] = item_data.purchase_price_currency
    if item_data.notes is not None:
        payload['notes'] = item_data.notes
    
    try:
        response = requests.patch(
            f"{inventree_url}/api/order/po-line/{item_id}/",
            headers=headers,
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        error_detail = str(e)
        if hasattr(e.response, 'text'):
            error_detail = f"{error_detail}: {e.response.text}"
        raise HTTPException(status_code=500, detail=f"Failed to update item: {error_detail}")


@router.delete("/purchase-orders/{order_id}/items/{item_id}")
async def delete_purchase_order_item(
    request: Request,
    order_id: int,
    item_id: int,
    current_user: dict = Depends(verify_token)
):
    """Delete an item from a purchase order"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        response = requests.delete(
            f"{inventree_url}/api/order/po-line/{item_id}/",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        return {"success": True}
    except requests.exceptions.RequestException as e:
        error_detail = str(e)
        if hasattr(e.response, 'text'):
            error_detail = f"{error_detail}: {e.response.text}"
        raise HTTPException(status_code=500, detail=f"Failed to delete item: {error_detail}")


@router.get("/parts")
async def get_parts(
    request: Request,
    search: Optional[str] = None,
    current_user: dict = Depends(verify_token)
):
    """Get list of parts from InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    params = {
        'purchaseable': 'true'
    }
    if search:
        params['search'] = search
    
    try:
        response = requests.get(
            f"{inventree_url}/api/part/",
            headers=headers,
            params=params,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch parts: {str(e)}")


@router.get("/purchase-orders/{order_id}/attachments")
async def get_attachments(
    request: Request,
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get attachments for a purchase order using generic attachment API"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        # InvenTree 1.0.1: Use generic attachment endpoint with model_type and model_id
        response = requests.get(
            f"{inventree_url}/api/attachment/",
            headers=headers,
            params={
                'model_type': 'purchaseorder',
                'model_id': order_id
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        print(f"[PROCUREMENT] Got {len(data.get('results', data)) if isinstance(data, dict) else len(data)} attachments for order {order_id}")
        return data
    except requests.exceptions.RequestException as e:
        print(f"[PROCUREMENT] Error fetching attachments: {str(e)}")
        if hasattr(e, 'response') and hasattr(e.response, 'text'):
            print(f"[PROCUREMENT] Response: {e.response.text}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch attachments: {str(e)}")


@router.post("/purchase-orders/{order_id}/attachments")
async def upload_attachment(
    request: Request,
    order_id: int,
    file: UploadFile = File(...),
    comment: Optional[str] = Form(None),
    current_user: dict = Depends(verify_token)
):
    """Upload an attachment to a purchase order using generic attachment API"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    token = current_user.get('token')
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated with InvenTree")
    
    try:
        # Read file content
        file_content = await file.read()
        
        # Prepare multipart form data
        files = {
            'attachment': (file.filename, file_content, file.content_type)
        }
        
        # InvenTree 1.0.1: Use model_type and model_id
        data = {
            'model_type': 'purchaseorder',
            'model_id': order_id
        }
        
        if comment:
            data['comment'] = comment
        
        # Upload to InvenTree generic attachment endpoint
        response = requests.post(
            f"{inventree_url}/api/attachment/",
            headers={'Authorization': f'Token {token}'},
            files=files,
            data=data,
            timeout=30
        )
        response.raise_for_status()
        print(f"[PROCUREMENT] Uploaded attachment for order {order_id}")
        return response.json()
    except requests.exceptions.RequestException as e:
        error_detail = str(e)
        if hasattr(e, 'response') and hasattr(e.response, 'text'):
            error_detail = f"{error_detail}: {e.response.text}"
        print(f"[PROCUREMENT] Error uploading attachment: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to upload attachment: {error_detail}")


@router.delete("/purchase-orders/{order_id}/attachments/{attachment_id}")
async def delete_attachment(
    request: Request,
    order_id: int,
    attachment_id: int,
    current_user: dict = Depends(verify_token)
):
    """Delete an attachment from a purchase order"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        # Use generic attachment endpoint
        response = requests.delete(
            f"{inventree_url}/api/attachment/{attachment_id}/",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        print(f"[PROCUREMENT] Deleted attachment {attachment_id} for order {order_id}")
        return {"success": True}
    except requests.exceptions.RequestException as e:
        error_detail = str(e)
        if hasattr(e.response, 'text'):
            error_detail = f"{error_detail}: {e.response.text}"
        print(f"[PROCUREMENT] Error deleting attachment: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to delete attachment: {error_detail}")


@router.get("/purchase-orders/{order_id}/received-items")
async def get_received_items(
    request: Request,
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get received stock items for a purchase order"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        response = requests.get(
            f"{inventree_url}/api/stock/",
            headers=headers,
            params={'purchase_order': order_id},
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch received items: {str(e)}")


class ReceiveStockRequest(BaseModel):
    line_item: int
    quantity: float
    location: int
    batch_code: Optional[str] = None
    serial_numbers: Optional[str] = None
    packaging: Optional[str] = None
    status: Optional[int] = None
    notes: Optional[str] = None


@router.post("/purchase-orders/{order_id}/receive-stock")
async def receive_stock(
    request: Request,
    order_id: int,
    stock_data: ReceiveStockRequest,
    current_user: dict = Depends(verify_token)
):
    """Receive stock items for a purchase order line"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    payload = {
        'line_item': stock_data.line_item,
        'quantity': stock_data.quantity,
        'location': stock_data.location
    }
    
    if stock_data.batch_code:
        payload['batch_code'] = stock_data.batch_code
    if stock_data.serial_numbers:
        payload['serial_numbers'] = stock_data.serial_numbers
    if stock_data.packaging:
        payload['packaging'] = stock_data.packaging
    if stock_data.status is not None:
        payload['status'] = stock_data.status
    if stock_data.notes:
        payload['notes'] = stock_data.notes
    
    try:
        response = requests.post(
            f"{inventree_url}/api/order/po/{order_id}/receive/",
            headers=headers,
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        error_detail = str(e)
        if hasattr(e, 'response') and hasattr(e.response, 'text'):
            error_detail = f"{error_detail}: {e.response.text}"
        raise HTTPException(status_code=500, detail=f"Failed to receive stock: {error_detail}")


@router.get("/purchase-orders/{order_id}/qc-records")
async def get_qc_records(
    request: Request,
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get QC records for a purchase order (placeholder)"""
    # This is a placeholder - QC records functionality to be implemented
    return {"results": []}


@router.get("/order-statuses")
async def get_order_statuses(
    request: Request,
    current_user: dict = Depends(verify_token)
):
    """Get available purchase order statuses"""
    # InvenTree 1.0.1 purchase order statuses
    statuses = [
        {"value": 10, "label": "Pending"},
        {"value": 20, "label": "Placed"},
        {"value": 30, "label": "Complete"},
        {"value": 40, "label": "Cancelled"},
        {"value": 50, "label": "Lost"},
        {"value": 60, "label": "Returned"}
    ]
    return {"statuses": statuses}


class UpdateOrderStatusRequest(BaseModel):
    status: int


@router.patch("/purchase-orders/{order_id}/status")
async def update_order_status(
    request: Request,
    order_id: int,
    status_data: UpdateOrderStatusRequest,
    current_user: dict = Depends(verify_token)
):
    """Update purchase order status"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    payload = {
        'status': status_data.status
    }
    
    try:
        response = requests.patch(
            f"{inventree_url}/api/order/po/{order_id}/",
            headers=headers,
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        error_detail = str(e)
        if hasattr(e, 'response') and hasattr(e.response, 'text'):
            error_detail = f"{error_detail}: {e.response.text}"
        raise HTTPException(status_code=500, detail=f"Failed to update order status: {error_detail}")


#

