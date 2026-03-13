import { useState, useEffect } from 'react';
import { Paper, Title, Text, Button, Group, Modal, Grid } from '@mantine/core';
import { IconPlus, IconPrinter } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { returnsApi, ReturnOrderItem, StockLocation } from '../../services/returns';
import { notifications } from '@mantine/notifications';
import { ReceiveStockForm, ReceiveStockFormData } from '../Common/ReceiveStockForm';
import { ReceivedStockTable } from '../Procurement/ReceivedStockTable';
import { ItemsReceiveHelper } from '../Procurement/ItemsReceiveHelper';
import { PrintLabelsModal } from '../Common/PrintLabelsModal';
import { ReceivedItem } from '../../types/procurement';

interface ReceivedStockTabProps {
  orderId: string;
  items: ReturnOrderItem[];
  stockLocations: StockLocation[];
  onReload: () => void;
  canModify?: boolean;
}

export function ReceivedStockTab({ orderId, items, stockLocations, onReload, canModify = true }: ReceivedStockTabProps) {
  const { t } = useTranslation();
  const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);
  const [receiveModalOpened, setReceiveModalOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stockStatuses, setStockStatuses] = useState<{ value: string; label: string }[]>([]);
  const [systemUms, setSystemUms] = useState<{ value: string; label: string }[]>([]);
  const [selectedReceivedItems, setSelectedReceivedItems] = useState<string[]>([]);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const [formData, setFormData] = useState<ReceiveStockFormData>({
    line_item: '',
    quantity: 0,
    location: '',
    batch_code: '',
    supplier_batch_code: '',
    serial_numbers: '',
    packaging: '',
    transferable: false,
    supplier_id: '',
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

  useEffect(() => {
    loadReceivedItems();
    loadStockStatuses();
    loadSystemUms();
  }, [orderId]);

  const loadReceivedItems = async () => {
    try {
      const response = await api.get(returnsApi.getReceivedItems(orderId));
      setReceivedItems(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load received items:', error);
    }
  };

  const loadStockStatuses = async () => {
    try {
      const response = await api.get(returnsApi.getStockStatuses());
      const statuses = response.data.statuses || [];
      setStockStatuses(statuses.map((s: any) => ({
        value: String(s.value),
        label: s.name || s.label
      })));
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
          {t('Batch')}: {item.batch_code || item.batch || '-'}
        </Text>
      ),
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(returnsApi.deleteStockItem(item._id));
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

    if (formData.quantity <= 0) {
      modals.open({
        title: t('Invalid Quantity'),
        children: (
          <Text size="sm">
            {t('Quantity must be greater than zero. Please enter a valid quantity.')}
          </Text>
        ),
        labels: { confirm: t('OK'), cancel: t('Cancel') },
      });
      return;
    }

    setSubmitting(true);
    try {
      const selectedItem = items.find(i => i._id === formData.line_item);
      if (!selectedItem) {
        notifications.show({
          title: t('Error'),
          message: t('Selected item not found'),
          color: 'red'
        });
        setSubmitting(false);
        return;
      }

      const receivePayload = {
        order_item_id: selectedItem._id,
        part_id: selectedItem.part_id,
        quantity: formData.quantity,
        location_id: formData.location,
        batch_code: formData.batch_code || '',
        supplier_batch_code: formData.supplier_batch_code || '',
        serial_numbers: formData.serial_numbers || '',
        packaging: formData.packaging || '',
        transferable: formData.transferable,
        supplier_id: formData.supplier_id || '',
        supplier_um_id: formData.supplier_um_id || '694813b6297c9dde6d7065b7',
        supplier_ba_no: formData.supplier_ba_no || '',
        supplier_ba_date: formData.supplier_ba_date ? formData.supplier_ba_date.toISOString().split('T')[0] : null,
        notes: formData.notes || '',
        manufacturing_date: formData.manufacturing_date ? formData.manufacturing_date.toISOString().split('T')[0] : null,
        expected_quantity: formData.expected_quantity || 0,
        expiry_date: formData.use_expiry && formData.expiry_date ? formData.expiry_date.toISOString().split('T')[0] : null,
        reset_date: !formData.use_expiry && formData.reset_date ? formData.reset_date.toISOString().split('T')[0] : null,
        containers: formData.containers.length > 0 ? formData.containers : [],
        containers_cleaned: formData.containers_cleaned,
        accord_ba: formData.accord_ba,
        is_list_supplier: formData.is_list_supplier,
        clean_transport: formData.clean_transport,
        temperature_control: formData.temperature_control,
        temperature_conditions_met: formData.temperature_control ? formData.temperature_conditions_met : false,
      };

      await api.post(returnsApi.receiveStock(orderId), receivePayload);

      notifications.show({
        title: t('Success'),
        message: t('Stock received successfully'),
        color: 'green'
      });

      setFormData({
        line_item: '',
        quantity: 0,
        location: '',
        batch_code: '',
        supplier_batch_code: '',
        serial_numbers: '',
        packaging: '',
        transferable: false,
        supplier_id: '',
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
      onReload();
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

    if (value) {
      const item = items.find(i => i._id === value);
      if (item) {
        const remaining = item.quantity - (item.received || 0);
        setFormData(prev => ({ ...prev, expected_quantity: remaining }));
      }
    }
  };

  const handleReceiveFromHelper = (itemId: string) => {
    setFormData(prev => ({ ...prev, line_item: itemId }));
    const item = items.find(i => i._id === itemId);
    if (item) {
      const remaining = item.quantity - (item.received || 0);
      setFormData(prev => ({ ...prev, expected_quantity: remaining }));
    }
    setReceiveModalOpened(true);
  };

  const availableItems = items.filter(item => (item.received || 0) < item.quantity);

  const selectedItem = items.find(i => i._id === formData.line_item);
  const maxQuantity = selectedItem ? selectedItem.quantity - (selectedItem.received || 0) : 0;

  const lineItemsData = availableItems.map(item => {
    const partName = item.part_detail?.name || `Part ${item.part_id}`;
    const ipn = item.part_detail?.IPN || '';
    const received = item.received || 0;
    const total = item.quantity;
    return {
      value: item._id,
      label: `${partName} - ${ipn} (${received}/${total})`
    };
  });

  const locationsData = stockLocations.map(loc => ({
    value: loc._id,
    label: loc.name
  }));

  const hasReceivedItems = receivedItems.length > 0;

  const getSelectedPrintItems = () => {
    return receivedItems
      .filter(i => selectedReceivedItems.includes(i._id))
      .map(i => ({
        id: i._id,
        name: i.part_detail?.name || i.part,
        code: i.batch_code || i.batch || '-'
      }));
  };

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={4}>{t('Items')}</Title>
      </Group>
      <ItemsReceiveHelper
        items={items as any}
        onReceiveClick={handleReceiveFromHelper}
        canModify={canModify}
      />

      <Group justify="space-between" mb="md" mt="xl">
        <Title order={4}>{t('Received Stock')}</Title>
        <Group>
          {selectedReceivedItems.length > 0 && (
            <Button
              variant="light"
              leftSection={<IconPrinter size={16} />}
              onClick={() => setPrintModalOpen(true)}
            >
              {t('Print Labels')} ({selectedReceivedItems.length})
            </Button>
          )}
          {canModify && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setReceiveModalOpened(true)}
              disabled={availableItems.length === 0}
            >
              {t('Receive Stock')}
            </Button>
          )}
        </Group>
      </Group>

      <PrintLabelsModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        items={getSelectedPrintItems()}
        table="depo_stocks"
      />

      {!hasReceivedItems ? (
        <Text size="sm" c="dimmed">{t('No received items')}</Text>
      ) : (
        <Grid>
          <Grid.Col span={12}>
            <ReceivedStockTable
              items={receivedItems}
              canModifyStock={canModify}
              onDeleteStock={handleDeleteStock}
              getStatusLabel={getStatusLabel}
              selectedItems={selectedReceivedItems}
              onSelectionChange={setSelectedReceivedItems}
            />
          </Grid.Col>
        </Grid>
      )}

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
          fixedSupplier={undefined}
          manufacturerUm={selectedItem?.part_detail?.manufacturer_um}
          articleLotallexp={(selectedItem?.part_detail as any)?.lotallexp ?? false}
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
