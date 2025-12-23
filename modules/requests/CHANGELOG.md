# Changelog - Requests Module

## Version 1.0.19 - Complete InvenTree Decoupling

### Changed
- **Removed All InvenTree Dependencies**: Completely eliminated InvenTree API calls from requests module
  - BOM data now loaded from MongoDB `depo_bom` collection
  - Recipe fallback now uses MongoDB BOM instead of InvenTree BOM
  - All data sources are now MongoDB only

### Technical Details
- `fetch_part_bom()` - Now queries `depo_bom` collection with `part_id` (ObjectId)
- `fetch_part_recipe()` - Fallback changed from InvenTree BOM to MongoDB `depo_bom`
- Returns `source: "none"` when neither recipe nor BOM found
- No more HTTP requests to InvenTree API

### MongoDB Collections Used
- `depo_locations` - Stock locations
- `depo_parts` - Parts catalog
- `depo_stocks` - Stock levels and batch codes
- `depo_bom` - Bill of Materials
- `depo_recipes` - Production recipes
- `depo_requests` - Stock transfer requests
- `approval_flows` - Approval workflows

### Removed
- All InvenTree API calls (`/api/stock/location/`, `/api/part/`, `/api/bom/`)
- InvenTree BOM fallback in `fetch_part_recipe()`
- Dependency on InvenTree for any request operations

## Version 1.0.18 - Part Details from MongoDB

### Changed
- **Part Details Source**: `get_request()` now loads part details from MongoDB `depo_parts` instead of InvenTree
  - Eliminates HTTP requests to InvenTree for part information
  - Faster response times
  - Consistent with other MongoDB-based data

### Technical Details
- Part details loaded from `depo_parts` collection using integer `id` field
- Returns: pk, name, IPN, description, active, assembly, component, purchaseable, salable, trackable, virtual
- No more `/api/part/{id}/` calls to InvenTree for request details

### InvenTree Usage Remaining
- **BOM Endpoint** (`/parts/{part_id}/bom`) - Still uses InvenTree (BOM data not in MongoDB)
- **Recipe Fallback** (`/parts/{part_id}/recipe`) - Uses MongoDB recipes with InvenTree BOM fallback
- These are intentional and necessary for BOM functionality

## Version 1.0.17 - ObjectId Serialization Fix

### Fixed
- **ObjectId Serialization Error**: Fixed `ValueError: 'ObjectId' object is not iterable` when loading requests
  - Convert `source` and `destination` ObjectIds to strings in `list_requests()`
  - Convert `source` and `destination` ObjectIds to strings in `get_request()`
  - Convert `source` and `destination` ObjectIds to strings in `update_request()`
  - Convert `recipe_id` and `recipe_part_id` ObjectIds to strings

- **Location Details from MongoDB**: Updated `get_request()` to use `depo_locations` instead of InvenTree
  - Fetch location details from MongoDB `depo_locations` collection
  - Return location `code` as `name` for consistency

### Technical Details
- All ObjectIds converted to strings before JSON serialization
- Location lookups now use MongoDB instead of InvenTree API
- Handles both ObjectId and string formats for backward compatibility

## Version 1.0.16 - Operations Add Item Modal Fixes

### Fixed
- **Article Select Disappearing**: Fixed issue where selected article disappeared when clicking on Batch Code field
  - Clear search value after selection to keep selected value visible
  - Added `clearable` prop to Article Select

- **Batch Codes Not Loading**: Fixed batch codes not loading from source location
  - Updated `fetch_part_batch_codes` to query MongoDB `depo_stocks` instead of InvenTree
  - Changed `location_id` parameter from `int` to `str` (ObjectId)
  - Query now uses ObjectId for location filtering
  - Only returns transferable stock (state_id = 694322878728e4d75ae72790)

### Changed
- **Batch Codes Source**: Now loads from MongoDB depo_stocks
  - Filters by part_id (ObjectId), location_id (ObjectId), and transferable state
  - Groups by batch_code and aggregates quantities
  - Returns batch_code, expiry_date, quantity, location_id

