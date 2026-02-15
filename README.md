# DataFlows Core Rompharm

Enterprise Resource Planning system pentru gestionare producție, stocuri și aprovizionare.

## Instalare

### Cerințe
- Python 3.11+
- Node.js 18+
- MongoDB 6.0+

### Setup Inițial

#### 1. Backend Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Create config from sample
copy config\config_sample.yaml config.yaml

# Edit config.yaml and set:
# - identity_server: "localhost" (or "inventree")
# - MongoDB connection string
# - Secret key for JWT

# Initialize local authentication (if using localhost)
python init_local_auth.py

# Fix admin role (if needed)
python fix_admin_role.py

# Start server
python src/backend/app.py
```

**Default credentials** (localhost mode):
- Username: `admin`
- Password: `admin123`
- ⚠️ Change password after first login!

### Frontend Setup
```bash
cd src/frontend
npm install
npm run dev
```

### MongoDB Setup
```bash
# Start MongoDB
mongod --dbpath /path/to/data

# Import initial data (optional)
mongorestore --db dataflows_rompharm backups/latest/
```

## Arhitectură

### Backend (FastAPI)
```
src/backend/
├── app.py                 # Main application
├── routes/                # Core routes (auth, users)
├── models/                # Pydantic models
└── utils/                 # DB, config, helpers

modules/
├── inventory/             # Inventory management
├── requests/              # Stock requests & production
└── depo_procurement/      # Procurement & purchasing
```

### Frontend (React + TypeScript)
```
src/frontend/src/
├── components/            # React components
├── services/              # API services
├── context/               # React context
└── pages/                 # Page components
```

### Database (MongoDB)
```
Collections:
├── users                  # Users & authentication
├── depo_parts             # Parts/Articles
├── depo_stocks            # Stock master data
├── depo_stocks_movements  # Stock ledger (NEW)
├── depo_stocks_balances   # Stock balances cache (NEW)
├── depo_requests          # Stock requests
├── depo_production        # Production data
├── approval_flows         # Approval workflows
└── depo_requests_states   # Request states
```

## Inventory Ledger System

### Concept
Sistem de contabilitate double-entry pentru stocuri - toate mișcările sunt înregistrate în ledger append-only.

### Colecții

#### 1. depo_stocks (Master Data)
```javascript
{
  _id: ObjectId,
  part_id: ObjectId,
  batch_code: String,
  initial_quantity: Number,      // ⭐ Immutable - NU se modifică!
  initial_location_id: ObjectId,
  supplier: ObjectId,
  expiry_date: Date,
  purchase_price: Number,
  state_id: ObjectId,
  created_at: Date,
  created_by: String
}
```

#### 2. depo_stocks_movements (Ledger - Sursa Adevărului)
```javascript
{
  _id: ObjectId,
  stock_id: ObjectId,
  part_id: ObjectId,
  batch_code: String,
  movement_type: String,         // RECEIPT, CONSUMPTION, TRANSFER_OUT/IN, ADJUSTMENT, SCRAP
  quantity: Number,              // + sau -
  from_location_id: ObjectId,
  to_location_id: ObjectId,
  document_type: String,
  document_id: ObjectId,
  transfer_group_id: String,     // Pentru TRANSFER_OUT/IN
  created_at: Date,
  created_by: String,
  notes: String
}
```

#### 3. depo_stocks_balances (Snapshot - Cache)
```javascript
{
  _id: ObjectId,
  stock_id: ObjectId,
  location_id: ObjectId,
  quantity: Number,              // Cantitate curentă
  updated_at: Date
}
```

### Movement Types

| Type | Operator | Description | Use Case |
|------|----------|-------------|----------|
| RECEIPT | + | Primire marfă | Procurement, Production |
| CONSUMPTION | - | Consum | Production, Sales |
| TRANSFER_OUT | - | Ieșire din locație | Transfer între locații |
| TRANSFER_IN | + | Intrare în locație | Transfer între locații |
| ADJUSTMENT | +/- | Ajustare inventar | Inventory count |
| SCRAP | - | Casare | Deteriorare, expirare |

### API Endpoints

#### Stocks CRUD
```
GET    /modules/inventory/api/stocks              # List stocks
GET    /modules/inventory/api/stocks/{id}         # Get stock details
POST   /modules/inventory/api/stocks              # Create stock
PUT    /modules/inventory/api/stocks/{id}         # Update metadata
```

#### Stock Operations
```
POST   /modules/inventory/api/stocks/{id}/transfer    # Transfer între locații
POST   /modules/inventory/api/stocks/{id}/adjust      # Ajustare inventar
POST   /modules/inventory/api/stocks/{id}/consume     # Consum
GET    /modules/inventory/api/stocks/{id}/movements   # Istoric mișcări
GET    /modules/inventory/api/stocks/{id}/balance     # Balance pe locații
```

### Exemple Utilizare

#### Creare Stock
```python
from modules.inventory.services.stocks_service import create_stock

