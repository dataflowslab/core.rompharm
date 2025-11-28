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
  pk: number;
  reference: string;
  description: string;
  supplier: number;
  supplier_detail?: {
    name: string;
    pk: number;
  };
  supplier_reference: string;
  order_currency: string;
  issue_date: string;
  target_date: string;
  destination?: number;
  destination_detail?: {
    name: string;
  };
  notes: string;
  status: number;
  status_text: string;
  responsible?: number;
}

interface PurchaseOrderItem {
  pk: number;
  part: number;
  part_detail?: {
    name: string;
    description: string;
    IPN: string;
  };
  quantity: number;
  received: number;
  purchase_price: number;
  purchase_price_currency: string;
  destination?: number;
  destination_detail?: {
    name: string;
  };
  reference: string;
  notes: string;
}

interface StockLocation {
  pk: number;
  name: string;
  description?: string;
}

interface Attachment {
  pk: number;
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
      await api.patch(`/api/procurement/purchase-orders/${id}`, data);
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
      const response = await api.get(`/api/procurement/purchase-orders/${id}/approval-flow`);
      setApprovalFlow(response.data.flow);
    } catch (error) {
      console.error('Failed to load approval flow:', error);
    }
  };

  // Check if user can edit
  const canEdit = () => {
    if (!order) return false;

    // Admin can always edit
    if (isAdmin) return true;

    // Creator can edit if no signatures yet
    if (approvalFlow && approvalFlow.signatures.length === 0) {
      return order.responsible && currentUserId && String(order.responsible) === String(currentUserId);
    }

    return false;
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 10: return 'gray'; // Pending
      case 20: return 'blue'; // Placed
      case 30: return 'yellow'; // Complete
      case 40: return 'green'; // Received
      case 50: return 'red'; // Cancelled
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
        <Badge color={getStatusColor(order.status)} size="lg">
          {order.status_text}
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
          <Tabs.Tab value="receive-stock" leftSection={<IconTruckDelivery size={16} />}>
            {t('Receive Stock')}
          </Tabs.Tab>
          <Tabs.Tab value="quality-control" leftSection={<IconClipboardCheck size={16} />}>
            {t('Quality Control')}
          </Tabs.Tab>
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
            orderCurrency={order.order_currency}
            stockLocations={stockLocations}
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
          />
        </Tabs.Panel>

        <Tabs.Panel value="quality-control" pt="md">
          <QualityControlTab
            orderId={id!}
            canEdit={isEditable}
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
