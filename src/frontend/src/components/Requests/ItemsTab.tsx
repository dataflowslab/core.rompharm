import { useState, useEffect } from 'react';
import { Paper, Title, Table, Button, Group, Modal, Select, NumberInput, TextInput, ActionIcon, Text, Grid } from '@mantine/core';
import { IconPlus, IconTrash, IconDeviceFloppy } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';
import { notifications } from '@mantine/notifications';

interface BatchOption {
  value: string;
  label: string;
}

interface ItemWithBatch {
  part: number;
  part_name?: string;
  quantity: number;
  batch_code?: string;
  notes?: string;
  batch_options: BatchOption[];
}

interface ItemsTabProps {
  requestId: string;
  request: any;
  onReload: () => void;
}

export function ItemsTab({ requestId, request, onReload }: ItemsTabProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ItemWithBatch[]>([]);
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
  const [newItemBatchOptions, setNewItemBatchOptions] = useState<BatchOption[]>([]);

  // Check if editable (no signatures in approval flow)
  const [isEditable, setIsEditable] = useState(true);

  useEffect(() => {
    loadItems();
    checkEditability();
  }, [requestId]);

  const loadItems = async () => {
    try {
      const response = await api.get(requestsApi.getRequest(requestId));
      const itemsData = response.data.items || [];
      const sourceLocation = response.data.source;
      
      // Load batch codes for each item
      const itemsWithBatch = await Promise.all(
        itemsData.map(async (item: any) => {
          const batchOptions = await loadBatchCodes(item.part, sourceLocation);
          return {
            part: item.part,
            part_name: item.part_detail?.name || String(item.part),
            quantity: item.quantity,
            batch_code: item.batch_code || '',
            notes: item.notes || '',
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
      const response = await api.get(requestsApi.getApprovalFlow(requestId));
      const flow = response.data.flow;
      const hasSignatures = flow && flow.signatures && flow.signatures.length > 0;
      setIsEditable(!hasSignatures);
    } catch (error) {
      console.error('Failed to check editability:', error);
    }
  };

  const loadBatchCodes = async (partId: number, locationId?: number): Promise<BatchOption[]> => {
    try {
      const url = requestsApi.getPartBatchCodes(partId);
      const params = locationId ? `?location_id=${locationId}` : '';
      const response = await api.get(`${url}${params}`);
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
      const response = await api.get(requestsApi.getParts(), {
        params: { search: query }
      });
      setParts(response.data.results || []);
    } catch (error) {
      console.error('Failed to search parts:', error);
    }
  };

  const handlePartSelect = async (value: string | null) => {
    setNewItem({ ...newItem, part: value || '', batch_code: '' });
    
    if (value) {
      const batchOptions = await loadBatchCodes(parseInt(value), request.source);
      setNewItemBatchOptions(batchOptions);
    } else {
      setNewItemBatchOptions([]);
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

    const partDetail = parts.find(p => String(p.pk) === newItem.part);
    const batchOptions = await loadBatchCodes(parseInt(newItem.part), request.source);

    const updatedItems = [
      ...items,
      {
        part: parseInt(newItem.part),
        part_name: partDetail?.name || String(newItem.part),
        quantity: newItem.quantity,
        batch_code: newItem.batch_code,
        notes: newItem.notes,
        batch_options: batchOptions
      }
    ];

    await saveItems(updatedItems);
    setModalOpened(false);
    setNewItem({ part: '', quantity: 1, batch_code: '', notes: '' });
    setNewItemBatchOptions([]);
    setPartSearch('');
    setParts([]);
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

  
  const handleQuantityChange = (index: number, value: number) => {
    const updatedItems = [...items];
    updatedItems[index].quantity = value;
    setItems(updatedItems);
  };

  const saveItems = async (updatedItems: ItemWithBatch[]) => {
    setSaving(true);
    try {
      await api.patch(requestsApi.updateRequest(requestId), {
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
            <Table.Th style={{ width: '250px' }}>{t('Batch Code')}</Table.Th>
            <Table.Th style={{ width: '120px' }}>{t('Requested Qty')}</Table.Th>
            {isEditable && <Table.Th style={{ width: '60px' }}>{t('Actions')}</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={isEditable ? 4 : 3}>
                <Text size="sm" c="dimmed" ta="center">{t('No items')}</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            items.map((item, index) => (
              <Table.Tr key={index}>
                <Table.Td>{item.part_name}</Table.Td>
                <Table.Td>
                  {item.batch_code || '-'}
                </Table.Td>
                <Table.Td>
                  {isEditable ? (
                    <NumberInput
                      value={item.quantity}
                      onChange={(value) => handleQuantityChange(index, Number(value) || 1)}
                      min={1}
                      size="xs"
                    />
                  ) : (
                    item.quantity
                  )}
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
            ))
          )}
        </Table.Tbody>
      </Table>

      {/* Add Item Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setNewItem({ part: '', quantity: 1, batch_code: '', notes: '' });
          setPartSearch('');
          setParts([]);
        }}
        title={t('Add Item')}
      >
        <Grid>
          <Grid.Col span={12}>
            <Select
              label={t('Part')}
              placeholder={t('Search for part...')}
              data={parts.map(part => ({
                value: String(part.pk),
                label: `${part.name} (${part.IPN})`
              }))}
              value={newItem.part}
              onChange={handlePartSelect}
              onSearchChange={(query) => {
                setPartSearch(query);
                searchParts(query);
              }}
              searchValue={partSearch}
              searchable
              clearable
              required
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <NumberInput
              label={t('Quantity')}
              placeholder="1"
              value={newItem.quantity}
              onChange={(value) => setNewItem({ ...newItem, quantity: Number(value) || 1 })}
              min={1}
              step={1}
              required
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Select
              label={t('Batch Code')}
              placeholder={t('Select batch code (optional)')}
              data={newItemBatchOptions}
              value={newItem.batch_code}
              onChange={(value) => setNewItem({ ...newItem, batch_code: value || '' })}
              searchable
              clearable
              disabled={!newItem.part}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => {
            setModalOpened(false);
            setNewItem({ part: '', quantity: 1, batch_code: '', notes: '' });
            setNewItemBatchOptions([]);
            setPartSearch('');
            setParts([]);
          }}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleAddItem}>
            {t('Add')}
          </Button>
        </Group>
      </Modal>
    </Paper>
  );
}
