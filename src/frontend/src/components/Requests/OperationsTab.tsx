import { useState, useEffect } from 'react';
import { Paper, Title, Text, Button, Group, Badge, Grid } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../context/AuthContext';
import { DocumentGenerator } from '../Common/DocumentGenerator';
import { debounce } from '../../utils/selectHelpers';
import { WarehouseOperationsTable } from './WarehouseOperationsTable';
import { AddItemModal } from './AddItemModal';
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
  _id: string;
  name: string;
  IPN: string;
}

interface ItemWithBatch {
  part: string;
  part_name?: string;
  quantity: number;
  init_q: number;
  batch_code: string;
  added_in_operations?: boolean;
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
  const [availableStates, setAvailableStates] = useState<any[]>([]);
  
  // Add Item Modal state
  const [addItemModalOpened, setAddItemModalOpened] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedPartData, setSelectedPartData] = useState<Part | null>(null);
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
    loadAvailableStates();
  }, [requestId]);

  const loadAvailableStates = async () => {
    try {
      const response = await api.get('/modules/requests/api/states');
      const allStates = response.data.results || [];
      
      // Filter states that have 'operations' in their scenes array
      const operationsStates = allStates.filter((state: any) => 
        state.scenes && Array.isArray(state.scenes) && state.scenes.includes('operations')
      );
      
      setAvailableStates(operationsStates);
    } catch (error) {
      console.error('Failed to load states:', error);
    }
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
      setRequest(response.data);
      
      // Load last status from status_log for operations scene
      const statusLog = response.data.status_log || [];
      const lastOperationsStatus = statusLog
        .filter((log: any) => log.scene === 'operations')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
      if (lastOperationsStatus) {
        setFinalStatus(lastOperationsStatus.status_id);
        setRefusalReason(lastOperationsStatus.reason || '');
        console.log('[OperationsTab] Loaded last status from log:', lastOperationsStatus);
      }
      
      const items = response.data.items || [];
      const itemsData: ItemWithBatch[] = items.map((item: any) => ({
        part: item.part,
        part_name: item.part_detail?.name || String(item.part),
        quantity: item.quantity,
        init_q: item.init_q !== undefined ? item.init_q : item.quantity,
        batch_code: item.batch_code || '',
        added_in_operations: item.added_in_operations || false
      }));
      
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
      // Keep selected part even when clearing search
      if (selectedPartData) {
        setParts([selectedPartData]);
      } else {
        setParts([]);
      }
      return;
    }
    
    try {
      const response = await api.get(requestsApi.getParts(), {
        params: { search: query }
      });
      const results = response.data.results || response.data || [];
      
      // Always include selected part in results if it exists
      if (selectedPartData && !results.some((p: Part) => p._id === selectedPartData._id)) {
        setParts([selectedPartData, ...results]);
      } else {
        setParts(results);
      }
    } catch (error) {
      console.error('Failed to search parts:', error);
    }
  };

  const debouncedSearchParts = debounce(searchParts, 250);

  const loadBatchCodes = async (partId: string) => {
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
      // Find selected part in current parts array
      const selected = parts.find(p => p._id === partId);
      
      if (selected) {
        // Always ensure selected part is in the array (move to front if exists)
        const filteredParts = parts.filter(p => p._id !== partId);
        setParts([selected, ...filteredParts]);
        setSelectedPartData(selected);
      }
      
      loadBatchCodes(partId);
    } else {
      setSelectedPartData(null);
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

    const partDetail = parts.find(p => p._id === newItem.part);
    const newItemData: ItemWithBatch = {
      part: newItem.part,
      part_name: partDetail?.name || String(newItem.part),
      quantity: newItem.quantity,
      init_q: newItem.quantity,
      batch_code: newItem.batch_code,
      added_in_operations: true
    };

    setItemsWithBatch([...itemsWithBatch, newItemData]);
    
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
    const newItems = itemsWithBatch.filter((_, i) => i !== index);
    setItemsWithBatch(newItems);
    
    notifications.show({
      title: t('Success'),
      message: t('Item deleted successfully'),
      color: 'green'
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
      await handleSaveBatchData();
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

  const canUserSign = () => {
    if (!flow || !username) return false;
    
    const alreadySigned = flow.signatures.some(s => s.username === username);
    if (alreadySigned) return false;
    
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

      {/* Warehouse Operations Table */}
      <WarehouseOperationsTable
        items={itemsWithBatch}
        isReadonly={isFormReadonly}
        onQuantityChange={handleQuantityChange}
        onDeleteItem={handleDeleteItem}
        onSave={handleSaveBatchData}
        onAddItem={() => setAddItemModalOpened(true)}
        saving={savingBatch}
      />

      {/* Add Item Modal */}
      <AddItemModal
        opened={addItemModalOpened}
        onClose={() => {
          setAddItemModalOpened(false);
          setNewItem({ part: '', batch_code: '', quantity: 1 });
          setSelectedPartData(null);
          setPartSearch('');
          setParts([]);
          setBatchOptions([]);
        }}
        parts={parts}
        selectedPartData={selectedPartData}
        batchOptions={batchOptions}
        newItem={newItem}
        onPartSelect={handlePartSelect}
        onBatchCodeChange={(value) => setNewItem({ ...newItem, batch_code: value || '' })}
        onQuantityChange={(value) => setNewItem({ ...newItem, quantity: value })}
        onAdd={handleAddItem}
        onPartSearchChange={(query) => {
          setPartSearch(query);
          debouncedSearchParts(query);
        }}
      />

      {/* Bottom Section: 1/3 Documents + 2/3 Decision & Signatures */}
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
            {/* Decision Section */}
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

            {/* Signatures Section */}
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
    </Paper>
  );
}
