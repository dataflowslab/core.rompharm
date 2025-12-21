# Changelog

All notable changes to this project will be documented in this file.

## [1.18.12] - 2024-12-21

### Added
- **Supplier Field in Add Stock Form**: Added supplier selection to stock receiving forms
  - **Inventory > Articles > Add Stock**: Shows dropdown of suppliers available for that article
    - Loads suppliers from `/modules/inventory/api/articles/{id}/suppliers` endpoint
    - Only shows suppliers that are associated with the article
    - Selectable dropdown (not readonly)
  - **Procurement > Receive Stock**: Shows supplier from purchase order
    - Supplier pre-selected from procurement order
    - Displayed as readonly text field (disabled)
    - Automatically populated from order's supplier

### Changed
- **Form Layout Optimization**: Reorganized ReceiveStockForm for better space utilization
  - **Row 1** (3 columns): Received Quantity | Expected Quantity | Supplier U.M.
    - Previously: Supplier U.M. was below Status field
    - Now: All quantity-related fields on same row
  - **Row 2** (2 columns): Location | Status
    - Previously: Location was full width, Status was separate
    - Now: Both on same row for compact layout
  - **Row 3** (full width): Supplier
    - Context-aware: readonly for Procurement, selectable for Inventory

### Technical
- Extended `ReceiveStockFormData` interface with `supplier_id: string` field
- Added `suppliers` prop to `ReceiveStockForm` component (array of {value, label})
- Added `fixedSupplier` prop to `ReceiveStockForm` for readonly supplier display
- Updated `AddStockModal.tsx`:
  - Added `fetchArticleSuppliers()` function to load article's suppliers
  - Loads suppliers when modal opens if `fixedArticleId` is provided
  - Passes `suppliers` array to `ReceiveStockForm`
- Updated `ReceivedStockTab.tsx`:
  - Added `supplierName` and `supplierId` props
  - Passes `fixedSupplier` to `ReceiveStockForm` for readonly display
  - Initializes `formData.supplier_id` with `supplierId` from order
- Grid layout changes in `ReceiveStockForm.tsx`:
  - Received Quantity: `span={4}` (was `span={6}`)
  - Expected Quantity: `span={4}` (was `span={6}`)
  - Supplier U.M.: `span={4}` (was `span={12}`, moved from bottom)
  - Location: `span={6}` (was `span={12}`)
  - Status: `span={6}` (was `span={12}`)

## [1.18.11] - 2024-12-21

### Fixed
- **Stock State Storage**: Fixed stock creation to save `state_id` (ObjectId) instead of `status` (value)
  - **Problem**: Stocks were saved with `status: 10` (value) instead of `state_id: ObjectId("...")` 
  - **Impact**: Status badges displayed "10" instead of "Rejected" because backend couldn't find `state_id` to enrich with `status_detail`
  - **Solution**: Backend now converts status value to `state_id` before saving
  - **Process**:
    1. Receives status value (e.g., 65 for Quarantine)
    2. Looks up state in `depo_stocks_states` collection by value
    3. Saves `state_id` (ObjectId) to `depo_stocks` collection
    4. Falls back to Quarantine state if value not found
  - **Applies to**:
    - ✅ Inventory > Articles > Add Stock
    - ✅ Procurement > Receive Stock (uses same logic)

### Technical
- Modified `modules/inventory/routes.py` `create_stock()` endpoint:
  - Added lookup to `depo_stocks_states` collection to find state by value
  - Changed from `'status': stock_data.status` to `'state_id': state['_id']`
  - Added fallback to Quarantine state if status value not found
  - Added `received_date` field for consistency
- All new stocks now properly saved with `state_id` for correct status display
- Existing stocks with old `status` field will need migration (manual update)

## [1.18.10] - 2024-12-21

### Fixed
- **Stock Status Display**: Fixed status badges to show status name instead of value
  - All stock tables now display `status_detail.name` (e.g., "Rejected") instead of `status_detail.value` (e.g., "10")
  - Status badges use `status_detail.color` from database as background color
  - White text color for better contrast on colored backgrounds
  - Fixed in:
    - **Inventory > Stocks** table (StocksPage)
    - **Inventory > Articles > Stock** tab (StockTab)
    - **Procurement > Receive Stock** tab (ReceivedStockTab)
  - Backend enrichment added to `get_received_stock_items()` to include `status_detail` with name, value, and color

### Technical
- Updated `StockTab.tsx` to use `status_detail.name` and `status_detail.color` for badge display
- Updated `ReceivedStockTab.tsx` interface to include `status_detail` field
- Modified `modules/depo_procurement/services.py` `get_received_stock_items()` to enrich stocks with:
  - `status_detail` from `depo_stocks_states` collection (name, value, color)
  - `location_detail` from `depo_locations` collection
