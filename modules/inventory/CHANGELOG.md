# Inventory Module - Changelog

## [2.0.0] - 2025-12-27

### 🎉 Major Refactoring - Modular Structure

#### Added
- **Modular Router Structure**: Split monolithic `routes.py` (1718 lines) into focused routers:
  - `routers/articles_router.py` - Articles/Parts CRUD (600+ lines)
  - `routers/locations_router.py` - Locations management (200+ lines)
  - `routers/categories_router.py` - Categories management (200+ lines)
  - `routers/stocks_router.py` - Stocks with ledger system (250+ lines)
  - `routers/suppliers_router.py` - Suppliers/Manufacturers/Clients (200+ lines)

- **Shared Utilities**: `services/common.py`
  - `serialize_doc()` - MongoDB to JSON conversion
  - `validate_object_id()` - ObjectId validation
  - `build_search_query()` - Query builder
  - `paginate_results()` - Pagination helper

- **Complete Documentation**: `README.md` with structure, endpoints, features, and development guide

#### Changed
- **Main Router**: `routes.py` now combines all sub-routers (clean 80 lines)
- **Services Export**: Updated `services/__init__.py` to export all supplier functions
- **Import Structure**: Cleaner imports, better organization

#### Fixed
- Missing `db` parameter in `get_stocks` endpoint
- Import errors for supplier/manufacturer/client functions
- Proper dependency injection across all endpoints

#### Backup
- Original `routes.py` backed up to `utils/inventory_routes_backup.py`

### Benefits
- ✅ Better code organization and maintainability
- ✅ Easier navigation and debugging
- ✅ Clear separation of concerns
- ✅ Reusable components
- ✅ Scalable architecture

---

## [1.0.0] - Previous Version

### Features
- Articles/Parts management
- Stock management with ledger system
- Locations hierarchy
- Categories hierarchy
- Suppliers/Manufacturers/Clients management
- Stock movements tracking
- Balances calculation
