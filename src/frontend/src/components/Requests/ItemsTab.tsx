import { useState, useEffect } from 'react';
import { Paper, Title, Table, Button, Group, Modal, NumberInput, TextInput, ActionIcon, Text, Grid, Divider } from '@mantine/core';
import { IconPlus, IconTrash, IconDeviceFloppy } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';
import { notifications } from '@mantine/notifications';
import { SafeSelect } from '../Common/SafeSelect';
import { BatchCodesTable } from './BatchCodesTable';

interface BatchOption {
  value: string;
  label: string;
  expiry_date?: string;
  quantity?: number;
  location_name?: string;
  location_id?: string;
  state_name?: string;
  state_id?: string;
  state_color?: string;
  is_transferable?: boolean;
  is_requestable?: boolean;
}

interface BatchSelection {
  batch_code: string;
  location_id: string;
  requested_quantity: number;
}

interface ItemWithBatch {
  part: string | number;
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
    quantity: 0,
    batch_code: '',
    notes: ''
  });
  const [newItemBatchOptions, setNewItemBatchOptions] = useState<BatchOption[]>([]);
  const [batchSelections, setBatchSelections] = useState<BatchSelection[]>([]);

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

  const loadBatchCodes = async (partId: string | number, locationId?: number): Promise<BatchOption[]> => {
    try {
      const url = requestsApi.getPartBatchCodes(partId);
      // Don't filter by location - get all available batch codes
      const response = await api.get(url);
      const batchCodes = response.data.batch_codes || [];
      
      return batchCodes.map((batch: any) => ({
        value: batch.batch_code,
        label: batch.label || `${batch.batch_code} (${batch.quantity} buc) - ${batch.location_name || 'N/A'}`,
        expiry_date: batch.expiry_date,
        quantity: batch.quantity,
        location_name: batch.location_name,
        location_id: batch.location_id,
        state_name: batch.state_name,
        state_id: batch.state_id,
        state_color: batch.state_color,
        is_transferable: batch.is_transferable,
        is_requestable: batch.is_requestable
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
      const batchOptions = await loadBatchCodes(value, request.source);
      setNewItemBatchOptions(batchOptions);
    } else {
      setNewItemBatchOptions([]);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.part) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a part'),
        color: 'red'
      });
      return;
    }

    const partDetail = parts.find(p => String(p._id) === newItem.part);
    const batchOptions = await loadBatchCodes(newItem.part, request.source);
    const newItems: ItemWithBatch[] = [];

    // Check if using general quantity or batch-specific quantities
    if (newItem.quantity > 0) {
      // General quantity - add one item without specific batch
      newItems.push({
        part: newItem.part,
        part_name: partDetail?.name || String(newItem.part),
        quantity: newItem.quantity,
        batch_code: '', // No specific batch
        notes: newItem.notes,
        batch_options: batchOptions
      });
    } else {
      // Batch-specific quantities - add one item per batch with quantity > 0
      const validSelections = batchSelections.filter(s => s.requested_quantity > 0);
      
      if (validSelections.length === 0) {
        notifications.show({
          title: t('Error'),
          message: t('Please specify quantity (general or per batch)'),
          color: 'red'
        });
        return;
      }

      for (const selection of validSelections) {
        newItems.push({
          part: newItem.part,
          part_name: partDetail?.name || String(newItem.part),
          quantity: selection.requested_quantity,
          batch_code: selection.batch_code,
          notes: newItem.notes,
          batch_options: batchOptions
        });
      }
    }

    // Add all new items to the list
    const updatedItems = [...items, ...newItems];
    await saveItems(updatedItems);
    
    setModalOpened(false);
    setNewItem({ part: '', quantity: 0, batch_code: '', notes: '' });
    setBatchSelections([]);
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
          setNewItem({ part: '', quantity: 0, batch_code: '', notes: '' });
          setBatchSelections([]);
          setPartSearch('');
          setParts([]);
          setNewItemBatchOptions([]);
        }}
        title={t('Add Item')}
        size="xl"
      >
        <Grid>
          <Grid.Col span={12}>
            <SafeSelect
              label={t('Part')}
              placeholder={t('Search for part...')}
              data={parts}
              valueKey="_id"
              labelKey="name"
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
              debug={true}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <NumberInput
              label={t('Quantity (General)')}
              placeholder="0"
              description={t('Leave at 0 to specify quantities per batch below')}
              value={newItem.quantity}
              onChange={(value) => {
                const numValue = Number(value) || 0;
                setNewItem({ ...newItem, quantity: numValue });
                if (numValue > 0) {
                  setBatchSelections([]);
                }
              }}
              min={0}
              step={1}
            />
          </Grid.Col>

          {newItem.part && (
            <>
              <Grid.Col span={12}>
                <Divider my="sm" label={t('Select Batch Codes')} labelPosition="center" />
              </Grid.Col>

              <Grid.Col span={12}>
                <BatchCodesTable
                  batchCodes={newItemBatchOptions.map(opt => ({
                    batch_code: opt.value,
                    quantity: opt.quantity || 0,
                    location_name: opt.location_name || '',
                    location_id: opt.location_id || '',
                    state_name: opt.state_name || '',
                    state_id: opt.state_id || '',
                    state_color: opt.state_color,
                    expiry_date: opt.expiry_date,
                    is_transferable: opt.is_transferable,
                    is_requestable: opt.is_requestable
                  }))}
                  selections={batchSelections}
                  onSelectionChange={(selections) => {
                    setBatchSelections(selections);
                    const hasQuantity = selections.some(s => s.requested_quantity > 0);
                    if (hasQuantity && newItem.quantity > 0) {
                      setNewItem({ ...newItem, quantity: 0 });
                    }
                  }}
                />
              </Grid.Col>
            </>
          )}
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => {
            setModalOpened(false);
            setNewItem({ part: '', quantity: 0, batch_code: '', notes: '' });
            setBatchSelections([]);
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
