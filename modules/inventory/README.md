# Inventory Module

Modul pentru gestionarea inventarului: articole, stocuri, locații, furnizori.

## Structură

```
modules/inventory/
├── routers/                    # Routere modulare
│   ├── articles_router.py     # Articles/Parts CRUD
│   ├── locations_router.py    # Locations management
│   ├── categories_router.py   # Categories management
│   ├── stocks_router.py       # Stocks with ledger system
│   └── suppliers_router.py    # Suppliers/Manufacturers/Clients
├── services/                   # Business logic
│   ├── common.py              # Shared utilities
│   ├── stocks_service.py      # Stocks operations
│   └── ...
├── models/                     # Pydantic models
│   └── stock_models.py        # Stock request/response models
├── routes_new.py              # Main router (combines all)
├── routes.py                  # Legacy (to be replaced)
└── README.md                  # This file
```

## Endpoints

### Articles (`/articles`)
- `GET /articles` - List articles with pagination
- `GET /articles/{id}` - Get article details
- `POST /articles` - Create article
- `PUT /articles/{id}` - Update article
- `DELETE /articles/{id}` - Delete article
- `GET /articles/{id}/suppliers` - Get article suppliers
- `GET /articles/{id}/recipes` - Get recipes using article
- `GET /articles/{id}/stock-calculations` - Calculate stock metrics
- `GET /articles/{id}/allocations` - Get allocations

### Locations (`/locations`)
- `GET /locations` - List locations (hierarchical)
- `POST /locations` - Create location
- `PUT /locations/{id}` - Update location
- `DELETE /locations/{id}` - Delete location (if empty)

### Categories (`/categories`)
- `GET /categories` - List categories (hierarchical)
- `POST /categories` - Create category
- `PUT /categories/{id}` - Update category
- `DELETE /categories/{id}` - Delete category (if empty)

### Stocks (`/stocks`)
- `GET /stocks` - List stocks with balances
- `GET /stocks/{id}` - Get stock details
- `POST /stocks` - Create stock (with ledger)
- `PUT /stocks/{id}` - Update stock metadata
- `POST /stocks/{id}/transfer` - Transfer between locations
- `POST /stocks/{id}/adjust` - Inventory adjustment
- `POST /stocks/{id}/consume` - Consume stock
- `GET /stocks/{id}/movements` - Movement history
- `GET /stocks/{id}/balance` - Current balance

### Suppliers (`/suppliers`, `/manufacturers`, `/clients`)
- `GET /suppliers` - List suppliers
- `GET /suppliers/{id}` - Get supplier details
- `POST /suppliers` - Create supplier
- `PUT /suppliers/{id}` - Update supplier
- `DELETE /suppliers/{id}` - Delete supplier

## Features

### Ledger System
Stocks folosesc un sistem de ledger pentru tracking complet:
- **Stock Master**: Cantitate inițială (niciodată modificată)
- **Movements**: Toate mișcările (RECEIPT, TRANSFER, ADJUSTMENT, CONSUMPTION)
- **Balances**: Cantități curente pe locații (calculate din movements)

### Hierarchical Data
- **Locations**: Suport pentru ierarhie (parent-child)
- **Categories**: Suport pentru ierarhie (parent-child)
- Validare pentru referințe circulare

### Data Enrichment
- Articles cu detalii despre UM, Category, Manufacturer
- Stocks cu balances și movement history
- Suppliers cu addresses și contacts

## Migration

Pentru a trece de la `routes.py` la `routes_new.py`:

1. În `src/backend/app.py`, înlocuiește:
```python
# OLD
from modules.inventory import routes as inventory_routes
app.include_router(inventory_routes.router)

# NEW
from modules.inventory import routes_new as inventory_routes
app.include_router(inventory_routes.router)
```

2. Testează toate endpoint-urile
3. Șterge `routes.py` după confirmare

## Development

### Adding New Endpoints
1. Adaugă în router-ul corespunzător (`routers/`)
2. Adaugă business logic în `services/`
3. Adaugă modele Pydantic în `models/` dacă e necesar

### Common Utilities
Folosește funcțiile din `services/common.py`:
- `serialize_doc()` - Conversie MongoDB → JSON
- `validate_object_id()` - Validare ObjectId
- `build_search_query()` - Query builder
- `paginate_results()` - Paginare

## Database Collections

- `depo_parts` - Articles/Parts
- `depo_stocks` - Stock master records
- `depo_stocks_balances` - Current balances per location
- `depo_stocks_movements` - All stock movements (ledger)
- `depo_stocks_states` - Stock states (Quarantine, Available, etc.)
- `depo_locations` - Storage locations
- `depo_categories` - Article categories
- `depo_companies` - Suppliers/Manufacturers/Clients
- `depo_parts_suppliers` - Article-Supplier relationships
- `depo_ums` - Units of measure
