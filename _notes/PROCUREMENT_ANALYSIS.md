# Procurement System - Complete Analysis

## 📋 Overview

Sistemul de procurement gestionează comenzi de achiziție (Purchase Orders) cu workflow complet: creare → aprobare → recepție → control calitate.

---

## 🗂️ Structure

### Frontend
```
src/frontend/src/
├── pages/
│   ├── ProcurementPage.tsx           # Lista comenzi
│   └── ProcurementDetailPage.tsx     # Detalii comandă (tabs)
└── components/Procurement/
    ├── DetailsTab.tsx                # Detalii comandă + documente
    ├── ApprovalsTab.tsx              # Flux aprobare + semnături
    ├── ItemsTab.tsx                  # Articole comandă
    ├── ReceivedStockTab.tsx          # Recepție stoc
    ├── QualityControlTab.tsx         # Control calitate
    └── AttachmentsTab.tsx            # Atașamente
```

### Backend
```
modules/depo_procurement/
├── routes.py                         # API endpoints
├── services.py                       # Business logic
└── models.py                         # Pydantic models
```

### Database Collections
- `depo_purchase_orders` - Comenzi
- `depo_purchase_orders_items` - Articole comandă
- `depo_purchase_orders_states` - Statusuri (Pending, Issued, Processing, Finished, Refused, Canceled)
- `depo_stocks` - Stocuri receptionate
- `depo_procurement_qc` - Înregistrări control calitate
- `depo_procurement_documents` - Documente generate
- `approval_flows` - Fluxuri aprobare
- `approval_templates` - Template-uri aprobare

---

## 🔄 Workflow

### 1. Creare Comandă (ProcurementPage)
**Status**: `Pending`

**Câmpuri obligatorii**:
- `supplier_id` - Furnizor (ObjectId)
- `issue_date` - Data emiterii

**Câmpuri opționale**:
- `reference` - Referință (auto-generată dacă lipsește)
- `description` - Descriere
- `supplier_reference` - Referință furnizor
- `currency` - Monedă (default: EUR)
- `target_date` - Data țintă
- `destination_id` - Locație destinație
- `notes` - Note

**Endpoint**: `POST /modules/depo_procurement/api/purchase-orders`

**Navigare**: După creare → `/procurement/{order_id}`

---

### 2. Detalii Comandă (ProcurementDetailPage)

#### Tab: Details
- Editare câmpuri comandă
- Generare documente (DocumentManager)
- **Editabil**: Doar dacă `status = Pending` și fără semnături

#### Tab: Approvals
- Creare flux aprobare (auto sau manual)
- Semnare comandă
- Vizualizare semnături
- **După semnare**: Status → `Processing`

#### Tab: Items
- Adăugare/editare/ștergere articole
- Câmpuri articol:
  - `part_id` - Articol (ObjectId)
  - `quantity` - Cantitate
  - `purchase_price` - Preț achiziție
  - `purchase_price_currency` - Monedă preț
  - `destination_id` - Locație destinație (opțional)
  - `reference` - Referință (opțional)
  - `notes` - Note (opțional)
- **Editabil**: Doar dacă `status = Pending` și fără semnături

#### Tab: Receive Stock
- **Vizibil**: Doar după semnare (când există `approval_flow.signatures`)
- Recepție stoc pentru articolele comandate
- Câmpuri recepție:
  - `line_item_id` - Articol comandă
  - `quantity` - Cantitate recepționată
  - `batch_code` - Cod lot
  - `expiry_date` - Data expirare
  - `packaging` - Ambalaj
  - `status_id` - Status stoc (ObjectId din `depo_stocks_states`)
  - `location_id` - Locație stocare
  - `notes` - Note
- **Endpoint**: `POST /modules/depo_procurement/api/purchase-orders/{order_id}/receive-stock`

#### Tab: Quality Control
- **Vizibil**: Doar după semnare
- Înregistrări control calitate pentru stocurile receptionate
- Câmpuri QC:
  - `stock_item_id` - Stoc recepționat
  - `qc_date` - Data control
  - `qc_result` - Rezultat (Pass/Fail)
  - `qc_notes` - Observații
  - `qc_user` - Utilizator control
