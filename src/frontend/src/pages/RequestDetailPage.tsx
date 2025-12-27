import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Paper, Title, Tabs, Button, Group, Badge, Text } from '@mantine/core';
import { IconArrowLeft, IconFileText, IconSignature, IconTruck, IconPackage, IconList, IconTool } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { requestsApi } from '../services/requests';
import { notifications } from '@mantine/notifications';
import { DetailsTab } from '../components/Requests/DetailsTab';
import { ApprovalsTab } from '../components/Requests/ApprovalsTab';
import { ItemsTab } from '../components/Requests/ItemsTab';
import { OperationsTab } from '../components/Requests/OperationsTab';
import { ReceptieTab } from '../components/Requests/ReceptieTab';
import { ProductionTab } from '../components/Requests/ProductionTab';

interface StockLocation {
  pk: number;
  name: string;
}

interface Part {
  pk: number;
  name: string;
  IPN: string;
}

interface RequestItem {
  part: number;
  quantity: number;
  notes?: string;
  part_detail?: Part;
}

interface StateDetail {
  _id: string;
  name: string;
  slug: string;
  workflow_level: number;
  order: number;
}

interface Request {
  _id: string;
  reference: string;
  source: number;
  destination: number;
  items: RequestItem[];
  line_items: number;
  status: string;
  state_order?: number;
  state_detail?: StateDetail;
  notes: string;
  issue_date: string;
  created_at: string;
  created_by: string;
  source_detail?: StockLocation;
  destination_detail?: StockLocation;
}

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('details');

  useEffect(() => {
    if (id) {
      loadRequest();
    }
  }, [id]);

  const loadRequest = async () => {
    try {
      const response = await api.get(requestsApi.getRequest(id!));
      console.log('Request data:', response.data);
      console.log('State level:', response.data.state_level);
      setRequest(response.data);
    } catch (error) {
      console.error('Failed to load request:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load request'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'gray';
      case 'Approved': return 'green';
      case 'Refused': return 'red';
      case 'Canceled': return 'orange';
      default: return 'blue';
    }
  };

  if (loading) {
    return <Paper p="md"><Text>{t('Loading...')}</Text></Paper>;
  }

  if (!request) {
    return <Paper p="md"><Text>{t('Request not found')}</Text></Paper>;
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/requests')}
          >
            {t('Back')}
          </Button>
          <Title order={2}>{request.reference}</Title>
          <Badge color={getStatusColor(request.status)} size="lg">
            {request.state_detail?.name || request.status}
          </Badge>
        </Group>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="details" leftSection={<IconFileText size={16} />}>
            {t('Details')}
          </Tabs.Tab>
          <Tabs.Tab value="approval" leftSection={<IconSignature size={16} />}>
            {t('Approval')}
          </Tabs.Tab>
          <Tabs.Tab value="items" leftSection={<IconList size={16} />}>
            {t('Items')}{request.line_items > 0 ? ` (${request.line_items})` : ''}
          </Tabs.Tab>
          {(request.state_order && request.state_order > 20) ? (
            <Tabs.Tab value="operations" leftSection={<IconTruck size={16} />}>
              {t('Operations')}
            </Tabs.Tab>
          ) : null}
          {(request.state_order && request.state_order > 30) ? (
            <Tabs.Tab value="reception" leftSection={<IconPackage size={16} />}>
              {t('Receive Stock')}
            </Tabs.Tab>
          ) : null}
          {(request.state_order && request.state_order > 40) ? (
            <Tabs.Tab value="production" leftSection={<IconTool size={16} />}>
              {t('Production')}
            </Tabs.Tab>
          ) : null}
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <DetailsTab request={request} onUpdate={loadRequest} />
        </Tabs.Panel>

        <Tabs.Panel value="approval" pt="md">
          {id ? <ApprovalsTab requestId={id} onReload={loadRequest} /> : null}
        </Tabs.Panel>

        <Tabs.Panel value="items" pt="md">
          {id && request ? <ItemsTab requestId={id} request={request} onReload={loadRequest} /> : null}
        </Tabs.Panel>

        {(request.state_order && request.state_order > 20) ? (
          <Tabs.Panel value="operations" pt="md">
            {id ? <OperationsTab requestId={id} onReload={loadRequest} /> : null}
          </Tabs.Panel>
        ) : null}

        {(request.state_order && request.state_order > 30) ? (
          <Tabs.Panel value="reception" pt="md">
            {id ? <ReceptieTab requestId={id} onReload={loadRequest} /> : null}
          </Tabs.Panel>
        ) : null}

        {(request.state_order && request.state_order > 40) ? (
          <Tabs.Panel value="production" pt="md">
            {id ? <ProductionTab requestId={id} onReload={loadRequest} /> : null}
          </Tabs.Panel>
        ) : null}
      </Tabs>
    </Paper>
  );
}
