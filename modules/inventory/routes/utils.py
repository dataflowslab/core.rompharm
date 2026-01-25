"""
Shared utilities and models for inventory routes
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from bson import ObjectId


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == '_id' or key.endswith('_id'):
                result[key] = str(value) if value else None
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = [serialize_doc(item) if isinstance(item, dict) else item for item in value]
            else:
                result[key] = value
        return result
    return doc


# Article models
class ArticleCreateRequest(BaseModel):
    name: str
    ipn: str
    default_location_id: Optional[str] = None
    system_um_id: Optional[str] = None
    supplier_id: Optional[str] = None
    notes: Optional[str] = ""
    minimum_stock: Optional[float] = None
    is_component: bool = True
    is_assembly: bool = True
    is_testable: bool = True
    is_salable: bool = False
    is_active: bool = True


class ArticleUpdateRequest(BaseModel):
    name: Optional[str] = None
    ipn: Optional[str] = None
    default_location_id: Optional[str] = None
    um: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    keywords: Optional[List[str]] = None
    link: Optional[str] = None
    minimum_stock: Optional[float] = None
    is_component: Optional[bool] = None
    is_assembly: Optional[bool] = None
    is_testable: Optional[bool] = None
    is_salable: Optional[bool] = None
    is_active: Optional[bool] = None
    storage_conditions: Optional[str] = None
    regulated: Optional[bool] = None
    lotallexp: Optional[bool] = None
    selection_method: Optional[str] = None
    category_id: Optional[str] = None
    manufacturer_id: Optional[str] = None
    manufacturer_ipn: Optional[str] = None
    system_um_id: Optional[str] = None
    total_delivery_time: Optional[int] = None
    payment_condition: Optional[int] = None


class ArticleSupplierRequest(BaseModel):
    supplier_id: str
    supplier_code: Optional[str] = ""
    um: Optional[str] = ""
    notes: Optional[str] = ""
    price: Optional[float] = 0
    currency: Optional[str] = "EUR"


class ArticleSupplierUpdateRequest(BaseModel):
    supplier_code: Optional[str] = None
    um: Optional[str] = None
    notes: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None


# Location models
class LocationCreateRequest(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None


class LocationUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None


# Category models
class CategoryCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None


# Stock models
class StockCreateRequest(BaseModel):
    part_id: str
    quantity: float
    location_id: str
    batch_code: Optional[str] = None
    supplier_batch_code: Optional[str] = None
    status: Optional[int] = 65  # Default to Quarantine
    supplier_id: Optional[str] = None
    supplier_um_id: Optional[str] = "694813b6297c9dde6d7065b7"
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
    temperature_conditions_met: Optional[bool] = False


class StockUpdateRequest(BaseModel):
    rompharm_ba_no: Optional[str] = None
    rompharm_ba_date: Optional[str] = None
    state_id: Optional[str] = None


# Company/Supplier models
class SupplierAddressRequest(BaseModel):
    name: str
    country: Optional[str] = ""
    city: Optional[str] = ""
    address: Optional[str] = ""
    description: Optional[str] = ""
    contact: Optional[str] = ""
    email: Optional[str] = ""


class SupplierContactRequest(BaseModel):
    name: str
    role: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""


class SupplierCreateRequest(BaseModel):
    name: str
    code: Optional[str] = ""
    is_supplier: bool = True
    is_manufacturer: bool = False
    is_client: bool = False
    vatno: Optional[str] = ""
    regno: Optional[str] = ""
    payment_conditions: Optional[str] = ""
    delivery_conditions: Optional[str] = ""
    bank_account: Optional[str] = ""
    currency_id: Optional[str] = None
    addresses: Optional[List[Dict[str, Any]]] = []
    contacts: Optional[List[Dict[str, Any]]] = []


class SupplierUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_supplier: Optional[bool] = None
    is_manufacturer: Optional[bool] = None
    is_client: Optional[bool] = None
    vatno: Optional[str] = None
    regno: Optional[str] = None
    payment_conditions: Optional[str] = None
    delivery_conditions: Optional[str] = None
    bank_account: Optional[str] = None
    currency_id: Optional[str] = None
    addresses: Optional[List[Dict[str, Any]]] = None
    contacts: Optional[List[Dict[str, Any]]] = None


class SupplierPartRequest(BaseModel):
    part_id: str
    supplier_code: Optional[str] = ""
    currency: Optional[str] = "EUR"


class SupplierPartUpdateRequest(BaseModel):
    supplier_code: Optional[str] = None
    currency: Optional[str] = None
