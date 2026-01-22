import { useState, useEffect } from 'react';
import { Grid, TextInput, Textarea, Select, Button, Paper, Group, Title, Stack, Badge, Text, Modal, Alert, Table } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';
import { DocumentManager } from '../Common/DocumentManager';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { procurementApi } from '../../services/procurement';
import { formatDateTime } from '../../utils/dateFormat';

interface Supplier {
  _id: string;
  name: string;
}

interface StockLocation {
  _id: string;
  name: string;
}

interface PurchaseOrder {
  _id: string;
  reference: string;
  description: string;
  supplier_id: string;
  supplier_detail?: {
    name: string;
    _id: string;
  };
  supplier_reference: string;
  order_currency: string;
  issue_date: string;
  target_date: string;
  destination_id?: string;
  destination_detail?: {
    name: string;
  };
  notes: string;
  status: string;
}

interface ApprovalSignature {
  user_id: string;
  username: string;
  user_name?: string;
  signed_at: string;
  signature_hash: string;
  ip_address?: string;
}

interface ApprovalFlow {
  _id: string;
  signatures: ApprovalSignature[];
  status: string;
  required_officers: any[];
  optional_officers: any[];
}

interface DetailsTabProps {
  order: PurchaseOrder;
  suppliers: Supplier[];
  stockLocations: StockLocation[];
  canEdit: boolean;
  onUpdate?: (data: any) => Promise<void>;
  onOrderUpdate?: () => void;
}