stock = await create_stock(
    db=db,
    part_id="693ea9fc71d731f72ad6542c",
    batch_code="BATCH-001",
    initial_quantity=100,
    location_id="693fb21371d731f72ad6544a",
    created_by="username",
    document_type="PURCHASE_ORDER",
    document_id="PO-123"
)
```

#### Transfer între Locații
```python
from modules.inventory.services.stocks_service import transfer_stock

await transfer_stock(
    db=db,
    stock_id="694829ba30c2736203fb6e2d",
    from_location_id="LOC-A",
    to_location_id="LOC-B",
    quantity=30,
    created_by="username",
    document_type="STOCK_TRANSFER"
)
```

#### Consum
```python
from modules.inventory.services.stocks_service import consume_stock

await consume_stock(
    db=db,
    stock_id="694829ba30c2736203fb6e2d",
    location_id="PRODUCTION",
    quantity=20,
    created_by="username",
    document_type="PRODUCTION_ORDER",
    document_id="PROD-789"
)
```

#### Query Balance
```python
from modules.inventory.stock_movements import get_stock_balance

# Balance pentru o locație
balance = get_stock_balance(db, stock_id, location_id)
# Returns: {stock_id, location_id, quantity, updated_at}

# Balance pentru toate locațiile
balance = get_stock_balance(db, stock_id)
# Returns: {stock_id, locations: [...], total_quantity}
```


## Sistem Generare Etichete (Produse, Stocuri, Locuri)

Sistemul de etichete genereaza PDF-uri cu QR prin DataFlows Docu, folosind date din MongoDB si template-uri predefinite.

### Backend
- Endpoint: `POST /modules/inventory/api/generate-labels-docu`
- Implementare: `modules/inventory/routes/labels.py`
- Config Docu: `config/config.yaml` -> `dataflows_docu`
- Payload:
```json
{
  "table": "depo_parts|depo_stocks|depo_locations",
  "items": [{"id": "<ObjectId>", "quantity": 1}]
}
```

### Template-uri Docu (coduri)
- `depo_parts` -> `VZ128YDOUWXZ`
- `depo_stocks` -> `Z4ZW2CN0A0VY`
- `depo_locations` -> `WOPS3UAKOVWH`

### Format QR (generat in backend)
- Produse (articles): `P{IPN}`
- Stocuri: `P{IPN}L{BATCH_CODE}`
- Locuri: `LOC{CODE}`

### Date trimise catre Docu (campuri principale)
Payload Docu per eticheta:
```json
{
  "template_code": "<CODE>",
  "data": {
    "data": {
      "barcode": "...",
      "barcode_str": "data:image/png;base64,...",
      "part_name": "...",
      "part_ipn": "...",
      "batch_code": "...",
      "expiry_date": "YYYY-MM-DD",
      "quantity": 0,
      "location_name": "...",
      "state_name": "...",
      "is_salable": true,
      "um": "",
      "storage_conditions": "",
      "purchase_price": "",
      "user_name": "...",
      "quant": 1,
      "crt_no": 1
    }
  },
  "format": "pdf",
  "filename": "labels-...-1",
  "options": {}
}
```
Generatorul trimite un job per eticheta (realtime) si apoi concateneaza PDF-urile intr-un singur fisier.

### Frontend (flux UI)
Componenta comuna: `src/frontend/src/components/Common/PrintLabelsModal.tsx`.

Integrari:
1. `src/frontend/src/pages/ArticlesPage.tsx` (selectie multipla -> Print Labels, table `depo_parts`)
2. `modules/inventory/frontend/pages/StocksPage.tsx` (selectie multipla -> Print Labels, table `depo_stocks`)
3. `src/frontend/src/pages/LocationsPage.tsx` (selectie multipla -> Print Labels, table `depo_locations`)
4. `src/frontend/src/components/Procurement/ReceivedStockTab.tsx` (selectie din receptii -> Print Labels, table `depo_stocks`)

### Observatii / Aliniere
- Endpointul `GET /modules/inventory/api/read-label` asteapta format `table:id---...`, dar QR-urile generate acum sunt `P...` / `LOC...`. Daca vrei scanare cu `read-label`, formatul trebuie aliniat.
- In `src/frontend/src/pages/MobileProcurementDetailPage.tsx` se folosesc endpointuri vechi (`/label-templates`, `/generate-labels`) care nu exista in prezent; trebuie migrat la `/generate-labels-docu` daca se doreste print pe mobil.


## Migrare la Ledger System

### Script Migrare
```bash
# Backup + migrare + indexuri + verificare
python migrate_stocks_to_ledger.py all

