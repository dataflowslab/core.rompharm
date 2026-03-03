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
  used_qty: number;
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

const FAILED_CANCELED_TOKENS = ['failed', 'fail', 'canceled', 'cancelled', 'anulat', 'anulare', 'esuat', 'refuz', 'refused', 'rejected', 'neconform'];

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

  const handleUsedQtyChange = (serieIndex: number, materialIndex: number, value: number) => {
    const newSeries = [...series];
    newSeries[serieIndex].materials[materialIndex].used_qty = value;
    onSeriesChange(newSeries);
  };

  const getDecisionState = (decisionStatus?: string) => {
    if (!decisionStatus) return null;
    return availableStates.find(s => s._id === decisionStatus) || null;
  };

  const isFailedOrCanceled = (decisionStatus?: string) => {
    const state = getDecisionState(decisionStatus);
    if (!state) return false;
    const haystack = `${state.name || ''} ${state.slug || ''}`.toLowerCase();
    return FAILED_CANCELED_TOKENS.some(token => haystack.includes(token));
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

  return (
    <Stack gap="xl">
      {series.map((serie, serieIndex) => {
        const decisionState = getDecisionState(serie.decision_status);
        const needsComment = decisionState?.needs_comment === true;
        const failedOrCanceled = isFailedOrCanceled(serie.decision_status);
        const expiryRequired = !failedOrCanceled;
        const producedRequired = !failedOrCanceled;
        const signatures = serie.signatures || [];
        const hasAnySignature = signatures.length > 0;
        const isReadonly = isCanceled || hasAnySignature;
        const serieCompleted = isSerieCompleted(signatures);

        const hasProducedQty = (serie.produced_qty || 0) > 0 || !producedRequired;
        const hasExpiry = !!serie.expiry_date || !expiryRequired;
        const hasStep = !!serie.production_step_id;
        const hasDecision = !!serie.decision_status;
        const userAlreadySigned = !!currentUsername && signatures.some(s => s.username === currentUsername);
        const canSign = canUserSign && hasDecision && hasStep && hasProducedQty && hasExpiry && !serieCompleted && !isCanceled && !userAlreadySigned;

        return (
          <Paper key={serie.batch_code} withBorder p="md">
            <Group justify="space-between" mb="md">
              <Title order={5}>{t('Batch')}: {serie.batch_code}</Title>
              {failedOrCanceled && (
                <Text c="red" fw={600}>{t('Canceled/Failed')}</Text>
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
                  disabled={isReadonly}
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
                  disabled={isReadonly}
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
                  disabled={isReadonly}
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
                  onChange={(value) => updateSerie(serieIndex, { decision_status: value || '' })}
                  required
                  disabled={isReadonly}
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
                disabled={isReadonly}
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
                      <Table.Th style={{ width: '120px' }}>{t('Received Qty')}</Table.Th>
                      <Table.Th style={{ width: '140px' }}>{t('Used Qty')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {serie.materials.map((material, materialIndex) => (
                      <Table.Tr key={`${serie.batch_code}-${materialIndex}`}>
                        <Table.Td>{material.part_name || material.part}</Table.Td>
                        <Table.Td>{material.batch}</Table.Td>
                        <Table.Td>{material.received_qty}</Table.Td>
                        <Table.Td>
                          <NumberInput
                            value={material.used_qty}
                            onChange={(value) => handleUsedQtyChange(serieIndex, materialIndex, Number(value) || 0)}
                            min={0}
                            max={material.received_qty}
                            disabled={isReadonly}
                            size="sm"
                          />
                        </Table.Td>
                      </Table.Tr>
                    ))}
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
