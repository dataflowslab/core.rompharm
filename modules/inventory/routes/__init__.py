"""
Inventory Module Routes - Modular Structure

This module combines all inventory routes from separate files:
- articles.py: Articles/Parts management (~450 lines)
- locations.py: Locations hierarchy (~180 lines)
- categories.py: Categories hierarchy (~180 lines)
- stocks.py: Stock management (~150 lines)
- companies.py: Suppliers/Manufacturers/Clients (~300 lines)
- utils.py: Shared models and utilities (~200 lines)

Total: ~1460 lines split across 6 files (vs 1777 lines in single file)
"""
from fastapi import APIRouter

# Import sub-routers
from . import articles, locations, categories, stocks, companies

# Create main router
router = APIRouter(prefix="/modules/inventory/api", tags=["inventory"])

# Include all sub-routers
router.include_router(articles.router)
router.include_router(locations.router)
router.include_router(categories.router)
router.include_router(stocks.router)
router.include_router(companies.router)
