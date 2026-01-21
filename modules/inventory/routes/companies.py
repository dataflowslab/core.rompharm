"""
Companies/Suppliers/Manufacturers/Clients routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Optional

from src.backend.routes.auth import verify_token
from .utils import (
    SupplierCreateRequest,
    SupplierUpdateRequest,
    SupplierPartRequest,
    SupplierPartUpdateRequest
)

router = APIRouter()


# Suppliers
@router.get("/suppliers")
async def get_suppliers(
    request: Request,
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token)
):
    """Get list of suppliers"""
    from modules.inventory.services import get_suppliers_list
    return await get_suppliers_list(search, skip, limit)


@router.get("/suppliers/{supplier_id}")
async def get_supplier(
    request: Request,
    supplier_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific supplier by ID"""
    from modules.inventory.services import get_supplier_by_id
    return await get_supplier_by_id(supplier_id)


@router.post("/suppliers")
async def create_supplier(
    request: Request,
    supplier_data: SupplierCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new supplier"""
    from modules.inventory.services import create_supplier as create_supplier_service
    return await create_supplier_service(supplier_data.dict(), current_user)


@router.put("/suppliers/{supplier_id}")
async def update_supplier(
    request: Request,
    supplier_id: str,
    supplier_data: SupplierUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an existing supplier"""
    from modules.inventory.services import update_supplier as update_supplier_service
    update_dict = {k: v for k, v in supplier_data.dict().items() if v is not None}
    return await update_supplier_service(supplier_id, update_dict, current_user)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    request: Request,
    supplier_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a supplier"""
    from modules.inventory.services import delete_supplier as delete_supplier_service
    return await delete_supplier_service(supplier_id)


@router.get("/suppliers/{supplier_id}/parts")
async def get_supplier_parts(
    request: Request,
    supplier_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get parts associated with a supplier"""
    from modules.inventory.services import get_supplier_parts as get_supplier_parts_service
    return await get_supplier_parts_service(supplier_id)


@router.post("/suppliers/{supplier_id}/parts")
async def add_supplier_part(
    request: Request,
    supplier_id: str,
    part_data: SupplierPartRequest,
    current_user: dict = Depends(verify_token)
):
    """Add a part to supplier's parts list"""
    from modules.inventory.services import add_supplier_part as add_supplier_part_service
    return await add_supplier_part_service(supplier_id, part_data.dict())


@router.put("/suppliers/{supplier_id}/parts/{part_id}")
async def update_supplier_part(
    request: Request,
    supplier_id: str,
    part_id: str,
    part_data: SupplierPartUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update supplier-specific data for a part"""
    from modules.inventory.services import update_supplier_part as update_supplier_part_service
    update_dict = {k: v for k, v in part_data.dict().items() if v is not None}
    return await update_supplier_part_service(supplier_id, part_id, update_dict)


@router.delete("/suppliers/{supplier_id}/parts/{part_id}")
async def remove_supplier_part(
    request: Request,
    supplier_id: str,
    part_id: str,
    current_user: dict = Depends(verify_token)
):
    """Remove a part from supplier's parts list"""
    from modules.inventory.services import remove_supplier_part as remove_supplier_part_service
    return await remove_supplier_part_service(supplier_id, part_id)


# Manufacturers (reuse supplier logic)
@router.get("/manufacturers")
async def get_manufacturers(
    request: Request,
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token)
):
    """Get list of manufacturers"""
    from modules.inventory.services import get_manufacturers_list
    return await get_manufacturers_list(search, skip, limit)


@router.get("/manufacturers/{manufacturer_id}")
async def get_manufacturer(
    request: Request,
    manufacturer_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific manufacturer by ID"""
    from modules.inventory.services import get_supplier_by_id
    return await get_supplier_by_id(manufacturer_id)


@router.post("/manufacturers")
async def create_manufacturer(
    request: Request,
    manufacturer_data: SupplierCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new manufacturer"""
    from modules.inventory.services import create_supplier as create_supplier_service
    return await create_supplier_service(manufacturer_data.dict(), current_user)


@router.put("/manufacturers/{manufacturer_id}")
async def update_manufacturer(
    request: Request,
    manufacturer_id: str,
    manufacturer_data: SupplierUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an existing manufacturer"""
    from modules.inventory.services import update_supplier as update_supplier_service
    update_dict = {k: v for k, v in manufacturer_data.dict().items() if v is not None}
    return await update_supplier_service(manufacturer_id, update_dict, current_user)


@router.delete("/manufacturers/{manufacturer_id}")
async def delete_manufacturer(
    request: Request,
    manufacturer_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a manufacturer"""
    from modules.inventory.services import delete_supplier as delete_supplier_service
    return await delete_supplier_service(manufacturer_id)


# Clients (reuse supplier logic)
@router.get("/clients")
async def get_clients(
    request: Request,
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(verify_token)
):
    """Get list of clients"""
    from modules.inventory.services import get_clients_list
    return await get_clients_list(search, skip, limit)


@router.get("/clients/{client_id}")
async def get_client(
    request: Request,
    client_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get a specific client by ID"""
    from modules.inventory.services import get_supplier_by_id
    return await get_supplier_by_id(client_id)


@router.post("/clients")
async def create_client(
    request: Request,
    client_data: SupplierCreateRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new client"""
    from modules.inventory.services import create_supplier as create_supplier_service
    return await create_supplier_service(client_data.dict(), current_user)


@router.put("/clients/{client_id}")
async def update_client(
    request: Request,
    client_id: str,
    client_data: SupplierUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update an existing client"""
    from modules.inventory.services import update_supplier as update_supplier_service
    update_dict = {k: v for k, v in client_data.dict().items() if v is not None}
    return await update_supplier_service(client_id, update_dict, current_user)


@router.delete("/clients/{client_id}")
async def delete_client(
    request: Request,
    client_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a client"""
    from modules.inventory.services import delete_supplier as delete_supplier_service
    return await delete_supplier_service(client_id)


# Utility endpoints
@router.get("/companies")
async def get_companies(
    request: Request,
    search: Optional[str] = Query(None),
    is_supplier: Optional[bool] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of companies from MongoDB"""
    from src.backend.utils.db import get_db
    from .utils import serialize_doc
    
    db = get_db()
    collection = db['depo_companies']
    
    query = {}
    if search:
        query['name'] = {'$regex': search, '$options': 'i'}
    if is_supplier is not None:
        query['is_supplier'] = is_supplier
    
    try:
        cursor = collection.find(query).sort('name', 1)
        companies = list(cursor)
        return serialize_doc(companies)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch companies: {str(e)}")


@router.get("/currencies")
async def get_currencies(
    request: Request,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of currencies from MongoDB"""
    from src.backend.utils.db import get_db
    from .utils import serialize_doc
    
    db = get_db()
    collection = db['currencies']
    
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'code': {'$regex': search, '$options': 'i'}},
            {'symbol': {'$regex': search, '$options': 'i'}}
        ]
    
    try:
        cursor = collection.find(query).sort('name', 1)
        currencies = list(cursor)
        return serialize_doc(currencies)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch currencies: {str(e)}")


@router.get("/countries")
async def get_countries(
    request: Request,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of countries from MongoDB"""
    from src.backend.utils.db import get_db
    from .utils import serialize_doc
    
    db = get_db()
    collection = db['nom_countries']
    
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'code': {'$regex': search, '$options': 'i'}}
        ]
    
    try:
        cursor = collection.find(query).sort('name', 1)
        countries = list(cursor)
        return serialize_doc(countries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch countries: {str(e)}")


@router.get("/system-ums")
async def get_system_ums(
    request: Request,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(verify_token)
):
    """Get list of system units of measure from MongoDB"""
    from src.backend.utils.db import get_db
    from .utils import serialize_doc
    
    db = get_db()
    collection = db['depo_ums']
    
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'symbol': {'$regex': search, '$options': 'i'}}
        ]
    
    try:
        cursor = collection.find(query).sort('name', 1)
        ums = list(cursor)
        return serialize_doc(ums)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch system UMs: {str(e)}")
