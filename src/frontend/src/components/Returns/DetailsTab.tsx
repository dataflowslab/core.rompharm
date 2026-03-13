import { useState, useEffect } from 'react';
import { Grid, TextInput, Textarea, Button, Paper, Group, Stack, Badge, Text, Modal, Alert, Table } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { DocumentManager } from '../Common/DocumentManager';
import { SafeSelect } from '../Common/SafeSelect';
import api from '../../services/api';
import { returnsApi, ReturnOrder, ApprovalFlow } from '../../services/returns';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/dateFormat';

interface DetailsTabProps {
  order: ReturnOrder;
  canEdit: boolean;
  onUpdate?: (data: any) => Promise<void>;
  onOrderUpdate?: () => void;
  orderStateId?: string;
  itemsCount: number;
}

const RETURN_PENDING_STATE_ID = '6943a4a6451609dd8a618ce0';

export function DetailsTab({ order, canEdit, onUpdate, onOrderUpdate, orderStateId, itemsCount }: DetailsTabProps) {
  const { t } = useTranslation();
  const { username, isStaff } = useAuth();
  const [saving, setSaving] = useState(false);
  const [flow, setFlow] = useState<ApprovalFlow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signModalOpened, setSignModalOpened] = useState(false);
  const [removeModalOpened, setRemoveModalOpened] = useState(false);
  const [userToRemove, setUserToRemove] = useState<string | null>(null);
  const [signAction, setSignAction] = useState<'issue' | 'cancel'>('issue');

  const [formData, setFormData] = useState({
    notes: order.notes || ''
  });

  const issueDate = order.issue_date ? new Date(order.issue_date) : null;
  const isOrderLocked = orderStateId ? orderStateId !== RETURN_PENDING_STATE_ID : false;
  const canRemoveSignatures = isStaff && !isOrderLocked;

  useEffect(() => {
    loadApprovalFlow();
  }, []);

  const loadApprovalFlow = async () => {
    try {
      const response = await api.get(returnsApi.getApprovalFlow(order._id));
      if (!response.data.flow) {
        try {
          const createResponse = await api.post(returnsApi.createApprovalFlow(order._id));
          setFlow(createResponse.data);
        } catch (createError) {
          console.error('Failed to create approval flow:', createError);
          setFlow(null);
        }
      } else {
        setFlow(response.data.flow);
      }
    } catch (error) {
      console.error('Failed to load approval flow:', error);
      setFlow(null);
    }
  };

  const handleSave = async () => {
    if (!onUpdate) return;

    setSaving(true);
    try {
      const updateData: any = {
        notes: formData.notes
      };

      await onUpdate(updateData);

      notifications.show({
        title: t('Success'),
        message: t('Order updated successfully'),
        color: 'green'
      });
    } catch (error: any) {
      console.error('Failed to update order:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update order'),
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmSign = async () => {
    if (itemsCount === 0) {
      notifications.show({
        title: t('Error'),
        message: t('Add some items before approving the order.'),
        color: 'red'
      });
      setSignModalOpened(false);
      return;
    }

    setSignModalOpened(false);
    setSubmitting(true);
    try {
      const response = await api.post(returnsApi.signReturnOrder(order._id), {
        action: signAction
      });
      setFlow(response.data);

      const message = signAction === 'issue'
        ? t('Order issued successfully')
        : t('Order cancelled successfully');

      notifications.show({
        title: t('Success'),
        message,
        color: 'green'
      });

      if (onOrderUpdate) {
        onOrderUpdate();
      }

      setSignAction('issue');

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
      await api.delete(returnsApi.removeSignature(order._id, userToRemove));

      notifications.show({
        title: t('Success'),
        message: t('Signature removed successfully'),
        color: 'green'
      });

      loadApprovalFlow();
      onOrderUpdate?.();
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

    const alreadySigned = flow.signatures.some(s => s.username === username);
    if (alreadySigned) return false;

    const minSignatures = flow.min_signatures || 0;
    const currentSignatures = flow.signatures.length;
    if (currentSignatures >= minSignatures && minSignatures > 0) {
      return false;
    }

    const allOfficers = [...(flow.required_officers || []), ...(flow.optional_officers || [])];
    return allOfficers.length > 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'gray';
      case 'in_progress': return 'blue';
      case 'approved': return 'green';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'in_progress' && flow && flow.signatures.length > 0) {
      return t('Signed');
    }

    switch (status) {
      case 'pending': return t('Pending');
      case 'in_progress': return t('In Progress');
      case 'approved': return t('Approved');
      default: return status;
    }
  };

  const hasChanges = () => formData.notes !== (order.notes || '');

  return (
    <Grid gutter="md">
      <Grid.Col span={4}>
        <Stack gap="md">
          <DocumentManager
            entityId={order._id}
            entityType="return-order"
            templates={[]}
            onDocumentGenerated={() => {
              console.log('Document generated for return order:', order._id);
            }}
          />

          {flow && (
            <Paper p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>{t('Approval')}</Text>
                  <Badge color={getStatusColor(flow.status)} size="sm">
                    {getStatusLabel(flow.status)}
                  </Badge>
                </Group>

                {canUserSign() && flow.status !== 'approved' && (
                  <>
                    <SafeSelect
                      label={t('Action')}
                      description={t('Select action when signing')}
                      value={signAction}
                      onChange={(value) => setSignAction(value as 'issue' | 'cancel')}
                      data={[
                        { value: 'issue', label: t('Issue Order') },
                        { value: 'cancel', label: t('Cancel Order') }
                      ]}
                      size="sm"
                      required
                    />

                    <Button
                      onClick={() => setSignModalOpened(true)}
                      loading={submitting}
                      leftSection={<IconCheck size={16} />}
                      fullWidth
                      size="sm"
                      color={signAction === 'cancel' ? 'red' : 'green'}
                    >
                      {t('Sign Order')}
                    </Button>
                  </>
                )}

                {flow.signatures.length > 0 && (
                  <div>
                    <Text size="xs" c="dimmed" mb="xs">{t('Signatures')}</Text>
                    <Table withTableBorder withColumnBorders>
                      <Table.Tbody>
                        {flow.signatures.map((signature, index) => (
                          <Table.Tr key={index}>
                            <Table.Td>
                              <Text size="xs">{signature.user_name || signature.username}</Text>
                              <Text size="xs" c="dimmed">{formatDateTime(signature.signed_at)}</Text>
                            </Table.Td>
                            {canRemoveSignatures && (
                              <Table.Td style={{ width: '60px' }}>
                                <Button
                                  size="xs"
                                  color="red"
                                  variant="subtle"
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
            </Paper>
          )}
        </Stack>
      </Grid.Col>

      <Grid.Col span={8}>
        <Paper p="md" withBorder>
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label={t('Order Reference')}
                value={order.reference || ''}
                readOnly
                disabled
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Sales Order')}
                value={order.sales_order_reference || order.sales_order_id || ''}
                readOnly
                disabled
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Customer')}
                value={order.customer_detail?.name || order.customer_id || ''}
                readOnly
                disabled
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Currency')}
                value={order.currency || 'EUR'}
                readOnly
                disabled
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <DatePickerInput
                label={t('Issue Date')}
                value={issueDate}
                readOnly
                disabled
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <Textarea
                label={t('Notes')}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                readOnly={!canEdit}
                minRows={4}
              />
            </Grid.Col>

            {canEdit && (
              <Grid.Col span={12}>
                <Group justify="flex-end">
                  <Button
                    leftSection={<IconDeviceFloppy size={16} />}
                    onClick={handleSave}
                    loading={saving}
                    disabled={!hasChanges()}
                  >
                    {t('Save Changes')}
                  </Button>
                </Group>
              </Grid.Col>
            )}
          </Grid>
        </Paper>
      </Grid.Col>

      <Modal
        opened={signModalOpened}
        onClose={() => setSignModalOpened(false)}
        title={t('Sign Order')}
        centered
      >
        <Stack gap="md">
          <Alert color={signAction === 'cancel' ? 'red' : 'blue'} icon={<IconAlertCircle />}>
            {signAction === 'issue'
              ? t('Are you sure you want to issue this order? The order will be ready for receiving items.')
              : t('Are you sure you want to cancel this order? This action cannot be undone.')
            }
          </Alert>

          <Text size="sm" c="dimmed">
            {t('This action will be recorded with a digital signature and timestamp.')}
          </Text>

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setSignModalOpened(false)}
            >
              {t('No, go back')}
            </Button>
            <Button
              color={signAction === 'cancel' ? 'red' : 'green'}
              onClick={confirmSign}
              loading={submitting}
              leftSection={<IconCheck size={16} />}
            >
              {t('Yes, sign')}
            </Button>
          </Group>
        </Stack>
      </Modal>

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
    </Grid>
  );
}
