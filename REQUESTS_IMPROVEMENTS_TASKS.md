# Requests Module - Improvements Tasks

## Status: 📋 TO IMPLEMENT

## Task 1: Zona Generare Documente în Details Tab

### Obiectiv:
Adaugă secțiune pentru generare document "P-Distrib-102_F1 - Fisa de solicitare" (cod: 6LL5WVTR8BTY) în DetailsTab, similar cu Procurement.

### Fișiere de modificat:
- `src/frontend/src/components/Requests/DetailsTab.tsx`
- `src/backend/routes/documents.py` (dacă nu există endpoint)

### Implementare Frontend:

```tsx
// În DetailsTab.tsx, după secțiunea Items, adaugă:

{/* Document Generation Section */}
{!isEditing && (
  <Paper withBorder p="md" mt="md">
    <Group justify="space-between" mb="md">
      <Title order={5}>{t('Documents')}</Title>
    </Group>
    
    <Group>
      <Button
        leftSection={<IconFileText size={16} />}
        onClick={handleGenerateDocument}
        loading={generatingDoc}
        disabled={request.status !== 'Approved'}
      >
        {t('Generate P-Distrib-102_F1')}
      </Button>
    </Group>
    
    {request.status !== 'Approved' && (
      <Text size="sm" c="dimmed" mt="xs">
        {t('Document can only be generated after approval')}
      </Text>
    )}
  </Paper>
)}

// Adaugă funcția:
const [generatingDoc, setGeneratingDoc] = useState(false);

const handleGenerateDocument = async () => {
  setGeneratingDoc(true);
  try {
    const response = await api.post(
      `/api/documents/requests/${request._id}/generate`,
      { template_slug: '6LL5WVTR8BTY' },
      { responseType: 'blob' }
    );
    
    // Download PDF
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Fisa_Solicitare_${request.reference}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    notifications.show({
      title: t('Success'),
      message: t('Document generated successfully'),
      color: 'green'
    });
  } catch (error: any) {
    console.error('Failed to generate document:', error);
    notifications.show({
      title: t('Error'),
      message: error.response?.data?.detail || t('Failed to generate document'),
      color: 'red'
    });
  } finally {
    setGeneratingDoc(false);
  }
};
```

### Implementare Backend:

```python
# În src/backend/routes/documents.py

@router.post("/requests/{request_id}/generate")
async def generate_request_document(
    request_id: str,
    request: Request,
    template_data: dict,
    current_user: dict = Depends(verify_admin)
):
    """Generate document for stock request (6LL5WVTR8BTY)"""
    from bson import ObjectId
    
    db = get_db()
    requests_collection = db['depo_requests_items']
    
    try:
        req_obj_id = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    req = requests_collection.find_one({'_id': req_obj_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get template
    template_slug = template_data.get('template_slug', '6LL5WVTR8BTY')
    template = db.templates.find_one({'slug': template_slug})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Prepare document data
    document_data = {
        "request": {
            "reference": req.get('reference'),
            "source_location": req.get('source_detail', {}).get('name', ''),
            "destination_location": req.get('destination_detail', {}).get('name', ''),
            "issue_date": req.get('issue_date', ''),
            "items": req.get('items', []),
            "notes": req.get('notes', ''),
            "created_by": req.get('created_by', '')
        }
    }
    
    # Render template with Jinja2
    from jinja2 import Template
    jinja_template = Template(template['content'])
    html_content = jinja_template.render(**document_data)
    
    # Generate PDF (use existing PDF generation logic)
    # ... PDF generation code ...
    
    return Response(content=pdf_content, media_type="application/pdf")
```

---

## Task 2: Tab "Items" cu Tabel Editabil

### Obiectiv:
Creează tab nou "Items" cu tabel editabil pentru componente produsului. Editabil până la prima semnătură.

### Fișiere de creat/modificat:
- `src/frontend/src/components/Requests/ItemsTab.tsx` (NOU)
- `src/frontend/src/pages/RequestDetailPage.tsx` (adaugă tab)

### Implementare ItemsTab.tsx:

