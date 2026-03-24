import { useState, useEffect } from 'react';
import { Paper, Title, Text, Badge, Group, Stack, Button, Table, NumberInput, Alert } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../context/AuthContext';
import { BuildOrderSeriesTable } from './BuildOrderSeriesTable';

interface Material {
  part: string;
  part_name: string;
  batch: string;
  received_qty: number;
  used_qty: number | null;
  request_id?: string;
  request_reference?: string;
  request_issue_date?: string;
  request_item_index?: number;
}

interface Serie {
  batch_code: string;
  materials: Material[];
  produced_qty?: number;
  expiry_date?: string;
  production_step_id?: string;
  decision_status?: string;
  decision_reason?: string;
  signatures?: ApprovalSignature[];
  saved_at?: string | null;
  saved_by?: string | null;
}

interface ApprovalOfficer {
  type: string;
  reference: string;
  username: string;
  action: string;
}

interface ApprovalSignature {
  user_id: string;
  username: string;
  user_name?: string;
  signed_at: string;
  signature_hash: string;
}

interface ProductionFlow {
  _id: string;
  flow_type: string;
  signatures: ApprovalSignature[];
  status: string;
  can_sign_officers: ApprovalOfficer[];
  must_sign_officers: ApprovalOfficer[];
  min_signatures: number;
}

interface RequestState {
  _id: string;
  name: string;
  slug?: string;
  needs_comment?: boolean;
}

interface BuildOrderProductionTabProps {
  buildOrderId: string;
}

interface RemainingItem {
  key: string;
  part_id?: string;
  part_name?: string;
  batch?: string;
  request_id?: string;
  request_reference?: string;
  request_issue_date?: string;
  request_item_index?: number;
  source_location_id?: string;
  source_location_name?: string;
  total_received: number;
  total_used: number;
  remaining_qty: number;
  return_qty?: number;
}

