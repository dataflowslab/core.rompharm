# Changelog - DEPO Procurement Module

## Version 2.0.1 - Stock Reception Enhancement

### Changed
- **Stock Reception**: Ensured that `purchase_order_id` is properly saved in `depo_stocks` collection when receiving goods
- The `purchase_order_id` field now stores the ObjectId from `depo_purchase_orders` collection
- This enables proper tracking of stock origin and supplier information

### Technical
- Modified `receive_stock_item` function to ensure `purchase_order_id` is saved as ObjectId
- Added `purchase_order_reference` field for easier reference lookup
- Stock records now properly linked to their source purchase orders

---

## Version 2.0.0 - MongoDB Migration

### Changed
- **Complete MongoDB Integration**: Removed all InvenTree dependencies
- All data now stored in MongoDB collections instead of InvenTree
- Purchase orders stored in `depo_purchase_orders` collection
- Stock items stored in `depo_stocks` collection
- Suppliers stored in `depo_companies` collection
- Attachments stored in `depo_purchase_order_attachments` collection
- Parts referenced from `depo_parts` collection
- Locations referenced from `depo_locations` collection

### Added
- **Service Layer Architecture**: Separated business logic into `services.py`
- Cleaner route definitions in `routes.py` (reduced from ~800 to ~400 lines)
- Better code organization and maintainability
- Auto-generated purchase order references (PO-NNNN format)
- Line items tracking with received quantities
- Status management (Pending, Placed, Complete, Cancelled, Lost, Returned)

### Removed
- InvenTree API integration
- InvenTree authentication requirements
- InvenTree-specific fields and logic
- Supplier part associations (no longer needed)
- InvenTree attachment API calls

### Technical
- Uses MongoDB ObjectId for all references
- Datetime serialization for JSON responses
- File attachments stored in `media/files` with hash-based naming
- Enriched responses with related data (supplier details, part details)

### Database Collections
- `depo_purchase_orders` - Purchase order documents
- `depo_stocks` - Stock reception records
- `depo_companies` - Supplier/manufacturer information
- `depo_purchase_order_attachments` - File attachments
- `depo_parts` - Parts/articles (read-only reference)
- `depo_locations` - Storage locations (read-only reference)

### Migration Notes
- Existing InvenTree data needs to be migrated to MongoDB
- Purchase order IDs changed from integers to ObjectId strings
- Item references changed from item_id to item_index (array position)
- Status values changed from integers to strings

---

## Version 1.0.0 - Initial Release

### Added
- Complete InvenTree procurement system integration
- Purchase order management with full CRUD operations
- Supplier management with custom fields (cod, reg_code, tax_id)
- Purchase order line items management
- File attachments with drag-and-drop upload
- Stock reception system with comprehensive fields
- Quality control system with LOTALLEXP separation
- Approval workflow integration (config-based)
- Document generation integration
- QR code generation for purchase orders
- Manager-based access control
- Auto-association of parts with suppliers

### Features
- Purchase order list with search and sorting
- Create/edit purchase orders with supplier selection
- Add/edit/delete line items
- Upload and manage attachments
- Receive stock with detailed form (batch codes, containers, transport info)
- Quality control with automatic LOTALLEXP handling
- Approval signatures with SHA256 hashing
- Document generation via DataFlows Docu
- Status management (Pending, Placed, Complete, etc.)
- Progress tracking for line items

### API Endpoints
- `/modules/depo_procurement/api/suppliers` - Supplier management
- `/modules/depo_procurement/api/purchase-orders` - Purchase order CRUD
- `/modules/depo_procurement/api/purchase-orders/{id}/items` - Line items management
- `/modules/depo_procurement/api/purchase-orders/{id}/attachments` - File attachments
- `/modules/depo_procurement/api/purchase-orders/{id}/receive-stock` - Stock reception
- `/modules/depo_procurement/api/purchase-orders/{id}/approval-flow` - Approval workflow
- `/modules/depo_procurement/api/stock-locations` - Stock locations
- `/modules/depo_procurement/api/parts` - Purchaseable parts

### Database Collections
- Uses InvenTree database for purchase orders, suppliers, and stock
- MongoDB collections:
  - `depo_procurement_containers` - Container information
  - `depo_procurement_stock_metadata` - Transport and delivery metadata
  - `approval_flows` - Approval signatures
  - `generated_documents` - Document generation tracking

### Integration
- InvenTree 1.0.1 Purchase Order API
- InvenTree Company API
- InvenTree Stock API
- InvenTree Attachment API
- DataFlowsDepoCompanies plugin for custom fields
- DataFlowsDepoStocks plugin for stock custom fields
- DataFlows Docu for document generation

### Notes
- All purchase order data stored in InvenTree
- Custom fields managed via InvenTree plugins
- Approval flow uses config-based system
- Document generation is asynchronous
- QR codes generated as SVG format
- Manager users have full access to all orders