```tsx
import { useState, useEffect } from 'react';
import { Paper, Title, Table, Button, Group, Modal, Select, NumberInput, TextInput, ActionIcon, Text } from '@mantine/core';
import { IconPlus, IconTrash, IconDeviceFloppy } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';

interface Item {
  part: number;
  part_name?: string;
  quantity: number;
  batch_code?: string;
  notes?: string;
  batch_options?: Array<{
    value: string;
    label: string;
  }>;
}

interface ItemsTabProps {
  requestId: string;
  request: any;
  onReload: () => void;
}

export function ItemsTab({ requestId, request, onReload }: ItemsTabProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [parts, setParts] = useState<any[]>([]);
  const [partSearch, setPartSearch] = useState('');
  const [newItem, setNewItem] = useState({
    part: '',
    quantity: 1,
    batch_code: '',
    notes: ''
  });

  // Check if editable (no signatures in approval flow)
  const [isEditable, setIsEditable] = useState(true);

  useEffect(() => {
    loadItems();
    checkEditability();
  }, [requestId]);

  const loadItems = async () => {
    try {
      const response = await api.get(`/api/requests/${requestId}`);
      const itemsData = response.data.items || [];
      
      // Load batch codes for each item
      const itemsWithBatch = await Promise.all(
        itemsData.map(async (item: any) => {
          const batchOptions = await loadBatchCodes(item.part);
          return {
            ...item,
            part_name: item.part_detail?.name || String(item.part),
            batch_options: batchOptions
          };
        })
      );
      
      setItems(itemsWithBatch);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkEditability = async () => {
    try {
      const response = await api.get(`/api/requests/${requestId}/approval-flow`);
      const flow = response.data.flow;
      const hasSignatures = flow && flow.signatures && flow.signatures.length > 0;
      setIsEditable(!hasSignatures);
    } catch (error) {
      console.error('Failed to check editability:', error);
    }
  };

  const loadBatchCodes = async (partId: number) => {
    try {
      const response = await api.get(`/api/requests/parts/${partId}/batch-codes`);
      const batchCodes = response.data.batch_codes || [];
      return batchCodes.map((batch: any) => ({
        value: batch.batch_code,
        label: `${batch.batch_code} - ${batch.expiry_date || 'N/A'} - ${batch.quantity} buc`
      }));
    } catch (error) {
      return [];
    }
  };

  const searchParts = async (query: string) => {
    if (!query || query.length < 2) {
      setParts([]);
      return;
    }
    
    try {
      const response = await api.get('/api/requests/parts', {
        params: { search: query }
      });
      setParts(response.data.results || []);
    } catch (error) {
      console.error('Failed to search parts:', error);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.part || !newItem.quantity) {
      notifications.show({
        title: t('Error'),
        message: t('Please fill in all required fields'),
        color: 'red'
      });
      return;
    }

    const updatedItems = [
      ...items,
      {
        part: parseInt(newItem.part),
        quantity: newItem.quantity,
        batch_code: newItem.batch_code,
        notes: newItem.notes
      }
    ];

    await saveItems(updatedItems);
    setModalOpened(false);
    setNewItem({ part: '', quantity: 1, batch_code: '', notes: '' });
  };

  const handleDeleteItem = (index: number) => {
    modals.openConfirmModal({
      title: t('Delete Item'),
      children: <Text size="sm">{t('Are you sure you want to delete this item?')}</Text>,
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const updatedItems = items.filter((_, i) => i !== index);
        await saveItems(updatedItems);
      }
    });
  };

  const handleBatchChange = (index: number, value: string | null) => {
    const updatedItems = [...items];
    updatedItems[index].batch_code = value || '';
    setItems(updatedItems);
  };

  const saveItems = async (updatedItems: any[]) => {
    setSaving(true);
    try {
      await api.patch(`/api/requests/${requestId}`, {
        items: updatedItems.map(item => ({
          part: item.part,
          quantity: item.quantity,
          batch_code: item.batch_code,
          notes: item.notes
        }))
      });

      notifications.show({
        title: t('Success'),
        message: t('Items saved successfully'),
        color: 'green'
      });

      loadItems();
      onReload();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save items'),
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Paper p="md"><Text>{t('Loading...')}</Text></Paper>;
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>{t('Items')}</Title>
        {isEditable && (
          <Group>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setModalOpened(true)}
            >
              {t('Add Item')}
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={() => saveItems(items)}
              loading={saving}
              variant="light"
            >
              {t('Save')}
            </Button>
          </Group>
        )}
      </Group>

      {!isEditable && (
        <Text size="sm" c="orange" mb="md">
          {t('This request has signatures and cannot be edited. Remove all signatures to enable editing.')}
        </Text>
      )}

      <Table striped withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Description')}</Table.Th>
            <Table.Th>{t('Quantity')}</Table.Th>
            <Table.Th>{t('Batch Code')}</Table.Th>
            {isEditable && <Table.Th style={{ width: '60px' }}>{t('Actions')}</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item, index) => (
            <Table.Tr key={index}>
              <Table.Td>{item.part_name}</Table.Td>
              <Table.Td>{item.quantity}</Table.Td>
              <Table.Td>
                <Select
                  data={item.batch_options || []}
                  value={item.batch_code}
                  onChange={(value) => handleBatchChange(index, value)}
                  disabled={!isEditable}
                  placeholder={t('Select batch')}
                  searchable
                  clearable
                  size="xs"
                />
              </Table.Td>
              {isEditable && (
                <Table.Td>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => handleDeleteItem(index)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {/* Add Item Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={t('Add Item')}
      >
        {/* Modal content similar to New Request */}
      </Modal>
    </Paper>
  );
}
```

