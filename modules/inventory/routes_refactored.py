"""
Inventory Module - Main Router (Refactored)
Acest fișier înlocuiește routes.py original care era prea mare (63KB)
"""
from fastapi import APIRouter, Depends

from src.backend.routes.auth import verify_token

# Import sub-routers
from .routers import (
    parts_router,
    articles_router,
    locations_router,
    categories_router,
    stocks_router,
    companies_router
)

# Main router
router = APIRouter(prefix="/modules/inventory/api", tags=["inventory"])

# Include sub-routers
router.include_router(parts_router.router, dependencies=[Depends(verify_token)])
router.include_router(articles_router.router, dependencies=[Depends(verify_token)])
router.include_router(locations_router.router, dependencies=[Depends(verify_token)])
router.include_router(categories_router.router, dependencies=[Depends(verify_token)])
router.include_router(stocks_router.router, dependencies=[Depends(verify_token)])
router.include_router(companies_router.router, dependencies=[Depends(verify_token)])
