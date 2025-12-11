import { useState, useEffect } from 'react';
import { Paper, Title, Text, Button, Group, Badge, Table, ActionIcon, Modal, Textarea } from '@mantine/core';
import { IconSignature, IconTrash, IconCheck, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
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
  const [statusModalOpened, setStatusModalOpened] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [refusalReason, setRefusalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReceptionFlow();
  }, [requestId]);

  const loadReceptionFlow = async () => {
    try {
      const response = await api.get(`/api/requests/${requestId}/reception-flow`);
      setFlow(response.data.flow);
    } catch (error) {
      console.error('Failed to load reception flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFlow = async () => {
    try {
      await api.post(`/api/requests/${requestId}/reception-flow`);
      notifications.show({
        title: t('Success'),
        message: t('Reception flow created successfully'),
        color: 'green'
      });
      loadReceptionFlow();
      onReload();
    } catch (error: any) {
      console.error('Failed to create reception flow:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to create reception flow'),
        color: 'red'
      });
    }
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      await api.post(`/api/requests/${requestId}/reception-sign`);
      notifications.show({
        title: t('Success'),
        message: t('Reception signed successfully'),
        color: 'green'
      });
      
      setTimeout(() => {
        loadReceptionFlow();
        onReload();
      }, 1000);
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
          await api.delete(`/api/requests/${requestId}/reception-signatures/${userId}`);
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

  const handleStatusChange = (newStatus: string) => {
    setSelectedStatus(newStatus);
    setRefusalReason('');
    setStatusModalOpened(true);
  };

  const handleConfirmStatusChange = async () => {
    if (selectedStatus === 'Refused' && !refusalReason.trim()) {
      notifications.show({
        title: t('Error'),
        message: t('Please provide a reason for refusal'),
        color: 'red'
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/api/requests/${requestId}/reception-status`, {
        status: selectedStatus,
        reason: selectedStatus === 'Refused' ? refusalReason : undefined
      });

      notifications.show({
        title: t('Success'),
        message: t('Status updated successfully'),
        color: 'green'
      });

      setStatusModalOpened(false);
      setSelectedStatus('');
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
    return flow.status === 'approved';
  };

  if (loading) {
    return <Paper p="md"><Text>{t('Loading...')}</Text></Paper>;
  }

  if (!flow) {
    return (
      <Paper p="md">
        <Text mb="md">{t('No reception flow created yet')}</Text>
        <Button onClick={handleCreateFlow}>{t('Create Reception Flow')}</Button>
      </Paper>
    );
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Group>
          <Title order={4}>{t('Reception')}</Title>
          <Badge color={getStatusColor(flow.status)} size="lg">
            {flow.status}
          </Badge>
        </Group>
        <Group>
          {canUserSign() && (
            <Button
              leftSection={<IconSignature size={16} />}
              onClick={handleSign}
              loading={signing}
            >
              {t('Sign')}
            </Button>
          )}
          {isFlowCompleted() && (
            <>
              <Button
                leftSection={<IconCheck size={16} />}
                color="green"
                onClick={() => handleStatusChange('Approved')}
              >
                {t('Approve')}
              </Button>
              <Button
                leftSection={<IconX size={16} />}
                color="red"
                onClick={() => handleStatusChange('Refused')}
              >
                {t('Refuse')}
              </Button>
            </>
          )}
        </Group>
      </Group>

      {/* Approvers */}
      {flow.can_sign_officers.length > 0 && (
        <>
          <Title order={5} mt="md" mb="sm">
            {t('Approvers')} ({t('Minimum')}: {flow.min_signatures})
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
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('User')}</Table.Th>
                <Table.Th>{t('Date')}</Table.Th>
                <Table.Th>{t('Signature Hash')}</Table.Th>
                <Table.Th style={{ width: '60px' }}>{t('Actions')}</Table.Th>
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
                  <Table.Td>
                    {isStaff && (
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => handleRemoveSignature(signature.user_id, signature.username)}
                        title={t('Remove')}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {/* Status Change Modal */}
      <Modal
        opened={statusModalOpened}
        onClose={() => setStatusModalOpened(false)}
        title={selectedStatus === 'Approved' ? t('Approve Reception') : t('Refuse Reception')}
      >
        <Text size="sm" mb="md">
          {selectedStatus === 'Approved' 
            ? t('Are you sure you want to approve this reception?')
            : t('Please provide a reason for refusing this reception:')}
        </Text>

        {selectedStatus === 'Refused' && (
          <Textarea
            label={t('Reason')}
            placeholder={t('Enter reason for refusal')}
            value={refusalReason}
            onChange={(e) => setRefusalReason(e.target.value)}
            required
            minRows={3}
            mb="md"
          />
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={() => setStatusModalOpened(false)}>
            {t('Cancel')}
          </Button>
          <Button
            color={selectedStatus === 'Approved' ? 'green' : 'red'}
            onClick={handleConfirmStatusChange}
            loading={submitting}
          >
            {t('Confirm')}
          </Button>
        </Group>
      </Modal>
    </Paper>
  );
}
