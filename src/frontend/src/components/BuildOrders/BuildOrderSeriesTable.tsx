import { Paper, Title, Text, Grid, Group, Table, NumberInput, Select, Textarea, Stack, Button, Badge, SimpleGrid } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { SeriesSignaturesSection } from '../Requests/SeriesSignaturesSection';
import { formatDate } from '../../utils/dateFormat';

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

interface BuildOrderSeriesTableProps {
  series: Serie[];
  onSeriesChange: (series: Serie[]) => void;
  availableStates: RequestState[];
  flow: ProductionFlow | null;
  canUserSign: boolean;
  onSignSerie: (batchCode: string, serie: Serie) => void;
  onSaveSerie: (batchCode: string, serie: Serie) => void;
  signingSerie: string | null;
  savingSerie: string | null;
  isCanceled: boolean;
  currentUsername?: string | null;
  editableBatchCode?: string;
  groupBuildOrders?: Array<{ batch_code: string; build_order_id: string }>;
}

const CANCELED_TOKENS = ['canceled', 'cancelled', 'anulat', 'anulare', 'cancel', 'cancelare'];
const FAILED_TOKENS = ['failed', 'fail', 'esuat', 'refuz', 'refused', 'rejected', 'neconform'];

export function BuildOrderSeriesTable({
  series,
  onSeriesChange,
  availableStates,
  flow,
  canUserSign,
  onSignSerie,
  onSaveSerie,
  signingSerie,
  savingSerie,
  isCanceled,
  currentUsername,
  editableBatchCode,
  groupBuildOrders
}: BuildOrderSeriesTableProps) {
  const { t } = useTranslation();
  const normalizeBatchCode = (value?: string | number | null) =>
    value === null || value === undefined ? '' : String(value).trim();
  const editableCode = normalizeBatchCode(editableBatchCode);
  const buildOrderByBatch = new Map(
    (groupBuildOrders || []).map(entry => [normalizeBatchCode(entry.batch_code), entry.build_order_id])
  );

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

    const mustPersons = flow.must_sign_officers.filter(o => o.type === 'person');
    const mustRoles = flow.must_sign_officers.filter(o => o.type === 'role');

    const mustPersonsOk = mustPersons.every(officer =>
      signatures.some(s => s.user_id === officer.reference)
    );
    const mustRolesOk = signatures.length >= mustRoles.length;

    const hasMinSignatures = signatures.length >= flow.min_signatures;

    return mustPersonsOk && mustRolesOk && hasMinSignatures;
  };

  const getMaterialKey = (material: Material) =>
    `${material.part}__${material.batch || ''}__${material.request_id || ''}__${material.request_item_index ?? ''}`;

  const totalUsedByKey = new Map<string, number>();
  series.forEach(serie => {
    if (isCanceledDecision(serie.decision_status)) return;
    (serie.materials || []).forEach(material => {
      const key = getMaterialKey(material);
      const prevValue = totalUsedByKey.get(key) || 0;
      totalUsedByKey.set(key, prevValue + (Number(material.used_qty) || 0));
    });
  });

  const formatRequestLabel = (material: Material) => {
    if (!material.request_id) return '-';
    const dateLabel = material.request_issue_date ? formatDate(material.request_issue_date) : '';
    return dateLabel ? `${material.request_reference || material.request_id} • ${dateLabel}` : (material.request_reference || material.request_id);
  };

  const orderedSeries = [...series].sort((a, b) => {
    const aEditable = normalizeBatchCode(a.batch_code) === editableCode;
    const bEditable = normalizeBatchCode(b.batch_code) === editableCode;
    if (aEditable === bEditable) return 0;
    return aEditable ? -1 : 1;
  });

  const editableSeries = orderedSeries.filter(serie => normalizeBatchCode(serie.batch_code) === editableCode || !editableCode);
  const readonlySeries = orderedSeries.filter(serie => !editableSeries.includes(serie));

  const renderEditableSerie = (serie: Serie, serieIndex: number) => {
        const decisionState = getDecisionState(serie.decision_status);
        const needsComment = decisionState?.needs_comment === true;
        const isCanceledDecisionStatus = isCanceledDecision(serie.decision_status);
        const isFailedDecisionStatus = isFailedDecision(serie.decision_status);
        const expiryRequired = !(isCanceledDecisionStatus || isFailedDecisionStatus);
        const producedRequired = !isCanceledDecisionStatus;
        const signatures = serie.signatures || [];
        const isEditableSerie = !editableCode || normalizeBatchCode(serie.batch_code) === editableCode;
        const isSerieLocked = isCanceled || !!serie.saved_at || !isEditableSerie;
        const isDecisionLocked = isSerieLocked;
        const disableDetails = isSerieLocked || isCanceledDecisionStatus;
        const serieCompleted = isSerieCompleted(signatures);

        const hasProducedQty = (serie.produced_qty || 0) > 0 || !producedRequired;
        const hasExpiry = !!serie.expiry_date || !expiryRequired;
        const hasStep = !!serie.production_step_id || isCanceledDecisionStatus;
        const hasDecision = !!serie.decision_status;
        const userAlreadySigned = !!currentUsername && signatures.some(s => s.username === currentUsername);
        const canSign = canUserSign && hasDecision && hasStep && hasProducedQty && hasExpiry && !serieCompleted && !isCanceled && !userAlreadySigned && isEditableSerie && !serie.saved_at;
        const buildOrderId = buildOrderByBatch.get(normalizeBatchCode(serie.batch_code));

        return (
          <Paper key={serie.batch_code} withBorder p="md">
            <Group justify="space-between" mb="md">
              <Title order={5}>{t('Batch')}: {serie.batch_code}</Title>
              <Group>
                {buildOrderId && (
                  <Button
                    size="xs"
                    variant="outline"
                    leftSection={<IconExternalLink size={14} />}
                    onClick={() => window.open(`/web/build-orders/${buildOrderId}`, '_blank')}
                  >
                    {t('Open build order')}
                  </Button>
                )}
                {serie.saved_at && (
                  <Badge color="green" size="sm">
                    {t('Saved')}
                  </Badge>
                )}
                {isCanceledDecisionStatus && (
                  <Badge color="red" size="sm">
                    {t('Canceled')}
                  </Badge>
                )}
                {!isCanceledDecisionStatus && isFailedDecisionStatus && (
                  <Badge color="red" size="sm">
                    {t('Failed')}
                  </Badge>
                )}
                <Button
                  size="xs"
                  onClick={() => onSaveSerie(serie.batch_code, serie)}
                  loading={savingSerie === serie.batch_code}
                  disabled={!serieCompleted || !!serie.saved_at || !isEditableSerie}
                >
                  {t('Save')}
                </Button>
              </Group>
            </Group>

            <Grid gutter="md" mb="md">
              <Grid.Col span={4}>
                <NumberInput
                  label={t('Produced quantity')}
                  value={serie.produced_qty || 0}
                  onChange={(value) => updateSerie(serieIndex, { produced_qty: Number(value) || 0 })}
                  min={0}
                  required={producedRequired}
                  disabled={disableDetails}
                />
              </Grid.Col>

              <Grid.Col span={4}>
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

              <Grid.Col span={4}>
                <Select
                  label={t('Decision')}
                  placeholder={t('Select status')}
                  data={availableStates.map(s => ({ value: s._id, label: s.name }))}
                  value={serie.decision_status || null}
                  onChange={(value) => {
                    const updates: Partial<Serie> = { decision_status: value || '' };
                    if (isCanceledDecision(serie.decision_status)) {
                      (serie.materials || []).forEach((material, materialIndex) => {
                        handleUsedQtyChange(serieIndex, materialIndex, null);
                      });
                    }
                    updateSerie(serieIndex, updates);
                  }}
                  required
                  searchable
                  disabled={isDecisionLocked}
                />
              </Grid.Col>

              {needsComment && (
                <Grid.Col span={12}>
                  <Textarea
                    label={t('Comment')}
                    value={serie.decision_reason || ''}
                    onChange={(event) => updateSerie(serieIndex, { decision_reason: event.currentTarget.value })}
                    disabled={isDecisionLocked}
                    minRows={2}
                  />
                </Grid.Col>
              )}
            </Grid>

            <Grid gutter="md">
              <Grid.Col span={9}>
                <Text fw={600} mb="xs">{t('Consumptions')}</Text>
                <Table striped withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('Material')}</Table.Th>
                      <Table.Th>{t('Batch')}</Table.Th>
                      <Table.Th>{t('Request')}</Table.Th>
                      <Table.Th>{t('Available Qty')}</Table.Th>
                      <Table.Th>{t('Used Qty')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(serie.materials || []).map((material, materialIndex) => {
                      const key = getMaterialKey(material);
                      const totalUsed = totalUsedByKey.get(key) || 0;
                      const currentUsed = Number(material.used_qty) || 0;
                      const usedByOthers = Math.max(0, totalUsed - currentUsed);
                      const availableQty = Math.max(0, (Number(material.received_qty) || 0) - usedByOthers);
                      const maxQty = availableQty;
                      return (
                        <Table.Tr key={`${serie.batch_code}-${materialIndex}`}>
                          <Table.Td>{material.part_name || material.part}</Table.Td>
                          <Table.Td>{material.batch || '-'}</Table.Td>
                          <Table.Td>
                            {material.request_id ? (
                              <Text
                                size="sm"
                                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => window.open(`/web/requests/${material.request_id}`, '_blank')}
                              >
                                {formatRequestLabel(material)}
                              </Text>
                            ) : (
                              '-'
                            )}
                          </Table.Td>
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
                  onSign={() => onSignSerie(serie.batch_code, serie)}
                  signing={signingSerie === serie.batch_code}
                />
              </Grid.Col>
            </Grid>
          </Paper>
        );
  };

  const renderReadonlySerie = (serie: Serie) => {
    const decisionState = getDecisionState(serie.decision_status);
    const decisionLabel = decisionState?.name || (serie.decision_status ? serie.decision_status : '-');
    const expiryLabel = serie.expiry_date ? formatDate(serie.expiry_date) : '-';
    const isCanceledDecisionStatus = isCanceledDecision(serie.decision_status);
    const isFailedDecisionStatus = isFailedDecision(serie.decision_status);
    const buildOrderId = buildOrderByBatch.get(normalizeBatchCode(serie.batch_code));

    return (
      <Paper key={`readonly-${serie.batch_code}`} withBorder p="md">
        <Group justify="space-between" mb="xs">
          <Title order={6}>{t('Batch')}: {serie.batch_code}</Title>
          {buildOrderId && (
            <Button
              size="xs"
              variant="outline"
              leftSection={<IconExternalLink size={14} />}
              onClick={() => window.open(`/web/build-orders/${buildOrderId}`, '_blank')}
            >
              {t('Open build order')}
            </Button>
          )}
        </Group>

        <Group gap="xs" mb="sm">
          {serie.saved_at && (
            <Badge color="green" size="sm">
              {t('Saved')}
            </Badge>
          )}
          {isCanceledDecisionStatus && (
            <Badge color="red" size="sm">
              {t('Canceled')}
            </Badge>
          )}
          {!isCanceledDecisionStatus && isFailedDecisionStatus && (
            <Badge color="red" size="sm">
              {t('Failed')}
            </Badge>
          )}
        </Group>

        <Stack gap={4} mb="sm">
          <Text size="sm">{t('Produced quantity')}: {Number(serie.produced_qty || 0)}</Text>
          <Text size="sm">{t('Expiration date')}: {expiryLabel}</Text>
          <Text size="sm">{t('Decision')}: {decisionLabel}</Text>
        </Stack>

        <Text fw={600} mb="xs">{t('Consumptions')}</Text>
        <Table striped withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Material')}</Table.Th>
              <Table.Th>{t('Request')}</Table.Th>
              <Table.Th>{t('Used Qty')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(serie.materials || []).map((material, materialIndex) => (
              <Table.Tr key={`readonly-${serie.batch_code}-${materialIndex}`}>
                <Table.Td>
                  <Stack gap={2}>
                    <Text size="sm">{material.part_name || material.part || '-'}</Text>
                    <Text size="xs" c="dimmed">{material.batch || '-'}</Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  {material.request_id ? (
                    <Text
                      size="sm"
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => window.open(`/web/requests/${material.request_id}`, '_blank')}
                    >
                      {material.request_reference || material.request_id}
                    </Text>
                  ) : (
                    '-'
                  )}
                </Table.Td>
                <Table.Td>{Number(material.used_qty) || 0}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    );
  };

  return (
    <Stack gap="xl">
      {editableSeries.map((serie) => {
        const serieIndex = series.findIndex(entry => entry === serie);
        return renderEditableSerie(serie, serieIndex >= 0 ? serieIndex : 0);
      })}

      {readonlySeries.length > 0 && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {readonlySeries.map(serie => renderReadonlySerie(serie))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
