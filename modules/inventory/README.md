# Inventory Module

Version: 1.0.0

## Description

Inventory management module for DataFlows Core. Manages articles (parts) from MongoDB `depo_parts` collection with complete CRUD operations, search, and sorting capabilities.

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

### Coming Soon
- Stock Management - Track stock levels and movements
- Suppliers - Manage supplier information
- Manufacturers - Manage manufacturer data
- Clients - Client management

## Installation

Add module to `config.yaml`:
```yaml
modules:
  active:
    - inventory
```

Restart the application to load the module.

## API Endpoints

### Articles
- `GET /modules/inventory/api/articles` - List articles (supports search, pagination, sorting)
- `GET /modules/inventory/api/articles/{id}` - Get article by ID
- `POST /modules/inventory/api/articles` - Create new article
- `PUT /modules/inventory/api/articles/{id}` - Update article
- `DELETE /modules/inventory/api/articles/{id}` - Delete article

### Supporting Data
- `GET /modules/inventory/api/locations` - Get storage locations from `depo_locations`
- `GET /modules/inventory/api/companies` - Get companies from `depo_companies` (filter by `is_supplier`)
- `GET /modules/inventory/api/categories` - Get categories from `depo_categories`

## Database Schema

Articles are stored in MongoDB `depo_parts` collection:

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
  "files": []
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
  - Stocks (disabled - coming soon)
  - Suppliers (disabled - coming soon)
  - Manufacturers (disabled - coming soon)
  - Clients (disabled - coming soon)
