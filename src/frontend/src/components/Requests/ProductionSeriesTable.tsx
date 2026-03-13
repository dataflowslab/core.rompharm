import { Paper, Title, Text, Grid, Group, Table, NumberInput, Select, Textarea, Stack } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { SafeSelect } from '../Common/SafeSelect';
import { SeriesSignaturesSection } from './SeriesSignaturesSection';

interface Material {
  part: string;
  part_name: string;
  batch: string;
  received_qty: number;
  used_qty: number | null;
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

interface ProductionStep {
  _id: string;
  name?: string;
  label?: string;
  code?: string;
}

interface RequestState {
  _id: string;
  name: string;
  slug?: string;
  needs_comment?: boolean;
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

interface ProductionSeriesTableProps {
  series: Serie[];
  onSeriesChange: (series: Serie[]) => void;
  availableStates: RequestState[];
  productionSteps: ProductionStep[];
  flow: ProductionFlow | null;
  canUserSign: boolean;
  onSignSerie: (batchCode: string) => void;
  signingSerie: string | null;
  isCanceled: boolean;
  currentUsername?: string | null;
}

const CANCELED_TOKENS = ['canceled', 'cancelled', 'anulat', 'anulare', 'cancel', 'cancelare'];
const FAILED_TOKENS = ['failed', 'fail', 'esuat', 'refuz', 'refused', 'rejected', 'neconform'];

export function ProductionSeriesTable({
  series,
  onSeriesChange,
  availableStates,
  productionSteps,
  flow,
  canUserSign,
  onSignSerie,
  signingSerie,
  isCanceled,
  currentUsername
}: ProductionSeriesTableProps) {
  const { t } = useTranslation();

  const updateSerie = (serieIndex: number, updates: Partial<Serie>) => {
    const newSeries = [...series];
    newSeries[serieIndex] = { ...newSeries[serieIndex], ...updates };
    onSeriesChange(newSeries);
  };

  const handleUsedQtyChange = (serieIndex: number, materialIndex: number, value: number | null) => {
    const newSeries = [...series];
    newSeries[serieIndex].materials[materialIndex].used_qty = value;
    onSeriesChange(newSeries);
  };

  const getDecisionState = (decisionStatus?: string) => {
    if (!decisionStatus) return null;
    return availableStates.find(s => s._id === decisionStatus) || null;
  };

  const isCanceledDecision = (decisionStatus?: string) => {
    const state = getDecisionState(decisionStatus);
    if (!state) return false;
    const haystack = `${state.name || ''} ${state.slug || ''}`.toLowerCase();
    return CANCELED_TOKENS.some(token => haystack.includes(token));
  };

  const isFailedDecision = (decisionStatus?: string) => {
    const state = getDecisionState(decisionStatus);
    if (!state) return false;
    const haystack = `${state.name || ''} ${state.slug || ''}`.toLowerCase();
    return FAILED_TOKENS.some(token => haystack.includes(token)) && !isCanceledDecision(decisionStatus);
  };

  const isSerieCompleted = (signatures: ApprovalSignature[]) => {
    if (!flow) return false;

    const allMustSigned = flow.must_sign_officers.every(officer =>
      signatures.some(s => s.user_id === officer.reference)
    );

    const signatureCount = signatures.filter(s =>
      flow.can_sign_officers.some(o => o.reference === s.user_id)
    ).length;

    const hasMinSignatures = signatureCount >= flow.min_signatures;

    return allMustSigned && hasMinSignatures;
  };

  const stepOptions = productionSteps.map(step => ({
    value: step._id,
    label: step.name || step.label || step.code || step._id
  }));

  const isSerieUsedQtyComplete = (serie: Serie) => {
    if (isCanceledDecision(serie.decision_status)) {
      return (serie.signatures || []).length > 0;
    }
    if (!serie.materials || serie.materials.length === 0) return true;
    return serie.materials.every(material => material.used_qty !== null && material.used_qty !== undefined);
  };

  const firstIncompleteIndex = series.findIndex(serie => !isSerieUsedQtyComplete(serie));
  const activeSerieIndex = series.length === 0
    ? -1
    : (firstIncompleteIndex === -1 ? series.length - 1 : firstIncompleteIndex);

  const getMaterialKey = (material: Material) => `${material.part}__${material.batch || ''}`;

  return (
    <Stack gap="xl">
      {series.map((serie, serieIndex) => {
        const decisionState = getDecisionState(serie.decision_status);
        const needsComment = decisionState?.needs_comment === true;
        const isCanceledDecisionStatus = isCanceledDecision(serie.decision_status);
        const isFailedDecisionStatus = isFailedDecision(serie.decision_status);
        const expiryRequired = !(isCanceledDecisionStatus || isFailedDecisionStatus);
        const producedRequired = !isCanceledDecisionStatus;
        const signatures = serie.signatures || [];
        const hasAnySignature = signatures.length > 0;
        const isSerieActive = serieIndex === activeSerieIndex || series.length === 1;
        const isSerieLocked = isCanceled || hasAnySignature || !isSerieActive;
        const isDecisionLocked = isCanceled || hasAnySignature;
        const disableDetails = isSerieLocked || isCanceledDecisionStatus;
        const serieCompleted = isSerieCompleted(signatures);

        const hasProducedQty = (serie.produced_qty || 0) > 0 || !producedRequired;
        const hasExpiry = !!serie.expiry_date || !expiryRequired;
        const hasStep = !!serie.production_step_id || isCanceledDecisionStatus;
        const hasDecision = !!serie.decision_status;
        const userAlreadySigned = !!currentUsername && signatures.some(s => s.username === currentUsername);
        const canSign = canUserSign && hasDecision && hasStep && hasProducedQty && hasExpiry && !serieCompleted && !isCanceled && !userAlreadySigned && !hasAnySignature && isSerieActive;

        const signedUsedByKey = new Map<string, number>();
        series.slice(0, serieIndex).forEach(prevSerie => {
          if ((prevSerie.signatures || []).length === 0) return;
          if (isCanceledDecision(prevSerie.decision_status)) return;
          (prevSerie.materials || []).forEach(material => {
            const key = getMaterialKey(material);
            const prevValue = signedUsedByKey.get(key) || 0;
            signedUsedByKey.set(key, prevValue + (Number(material.used_qty) || 0));
          });
        });

        return (
          <Paper key={serie.batch_code} withBorder p="md">
            <Group justify="space-between" mb="md">
              <Title order={5}>{t('Batch')}: {serie.batch_code}</Title>
              {isCanceledDecisionStatus && (
                <Text c="red" fw={600}>{t('Canceled')}</Text>
              )}
              {!isCanceledDecisionStatus && isFailedDecisionStatus && (
                <Text c="red" fw={600}>{t('Failed')}</Text>
              )}
            </Group>

            <Grid gutter="md" mb="md">
              <Grid.Col span={3}>
                <NumberInput
                  label={t('Produced quantity')}
                  value={serie.produced_qty || 0}
                  onChange={(value) => updateSerie(serieIndex, { produced_qty: Number(value) || 0 })}
                  min={0}
                  required={producedRequired}
                  disabled={disableDetails}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <DatePickerInput
                  label={t('Expiration date')}
                  placeholder={t('Pick date')}
                  value={serie.expiry_date ? new Date(serie.expiry_date) : null}
                  onChange={(value) => updateSerie(serieIndex, { expiry_date: value ? value.toISOString() : '' })}
                  required={expiryRequired}
                  clearable={!expiryRequired}
                  disabled={disableDetails}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <Select
                  label={t('Production step')}
                  placeholder={t('Select step')}
                  data={stepOptions}
                  value={serie.production_step_id || ''}
                  onChange={(value) => updateSerie(serieIndex, { production_step_id: value || '' })}
                  searchable
                  clearable
                  required
                  disabled={disableDetails}
                />
              </Grid.Col>

              <Grid.Col span={3}>
                <SafeSelect
                  label={t('Decision')}
                  placeholder={t('Select status')}
                  data={availableStates}
                  valueKey="_id"
                  labelKey="name"
                  value={serie.decision_status || ''}
                  onChange={(value) => {
                    const nextValue = value || '';
                    const wasCanceled = isCanceledDecision(serie.decision_status);

                    if (isCanceledDecision(nextValue)) {
                      const resetMaterials = (serie.materials || []).map(material => ({
                        ...material,
                        used_qty: 0
                      }));
                      updateSerie(serieIndex, {
                        decision_status: nextValue,
                        produced_qty: 0,
                        expiry_date: '',
                        production_step_id: '',
                        materials: resetMaterials
                      });
                      return;
                    }

                    if (wasCanceled && !isCanceledDecision(nextValue)) {
                      const resetMaterials = (serie.materials || []).map(material => ({
                        ...material,
                        used_qty: null
                      }));
                      updateSerie(serieIndex, {
                        decision_status: nextValue,
                        materials: resetMaterials
                      });
                      return;
                    }

                    updateSerie(serieIndex, { decision_status: nextValue });
                  }}
                  required
                  disabled={isDecisionLocked}
                />
              </Grid.Col>
            </Grid>

            {needsComment && (
              <Textarea
                label={t('Comment')}
                placeholder={t('Enter comment')}
                value={serie.decision_reason || ''}
                onChange={(e) => updateSerie(serieIndex, { decision_reason: e.target.value })}
                required
                minRows={2}
                mb="md"
                disabled={isDecisionLocked}
              />
            )}

            <Grid gutter="md">
              <Grid.Col span={9}>
                <Text size="sm" fw={600} mb="xs">{t('Consumptions')}</Text>
                <Table striped withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('Material')}</Table.Th>
                      <Table.Th>{t('Batch')}</Table.Th>
                      <Table.Th style={{ width: '120px' }}>{t('Available Qty')}</Table.Th>
                      <Table.Th style={{ width: '140px' }}>{t('Used Qty')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {serie.materials.map((material, materialIndex) => {
                      const key = getMaterialKey(material);
                      const signedUsed = signedUsedByKey.get(key) || 0;
                      const availableQty = Math.max(0, (Number(material.received_qty) || 0) - signedUsed);
                      const maxQty = availableQty;
                      return (
                        <Table.Tr key={`${serie.batch_code}-${materialIndex}`}>
                        <Table.Td>{material.part_name || material.part}</Table.Td>
                        <Table.Td>{material.batch || '-'}</Table.Td>
                        <Table.Td>{availableQty}</Table.Td>
                        <Table.Td>
                          <NumberInput
                            value={material.used_qty ?? ''}
                            onChange={(value) => {
                              if (value === null || value === undefined || value === '') {
                                handleUsedQtyChange(serieIndex, materialIndex, null);
                                return;
                              }
                              const numericValue = Number(value) || 0;
                              const clampedValue = Math.min(Math.max(numericValue, 0), maxQty);
                              handleUsedQtyChange(serieIndex, materialIndex, clampedValue);
                            }}
                            min={0}
                            max={maxQty}
                            disabled={isSerieLocked || isCanceledDecisionStatus}
                            size="sm"
                          />
                        </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Grid.Col>

              <Grid.Col span={3}>
                <SeriesSignaturesSection
                  canSign={canSign}
                  isCompleted={serieCompleted}
                  canSignOfficers={flow?.can_sign_officers || []}
                  minSignatures={flow?.min_signatures || 1}
                  signatures={signatures}
                  onSign={() => onSignSerie(serie.batch_code)}
                  signing={signingSerie === serie.batch_code}
                />
              </Grid.Col>
            </Grid>
          </Paper>
        );
      })}
    </Stack>
  );
}
