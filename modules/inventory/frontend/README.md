# Inventory Module - Frontend

Frontend components for the Inventory module.

## Structure

```
frontend/
├── pages/
│   ├── SuppliersPage.tsx          # Suppliers list page
│   ├── SupplierDetailPage.tsx     # Supplier details with tabs
│   └── index.ts                   # Exports
├── components/                     # Reusable components (future)
└── README.md
```

## Pages

### SuppliersPage
- List all suppliers (companies with is_supplier=true)
- Columns: Name, Country, VAT, Created on
- Search functionality
- Create new supplier modal
- Delete supplier with confirmation
- Navigate to supplier details

### SupplierDetailPage
- Tabbed interface with 5 tabs:
  - **Details**: Edit supplier information (name, code, vatno, regno, payment_conditions, checkboxes)
  - **Addresses**: Manage addresses array (add/edit/delete)
  - **Contacts**: Manage contacts array (add/edit/delete)
  - **Articles**: Manage part associations (add/remove parts with supplier_code and currency)
  - **Purchase Orders**: Placeholder (disabled)

## Usage

Import pages in your main App routing:

```typescript
import { SuppliersPage, SupplierDetailPage } from './modules/inventory/frontend/pages';

// In your routes:
<Route path="/inventory/suppliers" element={<SuppliersPage />} />
<Route path="/inventory/suppliers/:id" element={<SupplierDetailPage />} />
```

## Dependencies

- @mantine/core
- @mantine/hooks
- @mantine/notifications
- @mantine/modals
- @tabler/icons-react
- react-router-dom

## API Integration

All pages use the centralized API service from `src/frontend/src/services/api`.

Endpoints used:
- `GET /modules/inventory/api/suppliers`
- `GET /modules/inventory/api/suppliers/:id`
- `POST /modules/inventory/api/suppliers`
- `PUT /modules/inventory/api/suppliers/:id`
- `DELETE /modules/inventory/api/suppliers/:id`
- `GET /modules/inventory/api/suppliers/:id/parts`
- `POST /modules/inventory/api/suppliers/:id/parts`
- `DELETE /modules/inventory/api/suppliers/:id/parts/:part_id`
- `GET /modules/inventory/api/articles`