- Badge rendering now consistent across all stock displays: `<Badge style={{ backgroundColor: color, color: '#fff' }}>{name}</Badge>`

## [1.18.9] - 2024-12-21

### Changed
- **Unified Receive Stock Form**: Refactored Procurement Receive Stock to use shared `ReceiveStockForm` component
  - **Consistency**: Same form UI and behavior across Inventory (Add Stock) and Procurement (Receive Stock)
  - **DRY Principle**: Eliminated code duplication (~500 lines of duplicate form code)
  - **Feature Parity**: Procurement now includes all features from Inventory Add Stock:
    - ✅ Supplier U.M. field (with default value `694813b6297c9dde6d7065b7`)
    - ✅ All QC fields (containers, supplier BA, transport conditions)
    - ✅ Consistent validation and error handling
    - ✅ Same UX patterns and field layouts
  - **Context-Aware**: Form adapts to context:
    - Inventory: Fixed article (pre-selected)
    - Procurement: Line item selection from purchase order items
    - Shows remaining quantity for each line item: "Article Name - IPN (received/total)"
  - **Improved Maintainability**: Single source of truth for stock receiving logic

### Technical
- Refactored `ReceivedStockTab.tsx` to use `ReceiveStockForm` component
- Removed ~500 lines of duplicate form code (Grid, inputs, containers table, etc.)
- Added `systemUms` loading in `ReceivedStockTab`
- Form data now uses `ReceiveStockFormData` interface for type safety
- Backend saves `supplier_um_id` in extra data payload
- Line items prepared as `{ value, label }` array for dropdown
- Locations converted from `pk` to string format for compatibility

## [1.18.8] - 2024-12-21

### Added
- **Stock Detail Page**: New dedicated page for viewing complete stock information
  - Two tabs: "Stock Details" and "QC" (Quality Control)
  - **Stock Details tab**: Displays all stock information organized in sections:
    - Article Information (name, IPN, unit of measure)
    - Stock Information (quantity, expected quantity, location, supplier, batch codes, stock value)
    - Dates (manufacturing, received, expiry, reset)
    - Containers (with damage/unsealed/mislabeled indicators)
    - Notes
    - Metadata (created/updated timestamps and users)
  - **QC tab**: Quality control information:
    - Supplier BA Information (BA number, date, accordance status, supplier list status)
    - Transport Conditions (clean transport, temperature control, conditions met)
    - Quality Status (current status with color badge)
  - Accessible via `/inventory/stocks/{stock_id}`
  - Back button to return to previous page
  - Status badge with color in page header

- **Clickable Stock Rows**: Stock table rows are now clickable
  - Click any row to navigate to Stock Detail Page
  - Visual cursor pointer on hover
  - Improves navigation and user experience

### Changed
- **Stock Status Colors**: Status badges now use colors from `depo_stocks_states` collection
  - Backend enriches stocks with `status_detail` containing `name`, `value`, and `color`
  - Frontend displays badges with custom background color from database
  - Consistent color scheme across all stock displays (Stocks page, Article details, etc.)
  - Replaces hardcoded color mapping with dynamic database-driven colors
  - White text color for better contrast on colored backgrounds

### Technical
- Created `StockItemDetailPage.tsx` with tabbed interface (Stock Details, QC)
- Updated `StocksPage.tsx`:
  - Added `useNavigate` hook for navigation
  - Added `status_detail` to Stock interface
  - Modified `getStatusBadge()` to use `status_detail.color` from backend
  - Added `onClick` handler and cursor style to table rows
- Backend already returns `status_detail` with color in `get_stocks_list()` and `get_stock_by_id()`
- Route `/inventory/stocks/:id` displays StockItemDetailPage

## [1.18.7] - 2024-12-21

### Added
- **Supplier U.M. Field in Add Stock**: Added "Supplier U.M." (Unit of Measure) field to stock creation form
  - New field appears after Status field in Add Stock modal
  - Default value: `694813b6297c9dde6d7065b7` (automatically selected)
  - Dropdown populated from `depo_ums` collection via `/modules/inventory/api/system-ums` endpoint
  - Displays format: "Name (Abbreviation)" for easy identification
  - Saved to `depo_stocks` collection as `supplier_um_id` (ObjectId)

### Technical
- Extended `ReceiveStockFormData` interface with `supplier_um_id: string` field
- Added `systemUms` prop to `ReceiveStockForm` component
- Added `fetchSystemUms()` function in `AddStockModal` to load UMs from backend
- Extended `StockCreateRequest` Pydantic model with `supplier_um_id` field (default: "694813b6297c9dde6d7065b7")
- Backend saves `supplier_um_id` as ObjectId in `depo_stocks` collection
- Frontend passes `supplier_um_id` in stock creation payload