- **Endpoint**: `POST /modules/depo_procurement/api/purchase-orders/{order_id}/qc-records`

#### Tab: Attachments
- Upload/download/delete atașamente
- **Editabil**: Întotdeauna (chiar și după semnare)

---

## 🔐 Permissions & Edit Logic

### canEdit() Function
```typescript
const canEdit = () => {
  // 1. Dacă status != "Pending" → CANNOT EDIT
  if (order.status !== 'Pending') return false;
  
  // 2. Admin → CAN EDIT (oricând în Pending)
  if (isAdmin) return true;
  
  // 3. Dacă există semnături → CANNOT EDIT
  if (approvalFlow?.signatures?.length > 0) return false;
  
  // 4. Altfel → CAN EDIT
  return true;
};
```

### Tabs Visibility
- **Details, Approvals, Items, Attachments**: Întotdeauna vizibile
- **Receive Stock, Quality Control**: Doar când `order.status` este `Processing` sau `Finished` (după aprobare)

---

## 📡 API Endpoints

### Purchase Orders
```
GET    /modules/depo_procurement/api/purchase-orders
GET    /modules/depo_procurement/api/purchase-orders/{order_id}
POST   /modules/depo_procurement/api/purchase-orders
PATCH  /modules/depo_procurement/api/purchase-orders/{order_id}
PATCH  /modules/depo_procurement/api/purchase-orders/{order_id}/state
PATCH  /modules/depo_procurement/api/purchase-orders/{order_id}/documents
```

### Items
```
GET    /modules/depo_procurement/api/purchase-orders/{order_id}/items
POST   /modules/depo_procurement/api/purchase-orders/{order_id}/items
PUT    /modules/depo_procurement/api/purchase-orders/{order_id}/items/{item_id}
DELETE /modules/depo_procurement/api/purchase-orders/{order_id}/items/{item_id}
```

### Stock Reception
```
POST   /modules/depo_procurement/api/purchase-orders/{order_id}/receive-stock
GET    /modules/depo_procurement/api/purchase-orders/{order_id}/received-items
```

### Quality Control
```
GET    /modules/depo_procurement/api/purchase-orders/{order_id}/qc-records
POST   /modules/depo_procurement/api/purchase-orders/{order_id}/qc-records
PATCH  /modules/depo_procurement/api/purchase-orders/{order_id}/qc-records/{qc_id}
```

### Approvals
```
GET    /modules/depo_procurement/api/purchase-orders/{order_id}/approval-flow
POST   /modules/depo_procurement/api/purchase-orders/{order_id}/approval-flow
POST   /modules/depo_procurement/api/purchase-orders/{order_id}/sign
DELETE /modules/depo_procurement/api/purchase-orders/{order_id}/signatures/{user_id}
```

### Attachments
```
GET    /modules/depo_procurement/api/purchase-orders/{order_id}/attachments
POST   /modules/depo_procurement/api/purchase-orders/{order_id}/attachments
DELETE /modules/depo_procurement/api/purchase-orders/{order_id}/attachments/{attachment_id}
```

### Supporting Data
```
GET    /modules/depo_procurement/api/parts
GET    /modules/depo_procurement/api/order-statuses
GET    /modules/depo_procurement/api/stock-statuses
GET    /modules/depo_procurement/api/document-templates
```

---

## ✅ FIXED ISSUES

### 1. ✅ FIXED: Approval Flow Filtering
**Issue**: Toate comenzile vedeau același approval flow (primul găsit în DB)

**Root Cause**: Query-ul pentru `approval_flows` nu filtra corect după `object_id`:
```python
# ❌ GREȘIT
flow = db.approval_flows.find_one({
    "object_type": "procurement_order",
    "object_id": order_id  # order_id e string, dar în DB e ObjectId!
})
```

**Fix Applied**: Convertire `order_id` la ObjectId în toate query-urile:
```python
# ✅ CORECT
flow = db.approval_flows.find_one({
    "object_type": "procurement_order",
    "object_id": ObjectId(order_id)  # Conversie la ObjectId
})
```