### Technical Details
- `fetch_part_batch_codes` signature: `location_id: Optional[int]` → `Optional[str]`
- Query: `depo_stocks.find({part_id: ObjectId, location_id: ObjectId, state_id: ObjectId, quantity: {$gt: 0}})`
- Article Select: Added `setPartSearch('')` on selection to prevent value disappearing

## Version 1.0.15 - DocumentGenerator Performance Optimization

### Fixed
- **Multiple API Requests**: Fixed DocumentGenerator making excessive requests to `/api/documents/for/{objectId}`
  - Added `useRef` to track last loaded objectId
  - Only reloads when objectId actually changes
  - Prevents duplicate loads on component re-renders

### Changed
- **useEffect Dependencies**: Optimized to only depend on `objectId`, not `templateCodes`
  - Reduces unnecessary re-renders
  - Template codes are static per component instance

### Technical Details
- Added `loadedRef` to cache last loaded objectId
- Console log added for debugging: `[DocumentGenerator] Loading for objectId: {id}`
- No functional changes - only performance optimization

## Version 1.0.14 - Location ObjectIds from depo_locations

### Changed
- **Source and Destination**: Now use ObjectIds from `depo_locations` instead of integers from InvenTree
  - Changed from `int` to `str` (ObjectId) in models
  - Location names use `code` field from `depo_locations`
  - All location lookups now query MongoDB instead of InvenTree API

### Fixed
- **Stock Location Loading**: Fixed to use `depo_locations` collection
  - `fetch_stock_locations()` now queries MongoDB
  - Returns ObjectId as `pk` and `code` as `name`
  - Consistent with other MongoDB collections

### Migration
- **Update Script**: Created `update_requests_locations.py` to migrate existing requests
  - Updates all `source` and `destination` fields to ObjectIds
  - Default values: 
    - source: `693fb21371d731f72ad6544a`
    - destination: `69418ede71d731f72ad65483`

### Technical Details
- `RequestCreate.source`: `int` → `str` (ObjectId)
- `RequestCreate.destination`: `int` → `str` (ObjectId)
- `RequestUpdate.source`: `Optional[int]` → `Optional[str]`
- `RequestUpdate.destination`: `Optional[int]` → `Optional[str]`
- Location lookups use `depo_locations._id` (ObjectId)
- Location display uses `depo_locations.code` field

## Version 1.0.13 - Operations Tab Add/Delete Items

### Added
- **Add Item in Operations**: New functionality to add items directly in Operations tab
  - Button "Add Item" visible when not signed
  - Modal with fields: Article (searchable), Batch Code (from source location), Quantity
  - Batch codes filtered by selected article and source location
  - Items marked with `added_in_operations: true` flag

- **Delete Item in Operations**: Delete button for items added in Operations
  - Only items with `added_in_operations: true` can be deleted
  - Items from original request or Items tab cannot be deleted
  - Confirmation modal before deletion

### Changed
- **Table Columns**: Added Delete column (visible only when not signed)
- **Batch Code Source**: Add Item loads batch codes from **source location** (not destination)
- **Item Tracking**: New `added_in_operations` field to distinguish item origin

### Technical Details
- `added_in_operations` field added to RequestItemCreate model
- Default value: `false`
- Set to `true` only for items added via Operations tab
- Preserved during updates
- Delete button only shown for items with `added_in_operations: true`

### Workflow
1. **Add Item**: Article → Batch Code (from source) → Quantity → Add
2. **Edit Quantity**: All items can have quantity edited
3. **Delete**: Only items added in Operations can be deleted
4. **Save**: Saves all changes (quantities + new items)
5. **Sign**: Locks the form (no more add/delete/edit)

## Version 1.0.12 - UI Consistency and Document Generator

### Fixed
- **Details Tab Documents Border**: Added subtle border around DocumentGenerator
  - Consistent with Operations tab styling
  - Better visual separation with Paper component

### Verified
- **Operations Tab**: Confirmed using global DocumentGenerator component
  - Not custom implementation
  - Consistent across all tabs

