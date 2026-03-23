import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Paper, Title, Tabs, Button, Group, Badge, Text } from '@mantine/core';
import { IconArrowLeft, IconFileText, IconTool } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { requestsApi } from '../services/requests';
import { notifications } from '@mantine/notifications';
import { BuildOrderDetailsTab } from '../components/BuildOrders/BuildOrderDetailsTab';
import { BuildOrderProductionTab } from '../components/BuildOrders/BuildOrderProductionTab';
import { BuildOrderJournalTab } from '../components/BuildOrders/BuildOrderJournalTab';

interface BuildOrder {
  _id: string;
  batch_code?: string;
  batch_code_text?: string;
  product_id?: string;
  state_detail?: {
    name: string;
  };
  created_at?: string;
  product_detail?: {
    name: string;
    ipn: string;
  };
  location_detail?: {
    name: string;
  };
  grup?: {
    batch_codes?: string[];
  };
  campaign?: boolean;
}

export function BuildOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [buildOrder, setBuildOrder] = useState<BuildOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('details');

  useEffect(() => {
    if (id) {
      loadBuildOrder();
    }
  }, [id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get('tab');
    if (!requestedTab) {
      return;
    }

    const allowedTabs = new Set<string>(['details', 'production']);
    setActiveTab(allowedTabs.has(requestedTab) ? requestedTab : 'details');
  }, [location.search]);

  const loadBuildOrder = async () => {
    try {
      const response = await api.get(requestsApi.getBuildOrder(id!));
      setBuildOrder(response.data);
    } catch (error) {
      console.error('Failed to load build order:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load build order'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'gray';
    const normalized = status.toLowerCase();
    if (normalized.includes('pending')) return 'gray';
    if (normalized.includes('approved') || normalized.includes('done') || normalized.includes('signed')) return 'green';
    if (normalized.includes('refused') || normalized.includes('failed')) return 'red';
    if (normalized.includes('canceled')) return 'orange';
    return 'blue';
  };

  if (loading) {
    return <Paper p="md"><Text>{t('Loading...')}</Text></Paper>;
  }

  if (!buildOrder) {
    return <Paper p="md"><Text>{t('Build order not found')}</Text></Paper>;
  }

  const batchCode = buildOrder.batch_code_text || buildOrder.batch_code || '';
  const productLabel = buildOrder.product_detail
    ? `${buildOrder.product_detail.name}${buildOrder.product_detail.ipn ? ` (${buildOrder.product_detail.ipn})` : ''}`
    : '';
  const titleLabel = productLabel ? `${batchCode} - ${productLabel}` : batchCode;
  const groupCodes = buildOrder.grup?.batch_codes || [];
  const isCampaign = buildOrder.campaign ?? (groupCodes.length > 1);
  const hasSavedProduct = !!(buildOrder.product_id || buildOrder.product_detail?._id);

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/build-orders')}
          >
            {t('Back')}
          </Button>
          <Title order={2}>{titleLabel}</Title>
          <Badge color={getStatusColor(buildOrder.state_detail?.name)} size="lg">
            {buildOrder.state_detail?.name || '-'}
          </Badge>
          {isCampaign && (
            <Badge color="blue" size="lg" variant="light">
              {t('Campaign')}
            </Badge>
          )}
        </Group>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="details" leftSection={<IconFileText size={16} />}>
            {t('Details')}
          </Tabs.Tab>
          <Tabs.Tab value="production" leftSection={<IconTool size={16} />} disabled={!hasSavedProduct}>
            {t('Production')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <BuildOrderDetailsTab buildOrder={buildOrder} onUpdated={loadBuildOrder} />
          <Title order={5} mt="md" mb="xs">{t('Journal')}</Title>
          <BuildOrderJournalTab />
        </Tabs.Panel>

        <Tabs.Panel value="production" pt="md">
          {id && hasSavedProduct ? <BuildOrderProductionTab buildOrderId={id} /> : (
            <Paper p="md" withBorder>
              <Text c="dimmed">
                {t('Select and save a product in Details before using Production.')}
              </Text>
            </Paper>
          )}
        </Tabs.Panel>

      </Tabs>
    </Paper>
  );
}
