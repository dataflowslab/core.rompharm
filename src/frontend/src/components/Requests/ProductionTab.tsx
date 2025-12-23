import { useState, useEffect } from 'react';
import { Paper, Title, Text, Button, Group, Badge, Table, NumberInput, Stack, Grid, ActionIcon } from '@mantine/core';
import { IconDeviceFloppy, IconSignature, IconTrash } from '@tabler/icons-react';
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

interface ProductionFlow {
  _id: string;
  flow_type: string;
  signatures: ApprovalSignature[];
  status: string;
  can_sign_officers: ApprovalOfficer[];
  must_sign_officers: ApprovalOfficer[];
  min_signatures: number;
}

interface ProductionData {
  _id?: string;
  request_id: string;
  resulted: Array<{
    batch_code: string;
    resulted_qty: number;
  }>;
  unused: Array<{
    part: number;
    part_name?: string;
    received_qty: number;
    unused_qty: number;
  }>;
}

interface RequestItem {
  part: number;
  quantity: number;
  received_quantity?: number;
  part_detail?: {
    pk: number;
    name: string;
    IPN: string;
  };
}

interface ProductionTabProps {
  requestId: string;
  onReload: () => void;
}

export function ProductionTab({ requestId, onReload }: ProductionTabProps) {
  const { t } = useTranslation();
  const { username, isStaff } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [batchCodes, setBatchCodes] = useState<string[]>([]);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [flow, setFlow] = useState<ProductionFlow | null>(null);
  const [productionData, setProductionData] = useState<ProductionData>({
    request_id: requestId,
    resulted: [],
    unused: []
  });

  useEffect(() => {
    loadData();
    loadProductionFlow();
  }, [requestId]);

  const loadProductionFlow = async () => {
    try {
      const response = await api.get(`/modules/requests/api/${requestId}/production-flow`);
      setFlow(response.data.flow);
    } catch (error) {
      console.error('Failed to load production flow:', error);
    }
  };

  const loadData = async () => {
    try {
      // Load request details
      const requestResponse = await api.get(requestsApi.getRequest(requestId));
      const request = requestResponse.data;
      
      // Extract batch codes from request
      const codes = request.batch_codes || [];
      setBatchCodes(codes);
      
      // Load items with received quantities
      const requestItems = request.items || [];
      setItems(requestItems);
      
      // Try to load existing production data
      try {
        const productionResponse = await api.get(`/modules/requests/api/${requestId}/production`);
        if (productionResponse.data) {
          const existingData = productionResponse.data;
          // Merge with request items to ensure unused is populated
          const unused = requestItems.map(item => {
            // Find existing unused data for this part
            const existingUnused = existingData.unused?.find((u: any) => u.part === item.part);
            return {
              part: item.part,
              part_name: item.part_detail?.name || String(item.part),
              received_qty: item.received_quantity || item.quantity,
              unused_qty: existingUnused?.unused_qty || 0
            };
          });
          
          setProductionData({
            ...existingData,
            unused
          });
        } else {
          // Initialize production data
          initializeProductionData(codes, requestItems);
        }
      } catch (error) {
        // No production data yet, initialize
        initializeProductionData(codes, requestItems);
      }
    } catch (error) {
      console.error('Failed to load production data:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load production data'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeProductionData = (codes: string[], requestItems: RequestItem[]) => {
    const resulted = codes.map(code => ({
      batch_code: code,
      resulted_qty: 0
    }));

    const unused = requestItems.map(item => ({
      part: item.part,
      part_name: item.part_detail?.name || String(item.part),
      received_qty: item.received_quantity || item.quantity,
      unused_qty: 0
    }));

    setProductionData({
      request_id: requestId,
      resulted,
      unused
    });
  };

  const handleResultedQtyChange = (index: number, value: number) => {
    const newResulted = [...productionData.resulted];
    newResulted[index].resulted_qty = value;
    setProductionData({
      ...productionData,
      resulted: newResulted
    });
  };

  const handleUnusedQtyChange = (index: number, value: number) => {
    const newUnused = [...productionData.unused];
    newUnused[index].unused_qty = value;
    setProductionData({
      ...productionData,
      unused: newUnused
    });
  };

  const handleSaveResults = async () => {
    setSaving(true);
    try {
      await api.post(`/modules/requests/api/${requestId}/production`, {
        resulted: productionData.resulted
      });
      
      notifications.show({
        title: t('Success'),
        message: t('Results saved successfully'),
        color: 'green'
      });
      
      loadData();
    } catch (error: any) {
      console.error('Failed to save results:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save results'),
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUnused = async () => {
    setSaving(true);
    try {
      await api.post(`/modules/requests/api/${requestId}/production`, {
        unused: productionData.unused
      });
      
      notifications.show({
        title: t('Success'),
        message: t('Unused quantities saved successfully'),
        color: 'green'
      });
      
      loadData();
    } catch (error: any) {
      console.error('Failed to save unused:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save unused quantities'),
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      await api.post(`/modules/requests/api/${requestId}/production-sign`);
      
      notifications.show({
        title: t('Success'),
        message: t('Production signed successfully'),
        color: 'green'
      });
      
      setTimeout(() => {
        loadProductionFlow();
        onReload();
      }, 500);
    } catch (error: any) {
      console.error('Failed to sign production:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to sign production'),
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
          await api.delete(`/modules/requests/api/${requestId}/production-signatures/${userId}`);
          notifications.show({
            title: t('Success'),
            message: t('Signature removed successfully'),
            color: 'green'
          });
          loadProductionFlow();
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

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return <Paper p="md"><Text>{t('Loading...')}</Text></Paper>;
  }

  return (
    <Paper p="md">
      <Title order={4} mb="md">{t('Production')}</Title>

      {/* Results Table */}
      <Paper withBorder p="md" mb="md">
        <Group justify="space-between" mb="md">
          <Title order={5}>{t('Results')}</Title>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSaveResults}
            loading={saving}
          >
            {t('Save Results')}
          </Button>
        </Group>

        {batchCodes.length > 0 ? (
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Batch Code')}</Table.Th>
                <Table.Th>{t('Resulted Qty')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {productionData.resulted.map((result, index) => (
                <Table.Tr key={index}>
                  <Table.Td>{result.batch_code}</Table.Td>
                  <Table.Td>
                    <NumberInput
                      value={result.resulted_qty}
                      onChange={(value) => handleResultedQtyChange(index, Number(value) || 0)}
                      min={0}
                      style={{ width: '150px' }}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed">{t('No batch codes defined')}</Text>
        )}
      </Paper>

      {/* Unused Materials Table */}
      <Paper withBorder p="md">
        <Group justify="space-between" mb="md">
          <Title order={5}>{t('Unused Materials')}</Title>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSaveUnused}
            loading={saving}
          >
            {t('Save Unused')}
          </Button>
        </Group>

        {items.length > 0 ? (
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Material')}</Table.Th>
                <Table.Th>{t('Received Qty')}</Table.Th>
                <Table.Th>{t('Unused Qty')}</Table.Th>
                <Table.Th>{t('Used Qty')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {productionData.unused.map((item, index) => {
                const usedQty = item.received_qty - item.unused_qty;
                return (
                  <Table.Tr key={index}>
                    <Table.Td>{item.part_name}</Table.Td>
                    <Table.Td>{item.received_qty}</Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={item.unused_qty}
                        onChange={(value) => handleUnusedQtyChange(index, Number(value) || 0)}
                        min={0}
                        max={item.received_qty}
                        style={{ width: '150px' }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Badge color={usedQty > 0 ? 'blue' : 'gray'}>
                        {usedQty}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed">{t('No materials')}</Text>
        )}
      </Paper>

      {/* Production Approval Flow */}
      {flow ? (
        <Paper withBorder p="md" mt="md">
          <Group justify="space-between" mb="md">
            <Group>
              <Title order={5}>{t('Production Approval')}</Title>
              <Badge color={flow.status === 'approved' ? 'green' : flow.status === 'pending' ? 'gray' : 'blue'} size="lg">
                {flow.status.toUpperCase()}
              </Badge>
            </Group>
            {canUserSign() && !isFlowCompleted() && (
              <Button
                leftSection={<IconSignature size={16} />}
                onClick={handleSign}
                loading={signing}
                color="green"
              >
                {t('Sign Production')}
              </Button>
            )}
          </Group>

          {/* Signatures Table */}
          {flow.signatures.length > 0 && (
            <>
              <Title order={6} mb="sm">{t('Signatures')}</Title>
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

          {isFlowCompleted() && (
            <Text size="sm" c="green" mt="md">
              {t('Production completed successfully. Stock operations have been executed.')}
            </Text>
          )}
        </Paper>
      ) : (
        <Paper withBorder p="md" mt="md">
          <Text c="dimmed">{t('Production approval flow will be created automatically')}</Text>
        </Paper>
      )}
    </Paper>
  );
}
