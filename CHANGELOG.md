# Changelog

All notable changes to DataFlows Core Rompharm project.

## [2.0.2] - 2025-12-27

### 🔧 Backend - Auto-add 'value' field to all API responses
- **serialize_doc() Enhanced**: All MongoDB documents now automatically include `value` field
  - `value` = `_id` for all documents with `_id`
  - Makes all API responses compatible with Mantine Select without manual mapping
  - Applied globally across all modules (inventory, requests, etc.)
- **New Global Serializer**: `src/backend/utils/serializers.py`
  - Centralized serialization logic
  - Consistent handling of ObjectId, datetime, nested objects
  - Automatic `value` field injection
- **Modules Updated**:
  - `modules/inventory/services/common.py` - Enhanced serialize_doc
  - `modules/requests/services.py` - Now uses global serializer
- **Impact**:
  - ✅ Frontend can use `data={apiResponse}` directly in SafeSelect
  - ✅ No manual `value` mapping needed
  - ✅ Consistent API responses across all endpoints

## [2.0.1] - 2025-12-27

### 🛠️ Frontend - SafeSelect Component (Global Fix)
- **SafeSelect & SafeMultiSelect Components**: Wrapper components that automatically handle all Select issues
  - Auto-detects `_id` or `id` from API data (no manual mapping needed!)
  - Eliminates undefined/duplicate options automatically
  - Validates selected values against available options
  - Debug mode with console logging
  - Works with any data format (objects, strings, pre-formatted)
- **Utility Helpers**: Enhanced `selectHelpers.ts`
  - `sanitizeSelectOptions()` - Core sanitization function
  - `createSelectOptions()` - Creates options from API responses
  - `validateSelectValue()` - Validates single select values
  - `validateMultiSelectValues()` - Validates multi-select values
  - `debounce()` - Rate limiting for search inputs
- **Documentation**: 
  - `SAFE_SELECT_GUIDE.md` - Complete usage guide
  - `SELECT_HELPERS_GUIDE.md` - Helper functions reference
  - `FRONTEND_BEST_PRACTICES.md` - Best practices
  - Updated `utils/MUST_KNOW.md` - Critical issue #1 solved
- **Components Updated**:
  - `AddItemModal.tsx` - Now uses SafeSelect with debug mode
  - `Common/index.ts` - Exports SafeSelect and SafeMultiSelect
- **Impact**: 
  - ✅ Zero "Duplicate options" errors
  - ✅ Automatic `_id`/`id` normalization
  - ✅ 90% less code for Select components
  - ✅ Consistent behavior across all selects

## [2.0.0] - 2025-12-27

### 🎉 Inventory Module - Complete Refactoring
- **Modular router structure**: Split monolithic `routes.py` (1718 lines) into 5 focused routers
  - `routers/articles_router.py` - Articles/Parts CRUD (600+ lines)
  - `routers/locations_router.py` - Locations management (200+ lines)
  - `routers/categories_router.py` - Categories management (200+ lines)
  - `routers/stocks_router.py` - Stocks with ledger (250+ lines)
  - `routers/suppliers_router.py` - Suppliers/Manufacturers/Clients (200+ lines)
- **Shared utilities**: `services/common.py` with reusable functions
- **Complete documentation**: `modules/inventory/README.md` and `CHANGELOG.md`
- **Backup**: Original routes saved to `utils/inventory_routes_backup.py`
- **Benefits**: Better organization, easier maintenance, clear separation of concerns

## [Unreleased]

### Added - Role-Based Permissions System
- **roles.items** - array de permission slugs pentru fiecare rol
- **roles_items collection** - listă de permisiuni disponibile
- **Permission checking** - `has_permission()`, `has_any_permission()`, `has_all_permissions()`
- **Helper functions** - `can_view_all_requests()`, `can_edit_own_requests()`, etc.
- **Sysadmin role** - acces nerestrictionat la toate permisiunile
- **API endpoint**: `GET /api/roles/permissions/items` - listă permisiuni disponibile
- **Permission slugs**:
  - `dashboard:view` - acces dashboard
  - `requests:view:all` - vedere toate requesturile
  - `requests:view:own` - vedere propriile requesturi
  - `requests:add:own` - adăugare propriile requesturi
  - `requests:add:all` - adăugare requesturi pentru oricine
  - `requests:edit:own` - editare propriile requesturi
  - `requests:edit:all` - editare toate requesturile

### Changed - Roles System
- `RoleUpdate` model include `items: Optional[list[str]]`
- `PUT /api/roles/{id}` acceptă `items` array
- `local_auth.py` include `items` în role data
- User object include `role.items` array cu permisiuni

### Added - Local Authentication System
- **Localhost identity server** - autentificare fără InvenTree
- **User management** - CRUD pentru users cu roles
- **Role management** - CRUD pentru roles (name, slug)
- **Password hashing** - SHA256 + base64 + salt
- **JWT tokens** - token generation și verification
- **Users table**: username, firstname, lastname, role_id, email, phone, is_staff, is_active
- **Roles table**: name, slug, description
- **Config option**: `identity_server: "localhost"` sau `"inventree"`
- **Init script**: `init_local_auth.py` pentru setup inițial
- **API endpoints**:
  - `GET/POST/PUT/DELETE /api/users` - User management
  - `GET/POST/PUT/DELETE /api/roles` - Role management
  - `POST /api/auth/login` - Login (localhost sau InvenTree)