**Endpoints Fixed**:
- `GET /purchase-orders/{order_id}/approval-flow`
- `POST /purchase-orders/{order_id}/approval-flow`
- `POST /purchase-orders/{order_id}/sign`
- `DELETE /purchase-orders/{order_id}/signatures/{user_id}`

### 2. ✅ FIXED: Tab Visibility Logic
**Issue**: Tab-urile Receive Stock și Quality Control apăreau doar dacă existau semnături, nu după status

**Old Logic** (GREȘIT):
```typescript
{approvalFlow && approvalFlow.signatures && approvalFlow.signatures.length > 0 && (
  <Tabs.Tab value="receive-stock">...</Tabs.Tab>
)}
```

**New Logic** (CORECT):
```typescript
{order.status && ['Processing', 'Finished'].includes(order.status) && (
  <Tabs.Tab value="receive-stock">...</Tabs.Tab>
)}
```

**Reason**: Tab-urile trebuie să apară când comanda este aprobată (status = Processing), nu doar când există semnături.

### 3. ✅ FIXED: ApprovalsTab Order ID Mismatch
**Issue**: Approval flow exista în DB dar nu apărea în interfață (mesaj "No Approval Flow")

**Root Cause**: `ApprovalsTab` se aștepta la `order.pk` (number), dar primea `order._id` (string) de la `ProcurementDetailPage`
```typescript
// ❌ GREȘIT - ApprovalsTab interface
interface PurchaseOrder {
  pk: number;  // Dar primea _id: string!
}

// Folosea order.pk care era undefined
const response = await api.get(`${procurementApi.getPurchaseOrder(order.pk)}/approval-flow`);
// URL devenea: /purchase-orders/undefined/approval-flow
```

**Fix Applied**: Suport pentru ambele formate (_id și pk):
```typescript
// ✅ CORECT
interface PurchaseOrder {
  _id?: string;
  pk?: number;
  status: number | string;
}

// Folosește _id sau pk (oricare există)
const orderId = order._id || order.pk;
const response = await api.get(`${procurementApi.getPurchaseOrder(orderId!)}/approval-flow`);
```

**Impact**: Acum approval flow-ul se încarcă corect pentru toate comenzile.

---

## 🐛 Known Issues & Debugging Areas

### 1. Status Management
**Issue**: Status poate fi inconsistent între `status` (string) și `status_id` (ObjectId)

**Check**:
- `depo_purchase_orders.status` - Ar trebui să fie string name (e.g., "Pending")
- `depo_purchase_orders.status_id` - Ar trebui să fie ObjectId din `depo_purchase_orders_states`
- `depo_purchase_orders_states` - Collection cu statusuri (name, value, color)

**Fix**: Asigură-te că backend returnează ambele câmpuri corect

### 2. Supplier Selection
**Issue**: Supplier poate avea `pk` sau `_id` inconsistent

**Check**:
- `ProcurementPage.tsx` - Folosește `String(s.pk || s._id)`
- Backend - Asigură-te că returnează `_id` consistent

### 3. Items Tab - Part Selection
**Issue**: ApiSelect pentru parts poate avea probleme cu `supplier_id` filter

**Check**:
- `ItemsTab.tsx` - Endpoint: `${procurementApi.getParts()}?supplier_id=${supplierId}`
- Backend - Verifică dacă filtrul `supplier_id` funcționează corect

### 4. Receive Stock - Line Items
**Issue**: Line items pot să nu se încarce corect

**Check**:
- `ReceivedStockTab.tsx` - Folosește `items` din props
- Backend - Verifică dacă `get_purchase_order_items` returnează toate câmpurile necesare

### 5. Approval Flow Creation
**Issue**: Approval flow poate să nu se creeze automat

**Check**:
- `ApprovalsTab.tsx` - Verifică dacă există template de aprobare pentru procurement
- Backend - Verifică `create_order_approval_flow` endpoint
- Database - Verifică `approval_templates` collection (slug: "procurement_order")

### 6. Document Generation
**Issue**: Documente pot să nu se genereze corect

**Check**:
- `DetailsTab.tsx` - Folosește `DocumentManager` component
- Backend - Verifică endpoint `/modules/depo_procurement/api/purchase-orders/{order_id}/documents`
- Config - Verifică `config` collection (slug: "procurement_order") pentru template codes

