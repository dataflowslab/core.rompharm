"""
Sales routes for InvenTree integration
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, Dict
import requests

from ..utils.config import load_config
from .auth import verify_token

router = APIRouter(prefix="/api/sales", tags=["sales"])


def get_inventree_headers(user: dict) -> Dict[str, str]:
    """Get headers for InvenTree API requests"""
    token = user.get('token')
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated with InvenTree")
    
    return {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }


@router.get("/customers")
async def get_customers(
    request: Request,
    search: Optional[str] = None,
    current_user: dict = Depends(verify_token)
):
    """Get list of customers from InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    params = {
        'is_customer': 'true'
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
        raise HTTPException(status_code=500, detail=f"Failed to fetch customers: {str(e)}")


@router.get("/sales-orders")
async def get_sales_orders(
    request: Request,
    current_user: dict = Depends(verify_token)
):
    """Get list of sales orders from InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        response = requests.get(
            f"{inventree_url}/api/order/so/",
            headers=headers,
            params={'customer_detail': 'true'},
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sales orders: {str(e)}")


@router.get("/sales-orders/{order_id}")
async def get_sales_order(
    request: Request,
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get a specific sales order from InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        response = requests.get(
            f"{inventree_url}/api/order/so/{order_id}/",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sales order: {str(e)}")


@router.get("/sales-orders/{order_id}/items")
async def get_sales_order_items(
    request: Request,
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get items for a sales order with complete part details"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        # Get so-line items with part_detail
        response = requests.get(
            f"{inventree_url}/api/order/so-line/",
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
        
        # part_detail already contains IPN and name
        print(f"Successfully got {len(results)} sales order items with part details")
        
        # Return in the same format (list or dict with results)
        if isinstance(data, list):
            return {'results': results}
        return data
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sales order items: {str(e)}")


@router.get("/sales-orders/{order_id}/shipments")
async def get_shipments(
    request: Request,
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get shipments for a sales order"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        response = requests.get(
            f"{inventree_url}/api/order/so/shipment/",
            headers=headers,
            params={'order': order_id},
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        # Handle list or dict response
        if isinstance(data, list):
            return {'results': data}
        return data
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch shipments: {str(e)}")


@router.get("/sales-orders/{order_id}/attachments")
async def get_attachments(
    request: Request,
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get attachments for a sales order"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        response = requests.get(
            f"{inventree_url}/api/order/so/attachment/",
            headers=headers,
            params={'order': order_id},
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        # InvenTree might return results in different formats
        if isinstance(data, dict) and 'results' in data:
            return data
        elif isinstance(data, list):
            return {"results": data}
        else:
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


@router.get("/order-statuses")
async def get_order_statuses(
    request: Request,
    current_user: dict = Depends(verify_token)
):
    """Get available sales order statuses from InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        # Try to get status codes from OPTIONS first
        response = requests.options(
            f"{inventree_url}/api/order/so/",
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
            {"value": 20, "label": "In Progress"},
            {"value": 30, "label": "Shipped"},
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
            {"value": 20, "label": "In Progress"},
            {"value": 30, "label": "Shipped"},
            {"value": 40, "label": "Cancelled"},
            {"value": 50, "label": "Lost"},
            {"value": 60, "label": "Returned"}
        ]
        return {"statuses": statuses}


class UpdateOrderStatusRequest(BaseModel):
    status: int


@router.patch("/sales-orders/{order_id}/status")
async def update_order_status(
    request: Request,
    order_id: int,
    status_data: UpdateOrderStatusRequest,
    current_user: dict = Depends(verify_token)
):
    """Update sales order status"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    payload = {
        'status': status_data.status
    }
    
    try:
        response = requests.patch(
            f"{inventree_url}/api/order/so/{order_id}/",
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