### Technical Details
- DocumentGenerator does not auto-poll continuously
- Only checks status after generation (2s initial, then 3s intervals if processing)
- Manual refresh button available for user-initiated status checks
- Single request per document on page load

## Version 1.0.11 - Operations Tab Redesign

### Changed
- **Operations Tab - No Batch Selection**: Removed batch code selector from Operations
  - Operators can only edit quantities
  - Batch codes are displayed as read-only text
  - If materials are not available, operator sets quantity to 0
  - Materials can be re-added with batch codes in Items tab

### Added
- **Initial Quantity Tracking**: New `init_q` field in items
  - Saves the originally requested quantity
  - Displayed in "Requested" column in Operations tab
  - Allows comparison between requested vs actual quantities
  - Auto-populated on request creation

### Fixed
- **Document Generator Border**: Added subtle border around document generator section
  - Nested Paper component with thin border
  - Better visual separation

### Layout Changes
- **Operations Table Columns**:
  - Part (Material name)
  - Requested (init_q - read-only)
  - Qty (editable quantity)
  - Batch Code (read-only text)

### Technical Details
- `init_q` field added to RequestItemCreate model
- Auto-populated with `quantity` value on request creation
- Preserved during updates
- No validation required for signing (quantities can be 0)
- Simplified workflow: adjust quantities only, batch codes managed in Items tab

## Version 1.0.10 - Operations Tab Improvements

### Changed
- **Warehouse Operations Table**: Renamed from "Series and Batch Information" and moved to top
  - Now appears first in the Operations tab
  - Removed "Series" column completely
  - Only "Part", "Qty", and "Batch Code" columns remain
  - Batch codes now load from **destination location** (not source)

### Fixed
- **Batch Codes Loading**: Fixed issue where batch codes weren't loading for some materials
  - Changed from source location to destination location
  - Now correctly shows all available batch codes at destination

### Removed
- **Series Column**: Completely removed from Operations tab
  - Removed from interface
  - Removed from validation logic
  - Removed from save operations
  - Only batch code validation remains

### Layout Changes
- **New Layout Structure**:
  - Top: Warehouse Operations table (full width)
  - Bottom Left (1/3): Document Generator
  - Bottom Right (2/3): Signatures and Decision

### Technical Details
- Validation now only checks for batch_code (not series)
- Batch codes fetched using `destination` location ID
- DocumentGenerator component integrated for P-Distrib-102_F2
- Cleaner, more focused interface

## Version 1.0.9 - Document Generator Integration

### Changed
- **Document Component**: Replaced `DocumentManager` with global `DocumentGenerator` component
  - Now uses the standard document generation system from MUST_KNOW.md
  - Consistent with other modules (procurement, etc.)
  - Template code: `6LL5WVTR8BTY` for "P-Distrib-102_F1"

### Technical Details
- `DocumentGenerator` uses `/api/documents/*` endpoints
- Auto-polling for document status
- Supports download, delete, and regenerate actions
- Template names loaded from backend configuration

## Version 1.0.8 - Operations Flow Endpoints Fix

### Fixed
- **Operations Flow 404 Error**: Added missing operations flow endpoints
  - `GET /{request_id}/operations-flow` - Get operations flow
  - `POST /{request_id}/operations-sign` - Sign operations flow
  - `DELETE /{request_id}/operations-signatures/{user_id}` - Remove operations signature
  - Endpoints were being called by frontend but were not defined in backend

### Technical Details
- Operations flow endpoints follow same pattern as approval flow
- Use `object_type: "stock_request_operations"` to differentiate from approval flow
- Auto-created when request is approved
- Updates request status to "In Operations" when operations flow is approved

## Version 1.0.7 - Code Refactoring

### Changed
- **Code Organization**: Refactored monolithic `routes.py` into modular structure
  - Created `models.py` for Pydantic models (RequestItemCreate, RequestCreate, RequestUpdate)
  - Created `utils.py` for utility functions (get_inventree_headers, generate_request_reference)
  - Created `services.py` for business logic and external API calls
  - Created `approval_routes.py` for approval flow endpoints
  - Main `routes.py` now acts as orchestrator with cleaner structure

