import { useState, useEffect } from 'react';
import { Paper, Button, Group, Table, Badge, Text, Stack, Alert, Modal } from '@mantine/core';
import { IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { procurementApi } from '../../services/procurement';
import { notifications } from '@mantine/notifications';

interface ApprovalSignature {
  user_id: string;
  username: string;
  user_name?: string;
  signed_at: string;
  signature_hash: string;
  ip_address?: string;
}

interface ApprovalOfficer {
  type: string; // "person" or "role"
  reference: string; // user_id or role_name
  action: string; // "can_sign" or "must_sign"
  order?: number;
}

interface ApprovalFlow {
  _id: string;
  object_type: string;
  object_source: string;
  object_id: string;
  template_id: string;
  required_officers: ApprovalOfficer[];
  optional_officers: ApprovalOfficer[];
  signatures: ApprovalSignature[];
  status: string; // "pending", "in_progress", "approved"
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface PurchaseOrder {
  pk: number;
  status: number;
  status_text: string;
}

interface ApprovalsTabProps {
  order: PurchaseOrder;
  onOrderUpdate: () => void;
}

export function ApprovalsTab({ order, onOrderUpdate }: ApprovalsTabProps) {
  const { t } = useTranslation();
  const { username, isStaff } = useAuth();
  const [flow, setFlow] = useState<ApprovalFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signModalOpened, setSignModalOpened] = useState(false);
  const [removeModalOpened, setRemoveModalOpened] = useState(false);
  const [userToRemove, setUserToRemove] = useState<string | null>(null);

  useEffect(() => {
    loadApprovalFlow();
  }, [order.pk]);

  const loadApprovalFlow = async () => {
    setLoading(true);
    try {
      const response = await api.get(`${procurementApi.getPurchaseOrder(order.pk)}/approval-flow`);
      
      // If no flow exists, create it automatically
      if (!response.data.flow) {
        try {
          const createResponse = await api.post(`${procurementApi.getPurchaseOrder(order.pk)}/approval-flow`);
          setFlow(createResponse.data);
        } catch (createError: any) {
          console.error('Failed to create approval flow:', createError);
          // If creation fails, it might be because there's no template
          setFlow(null);
        }
      } else {
        setFlow(response.data.flow);
      }
    } catch (error) {
      console.error('Failed to load approval flow:', error);
      setFlow(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFlow = async () => {
    setSubmitting(true);
    try {
      const response = await api.post(`${procurementApi.getPurchaseOrder(order.pk)}/approval-flow`);
      setFlow(response.data);
      
      notifications.show({
        title: t('Success'),
        message: t('Approval flow created successfully'),
        color: 'green'
      });
    } catch (error: any) {
      console.error('Failed to create approval flow:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to create approval flow'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSign = async () => {
    setSignModalOpened(false);
    setSubmitting(true);
    try {
      const response = await api.post(`${procurementApi.getPurchaseOrder(order.pk)}/sign`);
      setFlow(response.data);
      
      notifications.show({
        title: t('Success'),
        message: t('Order signed successfully'),
        color: 'green'
      });

      // Refresh order to get updated status
      onOrderUpdate();
      
      // Reload page after a short delay to show new tabs
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to sign order:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to sign order'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRemoveSignature = async () => {
    if (!userToRemove) return;
    
    setRemoveModalOpened(false);
    try {
      await api.delete(`${procurementApi.getPurchaseOrder(order.pk)}/signatures/${userToRemove}`);
      
      notifications.show({
        title: t('Success'),
        message: t('Signature removed successfully'),
        color: 'green'
      });

      loadApprovalFlow();
      onOrderUpdate();
    } catch (error: any) {
      console.error('Failed to remove signature:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to remove signature'),
        color: 'red'
      });
    } finally {
      setUserToRemove(null);
    }
  };

  const canUserSign = (): boolean => {
    if (!flow || !username) return false;
    
    // Check if user already signed
    const alreadySigned = flow.signatures.some(s => s.username === username);
    if (alreadySigned) return false;

    // For now, we'll check by username since we don't have user_id in context
    // In a real implementation, you'd check against user_id and roles
    const allOfficers = [...flow.required_officers, ...flow.optional_officers];
    
    // This is a simplified check - in production you'd need to check user_id and roles properly
    return allOfficers.length > 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'gray';
      case 'in_progress':
        return 'blue';
      case 'approved':
        return 'green';
      default:
        return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return t('Pending');
      case 'in_progress':
        return t('In Progress');
      case 'approved':
        return t('Approved');
      default:
        return status;
    }
  };

  if (loading) {
    return <Paper p="md" withBorder><Text>{t('Loading...')}</Text></Paper>;
  }

  if (!flow) {
    return (
      <Paper p="md" withBorder>
        <Alert icon={<IconAlertCircle size={16} />} title={t('No Approval Flow')} color="blue">
          {t('This purchase order does not have an approval flow. Approval flows are automatically created for new orders based on the configured approval template.')}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Stack>
        <Group justify="space-between">
          <div>
            <Text size="lg" fw={500}>{t('Approval Flow')}</Text>
            <Badge color={getStatusColor(flow.status)} size="lg" mt="xs">
              {getStatusLabel(flow.status)}
            </Badge>
          </div>
          
          {canUserSign() && flow.status !== 'approved' && (
            <Button 
              onClick={() => setSignModalOpened(true)} 
              loading={submitting}
              leftSection={<IconCheck size={16} />}
            >
              {t('Sign')}
            </Button>
          )}
        </Group>

        {/* Required Officers */}
        {flow.required_officers.length > 0 && (
          <div>
            <Text size="sm" fw={500} mb="xs">{t('Required Approvers')}</Text>
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Type')}</Table.Th>
                  <Table.Th>{t('Reference')}</Table.Th>
                  <Table.Th>{t('Status')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {flow.required_officers.map((officer, index) => {
                  const hasSigned = flow.signatures.some(s => 
                    (officer.type === 'person' && s.user_id === officer.reference) ||
                    (officer.type === 'role' && s.username) // Simplified role check
                  );
                  
                  return (
                    <Table.Tr key={index}>
                      <Table.Td>{officer.type === 'person' ? t('Person') : t('Role')}</Table.Td>
                      <Table.Td>{officer.reference}</Table.Td>
                      <Table.Td>
                        {hasSigned ? (
                          <Badge color="green" leftSection={<IconCheck size={12} />}>
                            {t('Signed')}
                          </Badge>
                        ) : (
                          <Badge color="gray" leftSection={<IconX size={12} />}>
                            {t('Pending')}
                          </Badge>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>
        )}

        {/* Optional Officers */}
        {flow.optional_officers.length > 0 && (
          <div>
            <Text size="sm" fw={500} mb="xs">{t('Optional Approvers')}</Text>
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Type')}</Table.Th>
                  <Table.Th>{t('Reference')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {flow.optional_officers.map((officer, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{officer.type === 'person' ? t('Person') : t('Role')}</Table.Td>
                    <Table.Td>{officer.reference}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}

        {/* Signatures */}
        {flow.signatures.length > 0 && (
          <div>
            <Text size="sm" fw={500} mb="xs">{t('Signatures')}</Text>
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('User')}</Table.Th>
                  <Table.Th>{t('Signed At')}</Table.Th>
                  <Table.Th>{t('Signature Hash')}</Table.Th>
                  {isStaff && <Table.Th>{t('Actions')}</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {flow.signatures.map((signature, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{signature.user_name || signature.username}</Table.Td>
                    <Table.Td>{new Date(signature.signed_at).toLocaleString()}</Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                        {signature.signature_hash.substring(0, 16)}...
                      </Text>
                    </Table.Td>
                    {isStaff && (
                      <Table.Td>
                        <Button 
                          size="xs" 
                          color="red" 
                          variant="light"
                          onClick={() => {
                            setUserToRemove(signature.user_id);
                            setRemoveModalOpened(true);
                          }}
                        >
                          {t('Remove')}
                        </Button>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </Stack>

      {/* Sign Confirmation Modal */}
      <Modal
        opened={signModalOpened}
        onClose={() => setSignModalOpened(false)}
        title={t('Confirm Signature')}
        centered
      >
        <Stack>
          <Text>
            {t('Are you sure you want to sign this order? This action will be recorded with a digital signature.')}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setSignModalOpened(false)}>
              {t('Cancel')}
            </Button>
            <Button color="green" onClick={confirmSign} loading={submitting}>
              {t('Sign')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Remove Signature Confirmation Modal */}
      <Modal
        opened={removeModalOpened}
        onClose={() => {
          setRemoveModalOpened(false);
          setUserToRemove(null);
        }}
        title={t('Remove Signature')}
        centered
      >
        <Stack>
          <Text>
            {t('Are you sure you want to remove this signature?')}
          </Text>
          <Group justify="flex-end">
            <Button 
              variant="default" 
              onClick={() => {
                setRemoveModalOpened(false);
                setUserToRemove(null);
              }}
            >
              {t('Cancel')}
            </Button>
            <Button color="red" onClick={confirmRemoveSignature}>
              {t('Remove')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
