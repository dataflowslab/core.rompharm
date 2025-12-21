import { useState, useEffect } from 'react';
import { Paper, Title, Text, Table, Button, Group, Modal, ActionIcon, Badge } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { procurementApi } from '../../services/procurement';
import { notifications } from '@mantine/notifications';
import { ReceiveStockForm, ReceiveStockFormData } from '../Common/ReceiveStockForm';

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
  status_detail?: {
    name: string;
    value: number;
    color: string;
  };
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
  supplierName?: string;
  supplierId?: string;
}

export function ReceivedStockTab({ orderId, items, stockLocations, onReload, supplierName, supplierId }: ReceivedStockTabProps) {
  const { t } = useTranslation();
  const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);
  const [receiveModalOpened, setReceiveModalOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stockStatuses, setStockStatuses] = useState<{ value: string; label: string }[]>([]);
  const [systemUms, setSystemUms] = useState<{ value: string; label: string }[]>([]);
  
  // Form state using ReceiveStockFormData interface
  const [formData, setFormData] = useState<ReceiveStockFormData>({
    line_item: '',
    quantity: 0,
    location: '',
    batch_code: '',
    supplier_batch_code: '',
    serial_numbers: '',
    packaging: '',
    status: '65', // Quarantine status (implicit)
    supplier_id: supplierId || '',
    supplier_um_id: '694813b6297c9dde6d7065b7', // Default supplier UM
    notes: '',
    manufacturing_date: null,
    expected_quantity: 0,
    expiry_date: null,
    reset_date: null,
    use_expiry: true,
    containers: [],
    containers_cleaned: false,
    supplier_ba_no: '',
    supplier_ba_date: null,
    accord_ba: false,
    is_list_supplier: false,
    clean_transport: false,
    temperature_control: false,
    temperature_conditions_met: false,
  });

  useEffect(() => {
    loadReceivedItems();
    loadStockStatuses();
    loadSystemUms();
  }, [orderId]);

  const loadStockStatuses = async () => {
    try {
      const response = await api.get(procurementApi.getStockStatuses());
      const statuses = response.data.statuses || [];
      setStockStatuses(statuses.map((s: any) => ({
        value: String(s.value),
        label: s.name || s.label
      })));
      
      // Set default status to Quarantined if available
      const quarantinedStatus = statuses.find((s: any) => 
        s.name?.toLowerCase().includes('quarantin')
      );
      if (quarantinedStatus) {
        setFormData(prev => ({ ...prev, status: String(quarantinedStatus.value) }));
      }
    } catch (error) {
      console.error('Failed to load stock statuses:', error);
    }
  };

  const loadSystemUms = async () => {
    try {
      const response = await api.get('/modules/inventory/api/system-ums');
      const ums = response.data || [];
      setSystemUms(ums.map((um: any) => ({ 
        value: um._id, 
        label: `${um.name} (${um.abrev})` 
      })));
    } catch (error) {
      console.error('Failed to fetch system UMs:', error);
    }
  };

  const getStatusLabel = (statusValue: number): string => {
    const status = stockStatuses.find(s => Number(s.value) === statusValue);
    return status ? status.label : String(statusValue);
  };

  const loadReceivedItems = async () => {
    try {
      const response = await api.get(procurementApi.getReceivedItems(orderId));
      setReceivedItems(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load received items:', error);
    }
  };

  const handleDeleteStock = (item: ReceivedItem) => {
    modals.openConfirmModal({
      title: t('Delete Received Stock'),
      children: (
        <Text size="sm">
          {t('Are you sure you want to delete this stock item?')}
          <br />
          <strong>{item.part_detail?.name || item.part}</strong>
          <br />
          {t('Quantity')}: {item.quantity}
          <br />
          {t('Batch')}: {item.batch || '-'}
        </Text>
      ),
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(`/modules/depo_procurement/api/stock-items/${item.pk}`);
          notifications.show({
            title: t('Success'),
            message: t('Stock item deleted successfully'),
            color: 'green'
          });
          loadReceivedItems();
          onReload();
        } catch (error: any) {
          console.error('Failed to delete stock:', error);
          notifications.show({
            title: t('Error'),
            message: error.response?.data?.detail || t('Failed to delete stock item'),
            color: 'red'
          });
        }
      }
    });
  };

  const handleReceiveStock = async () => {
    if (!formData.line_item || !formData.quantity || !formData.location) {
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
        line_item: parseInt(formData.line_item),
        quantity: formData.quantity,
        location: parseInt(formData.location),
        batch_code: formData.batch_code || undefined,
        serial_numbers: formData.serial_numbers || undefined,
        packaging: formData.packaging || undefined,
        status: parseInt(formData.status),
        notes: formData.notes || undefined
      };

      const receiveResponse = await api.post(procurementApi.receiveStock(orderId), receivePayload);
      
      // Get the stock item ID from response
      const stockItemId = receiveResponse.data?.stock_item_id || receiveResponse.data?.id;

      if (stockItemId) {
        // Save extra data via plugin and MongoDB
        const extraDataPayload = {
          stock_item_id: stockItemId,
          order_id: orderId,
          supplier_batch_code: formData.supplier_batch_code || null,
          supplier_um_id: formData.supplier_um_id || null,
          manufacturing_date: formData.manufacturing_date ? formData.manufacturing_date.toISOString().split('T')[0] : null,
          expected_quantity: formData.expected_quantity || null,
          expiry_date: formData.use_expiry && formData.expiry_date ? formData.expiry_date.toISOString().split('T')[0] : null,
          reset_date: !formData.use_expiry && formData.reset_date ? formData.reset_date.toISOString().split('T')[0] : null,
          containers: formData.containers.length > 0 ? formData.containers : null,
          containers_cleaned: formData.containers_cleaned,
          supplier_ba_no: formData.supplier_ba_no || null,
          supplier_ba_date: formData.supplier_ba_date ? formData.supplier_ba_date.toISOString().split('T')[0] : null,
          accord_ba: formData.accord_ba,
          is_list_supplier: formData.is_list_supplier,
          clean_transport: formData.clean_transport,
          temperature_control: formData.temperature_control,
          temperature_conditions_met: formData.temperature_control ? formData.temperature_conditions_met : null,
        };

        // Save extra data
        await api.post(`/modules/depo_procurement/api/stock-extra-data`, extraDataPayload);
      }

      notifications.show({
        title: t('Success'),
        message: t('Stock received successfully'),
        color: 'green'
      });

      // Reset form
      setFormData({
        line_item: '',
        quantity: 0,
        location: '',
        batch_code: '',
        supplier_batch_code: '',
        serial_numbers: '',
        packaging: '',
        status: '65',
        supplier_id: supplierId || '',
        supplier_um_id: '694813b6297c9dde6d7065b7',
        notes: '',
        manufacturing_date: null,
        expected_quantity: 0,
        expiry_date: null,
        reset_date: null,
        use_expiry: true,
        containers: [],
        containers_cleaned: false,
        supplier_ba_no: '',
        supplier_ba_date: null,
        accord_ba: false,
        is_list_supplier: false,
        clean_transport: false,
        temperature_control: false,
        temperature_conditions_met: false,
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
    setFormData({ ...formData, line_item: value || '' });
    
    // Auto-set max quantity based on selected item
    if (value) {
      const item = items.find(i => String(i.pk) === value);
      if (item) {
        const remaining = item.quantity - (item.received || 0);
        setFormData(prev => ({ ...prev, quantity: remaining, expected_quantity: remaining }));
      }
    }
  };

  // Get available items (not fully received)
  const availableItems = items.filter(item => (item.received || 0) < item.quantity);

  // Get max quantity for selected item
  const selectedItem = items.find(i => String(i.pk) === formData.line_item);
  const maxQuantity = selectedItem ? selectedItem.quantity - (selectedItem.received || 0) : 0;

  // Prepare line items for ReceiveStockForm
  const lineItemsData = availableItems.map(item => {
    const partName = item.part_detail?.name || `Part ${item.part}`;
    const ipn = item.part_detail?.IPN || '';
    const received = item.received || 0;
    const total = item.quantity;
    return {
      value: String(item.pk),
      label: `${partName} - ${ipn} (${received}/${total})`
    };
  });

  // Prepare locations for ReceiveStockForm
  const locationsData = stockLocations
    .filter(loc => loc.pk != null && loc.pk !== undefined)
    .map(loc => ({ value: String(loc.pk), label: loc.name }));

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
              <Table.Th>{t('Status')}</Table.Th>
              <Table.Th style={{ width: '60px' }}>{t('Actions')}</Table.Th>
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
                <Table.Td>
                  {item.status_detail ? (
                    <Badge
                      style={{
                        backgroundColor: item.status_detail.color || '#gray',
                        color: '#fff',
                      }}
                    >
                      {item.status_detail.name}
                    </Badge>
                  ) : (
                    <Badge color="gray">{getStatusLabel(item.status)}</Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => handleDeleteStock(item)}
                    title={t('Delete')}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* Receive Stock Modal - Using ReceiveStockForm */}
      <Modal
        opened={receiveModalOpened}
        onClose={() => setReceiveModalOpened(false)}
        title={t('Receive Stock')}
        size="xl"
        centered
        styles={{ body: { maxHeight: '80vh', overflowY: 'auto' } }}
      >
        <ReceiveStockForm
          formData={formData}
          onChange={setFormData}
          lineItems={lineItemsData}
          onLineItemChange={handleLineItemChange}
          maxQuantity={maxQuantity}
          locations={locationsData}
          stockStatuses={stockStatuses}
          systemUms={systemUms}
          suppliers={[]}
          fixedSupplier={supplierName && supplierId ? {
            id: supplierId,
            name: supplierName
          } : undefined}
        />

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
