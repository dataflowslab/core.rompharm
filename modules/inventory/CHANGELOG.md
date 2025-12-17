# Changelog - Inventory Module

## Version 1.4.0 - Stocks Frontend Implementation

### Added
- **Stocks Section Frontend**: Complete frontend implementation for stocks listing
  - Created `StocksPage.tsx` with full table display
  - Columns: Batch Code, Batch Date, Product, IPN, Status, Location, Quantity, Stock Value, Supplier
  - Search functionality across batch codes, serial numbers, and notes
  - Status badges with color coding (OK, Quarantine, Attention, Damaged, etc.)
  - Currency formatting for stock values (RON)
  - Quantity display with unit of measure
  - Responsive table layout

### Features
- **Status Badges**: Color-coded status indicators
  - Green: OK
  - Yellow: Quarantine
  - Orange: Attention
  - Red: Damaged, Destroyed, Rejected
  - Gray: Lost
  - Blue: Returned
- **Data Enrichment**: Displays enriched data from backend
  - Product name and IPN from `depo_parts`
  - Location name from `depo_locations`
  - Supplier name (from purchase orders or internal production)
  - Calculated stock value
- **Search**: Real-time search across batch codes and notes
- **Date Formatting**: Localized date display (DD/MM/YYYY)
- **Currency Formatting**: Romanian locale (RON)

### Technical
- Frontend page: `modules/inventory/frontend/pages/StocksPage.tsx`
- Route added: `/inventory/stocks`
- Menu item activated in Navbar
- Uses existing backend API: `GET /modules/inventory/api/stocks`
- Mantine UI components for consistent styling

### Notes
- Backend was already implemented in v1.1.0
- This release adds the frontend interface
- All data comes from `depo_stocks` collection with enriched information
- Supplier detection works for both purchase orders and build orders

---

## Version 1.3.0 - Manufacturers and Clients Implementation

### Added
- **Manufacturers Section**: Complete CRUD for manufacturers (companies with is_manufacturer=true)
  - List manufacturers with search, create, delete
  - Manufacturer detail page with 5 tabs (Details, Addresses, Contacts, Articles, Purchase Orders)
  - Same structure as Suppliers section
  - Backend endpoints: GET/POST/PUT/DELETE `/api/manufacturers`
  - Frontend pages: `ManufacturersPage.tsx`, `ManufacturerDetailPage.tsx`

- **Clients Section**: Complete CRUD for clients (companies with is_client=true)
  - List clients with search, create, delete
  - Client detail page with 5 tabs (Details, Addresses, Contacts, Articles, Purchase Orders)
  - Same structure as Suppliers section
  - Backend endpoints: GET/POST/PUT/DELETE `/api/clients`
  - Frontend pages: `ClientsPage.tsx`, `ClientDetailPage.tsx`

### Technical
- Companies can be suppliers, manufacturers, clients, or any combination
- All three sections use the same `depo_companies` collection
- Filtering by `is_supplier`, `is_manufacturer`, or `is_client` flags
- Reuse supplier logic for manufacturers and clients
- Validation: At least one checkbox (supplier/manufacturer/client) must be selected

### Database
- `depo_companies` collection with flags:
  - `is_supplier`: boolean
  - `is_manufacturer`: boolean
  - `is_client`: boolean
- A company can have multiple flags set to true

### Notes
- Manufacturers and Clients reuse all supplier functionality
- Only difference is the filtering flag in queries
- Frontend pages are clones with renamed entities
- Backend services filter by appropriate flag

---

## Version 1.2.1 - Suppliers Frontend Implementation

### Added
- **Frontend Components**: Complete frontend implementation for Suppliers section
- Created `frontend/` directory structure within inventory module
- New pages:
  - `SuppliersPage.tsx` - Suppliers list with search, create, and delete
  - `SupplierDetailPage.tsx` - Supplier details with tabbed interface
- **Tabbed Interface** in SupplierDetailPage:
  - Details tab: Edit all supplier fields with validation
  - Addresses tab: Full CRUD for addresses array
  - Contacts tab: Full CRUD for contacts array
  - Articles tab: Manage part associations with supplier_code and currency
  - Purchase Orders tab: Placeholder (disabled)
- Modal dialogs for creating/editing addresses, contacts, and adding parts
- Validation: At least one checkbox (is_supplier, is_client, is_manufacturer) required
- Confirmation modals for delete operations

### Technical
- Self-contained module structure with frontend inside module folder
- Uses Mantine UI components
- React Router for navigation
- Centralized API service integration
- TypeScript interfaces for type safety

---

## Version 1.2.0 - Suppliers Section Implementation

### Added
- **Suppliers Section**: Complete CRUD implementation for suppliers management
- New API endpoints:
  - `GET /modules/inventory/api/suppliers` - List all suppliers with pagination and search
  - `GET /modules/inventory/api/suppliers/{supplier_id}` - Get specific supplier details
  - `POST /modules/inventory/api/suppliers` - Create new supplier
  - `PUT /modules/inventory/api/suppliers/{supplier_id}` - Update supplier
  - `DELETE /modules/inventory/api/suppliers/{supplier_id}` - Delete supplier
  - `GET /modules/inventory/api/suppliers/{supplier_id}/parts` - Get parts associated with supplier
  - `POST /modules/inventory/api/suppliers/{supplier_id}/parts` - Add part to supplier
  - `PUT /modules/inventory/api/suppliers/{supplier_id}/parts/{part_id}` - Update supplier part
  - `DELETE /modules/inventory/api/suppliers/{supplier_id}/parts/{part_id}` - Remove part from supplier

