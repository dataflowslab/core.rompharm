# Implementare Series și Batch în OperationsTab

## Status: ⏳ IN PROGRESS

Am adăugat interfețele TypeScript necesare. Următorii pași:

## 1. Adaugă state și funcții în OperationsTab

```typescript
// După linia: const [submitting, setSubmitting] = useState(false);
// Adaugă:
const [itemsWithBatch, setItemsWithBatch] = useState<ItemWithBatch[]>([]);
const [loadingBatch, setLoadingBatch] = useState(false);

// După useEffect pentru loadOperationsFlow, adaugă:
useEffect(() => {
  if (requestId) {
    loadRequestItems();
  }
}, [requestId]);

const loadRequestItems = async () => {
  try {
    const response = await api.get(`/api/requests/${requestId}`);
    const items = response.data.items || [];
    
    // Initialize items with batch data
    const itemsData: ItemWithBatch[] = await Promise.all(
      items.map(async (item: any) => {
        const batchOptions = await loadBatchCodes(item.part);
        return {
          part: item.part,
          part_name: item.part_detail?.name || String(item.part),
          quantity: item.quantity,
          series: item.series || '',
          batch_code: item.batch_code || '',
          batch_options: batchOptions
        };
      })
    );
    
    setItemsWithBatch(itemsData);
  } catch (error) {
    console.error('Failed to load request items:', error);
  }
};

const loadBatchCodes = async (partId: number): Promise<BatchOption[]> => {
  try {
    const response = await api.get(`/api/requests/parts/${partId}/batch-codes`);
    const batchCodes = response.data.batch_codes || [];
    
    return batchCodes.map((batch: any) => ({
      value: batch.batch_code,
      label: `${batch.batch_code} - ${batch.expiry_date || 'N/A'} - ${batch.quantity} buc`,
      expiry_date: batch.expiry_date,
      quantity: batch.quantity,
      location: batch.location
    }));
  } catch (error) {
    console.error(`Failed to load batch codes for part ${partId}:`, error);
    return [];
  }
};

const handleSeriesChange = (index: number, value: string) => {
  const newItems = [...itemsWithBatch];
  newItems[index].series = value;
  setItemsWithBatch(newItems);
};

const handleBatchChange = (index: number, value: string | null) => {
  const newItems = [...itemsWithBatch];
  newItems[index].batch_code = value || '';
  setItemsWithBatch(newItems);
};

const saveBatchData = async () => {
  try {
    await api.patch(`/api/requests/${requestId}`, {
      items: itemsWithBatch.map(item => ({
        part: item.part,
        quantity: item.quantity,
        series: item.series,
        batch_code: item.batch_code
      }))
    });
    
    notifications.show({
      title: t('Success'),
      message: t('Series and batch data saved successfully'),
      color: 'green'
    });
  } catch (error: any) {
    console.error('Failed to save batch data:', error);
    notifications.show({
      title: t('Error'),
      message: error.response?.data?.detail || t('Failed to save batch data'),
      color: 'red'
    });
  }
};
```

## 2. Adaugă tabelul Series și Batch în JSX

```typescript
// După tabelul "Signatures" și înainte de "Final Status Selection", adaugă:

{/* Series and Batch Information */}
{itemsWithBatch.length > 0 && (
  <>
    <Title order={5} mt="md" mb="sm">{t('Series and Batch Information')}</Title>
    <Table striped withTableBorder withColumnBorders mb="md">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t('Part')}</Table.Th>
          <Table.Th>{t('Quantity')}</Table.Th>
          <Table.Th>{t('Series')}</Table.Th>
          <Table.Th>{t('Batch Code')}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {itemsWithBatch.map((item, index) => (
          <Table.Tr key={index}>
            <Table.Td>{item.part_name}</Table.Td>
            <Table.Td>{item.quantity}</Table.Td>
            <Table.Td>
              <TextInput
                value={item.series}
                onChange={(e) => handleSeriesChange(index, e.target.value)}
                disabled={isFormReadonly}
                placeholder={t('Enter series')}
                style={{ minWidth: '150px' }}
              />
            </Table.Td>
            <Table.Td>
              <Select
                data={item.batch_options}
                value={item.batch_code}
                onChange={(value) => handleBatchChange(index, value)}
                disabled={isFormReadonly}
                placeholder={t('Select batch')}
                searchable
                clearable
                style={{ minWidth: '250px' }}
              />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
    
    {!isFormReadonly && (
      <Group justify="flex-end" mb="md">
        <Button onClick={saveBatchData} loading={loadingBatch}>
          {t('Save Series & Batch')}
        </Button>
      </Group>
    )}
  </>
)}
```

## 3. Backend - Endpoint pentru batch codes

Adaugă în `src/backend/routes/requests.py`:

```python
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
        seen_batches = set()
        
        for item in stock_items:
            batch = item.get('batch', '')
            if batch and batch not in seen_batches:
                seen_batches.add(batch)
                batch_codes.append({
                    'batch_code': batch,
                    'expiry_date': item.get('expiry_date', ''),
                    'quantity': item.get('quantity', 0),
                    'location': item.get('location_detail', {}).get('name', '')
                })
        
        return {"batch_codes": batch_codes}
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch batch codes: {str(e)}")
```

## 4. Backend - Actualizare model Request

În `src/backend/routes/requests.py`, actualizează `RequestItemCreate`:

```python
class RequestItemCreate(BaseModel):
    part: int
    quantity: float
    notes: Optional[str] = None
    series: Optional[str] = None  # NOU
    batch_code: Optional[str] = None  # NOU
```

## 5. Testare

1. Creează un request nou
2. Aprobă request-ul
3. Intră în tab Operations
4. Verifică că tabelul "Series and Batch Information" apare
5. Selectează batch codes din dropdown
6. Introdu series
7. Salvează
8. Semnează

## 6. Validare înainte de semnare

Opțional, poți adăuga validare că toate items au series și batch înainte de a permite semnarea:

```typescript
const canUserSign = () => {
  if (!flow || !username) return false;
  const alreadySigned = flow.signatures.some(s => s.username === username);
  if (alreadySigned) return false;
  
  // Validare series și batch
  const allItemsHaveBatch = itemsWithBatch.every(item => 
    item.series && item.batch_code
  );
  if (!allItemsHaveBatch) return false;
  
  const canSign = flow.can_sign_officers.some(o => o.username === username);
  const mustSign = flow.must_sign_officers.some(o => o.username === username);
  
  return canSign || mustSign;
};
```

## Status Implementare:
- ✅ Interfețe TypeScript adăugate
- ⏳ State și funcții (trebuie adăugate)
- ⏳ Tabel JSX (trebuie adăugat)
- ⏳ Backend endpoint (trebuie adăugat)
- ⏳ Model actualizat (trebuie actualizat)
