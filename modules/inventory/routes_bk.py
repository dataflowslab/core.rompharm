"""
Inventory Module - Main Routes Entry Point

This file provides backward compatibility by importing from the new modular structure.
All routes are now organized in the routes/ subdirectory:
- routes/articles.py
- routes/locations.py
- routes/categories.py
- routes/stocks.py
- routes/companies.py
- routes/utils.py

For details, see routes/__init__.py
"""
from .routes import router

__all__ = ['router']