export function DetailsTab({ order, stockLocations, canEdit, onUpdate, onOrderUpdate }: DetailsTabProps) {
  const { t } = useTranslation();
  const { username, isStaff } = useAuth();
  const [saving, setSaving] = useState(false);
  const [documentTemplates, setDocumentTemplates] = useState<Array<{code: string; name: string; label: string}>>([]);
  const [flow, setFlow] = useState<ApprovalFlow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signModalOpened, setSignModalOpened] = useState(false);
  const [removeModalOpened, setRemoveModalOpened] = useState(false);
  const [userToRemove, setUserToRemove] = useState<string | null>(null);
  const [itemsCount, setItemsCount] = useState(0);
  const [signAction, setSignAction] = useState<'issue' | 'cancel'>('issue');
  
  // Editable state
  const [formData, setFormData] = useState({
    reference: order.reference || '',
    supplier_reference: order.supplier_reference || '',
    description: order.description || '',
    target_date: order.target_date || '',
    destination_id: order.destination_id || '',
    notes: order.notes || '',
  });

  // Parse dates
  const issueDate = order.issue_date ? new Date(order.issue_date) : null;
  const targetDate = formData.target_date ? new Date(formData.target_date) : null;

  // Load document templates from backend
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await api.get('/modules/depo_procurement/api/document-templates');
        const templatesObj = response.data.templates || {};
        
        const templates = Object.entries(templatesObj).map(([code, name]) => ({
          code,
          name: name as string,
          label: name as string
        }));
        
        setDocumentTemplates(templates);
      } catch (error) {
        console.error('Failed to load templates:', error);
        setDocumentTemplates([]);
      }
    };
    
    loadTemplates();
    loadApprovalFlow();
    loadItemsCount();
  }, []);

  const loadApprovalFlow = async () => {
    try {
      const response = await api.get(`${procurementApi.getPurchaseOrder(order._id)}/approval-flow`);
      
      if (!response.data.flow) {
        try {
          const createResponse = await api.post(`${procurementApi.getPurchaseOrder(order._id)}/approval-flow`);
          setFlow(createResponse.data);
        } catch (createError: any) {
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

  const loadItemsCount = async () => {
    try {
      const response = await api.get(procurementApi.getOrderItems(order._id));
      const items = response.data.results || response.data || [];
      setItemsCount(items.length);
    } catch (error) {
      console.error('Failed to load items count:', error);
    }
  };

  const handleSave = async () => {
    if (!onUpdate) return;

    setSaving(true);
    try {
      const updateData: any = {
        reference: formData.reference,
        supplier_reference: formData.supplier_reference,
        description: formData.description,
        target_date: formData.target_date,
        notes: formData.notes,
      };

      if (formData.destination_id) {
        updateData.destination_id = formData.destination_id;
      }

      await onUpdate(updateData);
      
      notifications.show({
        title: t('Success'),
        message: t('Order updated successfully'),
        color: 'green',
      });
    } catch (error: any) {
      console.error('Failed to update order:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update order'),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmSign = async () => {
    // Check if there are items
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
      // Send action to backend
      const response = await api.post(`${procurementApi.getPurchaseOrder(order._id)}/sign`, {
        action: signAction  // 'issue' or 'cancel'
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
      
      // Reset action to default
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
      await api.delete(`${procurementApi.getPurchaseOrder(order._id)}/signatures/${userToRemove}`);
      
      notifications.show({
        title: t('Success'),
        message: t('Signature removed successfully'),
        color: 'green'
      });

      loadApprovalFlow();
      if (onOrderUpdate) {
        onOrderUpdate();
      }
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

    const allOfficers = [...flow.required_officers, ...flow.optional_officers];
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
    switch (status) {
      case 'pending': return t('Pending');
      case 'in_progress': return t('In Progress');
      case 'approved': return t('Approved');
      default: return status;
    }
  };

  const hasChanges = () => {
    return (
      formData.reference !== (order.reference || '') ||
      formData.supplier_reference !== (order.supplier_reference || '') ||
      formData.description !== (order.description || '') ||
      formData.target_date !== (order.target_date || '') ||
      formData.destination_id !== (order.destination_id || '') ||
      formData.notes !== (order.notes || '')
    );
  };

  return (
    <Grid gutter="md">
      {/* Document Sidebar - 1/3 width */}
      <Grid.Col span={4}>
        <Stack gap="md">
          <DocumentManager
            entityId={order._id}
            entityType="procurement-order"
            templates={documentTemplates}
            onDocumentGenerated={() => {
              console.log('Document generated for order:', order._id);
            }}
          />

          {/* Signature Section */}
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
                  <Button 
                    onClick={() => setSignModalOpened(true)} 
                    loading={submitting}
                    leftSection={<IconCheck size={16} />}
                    fullWidth
                    size="sm"
                  >
                    {t('Sign Order')}
                  </Button>
                )}

                {flow.signatures.length > 0 && (
                  <div>
                    <Text size="xs" c="dimmed" mb="xs">{t('Signatures')}</Text>
                    <Table withTableBorder withColumnBorders size="xs">
                      <Table.Tbody>
                        {flow.signatures.map((signature, index) => (
                          <Table.Tr key={index}>
                            <Table.Td>
                              <Text size="xs">{signature.user_name || signature.username}</Text>
                              <Text size="xs" c="dimmed">{formatDateTime(signature.signed_at)}</Text>
                            </Table.Td>
                            {isStaff && (
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

      {/* Order Details Form - 2/3 width */}
      <Grid.Col span={8}>
        <Paper p="md" withBorder>
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label={t('Order Reference')}
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                readOnly
                disabled
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Supplier Reference')}
                value={formData.supplier_reference}
                onChange={(e) => setFormData({ ...formData, supplier_reference: e.target.value })}
                readOnly={!canEdit}
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Supplier')}
                value={order.supplier_detail?.name || `Supplier ${order.supplier_id}`}
                readOnly
                disabled
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Currency')}
                value={order.order_currency || 'EUR'}
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

            <Grid.Col span={6}>
              <DatePickerInput
                label={t('Target Date')}
                value={targetDate}
                onChange={(date) => {
                  if (date) {
                    setFormData({ ...formData, target_date: date.toISOString().split('T')[0] });
                  }
                }}
                disabled={!canEdit}
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <Select
                label={t('Destination')}
                value={formData.destination_id}
                onChange={(value) => setFormData({ ...formData, destination_id: value || '' })}
                data={stockLocations.map(loc => ({ 
                  value: loc._id, 
                  label: loc.name 
                }))}
                disabled={!canEdit}
                searchable
                clearable
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <TextInput
                label={t('Description')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                readOnly={!canEdit}
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

      {/* Sign Confirmation Modal */}
      <Modal
        opened={signModalOpened}
        onClose={() => {
          setSignModalOpened(false);
          setSignAction('issue'); // Reset to default
        }}
        title={t('Sign Order')}
        centered
      >
        <Stack gap="md">
          <Select
            label={t('Action')}
            description={t('Select the action to perform when signing')}
            value={signAction}
            onChange={(value) => setSignAction(value as 'issue' | 'cancel')}
            data={[
              { value: 'issue', label: t('Issue Order') },
              { value: 'cancel', label: t('Cancel Order') }
            ]}
            required
          />
          
          <Alert color={signAction === 'cancel' ? 'red' : 'blue'} icon={<IconAlertCircle />}>
            {signAction === 'issue' 
              ? t('The order will be issued and ready for receiving items.')
              : t('The order will be cancelled and cannot be processed further.')
            }
          </Alert>

          <Text size="sm" c="dimmed">
            {t('This action will be recorded with a digital signature and timestamp.')}
          </Text>

          <Group justify="flex-end">
            <Button 
              variant="default" 
              onClick={() => {
                setSignModalOpened(false);
                setSignAction('issue');
              }}
            >
              {t('Cancel')}
            </Button>
            <Button 
              color={signAction === 'cancel' ? 'red' : 'green'} 
              onClick={confirmSign} 
              loading={submitting}
              leftSection={<IconCheck size={16} />}
            >
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
    </Grid>
  );
}
