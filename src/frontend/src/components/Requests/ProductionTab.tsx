import { useState, useEffect, useMemo } from 'react';
import { Paper, Title, Text, Badge, Group, Stack, Button } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { IconPrinter } from '@tabler/icons-react';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../context/AuthContext';
import { ProductionSeriesTable } from './ProductionSeriesTable';
import { UnusedMaterialsTable } from './UnusedMaterialsTable';
import { ProductionPrintLabelsModal } from './ProductionPrintLabelsModal';

interface Material {
  part: string;
  part_name: string;
  batch: string;
  received_qty: number;
  used_qty: number | null;
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

interface UnusedMaterial {
  part: string;
  part_name: string;
  total_received: number;
  total_used: number;
  unused: number;
  return_qty: number;
  loss: number;
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

interface ProductionTabProps {
  requestId: string;
  onReload: () => void;
}

const CANCELED_TOKENS = ['canceled', 'cancelled', 'anulat', 'anulare', 'cancel', 'cancelare'];

export function ProductionTab({ requestId, onReload }: ProductionTabProps) {
  const { t } = useTranslation();
  const { username, isStaff, localRole, roleSlug, userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<Serie[]>([]);
  const [flow, setFlow] = useState<ProductionFlow | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableStates, setAvailableStates] = useState<RequestState[]>([]);
  const [productionSteps, setProductionSteps] = useState<ProductionStep[]>([]);
  const [stateOrder, setStateOrder] = useState<number>(0);
  const [isCanceled, setIsCanceled] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnOrderReference, setReturnOrderReference] = useState<string | null>(null);
  const [creatingReturnOrder, setCreatingReturnOrder] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [productLossRateThreshold, setProductLossRateThreshold] = useState<number | null>(null);
  const [requestReference, setRequestReference] = useState<string | null>(null);
  const [requestIssueDate, setRequestIssueDate] = useState<string | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printingLabels, setPrintingLabels] = useState(false);
  const [signingSerie, setSigningSerie] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [requestId]);

  useEffect(() => {
    if (productId) {
      loadProductDetails(productId);
    }
  }, [productId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadRequestData(),
        loadProductionData(),
        loadProductionFlow(),
        loadAvailableStates(),
        loadProductionSteps()
      ]);
    } catch (error) {
      console.error('Failed to load production data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRequestData = async () => {
    try {
      const response = await api.get(requestsApi.getRequest(requestId));
      const request = response.data;

      setStateOrder(request.state_order || 0);
      setRequestReference(request.reference || null);
      setRequestIssueDate(request.issue_date || null);

      const canceledStateId = '67890abc1234567890abcde9';
      setIsCanceled(request.state_id === canceledStateId);

      const product = request.product_id || request.recipe_part_id || null;
      setProductId(product);

      const items = request.items || [];
      const batchCodes = request.batch_codes || [];

      if (series.length === 0 && batchCodes.length > 0) {
        const initialSeries = batchCodes.map((batchCode: string) => ({
          batch_code: batchCode,
          produced_qty: 0,
          expiry_date: '',
          production_step_id: '',
          decision_status: '',
          decision_reason: '',
          signatures: [],
          materials: items.map((item: any) => ({
            part: item.part,
            part_name: item.part_detail?.name || item.part,
            batch: item.batch_code || item.batch || '',
            received_qty: item.received_quantity || item.quantity || 0,
            used_qty: null
          }))
        }));

        setSeries(initialSeries);
      }
    } catch (error) {
      console.error('Failed to load request data:', error);
    }
  };

  const loadProductDetails = async (partId: string) => {
    try {
      const response = await api.get(`/modules/inventory/api/articles/${partId}`);
      const article = response.data;
      setProductLossRateThreshold(article.loss_rate_threshold ?? null);
    } catch (error) {
      console.error('Failed to load product details:', error);
      setProductLossRateThreshold(null);
    }
  };

  const loadProductionData = async () => {
    try {
      const response = await api.get(requestsApi.getProductionData(requestId));
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
        // production data present

        if (response.data.unused_materials) {
          const map: Record<string, number> = {};
          response.data.unused_materials.forEach((item: any) => {
            if (item.part) {
              map[item.part] = Number(item.return_qty) || 0;
            }
          });
          setReturnQuantities(map);
        } else {
          setReturnQuantities({});
        }

        if (response.data.return_order_reference) {
          setReturnOrderReference(response.data.return_order_reference);
        } else {
          setReturnOrderReference(null);
        }
      } else {
        setReturnQuantities({});
        setReturnOrderReference(null);
      }
    } catch (error) {
      console.error('Failed to load production data:', error);
      // no production data
    }
  };

  const loadProductionFlow = async () => {
    try {
      const response = await api.get(requestsApi.getProductionFlow(requestId));
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
      setProductionSteps(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load production steps:', error);
    }
  };

  const unusedMaterials = useMemo<UnusedMaterial[]>(() => {
    if (series.length === 0) return [];

    const materialMap = new Map<string, UnusedMaterial>();

    const isCanceledDecision = (decisionStatus?: string) => {
      if (!decisionStatus) return false;
      const state = availableStates.find(s => s._id === decisionStatus);
      if (!state) return false;
      const haystack = `${state.name || ''} ${state.slug || ''}`.toLowerCase();
      return CANCELED_TOKENS.some(token => haystack.includes(token));
    };

    series.forEach(serie => {
      if (isCanceledDecision(serie.decision_status)) {
        return;
      }
      serie.materials.forEach(material => {
        if (!materialMap.has(material.part)) {
          materialMap.set(material.part, {
            part: material.part,
            part_name: material.part_name,
            total_received: 0,
            total_used: 0,
            unused: 0,
            return_qty: 0,
            loss: 0
          });
        }

        const entry = materialMap.get(material.part)!;
        entry.total_received += material.received_qty;
        entry.total_used += Number(material.used_qty) || 0;
      });
    });

    materialMap.forEach(material => {
      material.unused = material.total_received - material.total_used;
      const returnQty = returnQuantities[material.part];
      material.return_qty = returnQty !== undefined ? returnQty : material.unused;
      material.loss = material.unused - material.return_qty;
    });

    return Array.from(materialMap.values());
  }, [series, returnQuantities, availableStates]);

  const buildUnusedMaterialsPayload = () => {
    return unusedMaterials.map(material => ({
      part: material.part,
      return_qty: material.return_qty
    }));
  };

  const notifyExcessiveLoss = () => {
    if (!productLossRateThreshold || productLossRateThreshold <= 0) return;

    const totalProduced = series.reduce((sum, serie) => sum + (serie.produced_qty || 0), 0);
    if (totalProduced <= 0) return;

    const issueDateText = requestIssueDate ? new Date(requestIssueDate).toLocaleDateString() : '';
    const orderRef = requestReference ? `${requestReference}${issueDateText ? `/${issueDateText}` : ''}` : '';

    unusedMaterials.forEach(material => {
      if (material.loss <= 0) return;
      const lossPercent = (material.loss / totalProduced) * 100;
      if (lossPercent > productLossRateThreshold) {
        notifications.show({
          title: t('Warning'),
          message: `Excessive loss for ${material.part_name || material.part}${orderRef ? ` on build order ${orderRef}` : ''}`,
          color: 'red'
        });
      }
    });
  };

  const saveProductionData = async (showSuccess: boolean) => {
    try {
      await api.post(requestsApi.saveProductionData(requestId), {
        series,
        unused_materials: buildUnusedMaterialsPayload()
      });

      if (showSuccess) {
        notifications.show({
          title: t('Success'),
          message: t('Production data saved successfully'),
          color: 'green'
        });
      }

      notifyExcessiveLoss();

      await loadProductionData();
      return true;
    } catch (error: any) {
      console.error('Failed to save production data:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save production data'),
        color: 'red'
      });
      return false;
    }
  };

  const handleSaveProduction = async () => {
    setSaving(true);
    try {
      await saveProductionData(true);
    } finally {
      setSaving(false);
    }
  };

  const handleSerieSign = async (batchCode: string) => {
    setSigningSerie(batchCode);
    try {
      const saved = await saveProductionData(false);
      if (!saved) {
        return;
      }

      await api.post(requestsApi.signProductionSeries(requestId), { batch_code: batchCode });
      notifications.show({
        title: t('Success'),
        message: t('Series signed successfully'),
        color: 'green'
      });
      await loadProductionData();
      onReload();
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

  const handleReturnQuantityChange = (part: string, value: number, max: number) => {
    const clampedValue = Math.min(Math.max(value, 0), max);
    setReturnQuantities(prev => ({ ...prev, [part]: clampedValue }));
  };

  const handleCreateReturnOrder = async () => {
    setCreatingReturnOrder(true);
    try {
      const saved = await saveProductionData(false);
      if (!saved) {
        return;
      }

      const response = await api.post(requestsApi.createProductionReturnOrder(requestId));
      setReturnOrderReference(response.data.return_order_reference || null);
      notifications.show({
        title: t('Success'),
        message: t('Return order created successfully'),
        color: 'green'
      });
      onReload();
    } catch (error: any) {
      console.error('Failed to create return order:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to create return order'),
        color: 'red'
      });
    } finally {
      setCreatingReturnOrder(false);
    }
  };

  const canUserSign = () => {
    if (!flow) return false;

    const matchesOfficer = (o: any) => {
      if (username && o.username && o.username === username) return true;
      if (o.reference && userId && o.reference === userId) return true;
      if (o.type === 'role') {
        if (roleSlug && o.reference === roleSlug) return true;
        if (localRole && o.reference === localRole) return true;
        if (o.reference === 'admin' && isStaff) return true;
      }
      return false;
    };

    const canSign = flow.can_sign_officers.some(matchesOfficer);
    const mustSign = flow.must_sign_officers.some(matchesOfficer);

    return canSign || mustSign;
  };

  const allSeriesResolved = series.length > 0 && series.every(serie => (serie.signatures || []).length > 0);
  const hasReturnable = unusedMaterials.some(material => material.return_qty > 0);

  const handlePrintLabels = async (quantities: Record<string, number>) => {
    const selected = Object.entries(quantities).filter(([, qty]) => qty > 0);
    if (selected.length === 0) {
      notifications.show({
        title: t('Error'),
        message: t('Please select at least one batch quantity'),
        color: 'red'
      });
      return;
    }

    if (!productId) {
      notifications.show({
        title: t('Error'),
        message: t('Product not found for this request'),
        color: 'red'
      });
      return;
    }

    setPrintingLabels(true);
    try {
      const response = await api.get(`/modules/inventory/api/stocks?part_id=${productId}&limit=1000`);
      const stocks = response.data.results || [];

      const itemsToPrint = [] as Array<{ id: string; quantity: number }>;
      const missingBatches: string[] = [];

      selected.forEach(([batchCode, qty]) => {
        const stock = stocks.find((s: any) => s.batch_code === batchCode);
        if (!stock) {
          missingBatches.push(batchCode);
          return;
        }
        itemsToPrint.push({ id: stock._id, quantity: qty });
      });

      if (missingBatches.length > 0) {
        notifications.show({
          title: t('Error'),
          message: `${t('Missing stock for batches')}: ${missingBatches.join(', ')}`,
          color: 'red'
        });
        return;
      }

      const labelResponse = await api.post(
        '/modules/inventory/api/generate-labels-docu',
        {
          table: 'depo_stocks',
          items: itemsToPrint
        },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([labelResponse.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'labels.pdf');
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();

      notifications.show({
        title: t('Success'),
        message: t('Labels generated successfully'),
        color: 'green'
      });
      setPrintModalOpen(false);
    } catch (error) {
      console.error('Failed to generate labels:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to generate labels'),
        color: 'red'
      });
    } finally {
      setPrintingLabels(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'gray';
      case 'in_progress': return 'blue';
      case 'approved': return 'green';
      case 'rejected': return 'red';
      default: return 'gray';
    }
  };

  if (loading) {
    return <Paper p="md"><Text>{t('Loading...')}</Text></Paper>;
  }

  if (stateOrder <= 40) {
    return (
      <Paper p="md">
        <Text c="dimmed">{t('Production will be available after stock is received')}</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Group>
          <Title order={4}>{t('Production')}</Title>
          {flow && (
            <Badge color={getStatusColor(flow.status)} size="lg">
              {flow.status.toUpperCase()}
            </Badge>
          )}
          {isCanceled && (
            <Badge color="red" size="lg">
              {t('CANCELED')}
            </Badge>
          )}
        </Group>
        <Group>
          <Button
            variant="default"
            leftSection={<IconPrinter size={16} />}
            onClick={() => setPrintModalOpen(true)}
          >
            {t('Print labels')}
          </Button>
          <Button onClick={handleSaveProduction} loading={saving}>
            {t('Save')}
          </Button>
        </Group>
      </Group>

      <Stack gap="xl">
        <ProductionSeriesTable
          series={series}
          onSeriesChange={setSeries}
          availableStates={availableStates}
          productionSteps={productionSteps}
          flow={flow}
          canUserSign={canUserSign() && !isCanceled}
          onSignSerie={handleSerieSign}
          signingSerie={signingSerie}
          isCanceled={isCanceled}
          currentUsername={username}
        />

        {unusedMaterials.length > 0 && (
          <Stack gap="md">
            <UnusedMaterialsTable
              unusedMaterials={unusedMaterials}
              onReturnQuantityChange={handleReturnQuantityChange}
              isReadonly={isCanceled}
            />
            <Group justify="space-between">
              {returnOrderReference ? (
                <Text size="sm" c="dimmed">
                  {t('Return order created')}: {returnOrderReference}
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  {t('Create return order after all batches are signed')}
                </Text>
              )}
              <Button
                onClick={handleCreateReturnOrder}
                loading={creatingReturnOrder}
                disabled={!allSeriesResolved || !hasReturnable || !!returnOrderReference || isCanceled}
              >
                {t('Create return order')}
              </Button>
            </Group>
          </Stack>
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
                    await api.post(requestsApi.createProductionFlow(requestId));
                    notifications.show({
                      title: t('Success'),
                      message: t('Production flow created successfully'),
                      color: 'green'
                    });
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

      <ProductionPrintLabelsModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        series={series}
        onPrint={handlePrintLabels}
        printing={printingLabels}
      />
    </Paper>
  );
}