### Adaugă tab în RequestDetailPage.tsx:

```tsx
// După tab Operations, adaugă:
<Tabs.Tab value="items" leftSection={<IconList size={16} />}>
  {t('Items')}
</Tabs.Tab>

// În Tabs.Panel:
<Tabs.Panel value="items" pt="md">
  {id && request && <ItemsTab requestId={id} request={request} onReload={loadRequest} />}
</Tabs.Panel>
```

---

## Task 3: Batch Code Manual în Operations

### Obiectiv:
Permite introducere manuală batch code în Operations (nu doar select).

### Modificare în OperationsTab.tsx:

```tsx
// În loc de Select simplu, folosește Select cu creatable sau TextInput + Select

<Table.Td>
  <Group gap="xs">
    <Select
      data={item.batch_options}
      value={item.batch_code}
      onChange={(value) => handleBatchChange(index, value)}
      disabled={isFormReadonly}
      placeholder={t('Select or enter batch')}
      searchable
      clearable
      creatable
      getCreateLabel={(query) => `+ ${t('Create')} "${query}"`}
      onCreate={(query) => {
        const newOption = { value: query, label: query };
        const newItems = [...itemsWithBatch];
        newItems[index].batch_options = [...newItems[index].batch_options, newOption];
        newItems[index].batch_code = query;
        setItemsWithBatch(newItems);
        return newOption;
      }}
      size="xs"
    />
  </Group>
</Table.Td>

// SAU alternativ, folosește TextInput cu datalist:

<Table.Td>
  <TextInput
    value={item.batch_code}
    onChange={(e) => handleBatchChange(index, e.target.value)}
    disabled={isFormReadonly}
    placeholder={t('Enter or select batch')}
    list={`batch-options-${index}`}
    size="xs"
  />
  <datalist id={`batch-options-${index}`}>
    {item.batch_options.map((option, i) => (
      <option key={i} value={option.value} />
    ))}
  </datalist>
</Table.Td>
```

---

## Pași de Implementare:

1. ✅ Backend: Endpoint pentru generare document requests
2. ✅ Frontend: Adaugă secțiune Documents în DetailsTab
3. ✅ Frontend: Creează ItemsTab.tsx
4. ✅ Frontend: Adaugă tab Items în RequestDetailPage
5. ✅ Frontend: Modifică OperationsTab pentru batch code manual
6. ✅ Test: Generare document
7. ✅ Test: Editare items
8. ✅ Test: Batch code manual

## Note:
- ItemsTab este editabil doar dacă nu există semnături în approval flow
- Batch code poate fi selectat din listă SAU introdus manual
- Document se generează doar după aprobare
