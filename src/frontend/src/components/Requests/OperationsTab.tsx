import { useState, useEffect } from 'react';
import { Paper, Title, Text, Button, Group, Badge, Table, ActionIcon, Select, Textarea, TextInput, Grid, NumberInput } from '@mantine/core';
import { IconSignature, IconTrash, IconDeviceFloppy, IconFileText } from '@tabler/icons-react';
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

interface OperationsFlow {
  _id: string;
  flow_type: string;
  signatures: ApprovalSignature[];
  status: string;
  can_sign_officers: ApprovalOfficer[];
  must_sign_officers: ApprovalOfficer[];
  min_signatures: number;
}

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
  const [itemsWithBatch, setItemsWithBatch] = useState<ItemWithBatch[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [finalStatus, setFinalStatus] = useState<string>('');
  const [refusalReason, setRefusalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<any>(null);

  useEffect(() => {
    loadOperationsFlow();
    loadRequestItems();
  }, [requestId]);

  // Generate Document Component
  const GenerateDocumentButton = ({ requestId, reference }: { requestId: string; reference: string }) => {
    const [generating, setGenerating] = useState(false);

    const handleGenerate = async () => {
      setGenerating(true);
      try {
        const response = await api.post(
          '/api/documents/stock-request/generate',
          {
            request_id: requestId,
            template_code: 'RC45WVTRBDGT',
            template_name: 'P-Distrib-102_F2'
          },
          { responseType: 'blob' }
        );

        // Download PDF
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Nota_Transfer_${reference}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        notifications.show({
          title: t('Success'),
          message: t('Document generated successfully'),
          color: 'green'
        });
      } catch (error: any) {
        console.error('Failed to generate document:', error);
        notifications.show({
          title: t('Error'),
          message: error.response?.data?.detail || t('Failed to generate document'),
          color: 'red'
        });
      } finally {
        setGenerating(false);
      }
    };

    return (
      <Button
        leftSection={<IconFileText size={16} />}
        onClick={handleGenerate}
        loading={generating}
      >
        {t('Generate P-Distrib-102_F2')}
      </Button>
    );
  };

  const loadOperationsFlow = async () => {
    try {
      const response = await api.get(requestsApi.getOperationsFlow(requestId));
      setFlow(response.data.flow);
    } catch (error) {
      console.error('Failed to load operations flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRequestItems = async () => {
    try {
      const response = await api.get(requestsApi.getRequest(requestId));
      setRequest(response.data); // Save request data
      const items = response.data.items || [];
      const sourceLocation = response.data.source;
      
      // Initialize items with batch data
      const itemsData: ItemWithBatch[] = await Promise.all(
        items.map(async (item: any) => {
          const batchOptions = await loadBatchCodes(item.part, sourceLocation);
          return {
            part: item.part,
            part_name: item.part_detail?.name || String(item.part),
            quantity: item.quantity,
            series: item.series || '',
            batch_code: item.batch_code || '',
            batch_options: batchOptions
          };
        })
      );
      
      // Sort items: non-zero quantities first, then zero quantities (grayed out)
      const sortedItems = itemsData.sort((a, b) => {
        if (a.quantity === 0 && b.quantity !== 0) return 1;
        if (a.quantity !== 0 && b.quantity === 0) return -1;
        return 0;
      });
      
      setItemsWithBatch(sortedItems);
    } catch (error) {
      console.error('Failed to load request items:', error);
    }
  };

  const loadBatchCodes = async (partId: number, locationId?: number): Promise<BatchOption[]> => {
    try {
      const url = requestsApi.getPartBatchCodes(partId);
      const params = locationId ? `?location_id=${locationId}` : '';
      const response = await api.get(`${url}${params}`);
      const batchCodes = response.data.batch_codes || [];
      
      return batchCodes.map((batch: any) => ({
        value: batch.batch_code,
        label: `${batch.batch_code} - ${batch.expiry_date || 'N/A'} - ${batch.quantity} buc`,
        expiry_date: batch.expiry_date,
        quantity: batch.quantity,
        location: batch.location
      }));
    } catch (error) {
      console.error(`Failed to load batch codes for part ${partId}:`, error);
      return [];
    }
  };

  const handleSeriesChange = (index: number, value: string) => {
    const newItems = [...itemsWithBatch];
    newItems[index].series = value;
    setItemsWithBatch(newItems);
  };

  const handleBatchChange = (index: number, value: string | null) => {
    const newItems = [...itemsWithBatch];
    newItems[index].batch_code = value || '';
    setItemsWithBatch(newItems);
  };

  const handleQuantityChange = (index: number, value: number) => {
    const newItems = [...itemsWithBatch];
    newItems[index].quantity = value;
    setItemsWithBatch(newItems);
  };

  const handleSaveBatchData = async () => {
    setSavingBatch(true);
    try {
      await api.patch(requestsApi.updateRequest(requestId), {
        items: itemsWithBatch.map(item => ({
          part: item.part,
          quantity: item.quantity,
          series: item.series,
          batch_code: item.batch_code
        }))
      });
      
      notifications.show({
        title: t('Success'),
        message: t('Series and batch data saved successfully'),
        color: 'green'
      });

      // Reload items to apply sorting
      await loadRequestItems();
    } catch (error: any) {
      console.error('Failed to save batch data:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save batch data'),
        color: 'red'
      });
    } finally {
      setSavingBatch(false);
    }
  };

  const handleSign = async () => {
    // Validate that all items with quantity > 0 have series and batch
    const itemsWithQuantity = itemsWithBatch.filter(item => item.quantity > 0);
    const allItemsComplete = itemsWithQuantity.every(item => item.series && item.batch_code);
    if (!allItemsComplete) {
      notifications.show({
        title: t('Error'),
        message: t('Please fill in series and batch code for all items with quantity > 0 before signing'),
        color: 'red'
      });
      return;
    }

    setSigning(true);
    try {
      // Save batch data first
      await handleSaveBatchData();
      
      // Then sign
      await api.post(requestsApi.signOperations(requestId));
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
          await api.delete(requestsApi.removeOperationsSignature(requestId, userId));
          notifications.show({
            title: t('Success'),
            message: t('Signature removed successfully'),
            color: 'green'
          });
          
          // Auto-refresh page to show/hide tabs
          setTimeout(() => {
            window.location.reload();
          }, 1000);
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
      await api.patch(requestsApi.updateOperationsStatus(requestId), {
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
        <Title order={4}>{t('Operations Flow')}</Title>
        <Badge color={getStatusColor(flow.status)} size="lg">
          {flow.status.toUpperCase()}
        </Badge>
      </Group>

      <Grid gutter="md">
        {/* Top Left - Signatures */}
        <Grid.Col span={6}>
          <Paper withBorder p="md">
            <Group justify="space-between" mb="md">
              <Title order={5}>{t('Signatures')}</Title>
              {canUserSign() && !isFlowCompleted() && (
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
                <Text size="sm" fw={500} mb="xs">
                  {t('Optional Approvers')} ({t('Minimum')}: {flow.min_signatures})
                </Text>
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
                            <Badge color={hasSigned ? 'green' : 'gray'} size="sm">
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

            {/* Signatures List */}
            {flow.signatures.length > 0 && (
              <>
                <Text size="sm" fw={500} mb="xs">{t('Signed by')}</Text>
                <Table striped withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('User')}</Table.Th>
                      <Table.Th>{t('Date')}</Table.Th>
                      {isStaff && <Table.Th style={{ width: '40px' }}></Table.Th>}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {flow.signatures.map((signature, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>{signature.user_name || signature.username}</Table.Td>
                        <Table.Td>{formatDate(signature.signed_at)}</Table.Td>
                        {isStaff && (
                          <Table.Td>
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              size="sm"
                              onClick={() => handleRemoveSignature(signature.user_id, signature.username)}
                              title={t('Remove')}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </>
            )}

            {flow.signatures.length === 0 && (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                {t('No signatures yet')}
              </Text>
            )}
          </Paper>
        </Grid.Col>

        {/* Top Right - Decision */}
        <Grid.Col span={6}>
          {isFlowCompleted() && (
            <Paper withBorder p="md">
              <Title order={5} mb="md">{t('Decision')}</Title>
              
              <Select
                label={t('Status')}
                placeholder={t('Select status')}
                data={[
                  { value: 'Finished', label: t('Finished') },
                  { value: 'Refused', label: t('Refused') }
                ]}
                value={finalStatus}
                onChange={(value) => setFinalStatus(value || '')}
                required
                mb="md"
              />

              {finalStatus === 'Refused' && (
                <Textarea
                  label={t('Reason for Refusal')}
                  placeholder={t('Enter reason for refusal')}
                  value={refusalReason}
                  onChange={(e) => setRefusalReason(e.target.value)}
                  required
                  minRows={3}
                  mb="md"
                />
              )}

              {finalStatus && (
                <Group justify="flex-end">
                  <Button
                    onClick={handleSubmitStatus}
                    loading={submitting}
                    color={finalStatus === 'Finished' ? 'green' : 'red'}
                  >
                    {t('Submit')}
                  </Button>
                </Group>
              )}
            </Paper>
          )}
        </Grid.Col>

        {/* Bottom - Series and Batch Information Table (Full Width) */}
        <Grid.Col span={12}>
          <Paper withBorder p="md">
            <Group justify="space-between" mb="md">
              <Title order={5}>{t('Series and Batch Information')}</Title>
              {!isFormReadonly && (
                <Button
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSaveBatchData}
                  loading={savingBatch}
                  size="sm"
                  variant="light"
                >
                  {t('Save')}
                </Button>
              )}
            </Group>

            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Part')}</Table.Th>
                  <Table.Th style={{ width: '120px' }}>{t('Qty')}</Table.Th>
                  <Table.Th>{t('Series')}</Table.Th>
                  <Table.Th style={{ width: '300px' }}>{t('Batch Code')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {itemsWithBatch.map((item, index) => {
                  const isZeroQuantity = item.quantity === 0;
                  return (
                    <Table.Tr key={index} style={{ opacity: isZeroQuantity ? 0.5 : 1 }}>
                      <Table.Td style={{ color: isZeroQuantity ? '#868e96' : 'inherit' }}>
                        {item.part_name}
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          value={item.quantity}
                          onChange={(value) => handleQuantityChange(index, Number(value) || 0)}
                          disabled={isFormReadonly}
                          min={0}
                          size="xs"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={item.series}
                          onChange={(e) => handleSeriesChange(index, e.target.value)}
                          disabled={isFormReadonly || isZeroQuantity}
                          placeholder={t('Enter series')}
                          size="xs"
                        />
                      </Table.Td>
                      <Table.Td>
                        <Select
                          value={item.batch_code}
                          onChange={(value) => handleBatchChange(index, value)}
                          disabled={isFormReadonly || isZeroQuantity}
                          placeholder={t('Select batch code')}
                          data={item.batch_options}
                          searchable
                          clearable
                          size="xs"
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            {isFormReadonly && (
              <Text size="sm" c="orange" mt="md">
                {t('This form is read-only because it has been signed.')}
              </Text>
            )}
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Document Generation Section */}
      {!isFormReadonly && (
        <Paper withBorder p="md" mt="md">
          <Group justify="space-between" mb="md">
            <Title order={5}>{t('Documents')}</Title>
          </Group>
          
          <GenerateDocumentButton requestId={requestId} reference={request?.reference || requestId} />
        </Paper>
      )}
    </Paper>
  );
}
