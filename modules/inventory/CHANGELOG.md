# Changelog - Inventory Module

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
