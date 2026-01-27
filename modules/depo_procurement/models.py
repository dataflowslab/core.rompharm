"""
Pydantic models for DEPO Procurement Module
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any


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
    supplier_id: str
    reference: Optional[str] = None
    description: Optional[str] = None
    supplier_reference: Optional[str] = None
    currency: Optional[str] = "EUR"
    issue_date: Optional[str] = None
    target_date: Optional[str] = None
    destination_id: Optional[str] = None
    notes: Optional[str] = None


class PurchaseOrderItemRequest(BaseModel):
    part_id: str
    quantity: float
    purchase_price: Optional[float] = None
    reference: Optional[str] = None
    purchase_price_currency: Optional[str] = None
    notes: Optional[str] = None


class PurchaseOrderItemUpdateRequest(BaseModel):
    quantity: Optional[float] = None
    purchase_price: Optional[float] = None
    reference: Optional[str] = None
    purchase_price_currency: Optional[str] = None
    notes: Optional[str] = None


class ReceiveStockRequest(BaseModel):
    part_id: str  # Article ID to receive stock for
    quantity: float
    location_id: str
    batch_code: Optional[str] = None
    supplier_batch_code: Optional[str] = None
    serial_numbers: Optional[str] = None
    packaging: Optional[str] = None
    transferable: Optional[bool] = False  # Stock can be transferred while in quarantine
    supplier_id: Optional[str] = None
    supplier_um_id: Optional[str] = None
    notes: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expected_quantity: Optional[float] = None
    expiry_date: Optional[str] = None
    reset_date: Optional[str] = None
    containers: Optional[List[Dict[str, Any]]] = None
    containers_cleaned: Optional[bool] = False
    supplier_ba_no: Optional[str] = None
    supplier_ba_date: Optional[str] = None
    accord_ba: Optional[bool] = False
    is_list_supplier: Optional[bool] = False
    clean_transport: Optional[bool] = False
    temperature_control: Optional[bool] = False
    temperature_conditions_met: Optional[bool] = None


class UpdateOrderStatusRequest(BaseModel):
    status: str
