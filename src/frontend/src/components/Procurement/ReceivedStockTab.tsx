import { useState, useEffect } from 'react';
import { Paper, Title, Text, Table, Button, Group, Modal, Grid, Select, NumberInput, TextInput, Textarea } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';

interface ReceivedItem {
  pk: number;
  part: number;
  part_detail?: {
    name: string;
    IPN: string;
  };
  quantity: number;
  location: number;
  location_detail?: {
    name: string;
  };
  batch: string;
  serial: string;
  packaging: string;
  status: number;
  notes: string;
}

interface PurchaseOrderItem {
  pk: number;
  part: number;
  part_detail?: {
    name: string;
    IPN: string;
  };
  quantity: number;
  received: number;
}

interface StockLocation {
  pk: number;
  name: string;
}

interface ReceivedStockTabProps {
  orderId: string;
  items: PurchaseOrderItem[];
  stockLocations: StockLocation[];
  onReload: () => void;
}

export function ReceivedStockTab({ orderId, items, stockLocations, onReload }: ReceivedStockTabProps) {
  const { t } = useTranslation();
  const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);
  const [receiveModalOpened, setReceiveModalOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stockStatuses, setStockStatuses] = useState<Array<{value: string, label: string}>>([]);

  // Form state for receiving stock
  const [receiveData, setReceiveData] = useState({
    line_item: '',
    quantity: 0,
    location: '',
    batch_code: '',
    serial_numbers: '',
    packaging: '',
    status: '10', // OK status
    notes: ''
  });

  useEffect(() => {
    loadReceivedItems();
    loadStockStatuses();
  }, [orderId]);

  const loadReceivedItems = async () => {
    try {
      const response = await api.get(`/api/procurement/purchase-orders/${orderId}/received-items`);
      setReceivedItems(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load received items:', error);
    }
  };

  const loadStockStatuses = async () => {
    try {
      const response = await api.get('/api/procurement/stock-statuses');
      const statuses = response.data.statuses || [];
      setStockStatuses(statuses.map((s: any) => ({
        value: String(s.value),
        label: s.label
      })));
    } catch (error) {
      console.error('Failed to load stock statuses:', error);
      // Fallback to default statuses
      setStockStatuses([
        { value: '10', label: 'OK' },
        { value: '50', label: 'Attention needed' },
        { value: '55', label: 'Damaged' },
        { value: '60', label: 'Destroyed' },
        { value: '65', label: 'Rejected' },
        { value: '70', label: 'Lost' },
        { value: '75', label: 'Returned' },
        { value: '80', label: 'În carantină (tranzacționabil)' }
      ]);
    }
  };

  const handleReceiveStock = async () => {
    if (!receiveData.line_item || !receiveData.quantity || !receiveData.location) {
      notifications.show({
        title: t('Error'),
        message: t('Please fill in all required fields'),
        color: 'red'
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        line_item: parseInt(receiveData.line_item),
        quantity: receiveData.quantity,
        location: parseInt(receiveData.location),
        batch_code: receiveData.batch_code || undefined,
        serial_numbers: receiveData.serial_numbers || undefined,
        packaging: receiveData.packaging || undefined,
        status: parseInt(receiveData.status),
        notes: receiveData.notes || undefined
      };

      await api.post(`/api/procurement/purchase-orders/${orderId}/receive-stock`, payload);

      notifications.show({
        title: t('Success'),
        message: t('Stock received successfully'),
        color: 'green'
      });

      // Reset form
      setReceiveData({
        line_item: '',
        quantity: 0,
        location: '',
        batch_code: '',
        serial_numbers: '',
        packaging: '',
        status: '10',
        notes: ''
      });
      setReceiveModalOpened(false);
      loadReceivedItems();
      onReload(); // Reload items to update received quantities
    } catch (error: any) {
      console.error('Failed to receive stock:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to receive stock'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLineItemChange = (value: string | null) => {
    setReceiveData({ ...receiveData, line_item: value || '' });
    
    // Auto-set max quantity based on selected item
    if (value) {
      const item = items.find(i => String(i.pk) === value);
      if (item) {
        const remaining = item.quantity - (item.received || 0);
        setReceiveData(prev => ({ ...prev, quantity: remaining }));
      }
    }
  };

  // Get available items (not fully received)
  const availableItems = items.filter(item => (item.received || 0) < item.quantity);

  // Get max quantity for selected item
  const selectedItem = items.find(i => String(i.pk) === receiveData.line_item);
  const maxQuantity = selectedItem ? selectedItem.quantity - (selectedItem.received || 0) : 0;

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={4}>{t('Received Stock')}</Title>
        <Button 
          leftSection={<IconPlus size={16} />}
          onClick={() => setReceiveModalOpened(true)}
          disabled={availableItems.length === 0}
        >
          {t('Receive Stock')}
        </Button>
      </Group>

      {receivedItems.length === 0 ? (
        <Text size="sm" c="dimmed">{t('No received items')}</Text>
      ) : (
        <Table striped withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Part')}</Table.Th>
              <Table.Th>{t('Quantity')}</Table.Th>
              <Table.Th>{t('Location')}</Table.Th>
              <Table.Th>{t('Batch')}</Table.Th>
              <Table.Th>{t('Serial')}</Table.Th>
              <Table.Th>{t('Packaging')}</Table.Th>
              <Table.Th>{t('Status')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {receivedItems.map((item) => (
              <Table.Tr key={item.pk}>
                <Table.Td>
                  {item.part_detail?.name || item.part}
                  {item.part_detail?.IPN && ` (${item.part_detail.IPN})`}
                </Table.Td>
                <Table.Td>{item.quantity}</Table.Td>
                <Table.Td>{item.location_detail?.name || item.location}</Table.Td>
                <Table.Td>{item.batch || '-'}</Table.Td>
                <Table.Td>{item.serial || '-'}</Table.Td>
                <Table.Td>{item.packaging || '-'}</Table.Td>
                <Table.Td>{item.status}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* Receive Stock Modal */}
      <Modal
        opened={receiveModalOpened}
        onClose={() => setReceiveModalOpened(false)}
        title={t('Receive Stock')}
        size="lg"
        centered
      >
        <Grid>
          <Grid.Col span={12}>
            <Select
              label={t('Line Item')}
              placeholder={t('Select item to receive')}
              data={availableItems.map(item => {
                const partName = item.part_detail?.name || `Part ${item.part}`;
                const ipn = item.part_detail?.IPN || '';
                const received = item.received || 0;
                const total = item.quantity;
                return {
                  value: String(item.pk),
                  label: `${partName} - ${ipn} (${received}/${total})`
                };
              })}
              value={receiveData.line_item}
              onChange={handleLineItemChange}
              searchable
              required
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <NumberInput
              label={t('Quantity')}
              placeholder="0"
              value={receiveData.quantity}
              onChange={(value) => setReceiveData({ ...receiveData, quantity: Number(value) || 0 })}
              min={0.01}
              max={maxQuantity}
              step={1}
              required
              description={maxQuantity > 0 ? `${t('Max')}: ${maxQuantity}` : ''}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Select
              label={t('Location')}
              placeholder={t('Select location')}
              data={stockLocations.map(loc => ({ value: String(loc.pk), label: loc.name }))}
              value={receiveData.location}
              onChange={(value) => setReceiveData({ ...receiveData, location: value || '' })}
              searchable
              required
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput
              label={t('Batch Code')}
              placeholder={t('Enter batch code')}
              value={receiveData.batch_code}
              onChange={(e) => setReceiveData({ ...receiveData, batch_code: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput
              label={t('Packaging')}
              placeholder={t('Enter packaging info')}
              value={receiveData.packaging}
              onChange={(e) => setReceiveData({ ...receiveData, packaging: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <TextInput
              label={t('Serial Numbers')}
              placeholder={t('Enter serial numbers (comma separated)')}
              value={receiveData.serial_numbers}
              onChange={(e) => setReceiveData({ ...receiveData, serial_numbers: e.target.value })}
              description={t('For multiple serials, separate with commas')}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Select
              label={t('Status')}
              data={stockStatuses}
              value={receiveData.status}
              onChange={(value) => setReceiveData({ ...receiveData, status: value || '10' })}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Textarea
              label={t('Notes')}
              placeholder={t('Additional notes')}
              value={receiveData.notes}
              onChange={(e) => setReceiveData({ ...receiveData, notes: e.target.value })}
              minRows={3}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setReceiveModalOpened(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleReceiveStock} loading={submitting}>
            {t('Receive')}
          </Button>
        </Group>
      </Modal>
    </Paper>
  );
}