### Changed - Authentication System
- `auth.py` suportă ambele moduri: localhost și InvenTree
- `verify_token()` verifică JWT pentru localhost, DB token pentru InvenTree
- Login returnează JWT token pentru localhost
- Test script actualizat cu login real (nu mai folosește token hardcodat)

### Added - Production Integration with Ledger System
- **Production stock operations** cu ledger system complet integrat
- **Stock creation** pentru produse finite cu informații despre materiale folosite
- **Material consumption** folosind ledger system (CONSUMPTION movements)
- **Production info** în stock: `production` field cu `materials_used`, `request_id`, `serie_batch`
- **Available quantity** calculation în API stocks (agregare din balances)
- **Test workflow script** (`test_request_workflow.py`) - test complet end-to-end

### Changed - Production Routes
- `execute_production_stock_operations()` refactorizat să folosească ledger system
- Creare stock cu `create_stock()` în loc de insert direct
- Consum materiale cu `consume_stock()` în loc de update direct
- Fiecare serie de producție creează un stock separat
- Stock-urile produse conțin informații despre materialele folosite

### Added - Inventory Ledger System
- **Ledger-based inventory management** - Double-entry bookkeeping pentru stocuri
- **Movement types**: RECEIPT (+), CONSUMPTION (-), TRANSFER_OUT/IN (±), ADJUSTMENT (±), SCRAP (-)
- **3 colecții noi**:
  - `depo_stocks` - master data cu `initial_quantity` (immutable)
  - `depo_stocks_movements` - ledger (sursa adevărului, append-only)
  - `depo_stocks_balances` - snapshot (cache, regenerabil)
- **Helper module** `modules/inventory/stock_movements.py`:
  - `create_movement()` - creare mișcare + update balance
  - `create_transfer()` - transfer între locații (2 mișcări corelate)
  - `get_stock_balance()` - query balance
  - `get_stock_movements()` - istoric mișcări
  - `regenerate_balances()` - rebuild din ledger
  - `verify_transfer_integrity()` - verificare transfer

### Added - Inventory Module Refactoring
- **Modular structure** pentru `modules/inventory/`:
  - `routers/` - sub-routers pentru fiecare entitate
  - `services/` - business logic
  - `models/` - Pydantic models
- **Common services** (`services/common.py`):
  - `serialize_doc()` - conversie MongoDB → JSON
  - `validate_object_id()` - validare ObjectId
  - `build_search_query()` - query builder
  - `paginate_results()` - paginare și sortare
- **Stocks module complet**:
  - 5 Pydantic models (Create, Update, Transfer, Adjustment, Consumption)
  - 7 service functions cu ledger integration
  - 9 API endpoints (CRUD + operations)

### Added - Production Tab Refactoring
- **ProductionSeriesTable** - tabel tree cu serii și materiale
- **UnusedMaterialsTable** - calcul automat unused materials
- **ProductionTab** - integrare completă cu Decision + Signatures
- **Status log system** pentru production scene
- **Canceled state** handling (blochează totul)
- **Role-based officers** support pentru semnături

### Added - Requests Module Updates
- **Status log system** pentru toate scenele (operations, receive_stock, production)
- **DecisionSection** component - reutilizabil pentru toate tab-urile
- **SignaturesSection** component - reutilizabil pentru toate tab-urile
- **Auto-create flows** când tab-urile devin active
- **ObjectId serialization** fixes în toate endpoint-urile

### Added - Migration Scripts
- `migrate_stocks_to_ledger.py` - migrare stocuri la sistem ledger
  - Backup automat înainte de migrare
  - Rename `quantity` → `initial_quantity`
  - Creare RECEIPT movements pentru stocuri existente
  - Creare balances inițiale
  - Verificare integritate după migrare
  - Creare indexuri MongoDB

### Changed
- **depo_stocks schema**:
  - `quantity` → `initial_quantity` (NU se modifică niciodată)
  - Added `initial_location_id`
  - Cantitatea curentă se calculează din movements sau se citește din balances

### Documentation
- `STOCK_MOVEMENT_TYPES.md` - documentație completă ledger system
- `INVENTORY_LEDGER_IMPLEMENTATION_PLAN.md` - plan implementare
- `INVENTORY_ROUTES_REFACTORING.md` - ghid refactorizare
- `INVENTORY_REFACTORING_STATUS.md` - status implementare
- `DEPO_STOCKS_QUANTITY_USAGE.md` - utilizare câmp quantity
- `PRODUCTION_TAB_SPEC.md` - specificații Production Tab
- `PRODUCTION_TAB_IMPLEMENTATION.md` - detalii implementare
- `UPDATE_PRODUCTION_ROUTES.md` - instrucțiuni update production

### Technical Debt
- TODO: Refactorizare completă `modules/inventory/routes.py` (63KB → module separate)
- TODO: Update `modules/depo_procurement` pentru ledger system
- TODO: Update `modules/requests` pentru ledger system
- TODO: Frontend updates pentru ledger system
- TODO: Performance optimization pentru agregări ledger

## [1.0.0] - 2025-12-15

### Initial Release
- Core DataFlows system
- Modules: inventory, requests, depo_procurement
- MongoDB integration
- FastAPI backend
- React frontend
- Authentication system
- Approval flows
- Document generation
