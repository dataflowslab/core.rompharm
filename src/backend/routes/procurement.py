"""
Procurement routes for InvenTree integration
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Form, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import requests
import yaml
import os

from ..utils.db import get_db
from ..utils.config import load_config, get_config_value
from .auth import verify_admin, verify_token

router = APIRouter(prefix="/api/procurement", tags=["procurement"])


async def get_current_user(authorization: Optional[str] = Header(None)):
    """Get current user from token"""
    return await verify_token(authorization)


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
    current_user: dict = Depends(verify_admin)
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
    current_user: dict = Depends(verify_admin)
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
    current_user: dict = Depends(verify_admin)
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
    current_user: dict = Depends(verify_admin)
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
    current_user: dict = Depends(verify_admin)
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
    current_user: dict = Depends(verify_admin)
):
    """Create a new purchase order in InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    payload = {
        'supplier': order_data.supplier,
    }
    
    if order_data.reference:
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


class PurchaseOrderUpdateRequest(BaseModel):
    reference: Optional[str] = None
    description: Optional[str] = None
    supplier_reference: Optional[str] = None
    target_date: Optional[str] = None
    destination: Optional[int] = None
    notes: Optional[str] = None


@router.patch("/purchase-orders/{order_id}")
async def update_purchase_order(
    request: Request,
    order_id: int,
    order_data: PurchaseOrderUpdateRequest,
    current_user: dict = Depends(verify_admin)
):
    """Update a purchase order in InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    payload = {}
    
    if order_data.reference is not None:
        payload['reference'] = order_data.reference
    if order_data.description is not None:
        payload['description'] = order_data.description
    if order_data.supplier_reference is not None:
        payload['supplier_reference'] = order_data.supplier_reference
    if order_data.target_date is not None:
        payload['target_date'] = order_data.target_date
    if order_data.destination is not None:
        payload['destination'] = order_data.destination
    if order_data.notes is not None:
        payload['notes'] = order_data.notes
    
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
        if hasattr(e.response, 'text'):
            error_detail = f"{error_detail}: {e.response.text}"
        raise HTTPException(status_code=500, detail=f"Failed to update purchase order: {error_detail}")


@router.get("/purchase-orders/{order_id}/items")
async def get_purchase_order_items(
    request: Request,
    order_id: int,
    current_user: dict = Depends(verify_admin)
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
    current_user: dict = Depends(verify_admin)
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
    
    # Check if part is associated with supplier and get the SupplierPart ID
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
            print(f"[PROCUREMENT] Found existing SupplierPart: {supplier_part_id}")
        else:
            # No association exists, create one
            print(f"[PROCUREMENT] Part {item_data.part} not associated with supplier {supplier_id}, creating association...")
            
            # Create supplier part association
            supplier_part_payload = {
                'part': item_data.part,
                'supplier': supplier_id,
                'SKU': f"SUP-{supplier_id}-{item_data.part}"  # Generate a SKU
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
            print(f"[PROCUREMENT] Successfully created SupplierPart: {supplier_part_id}")
    except Exception as e:
        print(f"[PROCUREMENT] Error checking/creating supplier part association: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to associate part with supplier: {str(e)}"
        )
    
    # Verify we have a supplier_part_id
    if not supplier_part_id:
        raise HTTPException(
            status_code=500,
            detail="Failed to get or create supplier part association"
        )
    
    # Now add the item to purchase order using the SupplierPart ID
    payload = {
        'order': order_id,
        'part': supplier_part_id,  # Use SupplierPart ID, not internal part ID
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
    
    print(f"[PROCUREMENT] Adding line item with SupplierPart ID: {supplier_part_id}")
    
    try:
        response = requests.post(
            f"{inventree_url}/api/order/po-line/",
            headers=headers,
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        print(f"[PROCUREMENT] Successfully added line item")
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
    current_user: dict = Depends(verify_admin)
):
    """Update an item in a purchase order"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    # First get the current line item to get the part info
    try:
        current_item_response = requests.get(
            f"{inventree_url}/api/order/po-line/{item_id}/",
            headers=headers,
            timeout=10
        )
        current_item_response.raise_for_status()
        current_item = current_item_response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get current item: {str(e)}")
    
    payload = {}
    
    # Always include the part (supplier part) to avoid validation error
    if 'part' in current_item:
        payload['part'] = current_item['part']
    
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
    current_user: dict = Depends(verify_admin)
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
    current_user: dict = Depends(verify_admin)
):
    """
    Get list of parts from InvenTree (autocomplete/search only)
    
    This endpoint requires a search query and returns limited results.
    It's designed for autocomplete functionality, not for loading all parts.
    """
    # Require search parameter - don't load all parts
    if not search or len(search.strip()) < 2:
        return {"results": [], "count": 0}
    
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    # Get limit from config
    limit = get_config_value('api.search_results_limit', 30)
    
    params = {
        'purchaseable': 'true',
        'search': search.strip(),
        'limit': limit
    }
    
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
    current_user: dict = Depends(verify_admin)
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
    except requests.exceptions.HTTPError as e:
        # If it's a 404, return empty results instead of error
        if e.response.status_code == 404:
            return {"results": []}
        raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch attachments: {str(e)}")
    except requests.exceptions.RequestException as e:
        # Return empty results for other errors too
        print(f"Warning: Failed to fetch attachments: {e}")
        return {"results": []}


