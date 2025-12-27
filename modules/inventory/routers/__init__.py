"""
Inventory Routers
Sub-routers pentru fiecare entitate
"""
from . import parts_router
from . import articles_router
from . import locations_router
from . import categories_router
from . import stocks_router
from . import companies_router

__all__ = [
    'parts_router',
    'articles_router',
    'locations_router',
    'categories_router',
    'stocks_router',
    'companies_router',
]
