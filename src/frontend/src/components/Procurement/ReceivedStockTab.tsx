import { useState, useEffect } from 'react';
import { Paper, Title, Text, Table, Button, Group, Modal, Grid, Select, NumberInput, TextInput, Textarea, Checkbox, Divider } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
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
  const [stockStatuses, setStockStatuses] = useState<{ value: number; label: string }[]>([]);

  // Container row interface
  interface ContainerRow {
    id: string;
    num_containers: number;
    products_per_container: number;
    unit: string;
    value: number;
    is_damaged: boolean;
    is_unsealed: boolean;
    is_mislabeled: boolean;
  }

  // Form state for receiving stock
  const [receiveData, setReceiveData] = useState({
    line_item: '',
    quantity: 0,
    location: '',
    batch_code: '',
    supplier_batch_code: '',
    serial_numbers: '',
    packaging: '',
    status: '65', // Quarantine status (implicit)
    notes: '',
    manufacturing_date: null as Date | null,
    expected_quantity: 0,
    expiry_date: null as Date | null,
    reset_date: null as Date | null,
    use_expiry: true, // true = expiry, false = reset
    containers_cleaned: false,
    supplier_ba_no: '',
    supplier_ba_date: null as Date | null,
    accord_ba: false,
    is_list_supplier: false,
    clean_transport: false,
    temperature_control: false,
    temperature_conditions_met: false,
  });

  const [containers, setContainers] = useState<ContainerRow[]>([]);

  useEffect(() => {
    loadReceivedItems();
    loadStockStatuses();
  }, [orderId]);

  const loadStockStatuses = async () => {
    try {
      const response = await api.get('/api/procurement/stock-statuses');
      setStockStatuses(response.data.statuses || []);
    } catch (error) {
      console.error('Failed to load stock statuses:', error);
    }
  };

  const getStatusLabel = (statusValue: number): string => {
    const status = stockStatuses.find(s => s.value === statusValue);
    return status ? status.label : String(statusValue);
  };

  const loadReceivedItems = async () => {
    try {
      const response = await api.get(`/api/procurement/purchase-orders/${orderId}/received-items`);
      setReceivedItems(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load received items:', error);
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
      // First, receive stock in InvenTree
      const receivePayload = {
        line_item: parseInt(receiveData.line_item),
        quantity: receiveData.quantity,
        location: parseInt(receiveData.location),
        batch_code: receiveData.batch_code || undefined,
        serial_numbers: receiveData.serial_numbers || undefined,
        packaging: receiveData.packaging || undefined,
        status: parseInt(receiveData.status),
        notes: receiveData.notes || undefined
      };

      const receiveResponse = await api.post(`/api/procurement/purchase-orders/${orderId}/receive-stock`, receivePayload);
      
      // Get the stock item ID from response
      const stockItemId = receiveResponse.data?.stock_item_id || receiveResponse.data?.id;

      if (stockItemId) {
        // Save extra data via plugin and MongoDB
        const extraDataPayload = {
          stock_item_id: stockItemId,
          order_id: orderId,
          supplier_batch_code: receiveData.supplier_batch_code || null,
          manufacturing_date: receiveData.manufacturing_date ? receiveData.manufacturing_date.toISOString().split('T')[0] : null,
          expected_quantity: receiveData.expected_quantity || null,
          expiry_date: receiveData.use_expiry && receiveData.expiry_date ? receiveData.expiry_date.toISOString().split('T')[0] : null,
          reset_date: !receiveData.use_expiry && receiveData.reset_date ? receiveData.reset_date.toISOString().split('T')[0] : null,
          containers: containers.length > 0 ? containers : null,
          containers_cleaned: receiveData.containers_cleaned,
          supplier_ba_no: receiveData.supplier_ba_no || null,
          supplier_ba_date: receiveData.supplier_ba_date ? receiveData.supplier_ba_date.toISOString().split('T')[0] : null,
          accord_ba: receiveData.accord_ba,
          is_list_supplier: receiveData.is_list_supplier,
          clean_transport: receiveData.clean_transport,
          temperature_control: receiveData.temperature_control,
          temperature_conditions_met: receiveData.temperature_control ? receiveData.temperature_conditions_met : null,
        };

        // Save extra data
        await api.post(`/api/procurement/stock-extra-data`, extraDataPayload);
      }

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
        supplier_batch_code: '',
        serial_numbers: '',
        packaging: '',
        status: '65',
        notes: '',
        manufacturing_date: null,
        expected_quantity: 0,
        expiry_date: null,
        reset_date: null,
        use_expiry: true,
        containers_cleaned: false,
        supplier_ba_no: '',
        supplier_ba_date: null,
        accord_ba: false,
        is_list_supplier: false,
        clean_transport: false,
        temperature_control: false,
        temperature_conditions_met: false,
      });
      setContainers([]);
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
        setReceiveData(prev => ({ ...prev, quantity: remaining, expected_quantity: remaining }));
      }
    }
  };

  // Container management functions
  const addContainerRow = () => {
    const newContainer: ContainerRow = {
      id: Date.now().toString(),
      num_containers: 1,
      products_per_container: 1,
      unit: 'pcs',
      value: 0,
      is_damaged: false,
      is_unsealed: false,
      is_mislabeled: false,
    };
    setContainers([...containers, newContainer]);
  };

  const removeContainerRow = (id: string) => {
    setContainers(containers.filter(c => c.id !== id));
  };

  const updateContainerRow = (id: string, field: keyof ContainerRow, value: any) => {
    setContainers(containers.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
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
                <Table.Td>{getStatusLabel(item.status)}</Table.Td>
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
        size="xl"
        centered
        styles={{ body: { maxHeight: '80vh', overflowY: 'auto' } }}
      >
        <Grid>
          {/* Line Item Selection */}
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

          {/* Quantity and Expected Quantity */}
          <Grid.Col span={6}>
            <NumberInput
              label={t('Received Quantity')}
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
            <NumberInput
              label={t('Expected Quantity (Delivery Docs)')}
              placeholder="0"
              value={receiveData.expected_quantity}
              onChange={(value) => setReceiveData({ ...receiveData, expected_quantity: Number(value) || 0 })}
              min={0}
              step={1}
            />
          </Grid.Col>

          {/* Location */}
          <Grid.Col span={12}>
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

          {/* Batch Codes */}
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
              label={t('Supplier Batch Code')}
              placeholder={t('Enter supplier batch code')}
              value={receiveData.supplier_batch_code}
              onChange={(e) => setReceiveData({ ...receiveData, supplier_batch_code: e.target.value })}
            />
          </Grid.Col>

          {/* Manufacturing Date */}
          <Grid.Col span={12}>
            <DateInput
              label={t('Manufacturing Date')}
              placeholder={t('Select date')}
              value={receiveData.manufacturing_date}
              onChange={(value) => setReceiveData({ ...receiveData, manufacturing_date: value })}
              clearable
            />
          </Grid.Col>

          {/* Expiry/Reset Date Section */}
          <Grid.Col span={12}>
            <Checkbox
              label={t('Use Expiry Date (uncheck for Reset Date)')}
              checked={receiveData.use_expiry}
              onChange={(e) => setReceiveData({ ...receiveData, use_expiry: e.currentTarget.checked })}
            />
          </Grid.Col>

          {receiveData.use_expiry ? (
            <Grid.Col span={12}>
              <DateInput
                label={t('Expiry Date')}
                placeholder={t('Select expiry date')}
                value={receiveData.expiry_date}
                onChange={(value) => setReceiveData({ ...receiveData, expiry_date: value })}
                clearable
              />
            </Grid.Col>
          ) : (
            <Grid.Col span={12}>
              <DateInput
                label={t('Reset Date')}
                placeholder={t('Select reset date')}
                value={receiveData.reset_date}
                onChange={(value) => setReceiveData({ ...receiveData, reset_date: value })}
                clearable
              />
            </Grid.Col>
          )}

          {/* Containers Section */}
          <Grid.Col span={12}>
            <Divider my="md" label={t('Containers')} labelPosition="center" />
          </Grid.Col>

          <Grid.Col span={12}>
            <Button 
              size="xs" 
              variant="light" 
              leftSection={<IconPlus size={14} />}
              onClick={addContainerRow}
            >
              {t('Add Container Row')}
            </Button>
          </Grid.Col>

          {containers.length > 0 && (
            <Grid.Col span={12}>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('Num')}</Table.Th>
                    <Table.Th>{t('Products/Container')}</Table.Th>
                    <Table.Th>{t('Unit')}</Table.Th>
                    <Table.Th>{t('Value')}</Table.Th>
                    <Table.Th>{t('Damaged')}</Table.Th>
                    <Table.Th>{t('Unsealed')}</Table.Th>
                    <Table.Th>{t('Mislabeled')}</Table.Th>
                    <Table.Th></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {containers.map((container) => (
                    <Table.Tr key={container.id}>
                      <Table.Td>
                        <NumberInput
                          value={container.num_containers}
                          onChange={(val) => updateContainerRow(container.id, 'num_containers', Number(val) || 1)}
                          min={1}
                          size="xs"
                          styles={{ input: { width: '60px' } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          value={container.products_per_container}
                          onChange={(val) => updateContainerRow(container.id, 'products_per_container', Number(val) || 1)}
                          min={1}
                          size="xs"
                          styles={{ input: { width: '60px' } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={container.unit}
                          onChange={(e) => updateContainerRow(container.id, 'unit', e.target.value)}
                          size="xs"
                          styles={{ input: { width: '60px' } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          value={container.value}
                          onChange={(val) => updateContainerRow(container.id, 'value', Number(val) || 0)}
                          min={0}
                          step={0.1}
                          size="xs"
                          styles={{ input: { width: '80px' } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Checkbox
                          checked={container.is_damaged}
                          onChange={(e) => updateContainerRow(container.id, 'is_damaged', e.currentTarget.checked)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Checkbox
                          checked={container.is_unsealed}
                          onChange={(e) => updateContainerRow(container.id, 'is_unsealed', e.currentTarget.checked)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Checkbox
                          checked={container.is_mislabeled}
                          onChange={(e) => updateContainerRow(container.id, 'is_mislabeled', e.currentTarget.checked)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          color="red"
                          variant="subtle"
                          onClick={() => removeContainerRow(container.id)}
                        >
                          <IconTrash size={14} />
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Grid.Col>
          )}

          <Grid.Col span={12}>
            <Checkbox
              label={t('Containers Cleaned')}
              checked={receiveData.containers_cleaned}
              onChange={(e) => setReceiveData({ ...receiveData, containers_cleaned: e.currentTarget.checked })}
            />
          </Grid.Col>

          {/* Supplier BA Section */}
          <Grid.Col span={12}>
            <Divider my="md" />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput
              label={t('Supplier BA No')}
              placeholder={t('Enter BA number')}
              value={receiveData.supplier_ba_no}
              onChange={(e) => setReceiveData({ ...receiveData, supplier_ba_no: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <DateInput
              label={t('Supplier BA Date')}
              placeholder={t('Select date')}
              value={receiveData.supplier_ba_date}
              onChange={(value) => setReceiveData({ ...receiveData, supplier_ba_date: value })}
              clearable
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Checkbox
              label={t('In Accordance with Supplier BA')}
              checked={receiveData.accord_ba}
              onChange={(e) => setReceiveData({ ...receiveData, accord_ba: e.currentTarget.checked })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Checkbox
              label={t('Supplier in List')}
              checked={receiveData.is_list_supplier}
              onChange={(e) => setReceiveData({ ...receiveData, is_list_supplier: e.currentTarget.checked })}
            />
          </Grid.Col>

          {/* Transport Section */}
          <Grid.Col span={12}>
            <Divider my="md" label={t('Transport')} labelPosition="center" />
          </Grid.Col>

          <Grid.Col span={6}>
            <Checkbox
              label={t('Clean Transport')}
              checked={receiveData.clean_transport}
              onChange={(e) => setReceiveData({ ...receiveData, clean_transport: e.currentTarget.checked })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Checkbox
              label={t('Temperature Control Transport')}
              checked={receiveData.temperature_control}
              onChange={(e) => setReceiveData({ ...receiveData, temperature_control: e.currentTarget.checked })}
            />
          </Grid.Col>

          {receiveData.temperature_control && (
            <Grid.Col span={12}>
              <Checkbox
                label={t('Temperature Conditions Met')}
                checked={receiveData.temperature_conditions_met}
                onChange={(e) => setReceiveData({ ...receiveData, temperature_conditions_met: e.currentTarget.checked })}
              />
            </Grid.Col>
          )}

          {/* Other Fields */}
          <Grid.Col span={12}>
            <Divider my="md" />
          </Grid.Col>

          <Grid.Col span={12}>
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