@router.post("/purchase-orders/{order_id}/attachments")
async def upload_attachment(
    request: Request,
    order_id: int,
    file: UploadFile = File(...),
    comment: Optional[str] = Form(None),
    current_user: dict = Depends(verify_admin)
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
    current_user: dict = Depends(verify_admin)
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


class QCRecordRequest(BaseModel):
    batch_code: str
    part: str
    prelevation_date: str
    prelevated_quantity: float
    ba_rompharm_no: str
    ba_rompharm_date: str
    test_result: str
    transactionable: bool
    comment: Optional[str] = None
    confirmed: bool = False


@router.get("/purchase-orders/{order_id}/qc-records")
async def get_qc_records(
    request: Request,
    order_id: int,
    current_user: dict = Depends(verify_admin)
):
    """Get QC records for a purchase order from MongoDB (depo_procurement_qc collection)"""
    db = get_db()
    qc_collection = db['depo_procurement_qc']
    
    records = list(qc_collection.find({
        'order_id': str(order_id)
    }))
    
    # Convert ObjectId to string
    for record in records:
        record['_id'] = str(record['_id'])
        if 'created_at' in record and isinstance(record['created_at'], datetime):
            record['created_at'] = record['created_at'].isoformat()
        if 'updated_at' in record and isinstance(record['updated_at'], datetime):
            record['updated_at'] = record['updated_at'].isoformat()
    
    return {"results": records}


@router.post("/purchase-orders/{order_id}/qc-records")
async def create_qc_record(
    request: Request,
    order_id: int,
    qc_data: QCRecordRequest,
    current_user: dict = Depends(verify_admin)
):
    """
    Create a QC record for a purchase order in MongoDB (depo_procurement_qc collection)
    Also transfers stock to QC location (ID 27) and creates stock adjustment
    """
    db = get_db()
    qc_collection = db['depo_procurement_qc']
    
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    # Get part name from InvenTree
    part_name = f"Part {qc_data.part}"
    try:
        part_response = requests.get(
            f"{inventree_url}/api/part/{qc_data.part}/",
            headers=headers,
            timeout=10
        )
        if part_response.status_code == 200:
            part_data = part_response.json()
            part_name = part_data.get('name', part_name)
    except Exception as e:
        print(f"Warning: Failed to get part name: {e}")
    
    # Find stock item with this batch code
    stock_item_id = None
    try:
        stock_response = requests.get(
            f"{inventree_url}/api/stock/",
            headers=headers,
            params={
                'part': qc_data.part,
                'batch': qc_data.batch_code,
                'purchase_order': order_id
            },
            timeout=10
        )
        if stock_response.status_code == 200:
            stock_data = stock_response.json()
            stock_items = stock_data if isinstance(stock_data, list) else stock_data.get('results', [])
            if stock_items:
                stock_item_id = stock_items[0].get('pk') or stock_items[0].get('id')
                print(f"[QC] Found stock item: {stock_item_id}")
    except Exception as e:
        print(f"Warning: Failed to find stock item: {e}")
    
    # Transfer stock to QC location (ID 27)
    qc_stock_item_id = None
    if stock_item_id and qc_data.prelevated_quantity > 0:
        try:
            # Transfer stock to QC location
            transfer_payload = {
                'items': [{
                    'item': stock_item_id,
                    'quantity': qc_data.prelevated_quantity,
                    'location': 27  # QC location
                }],
                'notes': f'Transfer pentru testare QC - BA Rompharm {qc_data.ba_rompharm_no}'
            }
            
            transfer_response = requests.post(
                f"{inventree_url}/api/stock/transfer/",
                headers=headers,
                json=transfer_payload,
                timeout=10
            )
            
            if transfer_response.status_code in [200, 201]:
                print(f"[QC] Stock transferred to QC location")
                
                # Find the new stock item in QC location
                qc_stock_response = requests.get(
                    f"{inventree_url}/api/stock/",
                    headers=headers,
                    params={
                        'part': qc_data.part,
                        'batch': qc_data.batch_code,
                        'location': 27
                    },
                    timeout=10
                )
                
                if qc_stock_response.status_code == 200:
                    qc_stock_data = qc_stock_response.json()
                    qc_stock_items = qc_stock_data if isinstance(qc_stock_data, list) else qc_stock_data.get('results', [])
                    if qc_stock_items:
                        qc_stock_item_id = qc_stock_items[0].get('pk') or qc_stock_items[0].get('id')
                        print(f"[QC] QC stock item: {qc_stock_item_id}")
            else:
                print(f"[QC] Warning: Failed to transfer stock: {transfer_response.text}")
        except Exception as e:
            print(f"Warning: Failed to transfer stock to QC: {e}")
    
    # Create QC record
    record = {
        'order_id': str(order_id),
        'batch_code': qc_data.batch_code,
        'part': qc_data.part,
        'part_name': part_name,
        'prelevation_date': qc_data.prelevation_date,
        'prelevated_quantity': qc_data.prelevated_quantity,
        'ba_rompharm_no': qc_data.ba_rompharm_no,
        'ba_rompharm_date': qc_data.ba_rompharm_date,
        'test_result': qc_data.test_result,
        'transactionable': qc_data.transactionable,
        'comment': qc_data.comment or '',
        'confirmed': qc_data.confirmed,
        'stock_item_id': stock_item_id,
        'qc_stock_item_id': qc_stock_item_id,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }
    
    result = qc_collection.insert_one(record)
    record['_id'] = str(result.inserted_id)
    record['created_at'] = record['created_at'].isoformat()
    record['updated_at'] = record['updated_at'].isoformat()
    
    return record


class QCRecordUpdateRequest(BaseModel):
    test_result: Optional[str] = None
    transactionable: Optional[bool] = None
    comment: Optional[str] = None
    confirmed: Optional[bool] = None


@router.patch("/purchase-orders/{order_id}/qc-records/{record_id}")
async def update_qc_record(
    request: Request,
    order_id: int,
    record_id: str,
    qc_data: QCRecordUpdateRequest,
    current_user: dict = Depends(verify_admin)
):
    """
    Update a QC record (approve/reject)
    When confirmed, creates stock adjustment to remove tested quantity
    """
    from bson import ObjectId
    
    db = get_db()
    qc_collection = db['depo_procurement_qc']
    
    try:
        record_obj_id = ObjectId(record_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid record ID")
    
    # Get existing record
    record = qc_collection.find_one({'_id': record_obj_id})
    if not record:
        raise HTTPException(status_code=404, detail="QC record not found")
    
    # Prepare update
    update_data = {
        'updated_at': datetime.utcnow(),
        'updated_by': current_user.get('username')
    }
    
    if qc_data.test_result is not None:
        update_data['test_result'] = qc_data.test_result
    if qc_data.transactionable is not None:
        update_data['transactionable'] = qc_data.transactionable
    if qc_data.comment is not None:
        update_data['comment'] = qc_data.comment
    if qc_data.confirmed is not None:
        update_data['confirmed'] = qc_data.confirmed
    
    # If confirming, create stock adjustment to remove tested quantity
    if qc_data.confirmed and not record.get('confirmed'):
        qc_stock_item_id = record.get('qc_stock_item_id')
        prelevated_quantity = record.get('prelevated_quantity', 0)
        
        if qc_stock_item_id and prelevated_quantity > 0:
            config = load_config()
            inventree_url = config['inventree']['url'].rstrip('/')
            headers = get_inventree_headers(current_user)
            
            try:
                # Remove stock (stock adjustment)
                adjustment_payload = {
                    'items': [{
                        'item': qc_stock_item_id,
                        'quantity': prelevated_quantity
                    }],
                    'notes': f'Testare calitate - BA Rompharm {record.get("ba_rompharm_no")} - Rezultat: {qc_data.test_result or record.get("test_result")}'
                }
                
                adjustment_response = requests.post(
                    f"{inventree_url}/api/stock/remove/",
                    headers=headers,
                    json=adjustment_payload,
                    timeout=10
                )
                
                if adjustment_response.status_code in [200, 201]:
                    print(f"[QC] Stock adjusted (removed {prelevated_quantity} units)")
                    update_data['stock_adjusted'] = True
                    update_data['stock_adjusted_at'] = datetime.utcnow()
                else:
                    print(f"[QC] Warning: Failed to adjust stock: {adjustment_response.text}")
                    update_data['stock_adjusted'] = False
                    update_data['stock_adjustment_error'] = adjustment_response.text
            except Exception as e:
                print(f"Warning: Failed to adjust stock: {e}")
                update_data['stock_adjusted'] = False
                update_data['stock_adjustment_error'] = str(e)
    
    # Update record
    qc_collection.update_one(
        {'_id': record_obj_id},
        {'$set': update_data}
    )
    
    # Get updated record
    updated_record = qc_collection.find_one({'_id': record_obj_id})
    updated_record['_id'] = str(updated_record['_id'])
    if 'created_at' in updated_record and isinstance(updated_record['created_at'], datetime):
        updated_record['created_at'] = updated_record['created_at'].isoformat()
    if 'updated_at' in updated_record and isinstance(updated_record['updated_at'], datetime):
        updated_record['updated_at'] = updated_record['updated_at'].isoformat()
    if 'stock_adjusted_at' in updated_record and isinstance(updated_record['stock_adjusted_at'], datetime):
        updated_record['stock_adjusted_at'] = updated_record['stock_adjusted_at'].isoformat()
    
    return updated_record


@router.get("/purchase-orders/{order_id}/received-items")
async def get_received_items(
    request: Request,
    order_id: int,
    current_user: dict = Depends(verify_admin)
):
    """Get received stock items for a purchase order with part details"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        response = requests.get(
            f"{inventree_url}/api/stock/",
            headers=headers,
            params={'purchase_order': order_id, 'part_detail': 'true', 'location_detail': 'true'},
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
        print(f"Successfully got {len(results)} received items with part details")
        
        # Return in the same format (list or dict with results)
        if isinstance(data, list):
            return {'results': results}
        return data
        
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
    current_user: dict = Depends(verify_admin)
):
    """Receive stock items for a purchase order line"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    # InvenTree expects "items" array with line item details
    item_payload = {
        'line_item': stock_data.line_item,
        'quantity': stock_data.quantity,
        'location': stock_data.location
    }
    
    if stock_data.batch_code:
        item_payload['batch_code'] = stock_data.batch_code
    if stock_data.serial_numbers:
        item_payload['serial_numbers'] = stock_data.serial_numbers
    if stock_data.packaging:
        item_payload['packaging'] = stock_data.packaging
    if stock_data.status is not None:
        item_payload['status'] = stock_data.status
    if stock_data.notes:
        item_payload['notes'] = stock_data.notes
    
    payload = {
        'items': [item_payload]
    }
    
    try:
        response = requests.post(
            f"{inventree_url}/api/order/po/{order_id}/receive/",
            headers=headers,
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        result = response.json()
        
        # Try to get the stock item ID from the response
        stock_item_id = None
        
        # InvenTree 1.0.1 may return different structures
        if isinstance(result, dict):
            # Check for direct stock_item field
            if 'stock_item' in result:
                stock_item_id = result['stock_item']
            # Check for items array
            elif 'items' in result and len(result['items']) > 0:
                stock_item_id = result['items'][0].get('pk') or result['items'][0].get('id')
        
        # If we couldn't get it from response, query for it
        if not stock_item_id and stock_data.batch_code:
            try:
                # Get the line item to know the part
                line_response = requests.get(
                    f"{inventree_url}/api/order/po-line/{stock_data.line_item}/",
                    headers=headers,
                    timeout=10
                )
                if line_response.status_code == 200:
                    line_data = line_response.json()
                    part_id = line_data.get('part_detail', {}).get('pk') or line_data.get('part_detail', {}).get('id')
                    
                    if part_id:
                        # Find the stock item
                        stock_response = requests.get(
                            f"{inventree_url}/api/stock/",
                            headers=headers,
                            params={
                                'part': part_id,
                                'batch': stock_data.batch_code,
                                'purchase_order': order_id,
                                'location': stock_data.location
                            },
                            timeout=10
                        )
                        if stock_response.status_code == 200:
                            stock_data_list = stock_response.json()
                            stock_items = stock_data_list if isinstance(stock_data_list, list) else stock_data_list.get('results', [])
                            if stock_items:
                                stock_item_id = stock_items[0].get('pk') or stock_items[0].get('id')
            except Exception as e:
                print(f"[PROCUREMENT] Warning: Failed to find stock item ID: {e}")
        
        # Add stock_item_id to result
        if stock_item_id:
            result['stock_item_id'] = stock_item_id
        
        return result
    except requests.exceptions.RequestException as e:
        error_detail = str(e)
        if hasattr(e, 'response') and hasattr(e.response, 'text'):
            error_detail = f"{error_detail}: {e.response.text}"
        raise HTTPException(status_code=500, detail=f"Failed to receive stock: {error_detail}")


@router.get("/order-statuses")
async def get_order_statuses(
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Get available purchase order statuses from InvenTree (including custom states)"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        # Try to get status codes from OPTIONS first
        response = requests.options(
            f"{inventree_url}/api/order/po/",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        statuses = []
        
        # Extract status choices from OPTIONS response
        if 'actions' in data and 'POST' in data['actions'] and 'status' in data['actions']['POST']:
            status_field = data['actions']['POST']['status']
            if 'choices' in status_field:
                statuses = [
                    {"value": choice['value'], "label": choice['display_name']}
                    for choice in status_field['choices']
                ]
        
        # If we got statuses, return them
        if statuses:
            return {"statuses": statuses}
        
        # Fallback to default statuses
        statuses = [
            {"value": 10, "label": "Pending"},
            {"value": 20, "label": "Placed"},
            {"value": 30, "label": "Complete"},
            {"value": 40, "label": "Cancelled"},
            {"value": 50, "label": "Lost"},
            {"value": 60, "label": "Returned"}
        ]
        return {"statuses": statuses}
    except Exception as e:
        print(f"Warning: Failed to fetch order statuses from InvenTree: {e}")
        # Return default statuses on error
        statuses = [
            {"value": 10, "label": "Pending"},
            {"value": 20, "label": "Placed"},
            {"value": 30, "label": "Complete"},
            {"value": 40, "label": "Cancelled"},
            {"value": 50, "label": "Lost"},
            {"value": 60, "label": "Returned"}
        ]
        return {"statuses": statuses}


@router.get("/stock-statuses")
async def get_stock_statuses(
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Get available stock statuses from InvenTree (including custom states)"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        # Try to get custom states from the custom states API
        response = requests.get(
            f"{inventree_url}/api/generic/status/",
            headers=headers,
            params={'model': 'stockitem'},
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        statuses = []
        
        # Process the response - it should contain all statuses including custom ones
        if isinstance(data, list):
            for status in data:
                statuses.append({
                    "value": status.get('key') or status.get('value'),
                    "label": status.get('label') or status.get('name')
                })
        elif isinstance(data, dict) and 'results' in data:
            for status in data['results']:
                statuses.append({
                    "value": status.get('key') or status.get('value'),
                    "label": status.get('label') or status.get('name')
                })
        
        # If we got statuses, return them
        if statuses:
            return {"statuses": statuses}
        
        # Fallback: try OPTIONS on stock endpoint
        try:
            options_response = requests.options(
                f"{inventree_url}/api/stock/",
                headers=headers,
                timeout=10
            )
            options_response.raise_for_status()
            options_data = options_response.json()
            
            if 'actions' in options_data and 'POST' in options_data['actions'] and 'status' in options_data['actions']['POST']:
                status_field = options_data['actions']['POST']['status']
                if 'choices' in status_field:
                    statuses = [
                        {"value": choice['value'], "label": choice['display_name']}
                        for choice in status_field['choices']
                    ]
                    return {"statuses": statuses}
        except Exception as e:
            print(f"Warning: Failed to get stock statuses from OPTIONS: {e}")
        
        # Final fallback to default stock statuses
        statuses = [
            {"value": 10, "label": "OK"},
            {"value": 50, "label": "Attention needed"},
            {"value": 55, "label": "Damaged"},
            {"value": 60, "label": "Destroyed"},
            {"value": 65, "label": "Rejected"},
            {"value": 70, "label": "Lost"},
            {"value": 75, "label": "Returned"},
            {"value": 80, "label": "În carantină (tranzacționabil)"}  # Custom state
        ]
        return {"statuses": statuses}
    except Exception as e:
        print(f"Warning: Failed to fetch stock statuses from InvenTree: {e}")
        # Return default statuses including known custom one
        statuses = [
            {"value": 10, "label": "OK"},
            {"value": 50, "label": "Attention needed"},
            {"value": 55, "label": "Damaged"},
            {"value": 60, "label": "Destroyed"},
            {"value": 65, "label": "Rejected"},
            {"value": 70, "label": "Lost"},
            {"value": 75, "label": "Returned"},
            {"value": 80, "label": "În carantină (tranzacționabil)"}  # Custom state
        ]
        return {"statuses": statuses}


class UpdateOrderStatusRequest(BaseModel):
    status: int


@router.patch("/purchase-orders/{order_id}/status")
async def update_order_status(
    request: Request,
    order_id: int,
    status_data: UpdateOrderStatusRequest,
    current_user: dict = Depends(verify_admin)
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


# ==================== APPROVAL INTEGRATION ====================

@router.get("/purchase-orders/{order_id}/approval-flow")
async def get_order_approval_flow(
    order_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get approval flow for a purchase order"""
    from bson import ObjectId
    
    db = get_db()
    
    # Find approval flow for this order
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": str(order_id)
    })
    
    if not flow:
        return {"flow": None}
    
    flow["_id"] = str(flow["_id"])
    
    # Get user details for signatures
    for signature in flow.get("signatures", []):
        user = db.users.find_one({"_id": ObjectId(signature["user_id"])})
        if user:
            signature["user_name"] = user.get("name") or user.get("username")
    
    return {"flow": flow}


@router.post("/purchase-orders/{order_id}/approval-flow")
async def create_order_approval_flow(
    order_id: int,
    current_user: dict = Depends(verify_admin)
):
    """Create approval flow for a purchase order using config from MongoDB"""
    from bson import ObjectId
    
    db = get_db()
    
    # Check if flow already exists
    existing = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": str(order_id)
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Approval flow already exists for this order")
    
    # Get procurement approval config from MongoDB
    config_collection = db['config']
    approval_config = config_collection.find_one({'slug': 'procurement_approval_flows'})
    
    if not approval_config or 'items' not in approval_config:
        raise HTTPException(status_code=404, detail="No procurement approval configuration found")
    
    # Get the first enabled flow (or default to first one)
    flow_config = None
    for item in approval_config.get('items', []):
        if item.get('enabled', True):
            flow_config = item
            break
    
    if not flow_config:
        raise HTTPException(status_code=404, detail="No enabled approval flow found")
    
    # Build can_sign list (optional officers - at least one must sign)
    can_sign_officers = []
    for user in flow_config.get('can_sign', []):
        can_sign_officers.append({
            "type": "person",
            "reference": user.get('user_id'),
            "username": user.get('username'),
            "action": "can_sign"
        })
    
    # Build must_sign list (required officers - all must sign)
    must_sign_officers = []
    for user in flow_config.get('must_sign', []):
        must_sign_officers.append({
            "type": "person",
            "reference": user.get('user_id'),
            "username": user.get('username'),
            "action": "must_sign"
        })
    
    flow_data = {
        "object_type": "procurement_order",
        "object_source": "depo_procurement",
        "object_id": str(order_id),
        "config_slug": flow_config.get('slug'),
        "min_signatures": flow_config.get('min_signatures', 1),
        "can_sign_officers": can_sign_officers,
        "must_sign_officers": must_sign_officers,
        "signatures": [],
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = db.approval_flows.insert_one(flow_data)
    
    flow_data["_id"] = str(result.inserted_id)
    
    return flow_data


@router.post("/purchase-orders/{order_id}/sign")
async def sign_purchase_order(
    order_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Sign a purchase order approval flow"""
    from bson import ObjectId
    from ..models.approval_flow_model import ApprovalFlowModel
    
    db = get_db()
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    
    # Get approval flow
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": str(order_id)
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this order")
    
    # Check if already signed
    user_id = str(current_user["_id"])
    existing_signature = next(
        (s for s in flow.get("signatures", []) if s["user_id"] == user_id),
        None
    )
    
    if existing_signature:
        raise HTTPException(status_code=400, detail="You have already signed this order")
    
    # Check if user is authorized to sign
    username = current_user["username"]
    can_sign = False
    
    # Admin/staff can always sign
    is_admin = current_user.get("is_staff", False) or current_user.get("staff", False)
    
    if is_admin:
        can_sign = True
    else:
        # Check required officers
        for officer in flow.get("required_officers", []):
            if officer["type"] == "person" and officer["reference"] == user_id:
                can_sign = True
                break
            elif officer["type"] == "role":
                # Check if user has this role
                user_role = current_user.get("role") or current_user.get("local_role")
                if user_role:
                    role = db.roles.find_one({"_id": ObjectId(user_role)})
                    if role and role.get("name") == officer["reference"]:
                        can_sign = True
                        break
                # Also check if role name matches directly (for "admin" role)
                if officer["reference"] == "admin" and is_admin:
                    can_sign = True
                    break
        
        # Check optional officers
        if not can_sign:
            for officer in flow.get("optional_officers", []):
                if officer["type"] == "person" and officer["reference"] == user_id:
                    can_sign = True
                    break
                elif officer["type"] == "role":
                    user_role = current_user.get("role") or current_user.get("local_role")
                    if user_role:
                        role = db.roles.find_one({"_id": ObjectId(user_role)})
                        if role and role.get("name") == officer["reference"]:
                            can_sign = True
                            break
                    # Also check if role name matches directly (for "admin" role)
                    if officer["reference"] == "admin" and is_admin:
                        can_sign = True
                        break
    
    if not can_sign:
        raise HTTPException(status_code=403, detail="You are not authorized to sign this order")
    
    # Generate signature
    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="procurement_order",
        object_id=str(order_id),
        timestamp=timestamp
    )
    
    signature = {
        "user_id": user_id,
        "username": username,
        "signed_at": timestamp,
        "signature_hash": signature_hash,
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent")
    }
    
    # Add signature to flow
    db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$push": {"signatures": signature},
            "$set": {
                "status": "in_progress",
                "updated_at": timestamp
            }
        }
    )
    
    # Check if all required signatures are collected
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    required_count = len(updated_flow.get("required_officers", []))
    
    # Count how many required officers have signed
    required_signed = 0
    for officer in updated_flow.get("required_officers", []):
        if officer["type"] == "person":
            if any(s["user_id"] == officer["reference"] for s in updated_flow.get("signatures", [])):
                required_signed += 1
        elif officer["type"] == "role":
            # Check if any user with this role has signed
            role = db.roles.find_one({"name": officer["reference"]})
            if role:
                for sig in updated_flow.get("signatures", []):
                    signer = db.users.find_one({"_id": ObjectId(sig["user_id"])})
                    if signer:
                        signer_role = signer.get("role") or signer.get("local_role")
                        if signer_role and str(signer_role) == str(role["_id"]):
                            required_signed += 1
                            break
    
    # If all required officers have signed, mark as approved
    if required_signed == required_count:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {
                "$set": {
                    "status": "approved",
                    "completed_at": timestamp,
                    "updated_at": timestamp
                }
            }
        )
    
    # Update order status to "Placed" (20) when someone signs
    try:
        headers = get_inventree_headers(current_user)
        response = requests.patch(
            f"{inventree_url}/api/order/po/{order_id}/",
            headers=headers,
            json={"status": 20},
            timeout=10
        )
        response.raise_for_status()
    except Exception as e:
        print(f"Warning: Failed to update order status: {e}")
    
    # Get updated flow
    flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    flow["_id"] = str(flow["_id"])
    
    return flow


@router.delete("/purchase-orders/{order_id}/signatures/{user_id}")
async def remove_order_signature(
    order_id: int,
    user_id: str,
    current_user: dict = Depends(verify_admin)
):
    """Remove signature from purchase order approval flow (admin only)"""
    from bson import ObjectId
    
    db = get_db()
    
    # Get flow
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": str(order_id)
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found for this order")
    
    # Remove signature
    result = db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$pull": {"signatures": {"user_id": user_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    # Update status back to pending if no signatures left
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    if len(updated_flow.get("signatures", [])) == 0:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {"$set": {"status": "pending"}}
        )
    
    return {"message": "Signature removed successfully"}


@router.post("/stock-extra-data")
async def save_stock_extra_data(
    request: Request,
    data: dict,
    current_user: dict = Depends(verify_admin)
):
    """
    Save extra data for received stock item
    - Saves to MongoDB (containers, transport info)
    - Updates InvenTree via DataFlowsDepoStocks plugin (dates, supplier info)
    """
    db = get_db()
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    stock_item_id = data.get('stock_item_id')
    order_id = data.get('order_id')
    
    if not stock_item_id:
        raise HTTPException(status_code=400, detail="stock_item_id is required")
    
    # Prepare data for MongoDB (containers and metadata)
    mongo_data = {
        'stock_item_id': stock_item_id,
        'order_id': order_id,
        'expected_quantity': data.get('expected_quantity'),
        'clean_transport': data.get('clean_transport', False),
        'temperature_control': data.get('temperature_control', False),
        'temperature_conditions_met': data.get('temperature_conditions_met'),
        'created_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }
    
    # Save containers to MongoDB
    containers = data.get('containers')
    if containers:
        containers_collection = db['depo_procurement_containers']
        for container in containers:
            container_doc = {
                'stock_item_id': stock_item_id,
                'order_id': order_id,
                'num_containers': container.get('num_containers', 1),
                'products_per_container': container.get('products_per_container', 1),
                'unit': container.get('unit', 'pcs'),
                'value': container.get('value', 0),
                'is_damaged': container.get('is_damaged', False),
                'is_unsealed': container.get('is_unsealed', False),
                'is_mislabeled': container.get('is_mislabeled', False),
                'created_at': datetime.utcnow(),
                'created_by': current_user.get('username')
            }
            containers_collection.insert_one(container_doc)
    
    # Save metadata to MongoDB
    stock_metadata_collection = db['depo_procurement_stock_metadata']
    stock_metadata_collection.insert_one(mongo_data)
    
    # Prepare data for InvenTree plugin (DataFlowsDepoStocks)
    plugin_fields = {}
    
    if data.get('supplier_batch_code'):
        plugin_fields['supplier_batch_code'] = data['supplier_batch_code']
    
    if data.get('manufacturing_date'):
        plugin_fields['manufacturing_date'] = data['manufacturing_date']
    
    if data.get('expiry_date'):
        plugin_fields['expiry_date'] = data['expiry_date']
    
    if data.get('reset_date'):
        plugin_fields['reset_date'] = data['reset_date']
    
    if data.get('containers_cleaned') is not None:
        plugin_fields['containers_cleaned'] = str(data['containers_cleaned']).lower()
    
    if data.get('supplier_ba_no'):
        plugin_fields['supplier_ba_no'] = data['supplier_ba_no']
    
    if data.get('supplier_ba_date'):
        plugin_fields['supplier_ba_date'] = data['supplier_ba_date']
    
    if data.get('accord_ba') is not None:
        plugin_fields['accord_ba'] = str(data['accord_ba']).lower()
    
    if data.get('is_list_supplier') is not None:
        plugin_fields['is_list_supplier'] = str(data['is_list_supplier']).lower()
    
    # Update stock item via plugin if we have fields to update
    if plugin_fields:
        try:
            plugin_response = requests.post(
                f"{inventree_url}/plugin/dataflows-depo-stocks/api/extra/stock/{stock_item_id}/update/",
                headers=headers,
                json={'fields': plugin_fields},
                timeout=10
            )
            plugin_response.raise_for_status()
            print(f"[PROCUREMENT] Updated stock {stock_item_id} via plugin with fields: {list(plugin_fields.keys())}")
        except Exception as e:
            print(f"[PROCUREMENT] Warning: Failed to update stock via plugin: {e}")
            # Don't fail the whole operation if plugin update fails
    
    return {
        "success": True,
        "stock_item_id": stock_item_id,
        "containers_saved": len(containers) if containers else 0,
        "plugin_fields_updated": len(plugin_fields)
    }
