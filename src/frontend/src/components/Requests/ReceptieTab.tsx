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

interface ReceptieTabProps {
  requestId: string;
  onReload: () => void;
}

export function ReceptieTab({ requestId, onReload }: ReceptieTabProps) {
  const { t } = useTranslation();
  const { username, isStaff } = useAuth();
  const [flow, setFlow] = useState<ReceptionFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [finalStatus, setFinalStatus] = useState<string>('');
  const [refusalReason, setRefusalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stateOrder, setStateOrder] = useState<number>(0);
  const [availableStates, setAvailableStates] = useState<any[]>([]);

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
      await api.patch(requestsApi.updateReceptionStatus(requestId), {
        status: finalStatus,
        reason: refusalReason || undefined
      });

      notifications.show({
        title: t('Success'),
        message: t('Status updated successfully'),
        color: 'green'
      });

      // DON'T reset status - keep it selected so user can sign
      // setFinalStatus('');
      // setRefusalReason('');
      
      await loadReceptionFlow();
      onReload();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update status'),
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
    
    // Check if user can sign - support both username and role-based officers
    const canSign = flow.can_sign_officers.some(o => {
      // Direct username match
      if (o.username === username) return true;
      
      // Role-based match: check if user has the role
      if (o.type === 'role' && o.reference) {
        // For admin role, check if user is staff
        if (o.reference === 'admin' && isStaff) return true;
        // Add other role checks here if needed
      }
      
      return false;
    });
    
    const mustSign = flow.must_sign_officers.some(o => {
      if (o.username === username) return true;
      if (o.type === 'role' && o.reference === 'admin' && isStaff) return true;
      return false;
    });
    
    console.log('[ReceptieTab] canUserSign check:', {
      username,
      isStaff,
      canSign,
      mustSign,
      can_sign_officers: flow.can_sign_officers,
      must_sign_officers: flow.must_sign_officers,
      result: canSign || mustSign
    });
    
    return canSign || mustSign;
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

  const isFormReadonly = hasAnySignature();

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
              <DecisionSection
                status={finalStatus}
                reason={refusalReason}
                isCompleted={isFlowCompleted()}
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
                canSign={canUserSign()}
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