# Sau pas cu pas:
python migrate_stocks_to_ledger.py migrate   # Migrare date
python migrate_stocks_to_ledger.py indexes   # Creare indexuri
python migrate_stocks_to_ledger.py verify    # Verificare
```

### Ce Face Migrarea
1. **Backup** - Crează `depo_stocks_backup_YYYYMMDD_HHMMSS`
2. **Rename** - `quantity` → `initial_quantity`
3. **Add** - `initial_location_id`
4. **Create** - RECEIPT movement pentru fiecare stock
5. **Create** - Balance entry pentru fiecare stock
6. **Indexes** - Crează indexuri pentru performanță

### Verificare Post-Migrare
```javascript
// Verifică că nu mai există câmpul vechi
db.depo_stocks.count({quantity: {$exists: true}})  // Trebuie 0

// Verifică balances
db.depo_stocks_balances.aggregate([
  {$group: {_id: null, total: {$sum: "$quantity"}}}
])

// Verifică movements
db.depo_stocks_movements.count({movement_type: "RECEIPT"})
```

## Production Module

### Production Tab
- **Series Table** - Tree table cu serii și materiale
- **Used Qty Input** - Input pentru cantitate folosită per material
- **Unused Materials** - Calcul automat: `received - SUM(used)`
- **Decision Section** - Status select + comment
- **Signatures Section** - Approval flow cu semnături

### Production Data Structure
```javascript
{
  request_id: ObjectId,
  series: [
    {
      batch_code: "BATCH-001",
      materials: [
        {
          part: ObjectId,
          part_name: String,
          batch: String,
          received_qty: Number,
          used_qty: Number        // Input de la user
        }
      ]
    }
  ]
}
```

### Production Workflow
1. **Completare Series** - User completează `used_qty` pentru fiecare material
2. **Save** - Salvează în `depo_production.series`
3. **Select Status** - Alege status din `depo_requests_states` (scene: production)
4. **Save Decision** - Salvează în `status_log`
5. **Sign** - Semnează production flow
6. **Execute** - La completare flow:
   - Crează stock pentru produse finite (RECEIPT)
   - Consumă materiale (CONSUMPTION)
   - Actualizează balances

## Requests Module

### Request States
Stări definite în `depo_requests_states`:
- `workflow_level` - Nivel în workflow
- `order` - Ordine de afișare
- `scenes` - Array cu scene-uri unde apare (`operations`, `receive_stock`, `production`)
- `needs_comment` - Dacă necesită comentariu

### Status Log
Fiecare decizie se salvează în `status_log`:
```javascript
{
  status_id: ObjectId,
  scene: String,              // operations, receive_stock, production
  created_at: Date,
  created_by: String,
  reason: String              // Optional comment
}
```

### Approval Flows
- **Operations Flow** - Aprobare operațiuni warehouse
- **Reception Flow** - Aprobare recepție marfă
- **Production Flow** - Aprobare producție

Fiecare flow:
- `can_sign_officers` - Pot semna (optional)
- `must_sign_officers` - Trebuie să semneze (obligatoriu)
- `min_signatures` - Număr minim semnături
- Suportă role-based officers (`type: "role"`, `reference: "admin"`)

## Development

### Structură Modulară
```
modules/inventory/
├── routes_refactored.py       # Main router
├── stock_movements.py         # Ledger helper functions
├── routers/
│   ├── stocks_router.py       # Stocks endpoints
│   └── ...                    # Other routers (TODO)
├── services/
│   ├── common.py              # Helper functions
│   ├── stocks_service.py      # Stocks business logic
│   └── ...                    # Other services (TODO)
└── models/
    ├── stock_models.py        # Pydantic models
    └── ...                    # Other models (TODO)
