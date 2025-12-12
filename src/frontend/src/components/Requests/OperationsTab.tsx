import { useState, useEffect } from 'react';
import { Paper, Title, Text, Button, Group, Badge, Table, ActionIcon, Select, Textarea, TextInput } from '@mantine/core';
import { IconSignature, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../context/AuthContext';

interface BatchOption {
  value: string;
  label: string;
  expiry_date?: string;
  quantity?: number;
  location?: string;
}

interface ItemWithBatch {
  part: number;
  part_name?: string;
  quantity: number;
  series: string;
  batch_code: string;
  batch_options: BatchOption[];
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

interface OperationsFlow {
  _id: string;
  flow_type: string;
  signatures: ApprovalSignature[];
  status: string;
  can_sign_officers: ApprovalOfficer[];
  must_sign_officers: ApprovalOfficer[];
  min_signatures: number;
}

interface OperationsTabProps {
  requestId: string;
  onReload: () => void;
}

export function OperationsTab({ requestId, onReload }: OperationsTabProps) {
  const { t } = useTranslation();
  const { username, isStaff } = useAuth();
  const [flow, setFlow] = useState<OperationsFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [finalStatus, setFinalStatus] = useState<string>('');
  const [refusalReason, setRefusalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadOperationsFlow();
  }, [requestId]);

  const loadOperationsFlow = async () => {
    try {
      const response = await api.get(`/api/requests/${requestId}/operations-flow`);
      setFlow(response.data.flow);
    } catch (error) {
      console.error('Failed to load operations flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      await api.post(`/api/requests/${requestId}/operations-sign`);
      notifications.show({
        title: t('Success'),
        message: t('Operations signed successfully'),
        color: 'green'
      });
      
      setTimeout(() => {
        loadOperationsFlow();
        onReload();
      }, 500);
    } catch (error: any) {
      console.error('Failed to sign operations:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to sign operations'),
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
          await api.delete(`/api/requests/${requestId}/operations-signatures/${userId}`);
          notifications.show({
            title: t('Success'),
            message: t('Signature removed successfully'),
            color: 'green'
          });
          loadOperationsFlow();
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
      await api.patch(`/api/requests/${requestId}/operations-status`, {
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
        <Text c="dimmed">{t('Operations flow will be created automatically when request is approved')}</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Group>
          <Title order={4}>{t('Operations Flow')}</Title>
          <Badge color={getStatusColor(flow.status)} size="lg">
            {flow.status.toUpperCase()}
          </Badge>
        </Group>
        {canUserSign() && isFlowCompleted() && finalStatus && (
          <Button
            leftSection={<IconSignature size={16} />}
            onClick={handleSign}
            loading={signing}
          >
            {t('Sign')}
          </Button>
        )}
      </Group>

      {/* Optional Approvers */}
      {flow.can_sign_officers.length > 0 && (
        <>
          <Title order={5} mt="md" mb="sm">
            {t('Optional Approvers')} ({t('Minimum')}: {flow.min_signatures})
          </Title>
          <Table striped withTableBorder withColumnBorders mb="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('User')}</Table.Th>
                <Table.Th>{t('Status')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {flow.can_sign_officers.map((officer, index) => {
                const hasSigned = flow.signatures.some(s => s.user_id === officer.reference);
                return (
                  <Table.Tr key={index}>
                    <Table.Td>{officer.username}</Table.Td>
                    <Table.Td>
                      <Badge color={hasSigned ? 'green' : 'gray'}>
                        {hasSigned ? t('Signed') : t('Pending')}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </>
      )}

      {/* Signatures */}
      {flow.signatures.length > 0 && (
        <>
          <Title order={5} mt="md" mb="sm">{t('Signatures')}</Title>
          <Table striped withTableBorder withColumnBorders mb="md">
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
        </>
      )}

      {/* Final Status Selection - appears after all signatures */}
      {isFlowCompleted() && (
        <Paper withBorder p="md" mt="md">
          <Title order={5} mb="md">{t('Final Decision')}</Title>
          
          <Select
            label={t('Status')}
            placeholder={t('Select status')}
            data={[
              { value: 'Approved', label: t('Approved') },
              { value: 'Refused', label: t('Refused') }
            ]}
            value={finalStatus}
            onChange={(value) => setFinalStatus(value || '')}
            disabled={isFormReadonly}
            required
            mb="md"
          />

          {finalStatus === 'Refused' && (
            <Textarea
              label={t('Reason for Refusal')}
              placeholder={t('Enter reason for refusal')}
              value={refusalReason}
              onChange={(e) => setRefusalReason(e.target.value)}
              disabled={isFormReadonly}
              required
              minRows={3}
              mb="md"
            />
          )}

          {finalStatus && !isFormReadonly && (
            <Group justify="flex-end">
              <Button
                onClick={handleSubmitStatus}
                loading={submitting}
                color={finalStatus === 'Approved' ? 'green' : 'red'}
              >
                {t('Submit')}
              </Button>
            </Group>
          )}
        </Paper>
      )}

      {isFormReadonly && !finalStatus && (
        <Text size="sm" c="orange" mt="md">
          {t('This form is read-only because it has been signed. Please select a status to proceed.')}
        </Text>
      )}
    </Paper>
  );
}