export function BuildOrderProductionTab({ buildOrderId }: BuildOrderProductionTabProps) {
  const { t } = useTranslation();
  const { username, roleId, roleSlug, userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<Serie[]>([]);
  const [flow, setFlow] = useState<ProductionFlow | null>(null);
  const [availableStates, setAvailableStates] = useState<RequestState[]>([]);
  const [signingSerie, setSigningSerie] = useState<string | null>(null);
  const [savingSerie, setSavingSerie] = useState<string | null>(null);
  const [remainingItems, setRemainingItems] = useState<RemainingItem[]>([]);
  const [remainingLoading, setRemainingLoading] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnOrders, setReturnOrders] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [buildOrderId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadProductionData(),
        loadProductionFlow(),
        loadAvailableStates()
      ]);
    } catch (error) {
      console.error('Failed to load build order production data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProductionData = async () => {
    try {
      const response = await api.get(requestsApi.getBuildOrderProduction(buildOrderId));
      if (response.data && response.data.series) {
        const normalizeMaterials = (materials: Material[] | undefined) => (materials || []).map(material => ({
          ...material,
          batch: material.batch || '',
          received_qty: Number(material.received_qty) || 0,
          used_qty: material.used_qty === null || material.used_qty === undefined ? null : Number(material.used_qty) || 0
        }));

        const normalizedSeries = (response.data.series || []).map((serie: Serie) => ({
          ...serie,
          produced_qty: serie.produced_qty || 0,
          expiry_date: serie.expiry_date || '',
          production_step_id: serie.production_step_id || '',
          decision_status: serie.decision_status || '',
          decision_reason: serie.decision_reason || '',
          signatures: serie.signatures || [],
          saved_at: serie.saved_at || null,
          saved_by: serie.saved_by || null,
          materials: normalizeMaterials(serie.materials)
        }));

        setSeries(normalizedSeries);
      }
    } catch (error) {
      console.error('Failed to load production data:', error);
    }
  };

  const loadProductionFlow = async () => {
    try {
      const response = await api.get(requestsApi.getBuildOrderProductionFlow(buildOrderId));
      setFlow(response.data.flow);
    } catch (error) {
      console.error('Failed to load production flow:', error);
    }
  };

  const loadRemaining = async () => {
    setRemainingLoading(true);
    try {
      const response = await api.get(requestsApi.getBuildOrderProductionRemaining(buildOrderId));
      const items = response.data?.items || [];
      const prevMap = new Map(remainingItems.map(item => [item.key, item.return_qty]));
      const normalized = items.map((item: RemainingItem) => ({
        ...item,
        return_qty: prevMap.get(item.key) ?? item.remaining_qty
      }));
      setRemainingItems(normalized);
      setReturnOrders(response.data?.return_orders || []);
    } catch (error) {
      console.error('Failed to load remaining materials:', error);
    } finally {
      setRemainingLoading(false);
    }
  };

  const loadAvailableStates = async () => {
    try {
      const response = await api.get(requestsApi.getStates());
      const allStates = response.data.results || [];

      const productionStates = allStates.filter((state: any) =>
        state.scenes && Array.isArray(state.scenes) && state.scenes.includes('production')
      );

      setAvailableStates(productionStates);
    } catch (error) {
      console.error('Failed to load states:', error);
    }
  };

  const handleSerieSign = async (batchCode: string, serie: Serie) => {
    try {
      setSigningSerie(batchCode);
      await api.post(requestsApi.signBuildOrderSeries(buildOrderId), {
        batch_code: batchCode,
        serie
      });
      await loadProductionData();
    } catch (error: any) {
      console.error('Failed to sign series:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to sign series'),
        color: 'red'
      });
    } finally {
      setSigningSerie(null);
    }
  };

  const handleSerieSave = async (batchCode: string, serie: Serie) => {
    try {
      setSavingSerie(batchCode);
      await api.post(requestsApi.saveBuildOrderSeries(buildOrderId), {
        batch_code: batchCode,
        serie
      });
      notifications.show({
        title: t('Success'),
        message: t('Production series saved successfully'),
        color: 'green'
      });
      await loadProductionData();
    } catch (error: any) {
      console.error('Failed to save production series:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save production series'),
        color: 'red'
      });
    } finally {
      setSavingSerie(null);
    }
  };

  const handleReturnOrders = async () => {
    if (remainingItems.length === 0) return;
    setReturnLoading(true);
    try {
      const payloadItems = remainingItems.map(item => ({
        key: item.key,
        part_id: item.part_id,
        batch: item.batch,
        request_id: item.request_id,
        request_item_index: item.request_item_index,
        return_qty: item.return_qty ?? 0
      }));

      const response = await api.post(requestsApi.createBuildOrderReturnOrders(buildOrderId), {
        items: payloadItems
      });

      const orders = response.data?.return_orders || [];
      setReturnOrders(orders);

      notifications.show({
        title: t('Success'),
        message: orders.length > 0
          ? t('Return orders created')
          : t('No return orders created'),
        color: 'green'
      });
    } catch (error: any) {
      console.error('Failed to create return orders:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to create return orders'),
        color: 'red'
      });
    } finally {
      setReturnLoading(false);
      await loadRemaining();
    }
  };

  const canUserSign = () => {
    if (!flow) return false;

    const normalize = (value?: string | null) => (value || '').toString().trim().toLowerCase();
    const roleSlugNormalized = normalize(roleSlug);
    const roleIdNormalized = normalize(roleId);

    const matchesOfficer = (o: any) => {
      if (username && o.username && o.username === username) return true;
      if (o.reference && userId && o.reference === userId) return true;
      if (o.type === 'role') {
        if (roleSlug && normalize(o.reference) === roleSlugNormalized) return true;
        if (roleId && o.reference === roleId) return true;
        if (roleId && normalize(o.reference) === roleIdNormalized) return true;
      }
      return false;
    };

    const canSign = flow.can_sign_officers.some(matchesOfficer);
    const mustSign = flow.must_sign_officers.some(matchesOfficer);

    return canSign || mustSign;
  };

  const allSeriesSaved = series.length > 0 && series.every(serie => !!serie.saved_at);

  useEffect(() => {
    if (allSeriesSaved) {
      loadRemaining();
    } else {
      setRemainingItems([]);
      setReturnOrders([]);
    }
  }, [allSeriesSaved]);

  const updateReturnQty = (key: string, value: number | null) => {
    setRemainingItems(prev => prev.map(item => {
      if (item.key !== key) return item;
      const numeric = value === null || value === undefined ? 0 : Number(value) || 0;
      const clamped = Math.max(0, Math.min(numeric, item.remaining_qty || 0));
      return { ...item, return_qty: clamped };
    }));
  };

  const getLossStyle = (remainingQty: number, returnQty: number | undefined) => {
    const safeRemaining = Number(remainingQty) || 0;
    const safeReturn = Number(returnQty) || 0;
    const lostQty = Math.max(0, safeRemaining - safeReturn);
    const percent = safeRemaining > 0 ? (lostQty / safeRemaining) * 100 : 0;

    let color = '#2b8a3e';
    if (percent > 20) {
      color = '#c92a2a';
    } else if (percent >= 10) {
      color = '#e67700';
    }

    return { lostQty, percent, color };
  };

  if (loading) {
    return (
      <Paper p="md">
        <Text>{t('Loading...')}</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Group>
          <Title order={4}>{t('Production')}</Title>
          {flow && (
            <Badge color="gray" size="lg">
              {flow.status.toUpperCase()}
            </Badge>
          )}
        </Group>
      </Group>

      <Stack gap="xl">
        <BuildOrderSeriesTable
          series={series}
          onSeriesChange={setSeries}
          availableStates={availableStates}
          flow={flow}
          canUserSign={canUserSign()}
          onSignSerie={handleSerieSign}
          onSaveSerie={handleSerieSave}
          signingSerie={signingSerie}
          savingSerie={savingSerie}
          isCanceled={false}
          currentUsername={username}
        />

        {allSeriesSaved && (
          <Paper withBorder p="md">
            <Group justify="space-between" mb="md">
              <Title order={5}>{t('Remaining Materials')}</Title>
              <Button
                onClick={handleReturnOrders}
                loading={returnLoading}
                disabled={remainingItems.length === 0 || returnOrders.length > 0}
              >
                {t('Return')}
              </Button>
            </Group>

            {returnOrders.length > 0 && (
              <Alert color="green" mb="md">
                {t('Return orders created')}: {returnOrders.map((order: any) => order.reference).join(', ')}
              </Alert>
            )}

            {remainingLoading ? (
              <Text>{t('Loading...')}</Text>
            ) : remainingItems.length === 0 ? (
              <Text c="dimmed">{t('No remaining materials')}</Text>
            ) : (
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('Material')}</Table.Th>
                    <Table.Th>{t('Batch')}</Table.Th>
                    <Table.Th>{t('Request')}</Table.Th>
                    <Table.Th>{t('Remaining')}</Table.Th>
                    <Table.Th>{t('Return Qty')}</Table.Th>
                    <Table.Th>{t('Lost')}</Table.Th>
                    <Table.Th>{t('Loss %')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {remainingItems.map(item => {
                    const remainingQty = Number(item.remaining_qty) || 0;
                    const returnQty = Number(item.return_qty) || 0;
                    const loss = getLossStyle(remainingQty, returnQty);
                    return (
                      <Table.Tr key={item.key}>
                        <Table.Td>{item.part_name || item.part_id}</Table.Td>
                        <Table.Td>{item.batch || '-'}</Table.Td>
                        <Table.Td>
                          {item.request_reference || item.request_id || '-'}
                        </Table.Td>
                        <Table.Td>{remainingQty}</Table.Td>
                        <Table.Td>
                          <NumberInput
                            value={returnQty}
                            onChange={(value) => updateReturnQty(item.key, value)}
                            min={0}
                            max={remainingQty}
                            size="sm"
                            disabled={returnOrders.length > 0}
                          />
                        </Table.Td>
                        <Table.Td style={{ backgroundColor: '#fffbe6' }}>
                          <Text fw={600} c={loss.color}>
                            {loss.lostQty}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ backgroundColor: '#fffbe6' }}>
                          <Text fw={600} c={loss.color}>
                            {loss.percent.toFixed(2)}%
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        )}

        {!flow && (
          <Paper withBorder p="md">
            <Stack align="center" gap="md" py="xl">
              <Text c="dimmed" ta="center">
                {t('Approval flow missing')}
              </Text>
              <Button
                onClick={async () => {
                  try {
                    await loadProductionFlow();
                  } catch (error: any) {
                    notifications.show({
                      title: t('Error'),
                      message: error.response?.data?.detail || t('Failed to create production flow'),
                      color: 'red'
                    });
                  }
                }}
              >
                {t('Initiate approval flow now')}
              </Button>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Paper>
  );
}