```

### Helper Functions

#### serialize_doc()
```python
from modules.inventory.services.common import serialize_doc

# Convertește MongoDB doc → JSON
doc = serialize_doc(mongo_document)
```

#### validate_object_id()
```python
from modules.inventory.services.common import validate_object_id

# Validează și convertește string → ObjectId
oid = validate_object_id(id_string, "field_name")
```

#### paginate_results()
```python
from modules.inventory.services.common import paginate_results

# Query cu paginare și sortare
result = paginate_results(collection, query, skip, limit, sort_by, sort_order)
# Returns: {results: [...], total: N, skip: X, limit: Y}
```

### Testing

#### Unit Tests
```bash
pytest modules/inventory/tests/
pytest modules/requests/tests/
```

#### Integration Tests
```bash
# Test stocks API
curl -X POST http://localhost:8000/modules/inventory/api/stocks \
  -H "Content-Type: application/json" \
  -d '{"part_id": "...", "batch_code": "TEST-001", "initial_quantity": 100, "location_id": "..."}'

# Test transfer
curl -X POST http://localhost:8000/modules/inventory/api/stocks/{id}/transfer \
  -H "Content-Type: application/json" \
  -d '{"from_location_id": "...", "to_location_id": "...", "quantity": 30}'
```

## MongoDB Indexes

### Required Indexes
```javascript
// depo_stocks_movements
db.depo_stocks_movements.createIndex({stock_id: 1, created_at: -1});
db.depo_stocks_movements.createIndex({part_id: 1, batch_code: 1});
db.depo_stocks_movements.createIndex({transfer_group_id: 1});
db.depo_stocks_movements.createIndex({document_type: 1, document_id: 1});

// depo_stocks_balances
db.depo_stocks_balances.createIndex({stock_id: 1, location_id: 1}, {unique: true});
db.depo_stocks_balances.createIndex({location_id: 1, quantity: 1});
db.depo_stocks_balances.createIndex({stock_id: 1});
```

## Troubleshooting

### Balance nu se potrivește cu movements
```python
# Regenerează balances din ledger
from modules.inventory.stock_movements import regenerate_balances

count = regenerate_balances(db)
print(f"Regenerated {count} balances")
```

### Transfer incomplet
```python
# Verifică integritate transfer
from modules.inventory.stock_movements import verify_transfer_integrity

result = verify_transfer_integrity(db, "TRF-2025-0001")
if not result['valid']:
    print(f"Error: {result['error']}")
```

### ObjectId serialization errors
Toate ObjectId-urile trebuie convertite la string în API responses:
```python
# În routes
if isinstance(doc['_id'], ObjectId):
    doc['_id'] = str(doc['_id'])

# Sau folosește serialize_doc()
from modules.inventory.services.common import serialize_doc
return serialize_doc(doc)
```

## Performance

### Optimizări
1. **Use balances** pentru query-uri frecvente (nu agrega movements)
2. **Indexuri** pe toate câmpurile folosite în query-uri
3. **Limit** numărul de movements returnate (default 100)
4. **Cache** la nivel aplicație pentru stocuri frecvent accesate

### Monitoring
```javascript
// Verifică performanță agregări
db.depo_stocks_movements.explain("executionStats").aggregate([...])

// Verifică utilizare indexuri
db.depo_stocks_movements.getIndexes()
```

## Security

### Authentication
- JWT tokens pentru API
- Role-based access control (RBAC)
- Admin vs regular users

### Audit Trail
- Toate mișcările stoc sunt înregistrate cu `created_by`
- `status_log` păstrează istoric decizii
- `approval_flows` păstrează semnături cu hash

## Support

Pentru probleme sau întrebări:
1. Verifică CHANGELOG.md pentru modificări recente
2. Verifică logs: `tail -f logs/app.log`
3. Verifică MongoDB: `mongosh dataflows_rompharm`

## License

Proprietary - Rompharm Company
