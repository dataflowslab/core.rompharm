"""
Pydantic models for requests module
"""
from pydantic import BaseModel
from typing import Optional, List


class RequestItemCreate(BaseModel):
    part: int
    quantity: float
    init_q: Optional[float] = None  # Initial requested quantity
    notes: Optional[str] = None
    series: Optional[str] = None
    batch_code: Optional[str] = None
    added_in_operations: Optional[bool] = False  # Flag for items added in Operations tab


class RequestCreate(BaseModel):
    source: str  # Stock location ObjectId from depo_locations
    destination: str  # Stock location ObjectId from depo_locations
    items: List[RequestItemCreate]
    notes: Optional[str] = None
    product_id: Optional[int] = None  # Main product ID if recipe-based
    product_quantity: Optional[float] = None  # Quantity of main product
    recipe_id: Optional[str] = None  # Recipe ObjectId if recipe-based
    recipe_part_id: Optional[str] = None  # Recipe part ObjectId if recipe-based


class RequestUpdate(BaseModel):
    source: Optional[str] = None
    destination: Optional[str] = None
    notes: Optional[str] = None
    batch_codes: Optional[List[str]] = None
    status: Optional[str] = None
    issue_date: Optional[str] = None
    items: Optional[List[RequestItemCreate]] = None
