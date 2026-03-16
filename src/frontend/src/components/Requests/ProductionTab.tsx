import { useEffect, useState } from 'react';
import { Paper, Title, Text, Group, Button, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';

interface ProductionTabProps {
  requestId: string;
  onReload: () => void;
}

interface RelatedRequest {
  _id: string;
  reference?: string;
}

interface BuildOrder {
  _id: string;
  batch_code?: string;
  location_name?: string;
  product_name?: string;
  product_ipn?: string;
  state_name?: string;
  requests?: RelatedRequest[];
}

export function ProductionTab({ requestId }: ProductionTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<BuildOrder[]>([]);
  const [requestReference, setRequestReference] = useState<string | null>(null);

  useEffect(() => {
    loadProductionOrder();
  }, [requestId]);

  const loadProductionOrder = async () => {
    setLoading(true);
    try {
      const requestResponse = await api.get(requestsApi.getRequest(requestId));
      const request = requestResponse.data || {};
      setRequestReference(request.reference || null);
      const batchCodes: string[] = request.batch_codes || [];

      const response = await api.get(requestsApi.getBuildOrders(), {
        params: { limit: 500 }
      });
      const orders: BuildOrder[] = response.data.results || [];

      let matched: BuildOrder[] = [];
      if (batchCodes.length > 0) {
        const batchSet = new Set(batchCodes.map(code => String(code)));
        matched = orders.filter((o) => batchSet.has(String(o.batch_code)));
      } else {
        matched = orders.filter((o) => (o.requests || []).some((r) => String(r._id) === String(requestId)));
      }

      setOrders(matched);
    } catch (error) {
      console.error('Failed to load production order:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Paper p="md">
        <Text>{t('Loading...')}</Text>
      </Paper>
    );
  }

  if (orders.length === 0) {
    return (
      <Paper p="md">
        <Text c="dimmed">{t('No production order linked yet')}</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>{t('Production')}</Title>
      </Group>

      <Stack gap="md">
        {orders.map((order) => (
          <Paper key={order._id} withBorder p="md">
            <Group justify="space-between" align="center">
              <Stack gap={2}>
                <Text fw={600}>{t('Production order')}</Text>
                {requestReference && (
                  <Text size="sm" c="dimmed">
                    {t('Request')}: {requestReference}
                  </Text>
                )}
                {order.batch_code && (
                  <Text size="sm" c="dimmed">
                    {t('Batch')}: {order.batch_code}
                  </Text>
                )}
                {order.product_name && (
                  <Text size="sm" c="dimmed">
                    {t('Product')}: {order.product_name}{order.product_ipn ? ` (${order.product_ipn})` : ''}
                  </Text>
                )}
                {order.location_name && (
                  <Text size="sm" c="dimmed">
                    {t('Location')}: {order.location_name}
                  </Text>
                )}
                {order.state_name && (
                  <Text size="sm" c="dimmed">
                    {t('Status')}: {order.state_name}
                  </Text>
                )}
              </Stack>
              <Button onClick={() => navigate(`/build-orders/${order._id}`)}>
                {t('Open')}
              </Button>
            </Group>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}
