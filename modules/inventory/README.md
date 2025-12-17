# Inventory Module

Version: 1.4.0

## Description

Comprehensive inventory management module for DataFlows Core. Manages articles (parts), stocks, and suppliers from MongoDB collections with complete CRUD operations, search, and advanced features.

Self-contained module with both backend (Python/FastAPI) and frontend (React/TypeScript) components.

## Features

### Articles Management (Active)
- List all articles with AJAX table
- Search across name, IPN, and description
- Sort by any column (ascending/descending)
- Create new articles with logical field order
- Edit articles with tabbed interface (Part Details, Stock, Allocations, Attachments)
- Delete articles with confirmation modal
- Rich text editor (WYSIWYG) for notes field
- Tag-style keywords input
- Status badges (Active/Inactive)

### Stocks Management (Active)
- List all stock entries with enriched data
- Display: Batch code, Batch date, Product (name + IPN), Status, Location, Stock value, Supplier
- Automatic supplier detection (from purchase orders or build orders)
- Stock value calculation from purchase order prices
- Search across batch codes, serial numbers, and notes
- Pagination support

### Suppliers Management (Active)
- List suppliers (companies with is_supplier=true)
- Display columns: Name, Country, VAT, Created on
- Create/edit/delete suppliers
- Validation: At least one checkbox (is_supplier, is_client, is_manufacturer) required
- Supplier details with tabs:
  - **Details**: Complete form (name, code, vatno, regno, payment_conditions, checkboxes)
  - **Addresses**: Manage addresses array (name, country, city, address, description, contact, email)
  - **Contacts**: Manage contacts array (name, role, phone, email)
  - **Articles**: Manage part associations (supplier_code, currency)
  - **Purchase Orders**: Placeholder (coming soon)
- Search across name, code, vatno, regno

### Manufacturers Management (Active)
- List manufacturers (companies with is_manufacturer=true)
- Same structure and features as Suppliers
- Display columns: Name, Country, VAT, Created on
- Create/edit/delete manufacturers
- Manufacturer details with 5 tabs (Details, Addresses, Contacts, Articles, Purchase Orders)
- Search across name, code, vatno, regno

### Clients Management (Active)
- List clients (companies with is_client=true)
- Same structure and features as Suppliers
- Display columns: Name, Country, VAT, Created on
- Create/edit/delete clients
- Client details with 5 tabs (Details, Addresses, Contacts, Articles, Purchase Orders)
- Search across name, code, vatno, regno

### Notes
- Companies can be suppliers, manufacturers, clients, or any combination
- All three sections use the same `depo_companies` collection
- Filtering by `is_supplier`, `is_manufacturer`, or `is_client` flags

## Module Structure

```
inventory/
├── frontend/                   # Frontend components
│   ├── pages/                 # Page components
│   │   ├── SuppliersPage.tsx
│   │   ├── SupplierDetailPage.tsx
│   │   └── index.ts
│   ├── components/            # Reusable components (future)
│   └── README.md
├── routes.py                  # FastAPI routes
├── services.py                # Business logic
├── config.json                # Module configuration
├── CHANGELOG.md               # Version history
└── README.md                  # This file
```

## Installation

Add module to `config.yaml`:
```yaml
modules:
  active:
    - inventory
```

Import frontend pages in your main App routing:
```typescript
import { SuppliersPage, SupplierDetailPage } from './modules/inventory/frontend/pages';

// Add routes:
<Route path="/inventory/suppliers" element={<SuppliersPage />} />
<Route path="/inventory/suppliers/:id" element={<SupplierDetailPage />} />
```

Restart the application to load the module.

## API Endpoints

### Articles
- `GET /modules/inventory/api/articles` - List articles (supports search, pagination, sorting)
- `GET /modules/inventory/api/articles/{id}` - Get article by ID
- `POST /modules/inventory/api/articles` - Create new article
- `PUT /modules/inventory/api/articles/{id}` - Update article
- `DELETE /modules/inventory/api/articles/{id}` - Delete article
- `GET /modules/inventory/api/articles/{id}/recipes` - Get recipes using this article

### Stocks
- `GET /modules/inventory/api/stocks` - List stocks (supports search, pagination)
- `GET /modules/inventory/api/stocks/{id}` - Get stock by ID

