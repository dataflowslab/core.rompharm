import { useState, useEffect } from 'react';
import { Paper, Title, Text, Button, Group, Badge, Table, ActionIcon, NumberInput, Select, Textarea, Grid, Stack } from '@mantine/core';
import { IconSignature, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../context/AuthContext';

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
    pk: number;
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

  useEffect(() => {
    loadReceptionFlow();
    loadRequestItems();
  }, [requestId]);

  const loadReceptionFlow = async () => {
    try {
      const response = await api.get(requestsApi.getReceptionFlow(requestId));
      setFlow(response.data.flow);
    } catch (error) {
      console.error('Failed to load reception flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRequestItems = async () => {
    try {
      const response = await api.get(requestsApi.getRequest(requestId));
      const requestItems = response.data.items || [];
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
    // Validate status is selected
    if (!finalStatus) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a status before signing'),
        color: 'red'
      });
      return;
    }

    if (finalStatus === 'Refused' && !refusalReason.trim()) {
      notifications.show({
        title: t('Error'),
        message: t('Please provide a reason for refusal'),
        color: 'red'
      });
      return;
    }

    setSigning(true);
    try {
      // 1. Save received quantities
      await api.patch(requestsApi.updateRequest(requestId), {
        items: items.map(item => ({
          part: item.part,
          quantity: item.quantity,
          notes: item.notes,
          received_quantity: item.received_quantity
        }))
      });

      // 2. Save reception status/decision
      await api.patch(requestsApi.updateReceptionStatus(requestId), {
        status: finalStatus,
        reason: finalStatus === 'Refused' ? refusalReason : undefined
      });

      // 3. Sign the reception
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

    if (finalStatus === 'Refused' && !refusalReason.trim()) {
      notifications.show({
        title: t('Error'),
        message: t('Please provide a reason for refusal'),
        color: 'red'
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(requestsApi.updateReceptionStatus(requestId), {
        status: finalStatus,
        reason: finalStatus === 'Refused' ? refusalReason : undefined
      });

      notifications.show({
        title: t('Success'),
        message: t('Status updated successfully'),
        color: 'green'
      });

      setFinalStatus('');
      setRefusalReason('');
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
    if (!flow || !username) return false;
    const alreadySigned = flow.signatures.some(s => s.username === username);
    if (alreadySigned) return false;
    const canSign = flow.can_sign_officers.some(o => o.username === username);
    const mustSign = flow.must_sign_officers.some(o => o.username === username);
    
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

  if (!flow) {
    return (
      <Paper p="md">
        <Text c="dimmed">{t('Reception flow will be created automatically when operations are finished')}</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>{t('Reception Flow')}</Title>
        <Badge color={getStatusColor(flow.status)} size="lg">
          {flow.status.toUpperCase()}
        </Badge>
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
              <Table.Td>
                <NumberInput
                  value={item.received_quantity || item.quantity}
                  onChange={(value) => handleReceivedQuantityChange(index, Number(value) || 0)}
                  min={0}
                  max={item.quantity}
                  disabled={isFormReadonly}
                  style={{ width: '120px' }}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {/* Grid Layout: 1/3 Decision - 2/3 Signatures */}
      <Grid mt="md">
        {/* Left Column: Decision (1/3) */}
        <Grid.Col span={4}>
          <Paper withBorder p="md">
            <Title order={5} mb="md">{t('Final Decision')}</Title>
            
            <Stack>
              <Select
                label={t('Status')}
                placeholder={t('Select status')}
                data={[
                  { value: 'Approved', label: t('Approved') },
                  { value: 'Refused', label: t('Refused') }
                ]}
                value={finalStatus}
                onChange={(value) => setFinalStatus(value || '')}
                disabled={isFlowCompleted()}
                required
              />

              {finalStatus === 'Refused' && (
                <Textarea
                  label={t('Reason for Refusal')}
                  placeholder={t('Enter reason for refusal')}
                  value={refusalReason}
                  onChange={(e) => setRefusalReason(e.target.value)}
                  disabled={isFlowCompleted()}
                  required
                  minRows={3}
                />
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        {/* Right Column: Signatures (2/3) */}
        <Grid.Col span={8}>
          <Paper withBorder p="md">
            <Group justify="space-between" mb="md">
              <Title order={5}>{t('Signatures')}</Title>
              {canUserSign() && !isFlowCompleted() && finalStatus && (
                <Button
                  leftSection={<IconSignature size={16} />}
                  onClick={handleSign}
                  loading={signing}
                  color={finalStatus === 'Approved' ? 'green' : 'red'}
                >
                  {t('Sign')}
                </Button>
              )}
            </Group>

            {flow.signatures.length > 0 ? (
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('User')}</Table.Th>
                    <Table.Th>{t('Date')}</Table.Th>
                    <Table.Th>{t('Signature Hash')}</Table.Th>
                    {isStaff && <Table.Th style={{ width: '60px' }}>{t('Actions')}</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {flow.signatures.map((signature, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>{signature.user_name || signature.username}</Table.Td>
                      <Table.Td>{formatDate(signature.signed_at)}</Table.Td>
                      <Table.Td>
                        <Text size="xs" style={{ fontFamily: 'monospace' }}>
                          {signature.signature_hash.substring(0, 16)}...
                        </Text>
                      </Table.Td>
                      {isStaff && (
                        <Table.Td>
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() => handleRemoveSignature(signature.user_id, signature.username)}
                            title={t('Remove')}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Table.Td>
                      )}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" size="sm">{t('No signatures yet')}</Text>
            )}

            {isFlowCompleted() && (
              <Text size="sm" c="green" mt="md">
                {t('Reception flow completed successfully')}
              </Text>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Paper>
  );
}
