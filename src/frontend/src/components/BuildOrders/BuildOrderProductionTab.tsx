import { useState, useEffect } from 'react';
import { Paper, Title, Text, Badge, Group, Stack, Button } from '@mantine/core';
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

interface ProductionStep {
  _id: string;
  name?: string;
  label?: string;
  code?: string;
}

interface BuildOrderProductionTabProps {
  buildOrderId: string;
}

export function BuildOrderProductionTab({ buildOrderId }: BuildOrderProductionTabProps) {
  const { t } = useTranslation();
  const { username, isStaff, localRole, roleSlug, userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<Serie[]>([]);
  const [flow, setFlow] = useState<ProductionFlow | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableStates, setAvailableStates] = useState<RequestState[]>([]);
  const [productionSteps, setProductionSteps] = useState<ProductionStep[]>([]);
  const [signingSerie, setSigningSerie] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [buildOrderId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadProductionData(),
        loadProductionFlow(),
        loadAvailableStates(),
        loadProductionSteps()
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

  const loadProductionSteps = async () => {
    try {
      const response = await api.get(requestsApi.getProductionSteps());
      setProductionSteps(response.data.results || []);
    } catch (error) {
      console.error('Failed to load production steps:', error);
    }
  };

  const handleSaveProduction = async () => {
    try {
      setSaving(true);
      await api.post(requestsApi.saveBuildOrderProduction(buildOrderId), { series });
      notifications.show({
        title: t('Success'),
        message: t('Production data saved successfully'),
        color: 'green'
      });
      await loadProductionData();
    } catch (error: any) {
      console.error('Failed to save production data:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save production data'),
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSerieSign = async (batchCode: string) => {
    try {
      setSigningSerie(batchCode);
      await api.post(requestsApi.signBuildOrderSeries(buildOrderId), { batch_code: batchCode });
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

  const canUserSign = () => {
    if (!flow) return false;

    const normalize = (value?: string | null) => (value || '').toString().trim().toLowerCase();

    const matchesOfficer = (o: any) => {
      if (username && o.username && o.username === username) return true;
      if (o.reference && userId && o.reference === userId) return true;
      if (o.type === 'role') {
        if (roleSlug && normalize(o.reference) === normalize(roleSlug)) return true;
        if (localRole && o.reference === localRole) return true;
        if (localRole && normalize(o.reference) === normalize(localRole)) return true;
        if (normalize(o.reference) === 'admin' && isStaff) return true;
      }
      return false;
    };

    const canSign = flow.can_sign_officers.some(matchesOfficer);
    const mustSign = flow.must_sign_officers.some(matchesOfficer);

    return canSign || mustSign;
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
        <Group>
          <Button onClick={handleSaveProduction} loading={saving}>
            {t('Save')}
          </Button>
        </Group>
      </Group>

      <Stack gap="xl">
        <BuildOrderSeriesTable
          series={series}
          onSeriesChange={setSeries}
          availableStates={availableStates}
          productionSteps={productionSteps}
          flow={flow}
          canUserSign={canUserSign()}
          onSignSerie={handleSerieSign}
          signingSerie={signingSerie}
          isCanceled={false}
          currentUsername={username}
        />

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