### Fixed
- **Missing Route**: Added `@router.get("/parts/{part_id}/recipe")` decorator for `get_part_recipe` function
  - Function was defined but not exposed as an endpoint
  - Now properly accessible at `/modules/requests/api/parts/{part_id}/recipe`

### Technical Details
- Separated concerns: models, utilities, services, and routes
- Improved maintainability and testability
- Reduced file size from 800+ lines to ~300 lines per file
- All functionality preserved, no breaking changes

## Version 1.0.6 - Recipe Integration and UX Improvements

### Added
- **Recipe Integration**: Requests now save recipe information when created from a recipe
  - Added `recipe_id` (ObjectId) field to store which recipe was used
  - Added `recipe_part_id` (ObjectId) field to store the product part reference
  - Added `product_id` (integer) and `product_quantity` (float) fields
  - Backend endpoint `/parts/{part_id}/recipe` now uses part_id (ObjectId) from depo_parts
  - Recipe endpoint returns `recipe_id` and `recipe_part_id` for saving in requests

- **Operations Flow Endpoints**: Complete backend support for operations flow
  - `GET /{request_id}/operations-flow` - Retrieve operations flow
  - `POST /{request_id}/operations-sign` - Sign operations flow
  - `DELETE /{request_id}/operations-signatures/{user_id}` - Remove signature (admin)
  - `PATCH /{request_id}/operations-status` - Update final status (Finished/Refused)

### Fixed
- **Operations Tab Visibility**: Operations tab now correctly displays after request approval
  - Operations flow is auto-created when request is approved
  - Tab shows operations form instead of "will be created" message
  - All operations flow functionality now works correctly

### Changed
- **Details Tab UX Improvements**:
  - All readonly fields now use `disabled` attribute for better visual clarity
  - Removed Items list from Details tab (already available in Items tab)
  - Cleaner, less redundant interface
  - Fields clearly show they cannot be edited when disabled

### Technical Details
- Recipe items now use `part_id` (ObjectId) internally instead of integer `id`
- Frontend sends recipe information when creating requests with recipes
- Operations flow follows same pattern as approval flow
- All endpoints properly handle ObjectId conversions

## Version 1.0.5 - Complete API Path Migration

### Fixed
- **All 404 Errors**: Fixed all remaining hardcoded `/api/requests/` paths across all components
- Updated all tabs to use centralized `requestsApi` service:
  - ApprovalsTab: approval flow, signing, signature removal
  - OperationsTab: operations flow, signing, status updates
  - ItemsTab: request data, approval flow checks
  - DetailsTab: approval flow checks, request updates
  - ComponentsTable: stock info (already fixed in 1.0.4)
  - ReceptieTab: reception flow endpoints (needs update)

### Added to requestsApi Service
- `getOperationsFlow()` - Get operations flow
- `signOperations()` - Sign operations
- `removeOperationsSignature()` - Remove operations signature
- `updateOperationsStatus()` - Update operations status
- `getReceptionFlow()` - Get reception flow
- `signReception()` - Sign reception
- `removeReceptionSignature()` - Remove reception signature
- `updateReceptionStatus()` - Update reception status

### Technical Details
- All API endpoints now use `/modules/requests/api` prefix
- Centralized in `services/requests.ts` for maintainability
- Eliminates 404 errors from incorrect API paths
- Consistent with ROUTES.md documentation

## Version 1.0.4 - API Path Fix

### Fixed
- **API Paths**: Fixed frontend API calls to use correct module prefix `/modules/requests/api`
- Updated ComponentsTable, ItemsTab, OperationsTab, and DetailsTab to use `requestsApi` service
- All API calls now properly route through the requests service module

### Technical Details
- Centralized API paths in `services/requests.ts`
- Changed hardcoded `/api/requests/` paths to use `requestsApi` helper functions
- Ensures consistency with ROUTES.md documentation

