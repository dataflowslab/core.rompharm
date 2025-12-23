import { useState, useEffect } from 'react';
import { Paper, Title, Text, Button, Group, Badge, Table, ActionIcon, Select, Textarea, Grid, NumberInput, Modal } from '@mantine/core';
import { IconSignature, IconTrash, IconDeviceFloppy, IconPlus, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../context/AuthContext';
import { DocumentGenerator } from '../Common/DocumentGenerator';

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
}

interface Part {
  pk: number;
  name: string;
  IPN: string;
}

interface ItemWithBatch {
  part: number;
  part_name?: string;
  quantity: number;
  init_q: number;  // Initial requested quantity
  batch_code: string;
  added_in_operations?: boolean;  // Flag to identify items added in Operations
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
  
  // Add Item Modal state
  const [addItemModalOpened, setAddItemModalOpened] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [partSearch, setPartSearch] = useState('');
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);
  const [newItem, setNewItem] = useState({
    part: '',
    batch_code: '',
    quantity: 1
  });

  useEffect(() => {
    loadOperationsFlow();
    loadRequestItems();
  }, [requestId]);

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
      setRequest(response.data);
      
      // Load saved operations decision
      if (response.data.operations_result) {
        setFinalStatus(response.data.operations_result);
        setRefusalReason(response.data.operations_result_reason || '');
      }
      
      const items = response.data.items || [];
      
      // Initialize items - save init_q if not already saved
      const itemsData: ItemWithBatch[] = items.map((item: any) => ({
        part: item.part,
        part_name: item.part_detail?.name || String(item.part),
        quantity: item.quantity,
        init_q: item.init_q !== undefined ? item.init_q : item.quantity,
        batch_code: item.batch_code || '',
        added_in_operations: item.added_in_operations || false
      }));
      
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

  const searchParts = async (query: string) => {
    if (!query || query.length < 2) {
      setParts([]);
      return;
    }
    
    try {
      const response = await api.get(requestsApi.getParts(), {
        params: { search: query }
      });
      const results = response.data.results || response.data || [];
      setParts(results);
    } catch (error) {
      console.error('Failed to search parts:', error);
    }
  };

  const loadBatchCodes = async (partId: number) => {
    if (!request || !request.source) {
      setBatchOptions([]);
      return;
    }

    try {
      const url = requestsApi.getPartBatchCodes(partId);
      const params = `?location_id=${request.source}`;
      const response = await api.get(`${url}${params}`);
      const batchCodes = response.data.batch_codes || [];
      
      const options = batchCodes.map((batch: any) => ({
        value: batch.batch_code,
        label: `${batch.batch_code} - ${batch.expiry_date || 'N/A'} - ${batch.quantity} buc`,
        expiry_date: batch.expiry_date,
        quantity: batch.quantity
      }));
      
      setBatchOptions(options);
    } catch (error) {
      console.error(`Failed to load batch codes for part ${partId}:`, error);
      setBatchOptions([]);
    }
  };

  const handlePartSelect = (partId: string | null) => {
    setNewItem({ ...newItem, part: partId || '', batch_code: '' });
    setBatchOptions([]);
    
    if (partId) {
      loadBatchCodes(parseInt(partId));
    }
  };

  const handleAddItem = () => {
    if (!newItem.part || !newItem.batch_code || !newItem.quantity) {
      notifications.show({
        title: t('Error'),
        message: t('Please fill in all fields'),
        color: 'red'
      });
      return;
    }

    const partDetail = parts.find(p => String(p.pk) === newItem.part);
    const newItemData: ItemWithBatch = {
      part: parseInt(newItem.part),
      part_name: partDetail?.name || String(newItem.part),
      quantity: newItem.quantity,
      init_q: newItem.quantity,  // For new items, init_q = quantity
      batch_code: newItem.batch_code,
      added_in_operations: true  // Mark as added in Operations
    };

    setItemsWithBatch([...itemsWithBatch, newItemData]);
    
    // Reset form
    setNewItem({ part: '', batch_code: '', quantity: 1 });
    setPartSearch('');
    setParts([]);
    setBatchOptions([]);
    setAddItemModalOpened(false);

    notifications.show({
      title: t('Success'),
      message: t('Item added successfully'),
      color: 'green'
    });
  };

  const handleDeleteItem = (index: number) => {
    const item = itemsWithBatch[index];
    
    if (!item.added_in_operations) {
      notifications.show({
        title: t('Error'),
        message: t('Cannot delete items not added in Operations'),
        color: 'red'
      });
      return;
    }

    modals.openConfirmModal({
      title: t('Delete Item'),
      children: (
        <Text size="sm">
          {t('Are you sure you want to delete this item?')}
        </Text>
      ),
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        const newItems = itemsWithBatch.filter((_, i) => i !== index);
        setItemsWithBatch(newItems);
        
        notifications.show({
          title: t('Success'),
          message: t('Item deleted successfully'),
          color: 'green'
        });
      }
    });
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
          init_q: item.init_q,
          batch_code: item.batch_code,
          added_in_operations: item.added_in_operations || false
        }))
      });
      
      notifications.show({
        title: t('Success'),
        message: t('Items saved successfully'),
        color: 'green'
      });

      // Reload items to apply sorting
      await loadRequestItems();
    } catch (error: any) {
      console.error('Failed to save items:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save items'),
        color: 'red'
      });
    } finally {
      setSavingBatch(false);
    }
  };

  const handleSign = async () => {
    // Check if decision is set
    if (!finalStatus) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a decision status before signing'),
        color: 'red'
      });
      return;
    }

    setSigning(true);
    try {
      // Save items first
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
        message: t('Decision saved successfully'),
        color: 'green'
      });

      // Don't clear the status - keep it visible
      // Reload to get updated data
      await loadRequestItems();
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
    
    const allMustSigned = flow.must_sign_officers.every(officer =>
      flow.signatures.some(s => s.user_id === officer.reference)
    );
    
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

  // Group items by part and calculate totals
  const getGroupedItems = () => {
    // Group items by part_name
    const grouped = itemsWithBatch.reduce((acc, item) => {
      const key = item.part_name || String(item.part);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {} as Record<string, ItemWithBatch[]>);

    // Sort groups alphabetically
    const sortedKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

    // Separate zero and non-zero items
    const nonZeroGroups: Array<{ key: string; items: ItemWithBatch[] }> = [];
    const zeroGroups: Array<{ key: string; items: ItemWithBatch[] }> = [];

    sortedKeys.forEach(key => {
      const items = grouped[key];
      const hasNonZero = items.some(item => item.quantity > 0);
      
      if (hasNonZero) {
        nonZeroGroups.push({ key, items });
      } else {
        zeroGroups.push({ key, items });
      }
    });

    return [...nonZeroGroups, ...zeroGroups];
  };

  // Check if a material group is complete (all requested quantities are fulfilled)
  const isGroupComplete = (items: ItemWithBatch[]) => {
    // Find the original item (not added in operations)
    const originalItem = items.find(item => !item.added_in_operations);
    if (!originalItem) return false;

    // Sum quantities of all items with batch codes
    const totalWithBatch = items
      .filter(item => item.batch_code && item.batch_code.trim() !== '')
      .reduce((sum, item) => sum + item.quantity, 0);

    return totalWithBatch === originalItem.init_q;
  };

  // Check if all groups are complete
  const areAllGroupsComplete = () => {
    const groups = getGroupedItems();
    const nonZeroGroups = groups.filter(group => 
      group.items.some(item => item.quantity > 0)
    );
    
    return nonZeroGroups.every(group => isGroupComplete(group.items));
  };

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

      {/* Warehouse Operations Table - First */}
      <Paper withBorder p="md" mb="md">
        <Group justify="space-between" mb="md">
          <Group>
            <Title order={5}>{t('Warehouse Operations')}</Title>
            {areAllGroupsComplete() ? (
              <IconCheck size={20} color="green" />
            ) : (
              <IconAlertTriangle size={20} color="orange" />
            )}
          </Group>
          <Group>
            {!isFormReadonly && (
              <>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => setAddItemModalOpened(true)}
                  size="sm"
                  variant="outline"
                >
                  {t('Add Item')}
                </Button>
                <Button
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSaveBatchData}
                  loading={savingBatch}
                  size="sm"
                  variant="light"
                >
                  {t('Save')}
                </Button>
              </>
            )}
          </Group>
        </Group>

        <Table striped withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Part')}</Table.Th>
              <Table.Th style={{ width: '120px' }}>{t('Requested')}</Table.Th>
              <Table.Th style={{ width: '120px' }}>{t('Qty')}</Table.Th>
              <Table.Th>{t('Batch Code')}</Table.Th>
              {!isFormReadonly && <Table.Th style={{ width: '60px' }}></Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {getGroupedItems().map((group, groupIndex) => {
              const isGroupZero = group.items.every(item => item.quantity === 0);
              const groupComplete = isGroupComplete(group.items);
              
              return group.items.map((item, itemIndex) => {
                const isZeroQuantity = item.quantity === 0;
                const isOriginalItem = !item.added_in_operations;
                const flatIndex = itemsWithBatch.findIndex(i => 
                  i.part === item.part && 
                  i.batch_code === item.batch_code && 
                  i.added_in_operations === item.added_in_operations
                );
                
                return (
                  <Table.Tr key={`${groupIndex}-${itemIndex}`} style={{ opacity: isZeroQuantity ? 0.5 : 1 }}>
                    <Table.Td style={{ color: isZeroQuantity ? '#868e96' : 'inherit' }}>
                      {item.part_name}
                    </Table.Td>
                    <Table.Td>
                      {isOriginalItem ? (
                        <Text 
                          size="sm" 
                          fw={groupComplete ? 700 : 400}
                          c={groupComplete ? 'green' : 'dimmed'}
                        >
                          {item.init_q}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={item.quantity}
                        onChange={(value) => handleQuantityChange(flatIndex, Number(value) || 0)}
                        disabled={isFormReadonly}
                        min={0}
                        size="xs"
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" style={{ color: isZeroQuantity ? '#868e96' : 'inherit' }}>
                        {item.batch_code || '-'}
                      </Text>
                    </Table.Td>
                    {!isFormReadonly && (
                      <Table.Td>
                        {item.added_in_operations && (
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            size="sm"
                            onClick={() => handleDeleteItem(flatIndex)}
                            title={t('Delete')}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        )}
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              });
            })}
          </Table.Tbody>
        </Table>

        {isFormReadonly && (
          <Text size="sm" c="orange" mt="md">
            {t('This form is read-only because it has been signed.')}
          </Text>
        )}

        {!isFormReadonly && (
          <Text size="sm" c="dimmed" mt="md">
            {t('Note: Set quantity to 0 for items not available. Use Add Item to add materials with batch codes from source location.')}
          </Text>
        )}
      </Paper>

      {/* Add Item Modal */}
      <Modal
        opened={addItemModalOpened}
        onClose={() => {
          setAddItemModalOpened(false);
          setNewItem({ part: '', batch_code: '', quantity: 1 });
          setPartSearch('');
          setParts([]);
          setBatchOptions([]);
        }}
        title={t('Add Item')}
        size="md"
      >
        <Grid>
          <Grid.Col span={12}>
            <Select
              label={t('Article')}
              placeholder={t('Search for article...')}
              data={parts.map(part => ({
                value: String(part.pk),
                label: `${part.name} (${part.IPN})`
              }))}
              value={newItem.part}
              onChange={(value) => {
                handlePartSelect(value);
                setPartSearch(''); // Clear search to keep selected value visible
              }}
              onSearchChange={(query) => {
                setPartSearch(query);
                searchParts(query);
              }}
              searchValue={partSearch}
              searchable
              clearable
              required
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Select
              label={t('Batch Code')}
              placeholder={t('Select batch code...')}
              data={batchOptions}
              value={newItem.batch_code}
              onChange={(value) => setNewItem({ ...newItem, batch_code: value || '' })}
              disabled={!newItem.part}
              searchable
              required
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <NumberInput
              label={t('Quantity')}
              placeholder="1"
              value={newItem.quantity}
              onChange={(value) => setNewItem({ ...newItem, quantity: Number(value) || 1 })}
              min={1}
              step={1}
              required
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => {
            setAddItemModalOpened(false);
            setNewItem({ part: '', batch_code: '', quantity: 1 });
            setPartSearch('');
            setParts([]);
            setBatchOptions([]);
          }}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleAddItem}>
            {t('Add')}
          </Button>
        </Group>
      </Modal>

      {/* Bottom Section: 1/3 Documents + 2/3 Signatures */}
      <Grid gutter="md">
        {/* Left - Documents (1/3) */}
        <Grid.Col span={4}>
          <Paper withBorder p="md" style={{ border: '1px solid #dee2e6' }}>
            <Title order={5} mb="md">{t('Documents')}</Title>
            <Paper withBorder p="sm" style={{ border: '1px solid #e9ecef' }}>
              <DocumentGenerator
                objectId={requestId}
                templateCodes={['RC45WVTRBDGT']}
                templateNames={{
                  'RC45WVTRBDGT': 'P-Distrib-102_F2'
                }}
              />
            </Paper>
          </Paper>
        </Grid.Col>

        {/* Right - Decision & Signatures (2/3) */}
        <Grid.Col span={8}>
          <Paper withBorder p="md">
            {/* Decision Section - ALWAYS VISIBLE */}
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
              disabled={isFlowCompleted()}
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
                disabled={isFlowCompleted()}
              />
            )}

            {finalStatus && !isFlowCompleted() && (
              <Group justify="flex-end" mb="xl">
                <Button
                  onClick={handleSubmitStatus}
                  loading={submitting}
                  color={finalStatus === 'Finished' ? 'green' : 'red'}
                >
                  {t('Save Decision')}
                </Button>
              </Group>
            )}

            {/* Signatures Section */}
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
      </Grid>
    </Paper>
  );
}
