"""
Suppliers Router
CRUD operations for suppliers, manufacturers, and clients
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token

router = APIRouter(tags=["suppliers"])


class SupplierCreateRequest(BaseModel):
    name: str
    code: Optional[str] = ""
    is_supplier: bool = True
    is_manufacturer: bool = False
    is_client: bool = False
    vatno: Optional[str] = ""
    regno: Optional[str] = ""
    payment_conditions: Optional[str] = ""
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
    addresses: Optional[List[Dict[str, Any]]] = None
    contacts: Optional[List[Dict[str, Any]]] = None


# Suppliers endpoints
@router.get("/suppliers")
async def get_suppliers(
    request: Request,
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token)
):
    """Get list of suppliers (companies with is_supplier=true)"""
    from ..services import get_suppliers_list
    return await get_suppliers_list(search, skip, limit)


@router.get("/suppliers/{supplier_id}")
async def get_supplier(
    request: Request,
    supplier_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific supplier by ID"""
    from ..services import get_supplier_by_id
    return await get_supplier_by_id(supplier_id)


@router.post("/suppliers")
async def create_supplier(
    request: Request,
    supplier_data: SupplierCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new supplier"""
    from ..services import create_supplier as create_supplier_service
    return await create_supplier_service(supplier_data.dict(), current_user)


@router.put("/suppliers/{supplier_id}")
async def update_supplier(
    request: Request,
    supplier_id: str,
    supplier_data: SupplierUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an existing supplier"""
    from ..services import update_supplier as update_supplier_service
    update_dict = {k: v for k, v in supplier_data.dict().items() if v is not None}
    return await update_supplier_service(supplier_id, update_dict, current_user)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    request: Request,
    supplier_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a supplier"""
    from ..services import delete_supplier as delete_supplier_service
    return await delete_supplier_service(supplier_id)


# Manufacturers endpoints (reuse supplier logic)
@router.get("/manufacturers")
async def get_manufacturers(
    request: Request,
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token)
):
    """Get list of manufacturers (companies with is_manufacturer=true)"""
    from ..services import get_manufacturers_list
    return await get_manufacturers_list(search, skip, limit)


@router.get("/manufacturers/{manufacturer_id}")
async def get_manufacturer(
    request: Request,
    manufacturer_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific manufacturer by ID"""
    from ..services import get_supplier_by_id
    return await get_supplier_by_id(manufacturer_id)


@router.post("/manufacturers")
async def create_manufacturer(
    request: Request,
    manufacturer_data: SupplierCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new manufacturer"""
    from ..services import create_supplier as create_supplier_service
    return await create_supplier_service(manufacturer_data.dict(), current_user)


@router.put("/manufacturers/{manufacturer_id}")
async def update_manufacturer(
    request: Request,
    manufacturer_id: str,
    manufacturer_data: SupplierUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an existing manufacturer"""
    from ..services import update_supplier as update_supplier_service
    update_dict = {k: v for k, v in manufacturer_data.dict().items() if v is not None}
    return await update_supplier_service(manufacturer_id, update_dict, current_user)


@router.delete("/manufacturers/{manufacturer_id}")
async def delete_manufacturer(
    request: Request,
    manufacturer_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a manufacturer"""
    from ..services import delete_supplier as delete_supplier_service
    return await delete_supplier_service(manufacturer_id)


# Clients endpoints (reuse supplier logic)
@router.get("/clients")
async def get_clients(
    request: Request,
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token)
):
    """Get list of clients (companies with is_client=true)"""
    from ..services import get_clients_list
    return await get_clients_list(search, skip, limit)


@router.get("/clients/{client_id}")
async def get_client(
    request: Request,
    client_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific client by ID"""
    from ..services import get_supplier_by_id
    return await get_supplier_by_id(client_id)


@router.post("/clients")
async def create_client(
    request: Request,
    client_data: SupplierCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new client"""
    from ..services import create_supplier as create_supplier_service
    return await create_supplier_service(client_data.dict(), current_user)


@router.put("/clients/{client_id}")
async def update_client(
    request: Request,
    client_id: str,
    client_data: SupplierUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an existing client"""
    from ..services import update_supplier as update_supplier_service
    update_dict = {k: v for k, v in client_data.dict().items() if v is not None}
    return await update_supplier_service(client_id, update_dict, current_user)


@router.delete("/clients/{client_id}")
async def delete_client(
    request: Request,
    client_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a client"""
    from ..services import delete_supplier as delete_supplier_service
    return await delete_supplier_service(client_id)
