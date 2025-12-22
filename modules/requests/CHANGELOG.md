# Changelog - Requests Module

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
