import { useState } from 'react';
import {
  Paper,
  Table,
  Text,
  ActionIcon,
  Group,
  Button,
  Modal,
  Grid,
  NumberInput,
  TextInput,
  Stack,
} from '@mantine/core';
import { IconTrash, IconEdit, IconBoxSeam, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { SalesOrderItem, SalesOrder, salesService } from '../../../services/sales';
import { ApiSelect } from '../../Common/ApiSelect';

interface SalesItemsTabProps {
    order: SalesOrder;
    items: SalesOrderItem[];
    onItemUpdate: () => void;
    onAllocate?: (itemId: string) => void;
}

export function SalesItemsTab({ order, items, onItemUpdate, onAllocate }: SalesItemsTabProps) {
  const { t } = useTranslation();
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SalesOrderItem | null>(null);

  const [newItem, setNewItem] = useState({
    part_id: '',
    quantity: 1,
    sale_price: 0,
    sale_price_currency: order.currency || 'EUR',
    reference: '',
    notes: '',
  });

  const [editItem, setEditItem] = useState({
    quantity: 1,
    sale_price: 0,
    sale_price_currency: order.currency || 'EUR',
    reference: '',
    notes: '',
  });

  const handleAllocate = (item: SalesOrderItem) => {
    onAllocate?.(item._id);
  };

  const handleDelete = (item: SalesOrderItem) => {
    if (!order?._id || !item?._id) return;
    if (!confirm(t('Are you sure you want to delete this item?'))) return;
    salesService.deleteSalesOrderItem(order._id, item._id)
      .then(() => {
        notifications.show({ title: t('Success'), message: t('Item deleted'), color: 'green' });
        onItemUpdate();
      })
      .catch((err) => {
        console.error(err);
        notifications.show({ title: t('Error'), message: err.response?.data?.detail || t('Failed to delete item'), color: 'red' });
      });
  };

  const openEdit = (item: SalesOrderItem) => {
    setSelectedItem(item);
    setEditItem({
      quantity: item.quantity,
      sale_price: Number((item as any).sale_price || 0),
      sale_price_currency: (item as any).sale_price_currency || order.currency || 'EUR',
      reference: item.reference || '',
      notes: item.notes || '',
    });
    setEditModal(true);
  };

  const submitAdd = async () => {
    if (!newItem.part_id) {
      notifications.show({ title: t('Error'), message: t('Please select a product'), color: 'red' });
      return;
    }
    setSubmitting(true);
    try {
      await salesService.addSalesOrderItem(order._id, {
        part_id: newItem.part_id,
        quantity: newItem.quantity,
        sale_price: newItem.sale_price || undefined,
        sale_price_currency: newItem.sale_price_currency || undefined,
        reference: newItem.reference || undefined,
        notes: newItem.notes || undefined,
      });
      notifications.show({ title: t('Success'), message: t('Item added'), color: 'green' });
      setAddModal(false);
      setNewItem({
        part_id: '',
        quantity: 1,
        sale_price: 0,
        sale_price_currency: order.currency || 'EUR',
        reference: '',
        notes: '',
      });
      onItemUpdate();
    } catch (err: any) {
      console.error(err);
      notifications.show({ title: t('Error'), message: err.response?.data?.detail || t('Failed to add item'), color: 'red' });
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async () => {
    if (!selectedItem?._id) return;
    setSubmitting(true);
    try {
      await salesService.updateSalesOrderItem(order._id, selectedItem._id, {
        quantity: editItem.quantity,
        sale_price: editItem.sale_price || undefined,
        sale_price_currency: editItem.sale_price_currency || undefined,
        reference: editItem.reference || undefined,
        notes: editItem.notes || undefined,
      });
      notifications.show({ title: t('Success'), message: t('Item updated'), color: 'green' });
      setEditModal(false);
      setSelectedItem(null);
      onItemUpdate();
    } catch (err: any) {
      console.error(err);
      notifications.show({ title: t('Error'), message: err.response?.data?.detail || t('Failed to update item'), color: 'red' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper shadow="sm" p="md">
      <Group justify="space-between" mb="md">
        <Text fw={600}>{t('Items')}</Text>
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => setAddModal(true)}
        >
          {t('Add Item')}
        </Button>
      </Group>
      <Table striped withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Part')}</Table.Th>
            <Table.Th>{t('Quantity')}</Table.Th>
                        <Table.Th>{t('Allocated')}</Table.Th>
                        <Table.Th>{t('Unit Price')}</Table.Th>
                        <Table.Th>{t('Line Total')}</Table.Th>
                        <Table.Th>{t('Reference')}</Table.Th>
                        <Table.Th>{t('Actions')}</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {items.length === 0 ? (
                        <Table.Tr>
                            <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                                <Text c="dimmed">{t('No items')}</Text>
                            </Table.Td>
                        </Table.Tr>
                    ) : (
                        items.map((item) => {
                            // Fix the Unit Price OID issue by ensuring it's formatting a number,
                            // or parsing appropriately if backend still sends something weird.
                            const unitPrice = parseFloat((item as any).sale_price || 0);
                            const lineTotal = unitPrice * (item.quantity || 0);
                            const currency = (item as any).sale_price_currency || order.currency || 'EUR';

                            return (
                                <Table.Tr key={item._id}>
                                    <Table.Td>
                                        <div>
                                            <Text size="sm" fw={500}>
                                                {item.part_detail?.name || item.part}
                                            </Text>
                                            {item.part_detail?.IPN && (
                                                <Text size="xs" c="dimmed">
                                                    {item.part_detail.IPN}
                                                </Text>
                                            )}
                                        </div>
                                    </Table.Td>
                                    <Table.Td>{item.quantity}</Table.Td>
                                    <Table.Td>{item.allocated || 0}</Table.Td>
                                    <Table.Td>
                                        {unitPrice > 0 ? `${unitPrice.toFixed(2)} ${currency}` : '-'}
                                    </Table.Td>
                                    <Table.Td>
                                        {lineTotal > 0 ? `${lineTotal.toFixed(2)} ${currency}` : '-'}
                                    </Table.Td>
                                    <Table.Td>{item.reference || '-'}</Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <ActionIcon variant="subtle" color="blue" onClick={() => handleAllocate(item)}>
                                                <IconBoxSeam size={16} />
                                            </ActionIcon>
                                            <ActionIcon variant="subtle" color="gray" onClick={() => openEdit(item)}>
                                                <IconEdit size={16} />
                                            </ActionIcon>
                                            <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item)}>
                                                <IconTrash size={16} />
                                            </ActionIcon>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            );
                        })
                    )}
        </Table.Tbody>
      </Table>

      {/* Add Item Modal */}
      <Modal opened={addModal} onClose={() => setAddModal(false)} title={t('Add Item')} centered size="lg">
        <Stack gap="md">
          <ApiSelect
            label={t('Product')}
            endpoint={`/modules/inventory/api/parts`}
            queryParams={{ is_salable: true }}
            value={newItem.part_id}
            onChange={(value) => setNewItem({ ...newItem, part_id: value || '' })}
            valueField="_id"
            labelFormat={(item) => `${item.name}${item.IPN ? ` (${item.IPN})` : ''}`}
            searchable
            required
            searchParam="search"
            dataPath="results"
            description={t('Only salable products are listed')}
          />
          <Grid>
            <Grid.Col span={6}>
              <NumberInput
                label={t('Quantity')}
                value={newItem.quantity}
                onChange={(v) => setNewItem({ ...newItem, quantity: Number(v) || 1 })}
                min={0.01}
                step={1}
                required
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label={`${t('Unit Price')} (${newItem.sale_price_currency})`}
                value={newItem.sale_price}
                onChange={(v) => setNewItem({ ...newItem, sale_price: Number(v) || 0 })}
                min={0}
                step={0.01}
                decimalScale={2}
              />
            </Grid.Col>
          </Grid>
          <TextInput
            label={t('Reference')}
            value={newItem.reference}
            onChange={(e) => setNewItem({ ...newItem, reference: e.target.value })}
          />
          <TextInput
            label={t('Notes')}
            value={newItem.notes}
            onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setAddModal(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={submitAdd} loading={submitting}>
              {t('Add')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Item Modal */}
      <Modal opened={editModal} onClose={() => setEditModal(false)} title={t('Edit Item')} centered size="lg">
        <Stack gap="md">
          <Grid>
            <Grid.Col span={6}>
              <NumberInput
                label={t('Quantity')}
                value={editItem.quantity}
                onChange={(v) => setEditItem({ ...editItem, quantity: Number(v) || 1 })}
                min={0.01}
                step={1}
                required
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label={`${t('Unit Price')} (${editItem.sale_price_currency})`}
                value={editItem.sale_price}
                onChange={(v) => setEditItem({ ...editItem, sale_price: Number(v) || 0 })}
                min={0}
                step={0.01}
                decimalScale={2}
              />
            </Grid.Col>
          </Grid>
          <TextInput
            label={t('Reference')}
            value={editItem.reference}
            onChange={(e) => setEditItem({ ...editItem, reference: e.target.value })}
          />
          <TextInput
            label={t('Notes')}
            value={editItem.notes}
            onChange={(e) => setEditItem({ ...editItem, notes: e.target.value })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditModal(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={submitEdit} loading={submitting}>
              {t('Save')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
