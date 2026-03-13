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
  IconPackage,
  IconTruckDelivery,
  IconPaperclip,
  IconFileText,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import api from '../services/api';
import { returnsApi, ReturnOrder, ReturnOrderItem, StockLocation, Attachment, ApprovalFlow } from '../services/returns';
import {
  DetailsTab,
  ReceivedStockTab,
  ItemsTab,
  AttachmentsTab,
  JournalTab,
} from '../components/Returns';

const RETURN_PENDING_STATE_ID = '6943a4a6451609dd8a618ce0';

export function ReturnDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  const [order, setOrder] = useState<ReturnOrder | null>(null);
  const [items, setItems] = useState<ReturnOrderItem[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('details');

  useEffect(() => {
    api.get('/api/auth/me')
      .then(response => {
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
        loadReturnOrder(),
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

  const loadReturnOrder = async () => {
    try {
      const response = await api.get(returnsApi.getReturnOrder(id!));
      setOrder(response.data);
    } catch (error) {
      console.error('Failed to load return order:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load return order'),
        color: 'red'
      });
    }
  };

  const handleUpdateOrder = async (data: any) => {
    try {
      await api.patch(returnsApi.updateReturnOrder(id!), data);
      await loadReturnOrder();
    } catch (error) {
      throw error;
    }
  };

  const loadItems = async () => {
    try {
      const response = await api.get(returnsApi.getOrderItems(id!));
      setItems(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  };

  const loadStockLocations = async () => {
    try {
      const response = await api.get(`${returnsApi.getStockLocations()}?type=Depozit`);
      setStockLocations(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load stock locations:', error);
    }
  };

  const loadAttachments = async () => {
    try {
      const response = await api.get(returnsApi.getAttachments(id!));
      setAttachments(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load attachments:', error);
    }
  };

  const loadApprovalFlow = async () => {
    try {
      const response = await api.get(returnsApi.getApprovalFlow(id!));
      setApprovalFlow(response.data.flow);
    } catch (error) {
      console.error('Failed to load approval flow:', error);
    }
  };

  const canEdit = () => {
    if (!order) return false;

    if (order.state_id && order.state_id !== RETURN_PENDING_STATE_ID) {
      return false;
    }

    if (isAdmin) {
      return true;
    }

    if (!approvalFlow || approvalFlow.signatures.length === 0) {
      return true;
    }

    return false;
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
        <Text>{t('Return order not found')}</Text>
      </Container>
    );
  }

  const isEditable = canEdit() || false;
  const showReceiveStock = order.state_id !== RETURN_PENDING_STATE_ID || (approvalFlow && approvalFlow.signatures && approvalFlow.signatures.length > 0);

  return (
    <Container size="xl">
      <Group mb="md">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/returns')}
        >
          {t('Back')}
        </Button>
      </Group>

      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>{order.reference || t('Return Order')}</Title>
          <Text size="sm" c="dimmed">{order.customer_detail?.name}</Text>
        </div>
        <Badge color={order.state_detail?.color || 'gray'} size="lg">
          {order.state_detail?.name || 'Unknown'}
        </Badge>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="details" leftSection={<IconInfoCircle size={16} />}>
            {t('Details')}
          </Tabs.Tab>
          <Tabs.Tab value="items" leftSection={<IconPackage size={16} />}>
            {t('Items')}
          </Tabs.Tab>
          {showReceiveStock && (
            <Tabs.Tab value="receive-stock" leftSection={<IconTruckDelivery size={16} />}>
              {t('Receive Stock')}
            </Tabs.Tab>
          )}
          <Tabs.Tab value="attachments" leftSection={<IconPaperclip size={16} />}>
            {t('Attachments')}
          </Tabs.Tab>
          <Tabs.Tab value="journal" leftSection={<IconFileText size={16} />}>
            {t('Journal')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <DetailsTab
            order={order}
            canEdit={isEditable}
            onUpdate={handleUpdateOrder}
            onOrderUpdate={loadReturnOrder}
            orderStateId={order.state_id}
            itemsCount={items.length}
          />
        </Tabs.Panel>

        <Tabs.Panel value="items" pt="md">
          <ItemsTab
            items={items}
            orderCurrency={order.currency || 'EUR'}
          />
        </Tabs.Panel>

        <Tabs.Panel value="receive-stock" pt="md">
          <ReceivedStockTab
            orderId={id!}
            items={items}
            stockLocations={stockLocations}
            onReload={loadItems}
            canModify={true}
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

        <Tabs.Panel value="journal" pt="md">
          <JournalTab
            orderId={id!}
          />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
