"""
Inventory Module - Main Routes Entry Point

This file imports the modular router structure from routes/ subdirectory.
All routes are organized in separate files for better maintainability:
- routes/articles.py - Articles/Parts management
- routes/locations.py - Locations hierarchy
- routes/categories.py - Categories hierarchy
- routes/stocks.py - Stock management
- routes/companies.py - Suppliers/Manufacturers/Clients
- routes/utils.py - Shared models and utilities

Total: ~1500 lines split across 6 files (vs 1777 lines in single file)
"""
from modules.inventory.routes import router

__all__ = ['router']