## [1.18.6] - 2024-12-21

### Fixed
- **Stock Filtering by Article**: Fixed stocks not appearing in article detail page
  - Corrected `part_id` query to use `ObjectId` instead of string in `get_stocks_list()`
  - Stocks now properly display when filtering by article

### Changed
- **Inventory Menu Order**: Reordered Inventory submenu items for better workflow
  - New order: Articles, Stocks, Suppliers, Manufacturers, Clients, Locations, Categories
  - Prioritizes most frequently accessed items (Articles, Stocks) at the top
- **Sidebar Scrollbar Position**: Improved scrollbar positioning in sidebar
  - Added `offsetScrollbars` and `scrollbarSize={8}` to ScrollArea
  - Scrollbar now positioned closer to sidebar edge, not overlapping menu arrows
  - Better visual separation and usability

### Technical
- Fixed `modules/inventory/services.py` line 48: `query['part_id'] = ObjectId(part_id)`
- Reordered NavLink items in `Navbar.tsx` Inventory section
- Updated `App.tsx` ScrollArea with `offsetScrollbars` and `scrollbarSize` props

## [1.18.5] - 2024-12-21

### Fixed
- **Add Stock Modal**: Fixed 405 Method Not Allowed error when adding stock
  - Added POST endpoint `/modules/inventory/api/stocks` to create new stock items
  - Endpoint validates part and location existence before creating stock
  - Returns created stock item with MongoDB _id
- **Stock Status Dropdown**: Fixed empty dropdown by correcting collection name
  - Changed from `depo_stock_statuses` to `depo_stocks_states` (correct collection name)
  - Backend endpoint `/modules/depo_procurement/api/stock-statuses` now returns statuses correctly
  - Status automatically defaults to "Quarantined" when modal opens
  - Added console logging to track status fetching process
  - Added user notification if status loading fails
- **Stock Data Storage**: Removed legacy InvenTree `stock-extra-data` endpoint
  - All stock data now saved directly to `depo_stocks` collection in single operation
  - Eliminated 404 error from obsolete `/modules/depo_procurement/api/stock-extra-data` call
  - Simplified stock creation workflow

### Technical
- Extended `StockCreateRequest` Pydantic model with all stock fields:
  - Basic: part_id, quantity, location_id, batch_code, supplier_batch_code, status, notes
  - Dates: manufacturing_date, expiry_date, reset_date
  - Quality: expected_quantity, containers, containers_cleaned
  - Supplier: supplier_ba_no, supplier_ba_date, accord_ba, is_list_supplier
  - Transport: clean_transport, temperature_control, temperature_conditions_met
- POST `/modules/inventory/api/stocks` now saves all fields directly to `depo_stocks`
- Default stock status set to "Quarantined" (auto-detected from `depo_stocks_states`)
- Stock creation includes timestamps and user tracking (created_by, updated_by)
- Fixed `/modules/depo_procurement/api/stock-statuses` to query `depo_stocks_states` collection
- Added detailed console logging in `AddStockModal.fetchStockStatuses()` for debugging
- Removed obsolete `stock-extra-data` API call from frontend

## [1.18.4] - 2024-12-21

### Changed
- **Articles Table**: MU column now displays System UM from `depo_ums` collection instead of simple `um` field
  - Shows proper unit of measure abbreviation from `depo_ums.abrev`
  - Backend enriches articles with `system_um_detail` containing name, abbreviation, and symbol
  - Frontend displays `system_um_detail.abrev` if available, falls back to `um` field
  - Correlates with `system_um_id` field in articles

- **Articles Table**: Category column now displays category name from `depo_categories` collection
  - Backend enriches articles with `category_detail` containing category name
  - Frontend displays `category_detail.name` if available
  - Correlates with `category_id` field in articles
  - Fixed issue where category was set but not displayed in table

### Technical
- Modified `/modules/inventory/api/articles` endpoint to enrich articles with System UM and Category details
- Added lookup to `depo_ums` collection for each article with `system_um_id`
- Added lookup to `depo_categories` collection for each article with `category_id`
- Updated `ArticlesPage.tsx` interface to include `system_um_detail` and `category_detail` fields
- Table now displays proper unit abbreviations and category names from standardized collections

### Documentation
- Archived previous changelog to `utils/251221-CHANGELOG.md`
- Started fresh changelog for better readability

---

*For complete changelog history before 2024-12-21, see `utils/251221-CHANGELOG.md`*
