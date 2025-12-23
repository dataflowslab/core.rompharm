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

interface Request {
  _id: string;
  reference: string;
  source: number;
  destination: number;
  items: RequestItem[];
  line_items: number;
  status: string;
  state_level?: number;
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
            {request.status}
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
            {t('Items')}
          </Tabs.Tab>
          {(request.state_level && request.state_level >= 100) && (
            <Tabs.Tab value="operations" leftSection={<IconTruck size={16} />}>
              {t('Operations')}
            </Tabs.Tab>
          )}
          {(request.state_level && request.state_level >= 250) && (
            <Tabs.Tab value="reception" leftSection={<IconPackage size={16} />}>
              {t('Receive Stock')}
            </Tabs.Tab>
          )}
          {(request.state_level && request.state_level >= 350) && (
            <Tabs.Tab value="production" leftSection={<IconTool size={16} />}>
              {t('Production')}
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <DetailsTab request={request} onUpdate={loadRequest} />
        </Tabs.Panel>

        <Tabs.Panel value="approval" pt="md">
          {id && <ApprovalsTab requestId={id} onReload={loadRequest} />}
        </Tabs.Panel>

        <Tabs.Panel value="items" pt="md">
          {id && request && <ItemsTab requestId={id} request={request} onReload={loadRequest} />}
        </Tabs.Panel>

        {(request.state_level && request.state_level >= 100) && (
          <Tabs.Panel value="operations" pt="md">
            {id && <OperationsTab requestId={id} onReload={loadRequest} />}
          </Tabs.Panel>
        )}

        {(request.state_level && request.state_level >= 250) && (
          <Tabs.Panel value="reception" pt="md">
            {id && <ReceptieTab requestId={id} onReload={loadRequest} />}
          </Tabs.Panel>
        )}

        {(request.state_level && request.state_level >= 350) && (
          <Tabs.Panel value="production" pt="md">
            {id && <ProductionTab requestId={id} onReload={loadRequest} />}
          </Tabs.Panel>
        )}
      </Tabs>
    </Paper>
  );
}
