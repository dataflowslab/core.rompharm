# DEPO Procurement Module

Version: 2.0.0

## Description

Procurement management module for DataFlows Core. Manages purchase orders, suppliers, and stock reception using MongoDB as the data source. All data is stored in MongoDB collections instead of InvenTree.

## Features

### Purchase Orders
- Create and manage purchase orders
- Auto-generated reference numbers (PO-NNNN format)
- Add/edit/delete line items
- Track received quantities
- Status management (Pending, Placed, Complete, Cancelled, Lost, Returned)
- File attachments support
- Search and filter capabilities

### Suppliers
- Create and manage suppliers in MongoDB
- Store supplier details (name, currency, tax ID, address, etc.)
- Custom fields support (cod, reg_code)

### Stock Reception
- Receive stock items against purchase orders
- Track batch codes, serial numbers, packaging
- Multiple status options (OK, Attention, Damaged, etc.)
- Link received stock to purchase orders

### Quality Control
- QC records tracking (placeholder for future implementation)

## Installation

Add module to `config.yaml`:
```yaml
modules:
  active:
    - depo_procurement
```

Restart the application to load the module.

## API Endpoints

### Suppliers
- `GET /modules/depo_procurement/api/suppliers` - List suppliers (supports search)
- `POST /modules/depo_procurement/api/suppliers` - Create new supplier

### Purchase Orders
- `GET /modules/depo_procurement/api/purchase-orders` - List all purchase orders (supports search)
- `GET /modules/depo_procurement/api/purchase-orders/{id}` - Get purchase order by ID
- `POST /modules/depo_procurement/api/purchase-orders` - Create new purchase order
- `PATCH /modules/depo_procurement/api/purchase-orders/{id}/status` - Update order status

### Line Items
- `GET /modules/depo_procurement/api/purchase-orders/{id}/items` - List order items
- `POST /modules/depo_procurement/api/purchase-orders/{id}/items` - Add item to order
- `PUT /modules/depo_procurement/api/purchase-orders/{id}/items/{index}` - Update item
- `DELETE /modules/depo_procurement/api/purchase-orders/{id}/items/{index}` - Delete item

### Stock Reception
- `POST /modules/depo_procurement/api/purchase-orders/{id}/receive-stock` - Receive stock
- `GET /modules/depo_procurement/api/purchase-orders/{id}/received-items` - List received items

### Attachments
- `GET /modules/depo_procurement/api/purchase-orders/{id}/attachments` - List attachments
- `POST /modules/depo_procurement/api/purchase-orders/{id}/attachments` - Upload attachment
- `DELETE /modules/depo_procurement/api/purchase-orders/{id}/attachments/{id}` - Delete attachment

### Supporting Data
- `GET /modules/depo_procurement/api/stock-locations` - Get storage locations
- `GET /modules/depo_procurement/api/parts` - Search parts (supports search)
- `GET /modules/depo_procurement/api/order-statuses` - Get available order statuses
- `GET /modules/depo_procurement/api/purchase-orders/{id}/qc-records` - Get QC records

## Database Schema

### depo_purchase_orders
```javascript
{
  "_id": ObjectId,
  "reference": "PO-0001",
  "supplier_id": ObjectId,
  "description": string,
  "supplier_reference": string,
  "currency": "EUR",
  "issue_date": string,
  "target_date": string,
  "destination_id": ObjectId,
  "notes": string,
  "status": "Pending|Placed|Complete|Cancelled|Lost|Returned",
  "items": [
    {
      "part_id": string,
      "quantity": number,
      "received": number,
      "purchase_price": number,
      "reference": string,
      "destination_id": string,
      "purchase_price_currency": string,
      "notes": string,
      "part_detail": {
        "name": string,
        "ipn": string,
        "um": string
      }
    }
  ],
  "line_items": number,  // Count of items with received > 0
  "lines": number,       // Total count of items
  "created_at": DateTime,
  "updated_at": DateTime,
  "created_by": string
}
```

### depo_stocks
```javascript
{
  "_id": ObjectId,
  "part_id": ObjectId,
  "location_id": ObjectId,
  "quantity": number,
  "batch_code": string,
  "serial_numbers": string,
  "packaging": string,
  "status": "OK|Attention|Damaged|...",
  "notes": string,
  "purchase_order_id": ObjectId,
  "purchase_order_reference": string,
  "supplier_id": ObjectId,
  "received_date": DateTime,
  "received_by": string,
  "created_at": DateTime
}
```

### depo_companies
```javascript
{
  "_id": ObjectId,
  "name": string,
  "is_supplier": boolean,
  "is_manufacturer": boolean,
  "currency": string,
  "tax_id": string,
  "cod": string,
  "reg_code": string,
  "address": string,
  "country": string,
  "city": string,
  "created_at": DateTime,
  "created_by": string
}
```

### depo_purchase_order_attachments
```javascript
{
  "_id": ObjectId,
  "order_id": ObjectId,
  "filename": string,
  "file_hash": string,
  "file_path": string,
  "content_type": string,
  "size": number,
  "comment": string,
  "created_at": DateTime,
  "created_by": string
}
```

## Requirements

- DataFlows Core >= 1.5.0
- MongoDB connection configured
- Collections: `depo_purchase_orders`, `depo_stocks`, `depo_companies`, `depo_parts`, `depo_locations`

## Architecture

The module is organized into:
- `routes.py` - FastAPI route definitions (lightweight)
- `services.py` - Business logic and database operations
- `config.json` - Module configuration

This separation keeps the codebase clean and maintainable.
