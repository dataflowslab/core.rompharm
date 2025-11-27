# DEPO Procurement Module

InvenTree procurement integration module for DataFlows Core.

## Version
1.0.0

## Description
Complete procurement management system integrated with InvenTree 1.0.1+. Provides purchase order management, supplier management, stock reception, and full integration with InvenTree's procurement workflow.

## Features

### Purchase Orders
- Create and manage purchase orders
- Link orders to suppliers
- Track order status (Pending, Placed, Complete, Cancelled, etc.)
- Add line items with parts, quantities, and prices
- Automatic supplier-part association
- Order attachments with file upload
- Stock reception workflow

### Suppliers
- List and search suppliers from InvenTree
- Create new suppliers with custom fields
- Integration with dataflows-depo-companies plugin
- Custom fields: cod, reg_code, tax_id
- Address management

### Stock Reception
- Receive stock items against purchase orders
- Batch code tracking
- Serial number management
- Packaging information
- Stock status selection
- Location assignment

### Components
- **DetailsTab**: Order details with DatePickers and Select components
- **ApprovalsTab**: Order status management
- **ReceivedStockTab**: Complete stock reception interface
- **ItemsTab**: Line items management with search and sort
- **AttachmentsTab**: File upload and management

## API Endpoints

All endpoints are prefixed with `/modules/depo_procurement/api`

### Suppliers
- `GET /suppliers` - List suppliers
- `POST /suppliers` - Create supplier

### Purchase Orders
- `GET /purchase-orders` - List purchase orders
- `GET /purchase-orders/{id}` - Get order details
- `POST /purchase-orders` - Create purchase order
- `PATCH /purchase-orders/{id}/status` - Update order status

### Line Items
- `GET /purchase-orders/{id}/items` - List order items
- `POST /purchase-orders/{id}/items` - Add item (with auto-association)
- `PUT /purchase-orders/{id}/items/{item_id}` - Update item
- `DELETE /purchase-orders/{id}/items/{item_id}` - Delete item

### Stock Reception
- `POST /purchase-orders/{id}/receive-stock` - Receive stock
- `GET /purchase-orders/{id}/received-items` - List received items

### Attachments
- `GET /purchase-orders/{id}/attachments` - List attachments
- `POST /purchase-orders/{id}/attachments` - Upload file
- `DELETE /purchase-orders/{id}/attachments/{id}` - Delete attachment

### Utilities
- `GET /parts` - List purchaseable parts
- `GET /stock-locations` - List stock locations
- `GET /order-statuses` - Get available order statuses

## Requirements

### InvenTree
- Version: >= 1.0.1
- Required plugins:
  - dataflows-depo-companies (for custom fields)

### DataFlows Core
- Version: >= 1.5.0

## Installation

1. Copy module to `src/backend/modules/depo_procurement/`
2. Add to `config.yaml`:
```yaml
modules:
  active:
    - depo_procurement
```
3. Restart application

## Configuration

Module configuration is stored in `config.json`:
- API prefix: `/modules/depo_procurement/api`
- Menu item: "Procurement" (order: 50)
- Required permissions: admin

## Auto-Association Feature

When adding a part to a purchase order, if the part is not associated with the supplier, the module automatically creates the association with a generated SKU: `SUP-{supplier_id}-{part_id}`

This prevents "Supplier must match purchase order" errors and provides seamless user experience.

## Dependencies

- FastAPI
- Pydantic
- requests
- PyYAML

## Author
DataFlows

## License
Proprietary
