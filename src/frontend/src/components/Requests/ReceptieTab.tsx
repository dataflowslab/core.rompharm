import { useState, useEffect } from 'react';
import { Paper, Title, Text, Badge, Table, Grid, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../context/AuthContext';
import { DecisionSection } from './DecisionSection';
import { SignaturesSection } from './SignaturesSection';
import { hasSectionPermission } from '../../utils/permissions';

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

interface ReceptionFlow {
  _id: string;
  flow_type: string;
  signatures: ApprovalSignature[];
  status: string;
  can_sign_officers: ApprovalOfficer[];
  must_sign_officers: ApprovalOfficer[];
  min_signatures: number;
}

interface RequestItem {
  part: number;
  quantity: number;
  notes?: string;
  part_detail?: {
    _id?: string;
    name: string;
    IPN: string;
  };
  received_quantity?: number;
}

interface LocationDetail {
  _id: string;
  name: string;
  code?: string;
  description?: string;
}

interface RequestMeta {
  source_detail?: LocationDetail;
  destination_detail?: LocationDetail;
  reception_initial_destination_detail?: LocationDetail;
  reception_return_to_sender?: boolean;
  reception_rejected_by?: {
    user_id?: string;
    username?: string;
  };
  reception_rejected_state_name?: string;
  reception_rejected_reason?: string;
}

interface ReceptieTabProps {
  requestId: string;
  onReload: () => void;
}

export function ReceptieTab({ requestId, onReload }: ReceptieTabProps) {
  const { t } = useTranslation();
  const { username, userId, roleSlug, roleId, roleSections } = useAuth();
  const [flow, setFlow] = useState<ReceptionFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [finalStatus, setFinalStatus] = useState<string>('');
  const [refusalReason, setRefusalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stateOrder, setStateOrder] = useState<number>(0);
  const [availableStates, setAvailableStates] = useState<any[]>([]);
  const [requestMeta, setRequestMeta] = useState<RequestMeta | null>(null);
  const canRemoveSignatures = hasSectionPermission(roleSections, 'requests', 'delete');

  const REJECT_TOKENS = ['refused', 'reject', 'rejected', 'refuz', 'refuzat', 'canceled', 'cancelled', 'cancel', 'anulat', 'anulare'];

  const isRejectedState = (state?: any) => {
    if (!state) return false;
    const name = (state.name || '').toLowerCase();
    const slug = (state.slug || '').toLowerCase();
    return REJECT_TOKENS.some(token => name.includes(token) || slug.includes(token));
  };

  const isCanceledState = (state?: any) => {
    if (!state) return false;
    const name = (state.name || '').toLowerCase();
    const slug = (state.slug || '').toLowerCase();
    return ['canceled', 'cancelled', 'cancel', 'anulat', 'anulare'].some(token => name.includes(token) || slug.includes(token));
  };

  useEffect(() => {
    loadReceptionFlow();
    loadRequestItems();
    loadAvailableStates();
  }, [requestId]);

  const loadAvailableStates = async () => {
    try {
      const response = await api.get('/modules/requests/api/states');
      const allStates = response.data.results || [];
      
      // Filter states with 'receive_stock' in scenes
      const receiveStockStates = allStates.filter((state: any) => 
        state.scenes && Array.isArray(state.scenes) && state.scenes.includes('receive_stock')
      );
      
      setAvailableStates(receiveStockStates);
    } catch (error) {
      console.error('Failed to load states:', error);
    }
  };

  const loadReceptionFlow = async () => {
    try {
      const response = await api.get(requestsApi.getReceptionFlow(requestId));
      console.log('[ReceptieTab] loadReceptionFlow response:', response.data);
      setFlow(response.data.flow);
      
      if (response.data.flow) {
        console.log('[ReceptieTab] Flow loaded:', {
          _id: response.data.flow._id,
          status: response.data.flow.status,
          can_sign_officers: response.data.flow.can_sign_officers,
          must_sign_officers: response.data.flow.must_sign_officers,
          signatures: response.data.flow.signatures
        });
      } else {
        console.log('[ReceptieTab] No flow returned from API');
      }
    } catch (error) {
      console.error('[ReceptieTab] Failed to load reception flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRequestItems = async () => {
    try {
      const response = await api.get(requestsApi.getRequest(requestId));
      const requestItems = response.data.items || [];
      setRequestMeta({
        source_detail: response.data.source_detail,
        destination_detail: response.data.destination_detail,
        reception_initial_destination_detail: response.data.reception_initial_destination_detail,
        reception_return_to_sender: response.data.reception_return_to_sender,
        reception_rejected_by: response.data.reception_rejected_by,
        reception_rejected_state_name: response.data.reception_rejected_state_name,
        reception_rejected_reason: response.data.reception_rejected_reason
      });
      setStateOrder(response.data.state_order || 0);
      
      // Load last status from status_log for receive_stock scene
      const statusLog = response.data.status_log || [];
      const lastReceiveStockStatus = statusLog
        .filter((log: any) => log.scene === 'receive_stock')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
      if (lastReceiveStockStatus) {
        setFinalStatus(lastReceiveStockStatus.status_id);
        setRefusalReason(lastReceiveStockStatus.reason || '');
        console.log('[ReceptieTab] Loaded last status from log:', lastReceiveStockStatus);
      }
      
      // Initialize received_quantity with requested quantity
      const itemsWithReceived = requestItems.map((item: RequestItem) => ({
        ...item,
        received_quantity: item.received_quantity || item.quantity
      }));
      
      // Sort alphabetically by part name
      const sortedItems = itemsWithReceived.sort((a, b) => {
        const nameA = a.part_detail?.name || String(a.part);
        const nameB = b.part_detail?.name || String(b.part);
        return nameA.localeCompare(nameB);
      });
      
      setItems(sortedItems);
    } catch (error) {
      console.error('Failed to load request items:', error);
    }
  };

  const handleReceivedQuantityChange = (index: number, value: number) => {
    const newItems = [...items];
    newItems[index].received_quantity = value;
    setItems(newItems);
  };

  const handleSign = async () => {
    // Validate status is selected (should already be saved via handleSubmitStatus)
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
      // Just sign - status was already saved in handleSubmitStatus
      await api.post(requestsApi.signReception(requestId));
      
      notifications.show({
        title: t('Success'),
        message: t('Reception signed successfully'),
        color: 'green'
      });
      
      setTimeout(() => {
        loadReceptionFlow();
        onReload();
      }, 500);
    } catch (error: any) {
      console.error('Failed to sign reception:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to sign reception'),
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
          await api.delete(requestsApi.removeReceptionSignature(requestId, userId));
          notifications.show({
            title: t('Success'),
            message: t('Signature removed successfully'),
            color: 'green'
          });
          loadReceptionFlow();
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

  const handleSubmitStatus = async () => {
    console.log('[ReceptieTab] handleSubmitStatus called', {
      finalStatus,
      refusalReason,
      availableStates: availableStates.map(s => ({ _id: s._id, name: s.name }))
    });
    
    if (!finalStatus) {
      console.log('[ReceptieTab] No finalStatus selected');
      notifications.show({
        title: t('Error'),
        message: t('Please select a status'),
        color: 'red'
      });
      return;
    }

    // Check if selected state needs comment
    const selectedState = availableStates.find(s => s._id === finalStatus);
    console.log('[ReceptieTab] Selected state:', selectedState);
    
    if (selectedState?.needs_comment && !refusalReason.trim()) {
      console.log('[ReceptieTab] Comment required but not provided');
      notifications.show({
        title: t('Error'),
        message: t('Please provide a comment'),
        color: 'red'
      });
      return;
    }

    console.log('[ReceptieTab] Submitting status update...');
    setSubmitting(true);
    try {
      const payload = {
        status: finalStatus,
        reason: refusalReason || undefined
      };
      console.log('[ReceptieTab] Payload:', payload);
      console.log('[ReceptieTab] URL:', requestsApi.updateReceptionStatus(requestId));
      
      await api.patch(requestsApi.updateReceptionStatus(requestId), payload);

      const rejectedDecision = isRejectedState(selectedState);
      if (!rejectedDecision) {
        // Auto-sign after saving decision
        console.log('[ReceptieTab] Auto-signing after save decision...');
        await api.post(requestsApi.signReception(requestId));
      }

      notifications.show({
        title: t('Success'),
        message: rejectedDecision
          ? t('Decision saved successfully')
          : t('Decision saved and signed successfully'),
        color: 'green'
      });
      
      await loadReceptionFlow();
      await loadRequestItems();
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'gray';
      case 'in_progress': return 'blue';
      case 'approved': return 'green';
      case 'rejected': return 'red';
      default: return 'gray';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Check if user is authorized to sign (regardless of whether they already signed)
  const canUserSignInitially = () => {
    if (!flow || !username) {
      return false;
    }

    const normalize = (value?: string | null) => (value || '').toString().trim().toLowerCase();
    const matchesOfficer = (o: ApprovalOfficer) => {
      if (o.type === 'person') {
        if (userId && o.reference === userId) return true;
        if (o.username === username) return true;
      }
      if (o.type === 'role') {
        if (roleId && o.reference === roleId) return true;
        if (roleSlug && normalize(o.reference) === normalize(roleSlug)) return true;
        if (roleId && normalize(o.reference) === normalize(roleId)) return true;
      }
      return false;
    };

    const canSign = flow.can_sign_officers.some(matchesOfficer);
    const mustSign = flow.must_sign_officers.some(matchesOfficer);
    return canSign || mustSign;
  };

  const canUserSign = () => {
    if (!flow || !username) {
      console.log('[ReceptieTab] canUserSign: no flow or username', { flow: !!flow, username });
      return false;
    }
    
    const alreadySigned = flow.signatures.some(s => s.username === username);
    if (alreadySigned) {
      console.log('[ReceptieTab] canUserSign: already signed');
      return false;
    }
    
    return canUserSignInitially();
  };

  const isFlowCompleted = () => {
    if (!flow) return false;
    
    // Check if all must_sign have signed
    const allMustSigned = flow.must_sign_officers.every(officer =>
      flow.signatures.some(s => s.user_id === officer.reference)
    );
    
    // Check if minimum signatures reached
    const signatureCount = flow.signatures.filter(s =>
      flow.can_sign_officers.some(o => o.reference === s.user_id)
    ).length;
    
    const hasMinSignatures = signatureCount >= flow.min_signatures;
    
    return allMustSigned && hasMinSignatures;
  };

  const hasAnySignature = () => {
    return !!(flow && flow.signatures.length > 0);
  };

  const isReturnToSender = requestMeta?.reception_return_to_sender === true;

  const getRejectionMessage = () => {
    const selectedState = availableStates.find(s => s._id === finalStatus);
    const rejectedState =
      isRejectedState(selectedState) ||
      isRejectedState({ name: requestMeta?.reception_rejected_state_name || '', slug: '' });
    if (!isReturnToSender || !rejectedState) return null;
    const stateName = (selectedState?.name || requestMeta?.reception_rejected_state_name || '').toLowerCase();
    const isCanceled = stateName
      ? ['canceled', 'cancelled', 'cancel', 'anulat', 'anulare'].some(token => stateName.includes(token))
      : false;
    const actionLabel = isCanceled ? t('Canceled by') : t('Refused by');
    const rejectedBy = requestMeta?.reception_rejected_by?.username || '-';
    const senderName = requestMeta?.source_detail?.name || t('Expeditor');
    const initialDest = requestMeta?.reception_initial_destination_detail?.name;
    return {
      headline: `${actionLabel} ${rejectedBy}. ${t('Goods are set to return to')} ${senderName}.`,
      initialDest
    };
  };

  const rejectionMessage = getRejectionMessage();
  const selectedDecisionState = availableStates.find(s => s._id === finalStatus);
  const isRejectedDecision = isRejectedState(selectedDecisionState);
  const allowDecisionEditAfterReturn = isReturnToSender && isRejectedDecision;

  if (loading) {
    return <Paper p="md"><Text>{t('Loading...')}</Text></Paper>;
  }

  // Show message if state_order <= 30 (not yet ready for reception)
  if (stateOrder <= 30) {
    return (
      <Paper p="md">
        <Text c="dimmed">{t('Reception flow will be created automatically when operations are finished')}</Text>
      </Paper>
    );
  }

  // Always show the table and form, even if flow doesn't exist yet
  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>{t('Reception Flow')}</Title>
        {flow && (
          <Badge color={getStatusColor(flow.status)} size="lg">
            {flow.status.toUpperCase()}
          </Badge>
        )}
      </Group>

      {/* Received Quantities Table */}
      <Title order={5} mt="md" mb="sm">{t('Received Quantities')}</Title>
      <Table striped withTableBorder withColumnBorders mb="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Part')}</Table.Th>
            <Table.Th>{t('IPN')}</Table.Th>
            <Table.Th>{t('Requested')}</Table.Th>
            <Table.Th>{t('Received')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item, index) => (
            <Table.Tr key={index}>
              <Table.Td>{item.part_detail?.name || item.part}</Table.Td>
              <Table.Td>{item.part_detail?.IPN || '-'}</Table.Td>
              <Table.Td>{item.quantity}</Table.Td>
              <Table.Td>{/* Empty for now */}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {/* Grid Layout: 1/3 Decision - 2/3 Signatures */}
      {flow ? (
        <Grid mt="md">
          {/* Left Column: Decision (1/3) */}
          <Grid.Col span={4}>
            <Paper withBorder p="md">
              <Title order={5} mb="md">{t('Decision')}</Title>
              {rejectionMessage && (
                <>
                  <Text size="sm" c="orange" fw={600}>
                    {rejectionMessage.headline}
                  </Text>
                  {rejectionMessage.initialDest && (
                    <Text size="xs" c="dimmed" mb="md">
                      {t('Initial destination')}: {rejectionMessage.initialDest}
                    </Text>
                  )}
                </>
              )}
              {/* Only show decision section if user can sign */}
              {(!hasAnySignature() || allowDecisionEditAfterReturn) && canUserSignInitially() && (!isFlowCompleted() || allowDecisionEditAfterReturn) ? (
                <DecisionSection
                  status={finalStatus}
                  reason={refusalReason}
                  isCompleted={false}
                  availableStates={availableStates}
                  onStatusChange={(value) => setFinalStatus(value || '')}
                  onReasonChange={setRefusalReason}
                  onSubmit={handleSubmitStatus}
                  submitting={submitting}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  {hasAnySignature() && !allowDecisionEditAfterReturn ? t('Decision already made') : 
                   isFlowCompleted() ? t('Flow completed') : 
                   t('You are not authorized to make a decision')}
                </Text>
              )}
            </Paper>
          </Grid.Col>

          {/* Right Column: Signatures (2/3) */}
          <Grid.Col span={8}>
            <Paper withBorder p="md">
              <SignaturesSection
                canSign={canUserSign()}
                isCompleted={isFlowCompleted()}
                canSignOfficers={flow.can_sign_officers}
                minSignatures={flow.min_signatures}
                signatures={flow.signatures}
                canRemoveSignatures={canRemoveSignatures}
                onSign={handleSign}
                onRemoveSignature={handleRemoveSignature}
                signing={signing}
              />
            </Paper>
          </Grid.Col>
        </Grid>
      ) : (
        <Paper withBorder p="md" mt="md">
          <Text c="dimmed" ta="center" py="xl">
            {t('Waiting for reception flow to be created...')}
          </Text>
        </Paper>
      )}
    </Paper>
  );
}