## Version 1.0.3 - Operations and Items Enhancements

### Changed - Items Tab
- **Optional Batch Codes**: Materials can now be added without batch codes (empty batch allowed)
- Batch code field is now optional when adding items
- Materials without stock can be added to requests

### Changed - Operations Tab
- **Editable Batch Codes**: Each line now has an active Select dropdown for batch codes with stock quantity in parentheses
- **Editable Quantities**: Quantity can be set to zero for any item (items cannot be deleted)
- **Zero Quantity Styling**: Items with quantity = 0 appear grayed out (50% opacity) and are sorted to the bottom of the list
- **Disabled Fields for Zero Qty**: Series and batch code fields are disabled for items with quantity = 0
- **Read-Only After Signing**: Once operations flow has signatures, the entire table becomes read-only
- **Validation Update**: Only items with quantity > 0 require series and batch code before signing

### Added - Operations Tab
- Quantity editing with NumberInput component (min: 0)
- Automatic sorting: non-zero quantities first, zero quantities last (grayed out)
- Batch code Select dropdown with searchable and clearable options
- Visual feedback for zero-quantity items (gray text and reduced opacity)

### Technical Details
- Items are re-sorted after save to maintain zero-quantity items at the bottom
- Batch options show format: `BATCH_CODE - EXPIRY_DATE - QUANTITY buc`
- Form becomes completely read-only when `hasAnySignature()` returns true

## Version 1.0.2 - Items Management Enhancement

### Changed
- **Items Tab**: Now allows adding individual materials with batch selection
- **Batch Management**: Each material-batch combination is stored as a separate line item
- **Read-Only Batches**: Batch codes are read-only once selected (must delete and re-add to change)
- **Multiple Lines**: Materials can appear multiple times with different batches
- **No Auto-Merge**: Removed automatic merging of duplicate materials

### Added
- Batch selection dropdown in Items tab when adding materials (loads available batches from source location)
- Support for multiple lines of the same material with different batches
- Batch code is now required when adding items

### Technical Details
- Batch codes are loaded dynamically when a part is selected in the add item modal
- Batch display format: `BATCH_CODE - EXPIRY_DATE - QUANTITY buc`
- Items with same part but different batches are kept as separate entries

## Version 1.0.1 - Bug Fixes

### Fixed
- Stock information now correctly filters by transferable state (state_id = 694322878728e4d75ae72790)
- Components with quarantined and transferable stock now show available batches in the New Request dialog
- Batch selection dropdown now displays available quantity in parentheses (e.g., "BATCH001 (20 available)")
- Fixed field name from 'q' to 'quantity' in depo_stocks query

### Changed
- Updated `/parts/{part_id}/stock-info` endpoint to only return transferable stock
- Improved batch display format in ComponentsTable to show stock availability

## Version 1.0.0 - Initial Release

### Added
- Complete stock transfer request management system
- Auto-generated reference numbers (REQ-NNNN format)
- Part selection with stock information from MongoDB
- BOM support for assemblies
- Approval workflow integration
- Operations and Reception approval flows
- Document generation support
- Batch code management
- Status tracking workflow

### Features
- Create/Read/Update/Delete requests
- Source and destination location selection
- Part search with autocomplete
- Stock information display (total, allocated, available)
- Batch codes with expiry dates
- Recipe integration with BOM fallback
- Config-based approval flows
- Signature workflows
- Status management with reason tracking

### API Endpoints
- 15+ endpoints for complete request management
- Stock location integration
- Part search and stock info
- BOM and recipe integration
- Approval flow management
- Signature operations

### Database
- `depo_requests_items` - Request documents
- `approval_flows` - Approval workflows
- Integration with `depo_parts`, `depo_stocks`

### Notes
- Requests stored in MongoDB (not InvenTree)
- Stock information from MongoDB `depo_stocks`
- Approval flows use config-based system
- Document templates: 6LL5WVTR8BTY, RC45WVTRBDGT
- Source and destination validation
- Auto-create approval flow on request creation
