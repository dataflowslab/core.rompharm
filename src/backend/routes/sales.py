"""
Sales API (stub)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from src.backend.routes.auth import verify_token

router = APIRouter(prefix="/api/sales", tags=["sales"])


@router.get("/sales-orders")
async def get_sales_orders(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    skip: Optional[int] = Query(None, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=200),
    current_user: dict = Depends(verify_token)
):
    """
    Stub endpoint for sales orders list.
    """
    return {
        "results": [],
        "total": 0,
        "skip": skip or 0,
        "limit": limit or 0
    }


@router.get("/sales-orders/{order_id}")
async def get_sales_order(
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """
    Stub endpoint for sales order detail.
    """
    raise HTTPException(status_code=404, detail="Sales order not found (stub)")


@router.get("/sales-orders/{order_id}/items")
async def get_sales_order_items(
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """
    Stub endpoint for sales order items.
    """
    return {"results": []}


@router.get("/sales-orders/{order_id}/shipments")
async def get_sales_order_shipments(
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """
    Stub endpoint for sales order shipments.
    """
    return {"results": []}


@router.get("/sales-orders/{order_id}/attachments")
async def get_sales_order_attachments(
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """
    Stub endpoint for sales order attachments.
    """
    return {"results": []}


@router.get("/order-statuses")
async def get_sales_order_statuses(
    current_user: dict = Depends(verify_token)
):
    """
    Stub endpoint for sales order statuses.
    """
    return {"statuses": []}


@router.patch("/sales-orders/{order_id}/status")
async def update_sales_order_status(
    order_id: int,
    current_user: dict = Depends(verify_token)
):
    """
    Stub endpoint for updating sales order status.
    """
    raise HTTPException(status_code=501, detail="Sales status update not implemented")


@router.get("/customers")
async def get_sales_customers(
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """
    Stub endpoint for customers list.
    """
    return {"results": []}
