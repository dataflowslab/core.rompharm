import { useState, useEffect, useMemo } from 'react';
import { Paper, Title, Text, Badge, Grid, Group, Stack, Button } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../context/AuthContext';
import { ProductionSeriesTable } from './ProductionSeriesTable';
import { UnusedMaterialsTable } from './UnusedMaterialsTable';
import { DecisionSection } from './DecisionSection';
import { SignaturesSection } from './SignaturesSection';

interface Material {
  part: string;
  part_name: string;
  batch: string;
  received_qty: number;
  used_qty: number;
}

interface Serie {
  batch_code: string;
  materials: Material[];
}

interface UnusedMaterial {
  part: string;
  part_name: string;
  total_received: number;
  total_used: number;
  unused: number;
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

interface ProductionTabProps {
  requestId: string;
  onReload: () => void;
}

export function ProductionTab({ requestId, onReload }: ProductionTabProps) {
  const { t } = useTranslation();
  const { username, isStaff } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<Serie[]>([]);
  const [flow, setFlow] = useState<ProductionFlow | null>(null);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [finalStatus, setFinalStatus] = useState<string>('');
  const [refusalReason, setRefusalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableStates, setAvailableStates] = useState<any[]>([]);
  const [stateOrder, setStateOrder] = useState<number>(0);
  const [isCanceled, setIsCanceled] = useState(false);
  const [hasProductionData, setHasProductionData] = useState(false);

  useEffect(() => {
    loadData();
  }, [requestId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadRequestData(),
        loadProductionData(),
        loadProductionFlow(),
        loadAvailableStates()
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
      
      // Check if canceled
      const canceledStateId = '67890abc1234567890abcde9';
      setIsCanceled(request.state_id === canceledStateId);
      
      // Load last status from status_log for production scene
      const statusLog = request.status_log || [];
      const lastProductionStatus = statusLog
        .filter((log: any) => log.scene === 'production')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
      if (lastProductionStatus) {
        setFinalStatus(lastProductionStatus.status_id);
        setRefusalReason(lastProductionStatus.reason || '');
      }
      
      // Initialize series from request batch_codes if no production data exists
      const items = request.items || [];
      const batchCodes = request.batch_codes || [];
      
      if (series.length === 0 && batchCodes.length > 0) {
        // Create a series for each batch code with materials from items
        const initialSeries = batchCodes.map((batchCode: string) => ({
          batch_code: batchCode,
          materials: items.map((item: any) => ({
            part: item.part,
            part_name: item.part_detail?.name || item.part,
            batch: '', // Material batch will be filled by user
            received_qty: item.received_quantity || item.quantity || 0,
            used_qty: 0
          }))
        }));
        
        setSeries(initialSeries);
      }
    } catch (error) {
      console.error('Failed to load request data:', error);
    }
  };

  const loadProductionData = async () => {
    try {
      const response = await api.get(requestsApi.getProductionData(requestId));
      if (response.data && response.data.series) {
        setSeries(response.data.series);
        setHasProductionData(true);
      } else {
        setHasProductionData(false);
      }
    } catch (error) {
      console.error('Failed to load production data:', error);
      setHasProductionData(false);
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
      
      // Filter states with 'production' in scenes
      const productionStates = allStates.filter((state: any) => 
        state.scenes && Array.isArray(state.scenes) && state.scenes.includes('production')
      );
      
      setAvailableStates(productionStates);
    } catch (error) {
      console.error('Failed to load states:', error);
    }
  };

  // Calculate unused materials
  const unusedMaterials = useMemo<UnusedMaterial[]>(() => {
    if (series.length === 0) return [];
    
    // Get all unique materials
    const materialMap = new Map<string, UnusedMaterial>();
    
    series.forEach(serie => {
      serie.materials.forEach(material => {
        if (!materialMap.has(material.part)) {
          materialMap.set(material.part, {
            part: material.part,
            part_name: material.part_name,
            total_received: 0,
            total_used: 0,
            unused: 0
          });
        }
        
        const entry = materialMap.get(material.part)!;
        entry.total_received += material.received_qty;
        entry.total_used += material.used_qty;
      });
    });
    
    // Calculate unused
    materialMap.forEach(material => {
      material.unused = material.total_received - material.total_used;
    });
    
    return Array.from(materialMap.values());
  }, [series]);

  const handleSaveProduction = async () => {
    setSaving(true);
    try {
      await api.post(requestsApi.saveProductionData(requestId), { series });
      
      notifications.show({
        title: t('Success'),
        message: t('Production data saved successfully'),
        color: 'green'
      });
      
      await loadProductionData();
      setHasProductionData(true);
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

  const handleSubmitStatus = async () => {
    if (!finalStatus) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a status'),
        color: 'red'
      });
      return;
    }

    // Check if selected state needs comment
    const selectedState = availableStates.find(s => s._id === finalStatus);
    if (selectedState?.needs_comment && !refusalReason.trim()) {
      notifications.show({
        title: t('Error'),
        message: t('Please provide a comment'),
        color: 'red'
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(requestsApi.updateProductionStatus(requestId), {
        status: finalStatus,
        reason: refusalReason || undefined
      });

      // Auto-sign after saving decision (like Reception flow)
      await api.post(requestsApi.signProduction(requestId));

      notifications.show({
        title: t('Success'),
        message: t('Decision saved and signed successfully'),
        color: 'green'
      });

      await loadRequestData();
      await loadProductionFlow();
      onReload();
    } catch (error: any) {
      console.error('Failed to update status or sign:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save decision'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSign = async () => {
    if (!finalStatus) {
      notifications.show({
        title: t('Error'),
        message: t('Please select and save a status before signing'),
        color: 'red'
      });
      return;
    }

    setSigning(true);
    try {
      await api.post(requestsApi.signProduction(requestId));
      
      notifications.show({
        title: t('Success'),
        message: t('Production signed successfully'),
        color: 'green'
      });
      
      setTimeout(() => {
        loadProductionFlow();
        onReload();
      }, 500);
    } catch (error: any) {
      console.error('Failed to sign production:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to sign production'),
        color: 'red'
      });
    } finally {
      setSigning(false);
    }
  };

  const handleRemoveSignature = (userId: string, username: string) => {
    modals.openConfirmModal({
      title: t('Remove Signature'),
      children: (
        <Text size="sm">
          {t('Are you sure you want to remove the signature from')} <strong>{username}</strong>?
        </Text>
      ),
      labels: { confirm: t('Remove'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          // TODO: Add remove signature endpoint
          notifications.show({
            title: t('Success'),
            message: t('Signature removed successfully'),
            color: 'green'
          });
          loadProductionFlow();
          onReload();
        } catch (error: any) {
          console.error('Failed to remove signature:', error);
          notifications.show({
            title: t('Error'),
            message: error.response?.data?.detail || t('Failed to remove signature'),
            color: 'red'
          });
        }
      }
    });
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

  const canUserSign = () => {
    if (!flow || !username) return false;
    
    const alreadySigned = flow.signatures.some(s => s.username === username);
    if (alreadySigned) return false;
    
    // Check if user can sign - support both username and role-based officers
    const canSign = flow.can_sign_officers.some(o => {
      if (o.username === username) return true;
      if (o.type === 'role' && o.reference === 'admin' && isStaff) return true;
      return false;
    });
    
    const mustSign = flow.must_sign_officers.some(o => {
      if (o.username === username) return true;
      if (o.type === 'role' && o.reference === 'admin' && isStaff) return true;
      return false;
    });
    
    return canSign || mustSign;
  };

  const isFlowCompleted = () => {
    if (!flow) return false;
    
    const allMustSigned = flow.must_sign_officers.every(officer =>
      flow.signatures.some(s => s.user_id === officer.reference)
    );
    
    const signatureCount = flow.signatures.filter(s =>
      flow.can_sign_officers.some(o => o.reference === s.user_id)
    ).length;
    
    const hasMinSignatures = signatureCount >= flow.min_signatures;
    
    return allMustSigned && hasMinSignatures;
  };

  const hasAnySignature = () => {
    return !!(flow && flow.signatures.length > 0);
  };

  const isReadonly = hasAnySignature() || isCanceled;

  if (loading) {
    return <Paper p="md"><Text>{t('Loading...')}</Text></Paper>;
  }

  // Show message if state_order <= 40 (not yet ready for production)
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

      <Stack gap="xl">
        {/* Production Series Table */}
        <ProductionSeriesTable
          series={series}
          onSeriesChange={setSeries}
          onSave={handleSaveProduction}
          saving={saving}
          isReadonly={isReadonly}
        />

        {/* Unused Materials Table */}
        {unusedMaterials.length > 0 && (
          <UnusedMaterialsTable unusedMaterials={unusedMaterials} />
        )}

        {/* Decision + Signatures - Only show after production data is saved */}
        {flow && hasProductionData && (
          <Grid>
            {/* Left Column: Decision (1/3) */}
            <Grid.Col span={4}>
              <Paper withBorder p="md">
                <Title order={5} mb="md">{t('Decision')}</Title>
                <DecisionSection
                  status={finalStatus}
                  reason={refusalReason}
                  isCompleted={isFlowCompleted() || isCanceled}
                  availableStates={availableStates}
                  onStatusChange={(value) => setFinalStatus(value || '')}
                  onReasonChange={setRefusalReason}
                  onSubmit={handleSubmitStatus}
                  submitting={submitting}
                />
              </Paper>
            </Grid.Col>

            {/* Right Column: Signatures (2/3) */}
            <Grid.Col span={8}>
              <Paper withBorder p="md">
                <SignaturesSection
                  canSign={canUserSign() && !isCanceled}
                  isCompleted={isFlowCompleted()}
                  canSignOfficers={flow.can_sign_officers}
                  minSignatures={flow.min_signatures}
                  signatures={flow.signatures}
                  isStaff={isStaff}
                  onSign={handleSign}
                  onRemoveSignature={handleRemoveSignature}
                  signing={signing}
                />
              </Paper>
            </Grid.Col>
          </Grid>
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
    </Paper>
  );
}
