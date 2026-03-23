"""
Inventory Module - Main Router (Refactored)
Acest fișier înlocuiește routes.py original care era prea mare (63KB)
"""
from fastapi import APIRouter

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
router.include_router(parts_router.router)
router.include_router(articles_router.router)
router.include_router(locations_router.router)
router.include_router(categories_router.router)
router.include_router(stocks_router.router)
router.include_router(companies_router.router)
