# Inventory Module - Changelog

## [2.2.0] - 2025-12-28

### 🔧 Routes Optimization - Modular Structure (COMPLETE)

#### Added
- **Modular Routes Structure**: Split monolithic `routes.py` (1777 lines) into organized modules:
  - `routes/__init__.py` - Router combinator (27 lines)
  - `routes/utils.py` - Shared utilities and Pydantic models (~200 lines)
  - `routes/articles.py` - Articles/Parts routes (~450 lines)
  - `routes/locations.py` - Locations hierarchy (~180 lines)
  - `routes/categories.py` - Categories hierarchy (~180 lines)
  - `routes/stocks.py` - Stock management (~150 lines)
  - `routes/companies.py` - Suppliers/Manufacturers/Clients (~300 lines)

#### Changed
- **routes.py**: Reduced from 1777 lines to just 2 lines of code (import statement)
- All route logic moved to modular structure in `routes/` subdirectory
- Removed old backup files and deprecated routers

#### Benefits
- ✅ **Dramatic size reduction**: 1777 lines → 2 lines in main file
- ✅ **Better organization**: 7 focused files vs 1 monolithic file
- ✅ **Easier maintenance**: Each module has clear responsibility
- ✅ **Improved IDE performance**: Smaller files load faster
- ✅ **Reusable components**: Shared models and utilities in utils.py
- ✅ **Scalable architecture**: Easy to add new modules
- ✅ **48 routes** working perfectly

#### Status
- ✅ Articles routes: Complete
- ✅ Locations routes: Complete
- ✅ Categories routes: Complete
- ✅ Stocks routes: Complete
- ✅ Companies routes: Complete (Suppliers/Manufacturers/Clients)
- ✅ Utility endpoints: Complete (currencies, countries, system-ums)

#### Files Structure
```
modules/inventory/
├── routes.py                    # 2 lines - import only
└── routes/
    ├── __init__.py              # 27 lines - combines all routers
    ├── utils.py                 # ~200 lines - models + utilities
    ├── articles.py              # ~450 lines
    ├── locations.py             # ~180 lines
    ├── categories.py            # ~180 lines
    ├── stocks.py                # ~150 lines
    └── companies.py             # ~300 lines
```

---

## [2.1.0] - 2025-12-28

### 🎯 Companies Enhancement & Articles Improvements

#### Added - Companies (Suppliers/Manufacturers/Clients)
- **Auto-increment PK**: Added `pk` field that auto-increments starting from 1 for all companies
- **New Fields**:
  - `delivery_conditions` (textarea) - Delivery terms and conditions
  - `payment_conditions` (textarea) - Payment terms (existing, now side-by-side with delivery)
  - `bank_account` (input) - Bank account information
  - `currency_id` (ObjectId) - Reference to currencies collection
- **Address Enhancement**: 
  - `country_id` (ObjectId) - Reference to nom_countries instead of plain text
  - `postal_code` (string) - Added postal code field to addresses
- **Display**: PK appears in table as column # and in edit page after name (in parentheses)

#### Added - API Endpoints
- `GET /modules/inventory/api/currencies` - List all currencies
- `GET /modules/inventory/api/countries` - List all countries from nom_countries

#### Changed - Articles
- **Removed**: `default_expiry` field from create and update forms
- **System U.M.**: Now uses `system_um_id` (ObjectId reference to depo_ums) instead of plain text `um`
- **Total Delivery Time**: Changed from string to integer (no decimals)
- **Payment Condition**: Changed from string to integer with "zile" (days) suffix for display
- **Create Form**: Uses select for Units of Measurement from depo_ums collection

#### Backend Changes
- Added `generate_company_pk()` function in services.py
- Updated `create_supplier()` to auto-generate pk and include new fields
- Updated `update_supplier()` to handle new fields (pk and code remain readonly)
- Updated Pydantic models:
  - `SupplierCreateRequest` - Added new fields
  - `SupplierUpdateRequest` - Added new fields
  - `ArticleCreateRequest` - Removed default_expiry, added system_um_id
  - `ArticleUpdateRequest` - Removed default_expiry, changed total_delivery_time and payment_condition to int

#### Migration
- Created `migrate_companies_add_pk.py` script to:
  - Add pk field to existing companies
  - Add new fields (delivery_conditions, bank_account, currency_id) with default values
  - Preserve existing data

#### Frontend Changes - Companies
- **List Pages**: Added # (pk) column to Suppliers, Manufacturers, and Clients tables
- **Detail Pages**: 
  - Display pk after name in parentheses (e.g., "Company Name (123)")
  - Name (3/4) and Code (1/4) on same row, Code is readonly
  - Delivery Conditions and Payment Conditions side-by-side as textareas
  - Added Bank Account input field
  - Added Currency select (from currencies collection)
  - Address modal: Country as select (from nom_countries), added Postal Code field
  - City (2/3) and Postal Code (1/3) on same row

### Status
- ✅ Backend: 100% Complete
- ✅ Frontend Companies: 100% Complete
  - ✅ SuppliersPage + SupplierDetailPage
  - ✅ ManufacturersPage + ManufacturerDetailPage
  - ✅ ClientsPage + ClientDetailPage
- ⏳ Frontend Articles: 0% (needs system_um_id, total_delivery_time, payment_condition updates)

### Migration
To add PK to existing companies, use one of these methods:

**Method 1: API Endpoint (Recommended)**
```bash
POST /modules/inventory/api/migrate-companies-pk
```
This endpoint will:
- Add `pk` field to all companies without it (auto-increment from 1)
- Add new fields: `delivery_conditions`, `bank_account`, `currency_id` (with default values)
- Preserve all existing data

**Method 2: Python Script**
```bash
python migrate_companies_add_pk.py
```

### Notes
- PK is auto-generated and readonly (cannot be edited)
- Code is auto-generated based on company type (MA-XXXX for manufacturers/suppliers, CL-XXXX for clients)
- Addresses use country_id (ObjectId reference to nom_countries)
- Payment condition values stored as integer days for system queries
- All company detail pages (Suppliers, Manufacturers, Clients) fully functional
- Companies without PK will show "N/A" in the # column (gray color)
- After migration, refresh the page to see the PK values

---

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
