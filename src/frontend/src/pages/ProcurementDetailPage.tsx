import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Title, 
  Tabs, 
  Button, 
  Group, 
  Text,
  Badge,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconInfoCircle,
  IconChecklist,
  IconPackage,
  IconTruckDelivery,
  IconPaperclip,
  IconClipboardCheck,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import api from '../services/api';
import { procurementApi } from '../services/procurement';
import { 
  DetailsTab, 
  ApprovalsTab, 
  ReceivedStockTab,
  ItemsTab,
  QualityControlTab,
  AttachmentsTab,
} from '../components/Procurement';
interface PurchaseOrder {
  _id: string;
  reference: string;
  description: string;
  supplier_id: string;
  supplier_detail?: {
    name: string;
    _id: string;
  };
  supplier_reference: string;
  order_currency?: string;
  currency?: string;
  issue_date: string;
  target_date: string;
  destination_id?: string;
  destination_detail?: {
    name: string;
  };
  notes: string;
  status: string;  // MongoDB: string status name (e.g., "Pending", "Processing")
  status_color?: string;  // Color from depo_purchase_orders_states
  created_by?: string;
}

interface PurchaseOrderItem {
  _id: string;
  part: number;  // Legacy field for compatibility
  part_id: string;
  part_detail?: {
    name: string;
    description: string;
    IPN: string;
    ipn: string;
    um?: string;
  };
  quantity: number;
  received: number;
  purchase_price: number;
  purchase_price_currency: string;
  destination?: number;  // Legacy field
  destination_id?: string;
  destination_detail?: {
    name: string;
  };
  reference: string;
  notes: string;
}

interface StockLocation {
  _id: string;
  pk: number;  // Legacy field for compatibility
  name: string;
  description?: string;
}

interface Attachment {
  _id: string;
  attachment: string;
  filename: string;
  comment: string;
  upload_date: string;
}

interface ApprovalFlow {
  _id: string;
  signatures: Array<{
    user_id: string;
    username: string;
    signed_at: string;
  }>;
  status: string;
}

