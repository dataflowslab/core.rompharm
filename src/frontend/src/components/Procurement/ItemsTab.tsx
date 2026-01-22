import { useState, useMemo } from 'react';
import {
  Title,
  Table,
  Button,
  Group,
  TextInput,
  Modal,
  Grid,
  NumberInput,
  Select,
  Textarea,
  Text,
  ActionIcon,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconSearch,
  IconArrowUp,
  IconArrowDown,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import api from '../../services/api';
import { procurementApi } from '../../services/procurement';
import { ApiSelect } from '../Common/ApiSelect';

interface PurchaseOrderItem {
  _id: string;  // MongoDB ObjectId
  pk?: number;  // Legacy field
  part: number;
  part_detail?: {
    name: string;
    description: string;
    IPN: string;
    um?: string;  // Unit of measure
  };
  quantity: number;
  received: number;
  purchase_price: number;
  purchase_price_currency: string;
  destination?: number;
  destination_id?: string;  // MongoDB ObjectId
  destination_detail?: {
    name: string;
  };
  reference: string;
  notes: string;
}

interface Part {
  _id: string;
  pk?: number; // Legacy field, may not exist
  name: string;
  description: string;
  IPN?: string;
  ipn?: string; // MongoDB uses lowercase
}

interface StockLocation {
  pk: number;
  name: string;
  description?: string;
}

interface ItemsTabProps {
  orderId: string;
  items: PurchaseOrderItem[];
  orderCurrency: string;
  stockLocations: StockLocation[];
  supplierId?: string;
  onReload: () => void;
  canEdit: boolean;
}

export function ItemsTab({ orderId, items, orderCurrency, stockLocations, supplierId, onReload, canEdit }: ItemsTabProps) {
  const { t } = useTranslation();
  const [itemModalOpened, setItemModalOpened] = useState(false);
  const [editItemModalOpened, setEditItemModalOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchaseOrderItem | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSortField, setItemSortField] = useState<keyof PurchaseOrderItem | null>(null);
  const [itemSortDirection, setItemSortDirection] = useState<'asc' | 'desc'>('asc');

  const [newItemData, setNewItemData] = useState({
    part: '',
    quantity: 1,
    purchase_price: 0,
    purchase_price_currency: orderCurrency || '',
    destination: '',
    reference: '',
    notes: ''
  });

  const [editItemData, setEditItemData] = useState({
    quantity: 1,
    purchase_price: 0,
    purchase_price_currency: '',
    destination: '',
    reference: '',
    notes: ''
  });

  const handleAddItem = async () => {
    if (!newItemData.part) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a part'),
        color: 'red'
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        part_id: newItemData.part, // MongoDB ObjectId as string
        quantity: newItemData.quantity,
        purchase_price: newItemData.purchase_price || undefined,
        purchase_price_currency: newItemData.purchase_price_currency || undefined,
        destination_id: newItemData.destination ? newItemData.destination : undefined, // MongoDB ObjectId as string
        reference: newItemData.reference || undefined,
        notes: newItemData.notes || undefined
      };

      await api.post(procurementApi.addOrderItem(orderId), payload);

      notifications.show({
        title: t('Success'),
        message: t('Item added successfully'),
        color: 'green'
      });

      setNewItemData({
        part: '',
        quantity: 1,
        purchase_price: 0,
        purchase_price_currency: orderCurrency || '',
        destination: '',
        reference: '',
        notes: ''
      });
      setItemModalOpened(false);
      onReload();
    } catch (error: any) {
      console.error('Failed to add item:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to add item'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditItem = (item: PurchaseOrderItem) => {
    setEditingItem(item);
    setEditItemData({
      quantity: item.quantity,
      purchase_price: item.purchase_price,
      purchase_price_currency: item.purchase_price_currency,
      destination: item.destination_id || (item.destination ? String(item.destination) : ''),
      reference: item.reference || '',
      notes: item.notes || ''
    });
    setEditItemModalOpened(true);
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !editingItem._id) return;

    setSubmitting(true);
    try {
      const payload = {
        quantity: editItemData.quantity,
        purchase_price: editItemData.purchase_price || undefined,
        purchase_price_currency: editItemData.purchase_price_currency || undefined,
        destination_id: editItemData.destination ? editItemData.destination : undefined,
        reference: editItemData.reference || undefined,
        notes: editItemData.notes || undefined
      };

      await api.put(procurementApi.updateOrderItem(orderId, editingItem._id), payload);

      notifications.show({
        title: t('Success'),
        message: t('Item updated successfully'),
        color: 'green'
      });

      setEditItemModalOpened(false);
      setEditingItem(null);
      onReload();
    } catch (error: any) {
      console.error('Failed to update item:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update item'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm(t('Are you sure you want to delete this item?'))) return;

    try {
      if (!itemId) {
        notifications.show({
          title: t('Error'),
          message: t('Item not found'),
          color: 'red'
        });
        return;
      }

      await api.delete(procurementApi.deleteOrderItem(orderId, itemId));
      notifications.show({
        title: t('Success'),
        message: t('Item deleted successfully'),
        color: 'green'
      });
      onReload();
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete item'),
        color: 'red'
      });
    }
  };

  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...items];

    if (itemSearchQuery) {
      const query = itemSearchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.part_detail?.name?.toLowerCase().includes(query) ||
        item.part_detail?.IPN?.toLowerCase().includes(query) ||
        item.reference?.toLowerCase().includes(query) ||
        item.destination_detail?.name?.toLowerCase().includes(query)
      );
    }

    if (itemSortField) {
      filtered.sort((a, b) => {
        let aVal: any = a[itemSortField];
        let bVal: any = b[itemSortField];

        if (itemSortField === 'part_detail') {
          aVal = a.part_detail?.name || '';
          bVal = b.part_detail?.name || '';
        }

        if (itemSortField === 'destination_detail') {
          aVal = a.destination_detail?.name || '';
          bVal = b.destination_detail?.name || '';
        }

        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';

        if (itemSortField === 'quantity' || itemSortField === 'received' || itemSortField === 'purchase_price') {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
          return itemSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (aStr < bStr) return itemSortDirection === 'asc' ? -1 : 1;
        if (aStr > bStr) return itemSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [items, itemSearchQuery, itemSortField, itemSortDirection]);

  const handleItemSort = (field: keyof PurchaseOrderItem) => {
    if (itemSortField === field) {
      setItemSortDirection(itemSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setItemSortField(field);
      setItemSortDirection('asc');
    }
  };

  const getItemSortIcon = (field: keyof PurchaseOrderItem) => {
    if (itemSortField !== field) return null;
    return itemSortDirection === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>{t('Order Items')}</Title>
        {canEdit && (
          <Button 
            leftSection={<IconPlus size={16} />}
            onClick={() => setItemModalOpened(true)}
          >
            {t('New item')}
          </Button>
        )}
      </Group>

      <TextInput
        placeholder={t('Search items...')}
        leftSection={<IconSearch size={16} />}
        value={itemSearchQuery}
        onChange={(e) => setItemSearchQuery(e.target.value)}
        mb="md"
      />

      <Table striped withTableBorder withColumnBorders highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('part_detail')}>
              <Group gap="xs">
                {t('Part')}
                {getItemSortIcon('part_detail')}
              </Group>
            </Table.Th>
            <Table.Th>{t('U.M.')}</Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('quantity')}>
              <Group gap="xs">
                {t('Quantity')}
                {getItemSortIcon('quantity')}
              </Group>
            </Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('received')}>
              <Group gap="xs">
                {t('Received')}
                {getItemSortIcon('received')}
              </Group>
            </Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('purchase_price')}>
              <Group gap="xs">
                {t('Unit Price')}
                {getItemSortIcon('purchase_price')}
              </Group>
            </Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('destination_detail')}>
              <Group gap="xs">
                {t('Destination')}
                {getItemSortIcon('destination_detail')}
              </Group>
            </Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('reference')}>
              <Group gap="xs">
                {t('Reference')}
                {getItemSortIcon('reference')}
              </Group>
            </Table.Th>
            {canEdit && <Table.Th>{t('Actions')}</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filteredAndSortedItems.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={canEdit ? 8 : 7}>
                {itemSearchQuery ? t('No results found') : t('No items')}
              </Table.Td>
            </Table.Tr>
          ) : (
            filteredAndSortedItems.map((item) => (
              <Table.Tr key={item._id}>
                <Table.Td>
                  <div>
                    <Text size="sm" fw={500}>{item.part_detail?.name || item.part}</Text>
                    {item.part_detail?.IPN && (
                      <Text size="xs" c="dimmed">{item.part_detail.IPN}</Text>
                    )}
                  </div>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{(item.part_detail as any)?.um || '-'}</Text>
                </Table.Td>
                <Table.Td>{item.quantity}</Table.Td>
                <Table.Td>{item.received || 0}</Table.Td>
                <Table.Td>
                  {item.purchase_price} {item.purchase_price_currency || orderCurrency}
                </Table.Td>
                <Table.Td>{item.destination_detail?.name || '-'}</Table.Td>
                <Table.Td>{item.reference || '-'}</Table.Td>
                {canEdit && (
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon 
                        variant="subtle" 
                        color="blue"
                        onClick={() => handleEditItem(item)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon 
                        variant="subtle" 
                        color="red"
                        onClick={() => handleDeleteItem(item._id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      {/* Add Item Modal */}
      <Modal
        opened={itemModalOpened}
        onClose={() => setItemModalOpened(false)}
        title={t('Add Item')}
        size="lg"
        centered
      >
        <Grid>
          <Grid.Col span={12}>
            <ApiSelect
              label={t('Part')}
              endpoint={supplierId ? `${procurementApi.getParts()}?supplier_id=${supplierId}` : procurementApi.getParts()}
              value={newItemData.part}
              onChange={(value) => setNewItemData({ ...newItemData, part: value || '' })}
              valueField="_id"
              labelFormat={(item) => `${item.name} ${(item.IPN || item.ipn) ? `(${item.IPN || item.ipn})` : ''}`}
              searchable
              searchParam="search"
              dataPath="results"
              placeholder={t('Type at least 2 characters to search...')}
              required
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <NumberInput
              label={t('Quantity')}
              placeholder="1"
              value={newItemData.quantity}
              onChange={(value) => setNewItemData({ ...newItemData, quantity: Number(value) || 1 })}
              min={0.01}
              step={1}
              required
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <ApiSelect
              label={t('Destination')}
              endpoint="/modules/inventory/api/locations"
              value={newItemData.destination}
              onChange={(value) => setNewItemData({ ...newItemData, destination: value || '' })}
              valueField="_id"
              labelField="name"
              searchable
              clearable
              placeholder={t('Select stock location')}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <NumberInput
              label={t('Purchase Price') + ` (${orderCurrency})`}
              placeholder="0.00"
              value={newItemData.purchase_price}
              onChange={(value) => setNewItemData({ ...newItemData, purchase_price: Number(value) || 0 })}
              min={0}
              step={0.01}
              decimalScale={2}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <ApiSelect
              label={t('Currency')}
              endpoint="/api/currencies"
              value={newItemData.purchase_price_currency}
              onChange={(value) => setNewItemData({ ...newItemData, purchase_price_currency: value || '' })}
              valueField="_id"
              labelFormat={(item) => item.abrev ? `${item.name} (${item.abrev})` : item.name}
              searchable
              placeholder={t('Select currency')}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <TextInput
              label={t('Reference')}
              placeholder={t('Item reference')}
              value={newItemData.reference}
              onChange={(e) => setNewItemData({ ...newItemData, reference: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Textarea
              label={t('Notes')}
              placeholder={t('Additional notes')}
              value={newItemData.notes}
              onChange={(e) => setNewItemData({ ...newItemData, notes: e.target.value })}
              minRows={3}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setItemModalOpened(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleAddItem} loading={submitting}>
            {t('Add')}
          </Button>
        </Group>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        opened={editItemModalOpened}
        onClose={() => setEditItemModalOpened(false)}
        title={t('Edit Item')}
        size="lg"
        centered
      >
        <Grid>
          <Grid.Col span={6}>
            <NumberInput
              label={t('Quantity')}
              placeholder="1"
              value={editItemData.quantity}
              onChange={(value) => setEditItemData({ ...editItemData, quantity: Number(value) || 1 })}
              min={0.01}
              step={1}
              required
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <NumberInput
              label={t('Purchase Price') + ` (${orderCurrency})`}
              placeholder="0.00"
              value={editItemData.purchase_price}
              onChange={(value) => setEditItemData({ ...editItemData, purchase_price: Number(value) || 0 })}
              min={0}
              step={0.01}
              decimalScale={2}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <ApiSelect
              label={t('Currency')}
              endpoint="/api/currencies"
              value={editItemData.purchase_price_currency}
              onChange={(value) => setEditItemData({ ...editItemData, purchase_price_currency: value || '' })}
              valueField="_id"
              labelFormat={(item) => item.abrev ? `${item.name} (${item.abrev})` : item.name}
              searchable
              placeholder={t('Select currency')}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <ApiSelect
              label={t('Destination')}
              endpoint="/modules/inventory/api/locations"
              value={editItemData.destination}
              onChange={(value) => setEditItemData({ ...editItemData, destination: value || '' })}
              valueField="_id"
              labelField="name"
              searchable
              clearable
              placeholder={t('Select stock location')}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <TextInput
              label={t('Reference')}
              placeholder={t('Item reference')}
              value={editItemData.reference}
              onChange={(e) => setEditItemData({ ...editItemData, reference: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Textarea
              label={t('Notes')}
              placeholder={t('Additional notes')}
              value={editItemData.notes}
              onChange={(e) => setEditItemData({ ...editItemData, notes: e.target.value })}
              minRows={3}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setEditItemModalOpened(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleUpdateItem} loading={submitting}>
            {t('Update')}
          </Button>
        </Group>
      </Modal>
    </>
  );
}