### Features
- **Supplier List Columns**: Name, Country, VAT (vatno), Created on (created_at)
- **Supplier Details Tabs**:
  - **Details**: Complete form with all fields (name, code, vatno, regno, payment_conditions, checkboxes)
  - **Addresses**: Manage addresses array (add/edit/delete) with fields: name, country, city, address, description, contact, email
  - **Contacts**: Manage contacts array (add/edit/delete) with fields: name, role, phone, email
  - **Articles**: Manage part associations with supplier_code and currency
  - **Purchase Orders**: Placeholder tab (disabled)
- **Validation**: At least one checkbox (is_supplier, is_client, is_manufacturer) must be selected
- **New Supplier**: Pre-checked is_supplier checkbox when creating new supplier
- **Search**: Search across name, code, vatno, regno fields

### Database Schema
Suppliers stored in `depo_companies` collection with fields:
- Basic info: name, code
- Flags: is_supplier, is_manufacturer, is_client
- Tax info: vatno, regno
- Business: payment_conditions
- Arrays: addresses[], contacts[]
- Metadata: created_at, created_by, updated_at, updated_by

### Parts Association
- Parts store supplier associations in `suppliers` array
- Each association contains: supplier_id, supplier_code, currency
- Managed through supplier details Articles tab

### Technical
- Proper validation for checkbox requirements
- Addresses stored in `addresses` array (not flat fields)
- Contacts stored in `contacts` array
- Service layer handles all business logic
- Proper ObjectId handling for all references

---

## Version 1.1.0 - Stocks Section Implementation

### Added
- **Stocks Section**: Complete implementation of stocks listing with enriched data
- New API endpoints:
  - `GET /modules/inventory/api/stocks` - List all stocks with pagination and search
  - `GET /modules/inventory/api/stocks/{stock_id}` - Get specific stock details
- Created `services.py` with business logic for stocks management
- Stock list includes the following columns:
  - Batch code
  - Batch date (received_date)
  - Product (part_id -> depo_parts with name and IPN)
  - Status
  - Location (location_id -> depo_locations)
  - Stock value (calculated from purchase order price)
  - Supplier (determined from purchase_order_id or build_order_id)

### Features
- **Supplier Detection Logic**:
  - If `build_order_id` exists: Supplier is organization name from config (slug='organizatie')
  - If `purchase_order_id` exists: Supplier is fetched from associated purchase order
  - Supports both procurement and internal production scenarios
- **Stock Value Calculation**: Automatically calculates stock value based on quantity and purchase price from purchase order
- **Enriched Data**: Each stock entry includes part details (name, IPN, UM) and location details
- **Search Functionality**: Search across batch codes, serial numbers, and notes
- **Pagination Support**: Configurable skip/limit parameters for large datasets

### Technical
- Uses MongoDB aggregation to enrich stock data with related information
- Proper ObjectId handling for all references
- Datetime serialization for batch dates
- Service layer architecture for clean separation of concerns

### Database Collections
- `depo_stocks` - Main stock records
- `depo_parts` - Part/article information (referenced)
- `depo_locations` - Storage locations (referenced)
- `depo_purchase_orders` - Purchase orders (referenced for supplier info)
- `depo_build_orders` - Build orders (referenced for internal production)
- `depo_companies` - Supplier information (referenced)
- `config` - Organization configuration (referenced)

---

## Version 1.0.0 - Initial Release

### Added
- Created inventory module structure with backend and frontend components
- Implemented Articles management:
  - List view with AJAX table, search, and sorting on all columns
  - Create new articles with fields: name, ipn, default_location, um, supplier, minimum_stock, default_expiry, and boolean flags
  - Edit articles with tabbed interface (Part Details tab active, Stock/Allocations/Attachments tabs placeholder)
  - Delete articles with Mantine confirmation modal
  - Full CRUD API endpoints for articles
- Added support for MongoDB collections:
  - depo_parts (articles)
  - depo_locations (storage locations)
  - depo_companies (suppliers/manufacturers)
  - depo_categories (part categories)
- Integrated with existing DataFlows Core authentication
- Added menu structure with submenu items: Articles, Stocks, Suppliers, Manufacturers, Clients
- Implemented rich text editor (WYSIWYG) for notes field in edit view
- Added keywords field with tag/label-style input
- All database fields from schema are editable in the Part Details tab

### Database Schema
Articles stored in `depo_parts` collection with fields:
- Basic info: id, name, ipn, um, description
- References: default_location_id, category_id, supplier_id
- Stock management: minimum_stock, default_expiry, selection_method
- Metadata: keywords, link, notes, files
- Flags: is_component, is_assembly, is_testable, is_salable, is_active
- Additional: storage_conditions, regulated, lotallexp

### Notes
- Stock, Allocations, and Attachments tabs are placeholders for future implementation
- Suppliers, Manufacturers, Clients, and Stocks menu items are disabled pending implementation
- Total Stock column in articles list is placeholder (will be calculated from stock data)