### 7. Stock Status Selection
**Issue**: Stock statuses pot să nu se încarce în Receive Stock tab

**Check**:
- `ReceivedStockTab.tsx` - Endpoint: `/modules/depo_procurement/api/stock-statuses`
- Backend - Verifică dacă returnează `depo_stocks_states` collection
- Database - Verifică dacă `depo_stocks_states` există și are date

### 8. Currency Selection
**Issue**: Currency poate să nu se încarce în New Order modal

**Check**:
- `ProcurementPage.tsx` - Folosește `ApiSelect` cu endpoint `/api/currencies`
- Backend - Verifică dacă endpoint-ul există și returnează `depo_currencies`

---

## 🔍 Debugging Checklist

### Frontend Console Errors
```javascript
// Check for:
1. "Duplicate options" - Folosește SafeSelect
2. "Cannot read property '_id' of undefined" - Verifică null checks
3. "Failed to load..." - Verifică endpoint-uri API
4. Network errors - Verifică CORS și autentificare
```

### Backend Logs
```python
# Check for:
1. ObjectId conversion errors - Verifică ObjectId(id_string)
2. Missing fields in response - Verifică serialize_doc()
3. Permission errors - Verifică verify_token dependency
4. Database connection errors - Verifică MongoDB connection
```

### Database Checks
```javascript
// MongoDB Compass:
1. depo_purchase_orders - Verifică structure și _id format
2. depo_purchase_orders_states - Verifică dacă există statusuri
3. depo_stocks_states - Verifică dacă există statusuri stoc
4. approval_templates - Verifică dacă există template pentru procurement
5. depo_companies - Verifică dacă există furnizori cu is_supplier=true
```

---

## 📝 Common Fixes

### Fix 1: Supplier not showing in dropdown
```typescript
// ProcurementPage.tsx - Check supplier mapping
const supplierOptions = suppliers
  .filter(s => (s.pk || s._id) != null)  // ✅ Filter null IDs
  .map(s => ({ 
    value: String(s.pk || s._id),        // ✅ Convert to string
    label: s.name 
  }));
```

### Fix 2: Items not loading
```python
# routes.py - Check items endpoint
@router.get("/purchase-orders/{order_id}/items")
async def get_purchase_order_items(order_id: str):
    items = list(db.depo_purchase_orders_items.find({
        'purchase_order_id': ObjectId(order_id)  # ✅ Use ObjectId
    }))
    # ✅ Enrich with part details
    for item in items:
        if item.get('part_id'):
            part = db.depo_parts.find_one({'_id': item['part_id']})
            if part:
                item['part_detail'] = serialize_doc(part)
    return serialize_doc(items)
```

### Fix 3: Approval flow not creating
```python
# Check approval_templates collection
db.approval_templates.find_one({'slug': 'procurement_order'})

# Should return:
{
  "_id": ObjectId("..."),
  "slug": "procurement_order",
  "name": "Procurement Order Approval",
  "min_signatures": 1,
  "officers": [
    {"user_id": ObjectId("..."), "username": "admin", "must_sign": true}
  ]
}
```

### Fix 4: Stock statuses not loading
```python
# routes.py - Check stock-statuses endpoint
@router.get("/stock-statuses")
async def get_stock_statuses():
    statuses = list(db.depo_stocks_states.find())
    return {"statuses": serialize_doc(statuses)}
```

---

## 🎯 Next Steps for Debugging

1. **Check Console**: Deschide DevTools → Console → Caută erori
2. **Check Network**: DevTools → Network → Verifică API calls (status codes, responses)
3. **Check Backend Logs**: Terminal unde rulează backend-ul
4. **Check Database**: MongoDB Compass → Verifică collections și documente
5. **Test Endpoints**: Postman/Thunder Client → Test manual API endpoints

---

## 📚 Related Documentation

- `utils/MUST_KNOW.md` - Critical issues & solutions
- `utils/DOCUMENT_GENERATION.md` - Document generation system
- `modules/depo_procurement/README.md` - Module documentation
- `modules/depo_procurement/CHANGELOG.md` - Version history

---

**Last Updated**: 2025-12-28
**Version**: 2.0.2
