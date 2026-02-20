import { useState, useEffect } from 'react';
import { Paper, Title, Text, Button, Group, Modal, Grid } from '@mantine/core';
import { IconPlus, IconPrinter } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { procurementApi } from '../../services/procurement';
import { notifications } from '@mantine/notifications';
import { ReceiveStockForm, ReceiveStockFormData } from '../Common/ReceiveStockForm';
import { ReceivedStockTable } from './ReceivedStockTable';
import { ReceivedStockApproval } from './ReceivedStockApproval';
import { ReceivedItem, PurchaseOrderItem, StockLocation, ApprovalFlow } from '../../types/procurement';
import { PrintLabelsModal } from '../Common/PrintLabelsModal';

interface ReceivedStockTabProps {
  orderId: string;
  items: PurchaseOrderItem[];
  stockLocations: StockLocation[];
  onReload: () => void;
  supplierName?: string;
  supplierId?: string;
  orderStateId?: string;
  canModify?: boolean;
}

export function ReceivedStockTab({ orderId, items, stockLocations, onReload, supplierName, supplierId, orderStateId, canModify = true }: ReceivedStockTabProps) {
  const { t } = useTranslation();

  // Check if order is in FINISHED or CANCELLED state (cannot modify)
  const FINISHED_STATE = '6943a4a6451609dd8a618ce3';
  const CANCELLED_STATE = '6943a4a6451609dd8a618ce2';
  const isOrderLocked = orderStateId === FINISHED_STATE || orderStateId === CANCELLED_STATE;
  const canModifyStock = canModify && !isOrderLocked;
  const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);
  const [receiveModalOpened, setReceiveModalOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stockStatuses, setStockStatuses] = useState<{ value: string; label: string }[]>([]);
  const [systemUms, setSystemUms] = useState<{ value: string; label: string }[]>([]);
  const [selectedReceivedItems, setSelectedReceivedItems] = useState<string[]>([]);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Approval flow state
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlow | null>(null);
  const [loadingFlow, setLoadingFlow] = useState(false);
  const [signing, setSigning] = useState(false);
  const [targetStateId, setTargetStateId] = useState<string>('');
  const [availableStates, setAvailableStates] = useState<{ value: string; label: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [refusalComments, setRefusalComments] = useState<string>('');

  // Form state using ReceiveStockFormData interface
  const [formData, setFormData] = useState<ReceiveStockFormData>({
    line_item: '',
    quantity: 0,
    location: '',
    batch_code: '',
    supplier_batch_code: '',
    serial_numbers: '',
    packaging: '',
    transferable: false, // Stock can be transferred while in quarantine
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
    loadApprovalFlow();
    loadCurrentUser();
    loadAvailableStates();
  }, [orderId]);

  const loadCurrentUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setCurrentUserId(response.data._id);
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  };

  const loadApprovalFlow = async () => {
    setLoadingFlow(true);
    try {
      const response = await api.get(`/modules/depo_procurement/api/purchase-orders/${orderId}/received-stock-approval-flow`);
      setApprovalFlow(response.data.flow);
    } catch (error) {
      console.error('Failed to load approval flow:', error);
    } finally {
      setLoadingFlow(false);
    }
  };

  const loadAvailableStates = async () => {
    try {
      const response = await api.get('/modules/depo_procurement/api/order-statuses');
      const allStates = response.data.statuses || [];
      // Filter states: 6943a4a6451609dd8a618ce3, 6943a4a6451609dd8a618ce4
      const targetStates = allStates.filter((s: any) =>
        s._id === '6943a4a6451609dd8a618ce3' || s._id === '6943a4a6451609dd8a618ce4'
      );
      setAvailableStates(targetStates.map((s: any) => ({
        value: s._id,
        label: s.name
      })));
      // Set default to first state
      if (targetStates.length > 0 && !targetStateId) {
        setTargetStateId(targetStates[0]._id);
      }
    } catch (error) {
      console.error('Failed to load available states:', error);
    }
  };

  const handleSignReceivedStock = () => {
    if (!targetStateId) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a target state'),
        color: 'red'
      });
      return;
    }

    // Get selected state name
    const selectedState = availableStates.find(s => s.value === targetStateId);
    const isRefused = selectedState?.label?.toLowerCase().includes('refused') ||
      selectedState?.label?.toLowerCase().includes('refuz');

    // Validate comments for refused state
    if (isRefused && !refusalComments.trim()) {
      notifications.show({
        title: t('Error'),
        message: t('Comments are required when refusing received stock'),
        color: 'red'
      });
      return;
    }

    // Show confirmation modal
    modals.openConfirmModal({
      title: t('Confirm Signature'),
      children: (
        <Text size="sm">
          {t('Are you sure you want to sign this received stock with state')}: <strong>{selectedState?.label}</strong>?
        </Text>
      ),
      labels: { confirm: t('Sign'), cancel: t('Cancel') },
      confirmProps: { color: 'blue' },
      onConfirm: async () => {
        try {
          setSigning(true);
          await api.post(`/modules/depo_procurement/api/purchase-orders/${orderId}/sign-received-stock`, {
            target_state_id: targetStateId
          });

          notifications.show({
            title: t('Success'),
            message: t('Received stock signed successfully'),
            color: 'green'
          });

          // Refresh page to update order state and UI
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } catch (error: any) {
          notifications.show({
            title: t('Error'),
            message: error.response?.data?.detail || t('Failed to sign received stock'),
            color: 'red'
          });
          setSigning(false);
        }
      }
    });
  };

  const handleRemoveSignature = (userId: string, username: string) => {
    modals.openConfirmModal({
      title: t('Remove Signature'),
      children: (
        <Text size="sm">
          {t('Are you sure you want to remove the signature from')} <strong>{username}</strong>?
        </Text>
      ),
      labels: { confirm: t('Remove'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(`/modules/depo_procurement/api/purchase-orders/${orderId}/received-stock-signatures/${userId}`);
          notifications.show({
            title: t('Success'),
            message: t('Signature removed successfully'),
            color: 'green'
          });
          await loadApprovalFlow();
          onReload();
        } catch (error: any) {
          notifications.show({
            title: t('Error'),
            message: error.response?.data?.detail || t('Failed to remove signature'),
            color: 'red'
          });
        }
      },
    });
  };

  const loadStockStatuses = async () => {
    try {
      const response = await api.get(procurementApi.getStockStatuses());
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
          {t('Batch')}: {item.batch_code || item.batch || '-'}
        </Text>
      ),
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(`/modules/depo_procurement/api/stock-items/${item._id}`);
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

    // Validate quantity is positive
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
      // Find selected item to get part_id
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

      // Prepare complete payload with all form data
      const receivePayload = {
        part_id: selectedItem.part_id,  // Send part_id instead of line_item_index
        quantity: formData.quantity,
        location_id: formData.location,
        batch_code: formData.batch_code || '',
        supplier_batch_code: formData.supplier_batch_code || '',
        serial_numbers: formData.serial_numbers || '',
        packaging: formData.packaging || '',
        transferable: formData.transferable, // Backend will determine actual status based on part.regulated and this flag
        supplier_id: formData.supplier_id || supplierId || '',
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

      console.log('[ReceivedStockTab] Sending payload:', receivePayload);

      await api.post(procurementApi.receiveStock(orderId), receivePayload);

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
        transferable: false,
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

    // Auto-set expected quantity based on selected item (but allow user to receive more)
    if (value) {
      const item = items.find(i => i._id === value);
      if (item) {
        const remaining = item.quantity - (item.received || 0);
        // Only set expected_quantity, not the actual quantity (user can enter any amount)
        setFormData(prev => ({ ...prev, expected_quantity: remaining }));
      }
    }
  };

  // Get available items (not fully received)
  const availableItems = items.filter(item => (item.received || 0) < item.quantity);

  // Get max quantity for selected item
  const selectedItem = items.find(i => i._id === formData.line_item);
  const maxQuantity = selectedItem ? selectedItem.quantity - (selectedItem.received || 0) : 0;

  // Prepare line items for ReceiveStockForm
  const lineItemsData = availableItems.map(item => {
    const partName = item.part_detail?.name || `Part ${item.part_id}`;
    const ipn = item.part_detail?.ipn || '';
    const received = item.received || 0;
    const total = item.quantity;
    return {
      value: item._id,
      label: `${partName} - ${ipn} (${received}/${total})`
    };
  });

  // Prepare locations for ReceiveStockForm
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
          {canModifyStock && (
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
          {/* Approval Box - 1/4 width */}
          <Grid.Col span={3}>
            <ReceivedStockApproval
              approvalFlow={approvalFlow}
              targetStateId={targetStateId}
              setTargetStateId={setTargetStateId}
              availableStates={availableStates}
              refusalComments={refusalComments}
              setRefusalComments={setRefusalComments}
              onSign={handleSignReceivedStock}
              onRemoveSignature={handleRemoveSignature}
              signing={signing}
              canModifyStock={canModifyStock}
            />
          </Grid.Col>

          {/* Table - 3/4 width */}
          <Grid.Col span={9}>
            <ReceivedStockTable
              items={receivedItems}
              canModifyStock={canModifyStock}
              onDeleteStock={handleDeleteStock}
              getStatusLabel={getStatusLabel}
              selectedItems={selectedReceivedItems}
              onSelectionChange={setSelectedReceivedItems}
            />
          </Grid.Col>
        </Grid>
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
          manufacturerUm={selectedItem?.part_detail?.manufacturer_um}
          articleLotallexp={selectedItem?.part_detail?.lotallexp ?? false}
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
