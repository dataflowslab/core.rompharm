import { useState, useEffect } from 'react';
import { Paper, Title, Text, Button, Group, Badge, Table, ActionIcon } from '@mantine/core';
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
  ip_address: string;
  user_agent: string;
}

interface ApprovalFlow {
  _id: string;
  object_type: string;
  object_id: string;
  config_slug: string;
  min_signatures: number;
  can_sign_officers: ApprovalOfficer[];
  must_sign_officers: ApprovalOfficer[];
  signatures: ApprovalSignature[];
  status: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface ApprovalsTabProps {
  requestId: string;
  onReload: () => void;
}

export function ApprovalsTab({ requestId, onReload }: ApprovalsTabProps) {
  const { t } = useTranslation();
  const { username, isStaff } = useAuth();
  const [flow, setFlow] = useState<ApprovalFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    loadApprovalFlow();
  }, [requestId]);

  const loadApprovalFlow = async () => {
    try {
      const response = await api.get(requestsApi.getApprovalFlow(requestId));
      setFlow(response.data.flow);
    } catch (error) {
      console.error('Failed to load approval flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFlow = async () => {
    try {
      await api.post(requestsApi.createApprovalFlow(requestId));
      notifications.show({
        title: t('Success'),
        message: t('Approval flow created successfully'),
        color: 'green'
      });
      loadApprovalFlow();
      onReload();
    } catch (error: any) {
      console.error('Failed to create approval flow:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to create approval flow'),
        color: 'red'
      });
    }
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      await api.post(requestsApi.signRequest(requestId));
      notifications.show({
        title: t('Success'),
        message: t('Request signed successfully'),
        color: 'green'
      });
      
      // Reload after 1 second to show updated status
      setTimeout(() => {
        loadApprovalFlow();
        onReload();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to sign request:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to sign request'),
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
          await api.delete(requestsApi.removeSignature(requestId, userId));
          notifications.show({
            title: t('Success'),
            message: t('Signature removed successfully'),
            color: 'green'
          });
          loadApprovalFlow();
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

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const canUserSign = () => {
    if (!flow || !username) return false;
    
    // Check if already signed
    const alreadySigned = flow.signatures.some(s => s.username === username);
    if (alreadySigned) return false;
    
    // Check if user is in can_sign or must_sign by username
    const canSign = flow.can_sign_officers.some(o => o.username === username);
    const mustSign = flow.must_sign_officers.some(o => o.username === username);
    
    return canSign || mustSign;
  };

  if (loading) {
    return <Paper p="md"><Text>{t('Loading...')}</Text></Paper>;
  }

  if (!flow) {
    return (
      <Paper p="md">
        <Text mb="md">{t('No approval flow created yet')}</Text>
        <Button onClick={handleCreateFlow}>{t('Create Approval Flow')}</Button>
      </Paper>
    );
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Group>
          <Title order={4}>{t('Approval Flow')}</Title>
          <Badge color={getStatusColor(flow.status)} size="lg">
            {flow.status}
          </Badge>
        </Group>
        {canUserSign() && (
          <Button
            leftSection={<IconSignature size={16} />}
            onClick={handleSign}
            loading={signing}
          >
            {t('Sign')}
          </Button>
        )}
      </Group>

      {/* Required Approvers (must_sign) */}
      {flow.must_sign_officers.length > 0 && (
        <>
          <Title order={5} mt="md" mb="sm">{t('Required Approvers')}</Title>
          <Table striped withTableBorder withColumnBorders mb="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('User')}</Table.Th>
                <Table.Th>{t('Status')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {flow.must_sign_officers.map((officer, index) => {
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

      {/* Optional Approvers (can_sign) */}
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
    </Paper>
  );
}