### Suppliers
- `GET /modules/inventory/api/suppliers` - List suppliers (supports search, pagination)
- `GET /modules/inventory/api/suppliers/{id}` - Get supplier by ID
- `POST /modules/inventory/api/suppliers` - Create new supplier
- `PUT /modules/inventory/api/suppliers/{id}` - Update supplier
- `DELETE /modules/inventory/api/suppliers/{id}` - Delete supplier
- `GET /modules/inventory/api/suppliers/{id}/parts` - Get parts associated with supplier
- `POST /modules/inventory/api/suppliers/{id}/parts` - Add part to supplier
- `PUT /modules/inventory/api/suppliers/{id}/parts/{part_id}` - Update supplier part
- `DELETE /modules/inventory/api/suppliers/{id}/parts/{part_id}` - Remove part from supplier

### Supporting Data
- `GET /modules/inventory/api/locations` - Get storage locations from `depo_locations`
- `GET /modules/inventory/api/companies` - Get companies from `depo_companies` (filter by `is_supplier`)
- `GET /modules/inventory/api/categories` - Get categories from `depo_categories`

## Database Schema

### Articles (`depo_parts` collection)

```javascript
{
  "_id": ObjectId,
  "name": string,              // Article name
  "ipn": string,               // Internal Part Number (code)
  "um": string,                // Unit of measure (buc, kg, L, etc.)
  "description": string,       // Short description
  "notes": string,             // HTML content from WYSIWYG editor
  "keywords": [string],        // Array of keywords/tags
  "link": string,              // External link
  "default_location_id": ObjectId,  // Reference to depo_locations
  "category_id": ObjectId,     // Reference to depo_categories
  "supplier_id": ObjectId,     // Reference to depo_companies
  "minimum_stock": number,     // Minimum stock level
  "default_expiry": number,    // Default expiry in days
  "selection_method": string,  // FIFO, LIFO, or FEFO
  "storage_conditions": string,
  "is_component": boolean,
  "is_assembly": boolean,
  "is_testable": boolean,
  "is_salable": boolean,
  "is_active": boolean,
  "regulated": boolean,
  "lotallexp": boolean,
  "files": [],
  "suppliers": [               // Supplier associations
    {
      "supplier_id": string,   // Reference to depo_companies
      "supplier_code": string, // Supplier's code for this part
      "currency": string       // Currency (EUR, USD, etc.)
    }
  ]
}
```

### Stocks (`depo_stocks` collection)

```javascript
{
  "_id": ObjectId,
  "part_id": ObjectId,         // Reference to depo_parts
  "location_id": ObjectId,     // Reference to depo_locations
  "quantity": number,
  "batch_code": string,
  "serial_numbers": string,
  "packaging": string,
  "status": string,            // OK, Quarantine, etc.
  "notes": string,
  "purchase_order_id": ObjectId,  // Reference to depo_purchase_orders
  "build_order_id": ObjectId,     // Reference to depo_build_orders
  "purchase_order_reference": string,
  "supplier_id": ObjectId,     // Reference to depo_companies
  "received_date": datetime,
  "received_by": string,
  "created_at": datetime
}
```

### Suppliers (`depo_companies` collection)

```javascript
{
  "_id": ObjectId,
  "name": string,
  "code": string,
  "is_supplier": boolean,
  "is_manufacturer": boolean,
  "is_client": boolean,
  "vatno": string,             // VAT number
  "regno": string,             // Registration number
  "payment_conditions": string,
  "addresses": [
    {
      "name": string,          // Address name (HQ, Warehouse, etc.)
      "country": string,
      "city": string,
      "address": string,
      "description": string,
      "contact": string,
      "email": string
    }
  ],
  "contacts": [
    {
      "name": string,
      "role": string,
      "phone": string,
      "email": string
    }
  ],
  "created_at": datetime,
  "created_by": string,
  "updated_at": datetime,
  "updated_by": string
}
```

## Requirements

- InvenTree >= 1.0.1 (for reference documentation)
- DataFlows Core >= 1.5.0
- MongoDB connection configured
- Collections: `depo_parts`, `depo_locations`, `depo_companies`, `depo_categories`

## Menu Structure

- **Inventory** (parent menu)
  - Articles (active)
  - Stocks (active)
  - Suppliers (active)
  - Manufacturers (active)
  - Clients (active)
