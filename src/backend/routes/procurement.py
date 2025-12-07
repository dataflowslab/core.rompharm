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
    """Create a QC record for a purchase order in MongoDB (depo_procurement_qc collection)"""
    db = get_db()
    qc_collection = db['depo_procurement_qc']
    
    # Get part name from InvenTree
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
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
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': current_user.get('username')
    }
    
    result = qc_collection.insert_one(record)
    record['_id'] = str(result.inserted_id)
    record['created_at'] = record['created_at'].isoformat()
    record['updated_at'] = record['updated_at'].isoformat()
    
    return record


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
        return response.json()
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
    """Create approval flow for a purchase order"""
    from bson import ObjectId
    
    db = get_db()
    
    # Check if flow already exists
    existing = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": str(order_id)
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Approval flow already exists for this order")
    
    # Find active template for procurement orders
    template = db.approval_templates.find_one({
        "object_type": "procurement_order",
        "active": True
    })
    
    if not template:
        raise HTTPException(status_code=404, detail="No active approval template found for procurement orders")
    
    # Separate required and optional officers
    required_officers = []
    optional_officers = []
    
    for officer in template.get("officers", []):
        if officer.get("action") == "must_sign":
            required_officers.append(officer)
        else:
            optional_officers.append(officer)
    
    flow_data = {
        "object_type": "procurement_order",
        "object_source": "depo_procurement",
        "object_id": str(order_id),
        "template_id": str(template["_id"]),
        "required_officers": required_officers,
        "optional_officers": optional_officers,
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


#