export function ProcurementDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('details');

  useEffect(() => {
    // Load current user info
    api.get('/api/auth/me')
      .then(response => {
        setCurrentUserId(response.data._id || response.data.pk);
        setIsAdmin(response.data.is_staff || response.data.staff || false);
      })
      .catch(error => {
        console.error('Failed to load user info:', error);
      });
  }, []);

  useEffect(() => {
    if (id) {
      loadAllData();
    }
  }, [id]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPurchaseOrder(),
        loadItems(),
        loadStockLocations(),
        loadAttachments(),
        loadApprovalFlow(),
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseOrder = async () => {
    try {
      const response = await api.get(procurementApi.getPurchaseOrder(id!));
      setOrder(response.data);
    } catch (error) {
      console.error('Failed to load purchase order:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load purchase order'),
        color: 'red'
      });
    }
  };

  const handleUpdateOrder = async (data: any) => {
    try {
      await api.patch(procurementApi.getPurchaseOrder(id!), data);
      await loadPurchaseOrder();
    } catch (error) {
      throw error;
    }
  };

  const loadItems = async () => {
    try {
      const response = await api.get(procurementApi.getOrderItems(id!));
      setItems(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  };

  const loadStockLocations = async () => {
    try {
      const response = await api.get(procurementApi.getStockLocations());
      setStockLocations(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load stock locations:', error);
    }
  };

  const loadAttachments = async () => {
    try {
      const response = await api.get(procurementApi.getAttachments(id!));
      setAttachments(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load attachments:', error);
    }
  };

  const loadApprovalFlow = async () => {
    try {
      const response = await api.get(`${procurementApi.getPurchaseOrder(id!)}/approval-flow`);
      setApprovalFlow(response.data.flow);
    } catch (error) {
      console.error('Failed to load approval flow:', error);
    }
  };

  // Check if user can edit
  const canEdit = () => {
    if (!order) {
      console.log('[canEdit] No order');
      return false;
    }

    console.log('[canEdit] Checking permissions:', {
      isAdmin,
      currentUserId,
      orderCreatedBy: order.created_by,
      orderStatus: order.status,
      approvalFlow,
      signatures: approvalFlow?.signatures?.length || 0,
    });

    // ✅ FIX: Once order is signed (status is Issued or beyond), cannot edit items/details
    // Status "Pending" = can edit, "Issued"/"Processing"/"Finished" = signed = cannot edit
    const orderStatus = order.status?.toLowerCase();
    if (orderStatus && orderStatus !== 'pending') {
      console.log('[canEdit] Order is signed (status:', order.status, ') - CANNOT EDIT');
      return false;
    }

    // Admin can edit pending orders
    if (isAdmin) {
      console.log('[canEdit] User is admin - CAN EDIT');
      return true;
    }

    // If no approval flow exists yet, or no signatures, creator can edit
    if (!approvalFlow || approvalFlow.signatures.length === 0) {
      // Note: created_by is username, not user_id, so we can't compare directly
      // For now, allow editing if no signatures (admin will have full control anyway)
      console.log('[canEdit] No signatures - CAN EDIT');
      return true;
    }

    console.log('[canEdit] Has signatures - CANNOT EDIT');
    return false;
  };

  const getStatusColor = (status: string) => {
    // MongoDB status names based on depo_purchase_orders_states
    switch (status?.toLowerCase()) {
      case 'pending': return 'gray';      // value: 0 - Not signed yet
      case 'issued': return 'cyan';       // value: 10 - Signed, ready for receiving
      case 'processing': return 'blue';   // value: 20 - Receiving in progress
      case 'finished': return 'green';    // value: 30 - All received and QC done
      case 'refused': return 'red';       // value: 40 - Refused
      case 'canceled': 
      case 'cancelled': return 'red';     // value: 90 - Cancelled
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <Container size="xl">
        <Text>{t('Loading...')}</Text>
      </Container>
    );
  }

  if (!order) {
    return (
      <Container size="xl">
        <Text>{t('Purchase order not found')}</Text>
      </Container>
    );
  }

  const isEditable = canEdit() || false;

  return (
    <Container size="xl">
      <Group mb="md">
        <Button 
          variant="subtle" 
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/procurement')}
        >
          {t('Back')}
        </Button>
      </Group>

      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>{order.reference || t('Purchase Order')}</Title>
          <Text size="sm" c="dimmed">{order.supplier_detail?.name}</Text>
        </div>
        <Badge color={order.status_color || getStatusColor(order.status)} size="lg">
          {order.status || 'Unknown'}
        </Badge>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="details" leftSection={<IconInfoCircle size={16} />}>
            {t('Details')}
          </Tabs.Tab>
          <Tabs.Tab value="approvals" leftSection={<IconChecklist size={16} />}>
            {t('Approvals')}
          </Tabs.Tab>
          <Tabs.Tab value="items" leftSection={<IconPackage size={16} />}>
            {t('Items')}
          </Tabs.Tab>
          {/* Show Receive Stock tab only if order is Issued or beyond (after signing) */}
          {order.status && ['Issued', 'Processing', 'Finished'].includes(order.status) && (
            <Tabs.Tab value="receive-stock" leftSection={<IconTruckDelivery size={16} />}>
              {t('Receive Stock')}
            </Tabs.Tab>
          )}
          {/* Show Quality Control tab only if order is Issued or beyond */}
          {order.status && ['Issued', 'Processing', 'Finished'].includes(order.status) && (
            <Tabs.Tab value="quality-control" leftSection={<IconClipboardCheck size={16} />}>
              {t('Quality Control')}
            </Tabs.Tab>
          )}
          <Tabs.Tab value="attachments" leftSection={<IconPaperclip size={16} />}>
            {t('Attachments')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <DetailsTab 
            order={order} 
            suppliers={[]} 
            stockLocations={stockLocations}
            canEdit={isEditable}
            onUpdate={handleUpdateOrder}
            onOrderUpdate={loadPurchaseOrder}
          />
        </Tabs.Panel>

        <Tabs.Panel value="approvals" pt="md">
          <ApprovalsTab 
            order={order} 
            onOrderUpdate={loadPurchaseOrder} 
          />
        </Tabs.Panel>

        <Tabs.Panel value="items" pt="md">
          <ItemsTab
            orderId={id!}
            items={items}
            orderCurrency={order.order_currency || order.currency || 'EUR'}
            stockLocations={stockLocations}
            supplierId={order.supplier_id}
            onReload={loadItems}
            canEdit={isEditable}
          />
        </Tabs.Panel>

        <Tabs.Panel value="receive-stock" pt="md">
          <ReceivedStockTab 
            orderId={id!} 
            items={items} 
            stockLocations={stockLocations}
            onReload={loadItems}
            supplierName={order.supplier_detail?.name}
            supplierId={order.supplier_id}
          />
        </Tabs.Panel>

        <Tabs.Panel value="quality-control" pt="md">
          <QualityControlTab
            orderId={id!}
          />
        </Tabs.Panel>

        <Tabs.Panel value="attachments" pt="md">
          <AttachmentsTab
            orderId={id!}
            attachments={attachments}
            onReload={loadAttachments}
            canEdit={isEditable}
          />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
