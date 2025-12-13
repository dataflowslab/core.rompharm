# Implementare Updates pentru Requests Module

## 1. Template HTML RC45WVTRBDGT

### Actualizare în MongoDB:
```javascript
// În MongoDB Compass, collection: templates
// Găsește documentul cu slug: "RC45WVTRBDGT"
// Actualizează câmpul "content" cu HTML-ul din TEMPLATE_RC45WVTRBDGT.html
```

### Placeholders necesare:
- `request.source_location_name` - Numele locației sursă
- `request.destination_location_name` - Numele locației destinație
- `request.reference` - REQ-NNNN
- `request.issue_date` - Data emiterii
- `request.product_name` - Denumirea produsului (doar pentru produse compuse)
- `request.series` - Seria de fabricație
- `request.items[]` - Array cu items:
  - `item.part_name` - Numele piesei
  - `item.batch_code` - Codul batch-ului
  - `item.unit` - Unitatea de măsură
  - `item.quantity` - Cantitatea
  - `item.price` - Prețul
  - `item.total` - Valoarea totală
- `request.qr_code` - Codul QR (base64)
- `request.operations_user` - Utilizatorul Operations
- `request.operations_date` - Data Operations
- `request.operations_signature` - Semnătura Operations
- `request.reception_user` - Utilizatorul Reception
- `request.reception_date` - Data Reception
- `request.reception_signature` - Semnătura Reception

## 2. Câmpuri Series și Batch în Operations

### Backend - Modificări necesare:

#### A. Model Request (MongoDB):
```python
# Adaugă în request items:
{
    "part": int,
    "quantity": float,
    "notes": str,
    "series": str,  # NOU
    "batch_code": str  # NOU
}
```

#### B. Endpoint pentru batch codes:
```python
# În src/backend/routes/requests.py
@router.get("/parts/{part_id}/batch-codes")
async def get_part_batch_codes(
    part_id: int,
    current_user: dict = Depends(verify_admin)
):
    """Get available batch codes for a part from InvenTree"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    
    try:
        # Get stock items for this part
        response = requests.get(
            f"{inventree_url}/api/stock/",
            headers=headers,
            params={
                'part': part_id,
                'in_stock': 'true',
                'status': 10  # OK status
            },
            timeout=10
        )
        response.raise_for_status()
        stock_data = response.json()
        stock_items = stock_data if isinstance(stock_data, list) else stock_data.get('results', [])
        
        # Extract batch codes
        batch_codes = []
        for item in stock_items:
            if item.get('batch'):
                batch_codes.append({
                    'batch_code': item.get('batch'),
                    'expiry_date': item.get('expiry_date'),
                    'quantity': item.get('quantity'),
                    'location': item.get('location_detail', {}).get('name', '')
                })
        
        return {"batch_codes": batch_codes}
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch batch codes: {str(e)}")
```

### Frontend - Modificări necesare:

#### A. OperationsTab.tsx:
```typescript
// Adaugă state pentru series și batch
const [itemsWithBatch, setItemsWithBatch] = useState<Array<{
  part: number;
  quantity: number;
  series: string;
  batch_code: string;
  batch_options: Array<{
    value: string;
    label: string;
    expiry_date: string;
    quantity: number;
  }>;
}>>([]);

// Adaugă tabel pentru editare series și batch
<Title order={5} mt="md" mb="sm">{t('Series and Batch Information')}</Title>
<Table striped withTableBorder withColumnBorders mb="md">
  <Table.Thead>
    <Table.Tr>
      <Table.Th>{t('Part')}</Table.Th>
      <Table.Th>{t('Series')}</Table.Th>
      <Table.Th>{t('Batch Code')}</Table.Th>
    </Table.Tr>
  </Table.Thead>
  <Table.Tbody>
    {itemsWithBatch.map((item, index) => (
      <Table.Tr key={index}>
        <Table.Td>{item.part_name}</Table.Td>
        <Table.Td>
          <TextInput
            value={item.series}
            onChange={(e) => handleSeriesChange(index, e.target.value)}
            disabled={isFormReadonly}
          />
        </Table.Td>
        <Table.Td>
          <Select
            data={item.batch_options}
            value={item.batch_code}
            onChange={(value) => handleBatchChange(index, value)}
            disabled={isFormReadonly}
            searchable
          />
        </Table.Td>
      </Table.Tr>
    ))}
  </Table.Tbody>
</Table>
```

## 3. Cod QR

### Backend - Generare QR:
```python
# În src/backend/routes/documents.py
import qrcode
import io
import base64

def generate_qr_code(data: str) -> str:
    """Generate QR code and return as base64 string"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return img_str

# În funcția de generare document:
document_data = {
    # ... alte date
    "qr_code": generate_qr_code(f"REQ-{request['reference']}")
}
```

### Instalare dependență:
```bash
pip install qrcode[pil]
```

## 4. Actualizare Backend pentru Document Generation

### Modifică endpoint-ul de generare document:
```python
# În src/backend/routes/documents.py
# Adaugă în document_data:
document_data = {
    "request": {
        "reference": request['reference'],
        "source_location_name": request.get('source_detail', {}).get('name', ''),
        "destination_location_name": request.get('destination_detail', {}).get('name', ''),
        "issue_date": request.get('issue_date', ''),
        "product_name": "",  # Doar pentru produse compuse
        "series": request.get('series', ''),
        "items": [
            {
                "part_name": item.get('part_detail', {}).get('name', ''),
                "batch_code": item.get('batch_code', ''),
                "unit": item.get('part_detail', {}).get('units', 'buc'),
                "quantity": item.get('quantity', 0),
                "price": 0,  # Trebuie extras din InvenTree
                "total": 0
            }
            for item in request.get('items', [])
        ],
        "qr_code": generate_qr_code(request['reference']),
        "operations_user": request.get('operations_completed_by', ''),
        "operations_date": request.get('operations_completed_at', ''),
        "operations_signature": "",  # Hash-ul semnăturii
        "reception_user": request.get('reception_completed_by', ''),
        "reception_date": request.get('reception_completed_at', ''),
        "reception_signature": ""  # Hash-ul semnăturii
    }
}
```

## 5. Pași de implementare:

1. ✅ Actualizează template-ul HTML în MongoDB
2. ⏳ Adaugă endpoint pentru batch codes
3. ⏳ Modifică OperationsTab pentru series și batch
4. ⏳ Instalează qrcode: `pip install qrcode[pil]`
5. ⏳ Adaugă funcție generate_qr_code
6. ⏳ Actualizează document generation cu toate datele
7. ⏳ Testează generarea documentului

## 6. Testare:

```bash
# Backend
cd src/backend
pip install qrcode[pil]
# Restart backend

# Frontend
cd src/frontend
npm run build
```

## Note:
- Template-ul HTML este în `TEMPLATE_RC45WVTRBDGT.html`
- Batch codes se iau din InvenTree stock items
- QR code conține referința request-ului
- Data recepției = `reception_completed_at` din MongoDB
