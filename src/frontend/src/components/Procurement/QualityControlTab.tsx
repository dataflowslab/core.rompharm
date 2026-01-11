import { useState, useEffect } from 'react';
import { Paper, Title, Text, Table, Button, Group, Modal, Grid, Select, Textarea, Badge, TextInput, NumberInput, Checkbox, ActionIcon } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus, IconCheck, IconEdit } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { procurementApi } from '../../services/procurement';
import { notifications } from '@mantine/notifications';

interface QCRecord {
  _id: string;
  batch_code: string;
  part: string;
  part_name: string;
  prelevation_date: string;
  prelevated_quantity: number;
  ba_rompharm_no: string;
  ba_rompharm_date: string;
  test_result: string;
  transactionable: boolean;
  comment: string;
  confirmed: boolean;
}

interface ReceivedItem {
  _id: string;
  pk?: number;  // Legacy support
  batch?: string;  // Legacy field
  batch_code?: string;  // New field
  part_id: string;  // MongoDB ObjectId
  part?: number;  // Legacy field
  part_detail?: {
    name: string;
    IPN: string;
    custom_fields?: {
      [key: string]: any;
    };
  };
  quantity: number;
  location_detail?: {
    name: string;
  };
}

interface QualityControlTabProps {
  orderId: string;
}

export function QualityControlTab({ orderId }: QualityControlTabProps) {
  const { t } = useTranslation();
  const [qcRecords, setQcRecords] = useState<QCRecord[]>([]);
  const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);
  const [qcModalOpened, setQcModalOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRecord, setEditingRecord] = useState<QCRecord | null>(null);
  
  // Order state management
  const [orderState, setOrderState] = useState<string>('Finished');
  const [savingState, setSavingState] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Form state for QC record
  const [qcData, setQcData] = useState({
    batch_code: '',
    part: '',
    prelevation_date: null as Date | null,
    prelevated_quantity: 0,
    ba_rompharm_no: '',
    ba_rompharm_date: null as Date | null,
    test_result: '',
    transactionable: false,
    comment: '',
    quarantine_delivery: false, // Livrare în carantină (for Reglementat products)
  });

  // Separate state for LOTALLEXP items
  const [lotallexpItems, setLotallexpItems] = useState<ReceivedItem[]>([]);

  useEffect(() => {
    loadQCRecords();
    loadReceivedItems();
    loadCurrentUser();
  }, [orderId]);
  
  const loadCurrentUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  };

  const loadQCRecords = async () => {
    try {
      const response = await api.get(procurementApi.getQCRecords(orderId));
      setQcRecords(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load QC records:', error);
    }
  };

  const loadReceivedItems = async () => {
    try {
      const response = await api.get(procurementApi.getReceivedItems(orderId));
      const items = response.data.results || response.data || [];
      
      // Separate LOTALLEXP items (custom field id 3)
      const lotallexpFiltered: ReceivedItem[] = [];
      const regularItems: ReceivedItem[] = [];
      
      items.forEach((item: ReceivedItem) => {
        // Check if item has LOTALLEXP custom field (id 3) set to true
        const hasLotallexp = item.part_detail?.custom_fields?.['3'] === true || 
                            item.part_detail?.custom_fields?.['LOTALLEXP'] === true;
        
        if (hasLotallexp) {
          lotallexpFiltered.push(item);
        } else {
          const batchCode = item.batch_code || item.batch;
          if (batchCode && batchCode.trim() !== '') {
            // Only add to regular items if it has a batch code
            regularItems.push(item);
          }
        }
      });
      
      setLotallexpItems(lotallexpFiltered);
      setReceivedItems(regularItems);
    } catch (error) {
      console.error('Failed to load received items:', error);
    }
  };

  const handleSaveQCRecord = async () => {
    if (!qcData.batch_code || !qcData.part) {
      notifications.show({
        title: t('Error'),
        message: t('Please fill in all required fields'),
        color: 'red'
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        batch_code: qcData.batch_code,
        part_id: qcData.part,  // ✅ FIX: Send as part_id
        prelevation_date: qcData.prelevation_date?.toISOString().split('T')[0],
        prelevated_quantity: qcData.prelevated_quantity,
        ba_rompharm_no: qcData.ba_rompharm_no,
        ba_rompharm_date: qcData.ba_rompharm_date?.toISOString().split('T')[0],
        test_result: qcData.test_result,
        transactionable: qcData.transactionable,
        comment: qcData.comment,
        confirmed: false
      };

      await api.post(procurementApi.createQCRecord(orderId), payload);

      notifications.show({
        title: t('Success'),
        message: t('QC record saved successfully'),
        color: 'green'
      });

      resetForm();
      setQcModalOpened(false);
      loadQCRecords();
    } catch (error: any) {
      console.error('Failed to save QC record:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save QC record'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmQCRecord = async () => {
    if (!isFormComplete()) {
      notifications.show({
        title: t('Error'),
        message: t('Please complete all fields including test results'),
        color: 'red'
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        batch_code: qcData.batch_code,
        part_id: qcData.part,  // ✅ FIX: Send as part_id
        prelevation_date: qcData.prelevation_date?.toISOString().split('T')[0],
        prelevated_quantity: qcData.prelevated_quantity,
        ba_rompharm_no: qcData.ba_rompharm_no,
        ba_rompharm_date: qcData.ba_rompharm_date?.toISOString().split('T')[0],
        test_result: qcData.test_result,
        transactionable: qcData.test_result === 'conform',  // Auto-set based on result
        comment: qcData.comment,
        confirmed: true
      };

      await api.post(procurementApi.createQCRecord(orderId), payload);

      notifications.show({
        title: t('Success'),
        message: qcData.test_result === 'conform' 
          ? t('QC record confirmed - Batch is transactionable') 
          : t('QC record confirmed - Non-conforming batch'),
        color: qcData.test_result === 'conform' ? 'green' : 'orange'
      });

      resetForm();
      setQcModalOpened(false);
      loadQCRecords();
    } catch (error: any) {
      console.error('Failed to confirm QC record:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to confirm QC record'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRecord = (record: QCRecord) => {
    setEditingRecord(record);
    setQcData({
      batch_code: record.batch_code,
      part: record.part,
      prelevation_date: new Date(record.prelevation_date),
      prelevated_quantity: record.prelevated_quantity,
      ba_rompharm_no: record.ba_rompharm_no,
      ba_rompharm_date: new Date(record.ba_rompharm_date),
      test_result: record.test_result,
      transactionable: record.transactionable,
      comment: record.comment,
      quarantine_delivery: false
    });
    setQcModalOpened(true);
  };

  const handleUpdateQCRecord = async () => {
    if (!editingRecord) return;

    setSubmitting(true);
    try {
      const payload = {
        ba_rompharm_no: qcData.ba_rompharm_no,
        ba_rompharm_date: qcData.ba_rompharm_date?.toISOString().split('T')[0],
        test_result: qcData.test_result,
        transactionable: qcData.transactionable,
        comment: qcData.comment,
        confirmed: false
      };

      await api.patch(procurementApi.updateQCRecord(orderId, editingRecord._id), payload);

      notifications.show({
        title: t('Success'),
        message: t('QC record updated successfully'),
        color: 'green'
      });

      resetForm();
      setEditingRecord(null);
      setQcModalOpened(false);
      loadQCRecords();
    } catch (error: any) {
      console.error('Failed to update QC record:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update QC record'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmEditedRecord = async () => {
    if (!editingRecord) return;

    setSubmitting(true);
    try {
      const payload = {
        ba_rompharm_no: qcData.ba_rompharm_no,
        ba_rompharm_date: qcData.ba_rompharm_date?.toISOString().split('T')[0],
        test_result: qcData.test_result,
        transactionable: qcData.test_result === 'conform',
        comment: qcData.comment,
        confirmed: true
      };

      await api.patch(procurementApi.updateQCRecord(orderId, editingRecord._id), payload);

      notifications.show({
        title: t('Success'),
        message: qcData.test_result === 'conform' 
          ? t('QC record confirmed - Batch is transactionable') 
          : t('QC record confirmed - Non-conforming batch'),
        color: qcData.test_result === 'conform' ? 'green' : 'orange'
      });

      resetForm();
      setEditingRecord(null);
      setQcModalOpened(false);
      loadQCRecords();
    } catch (error: any) {
      console.error('Failed to confirm QC record:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to confirm QC record'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setQcData({
      batch_code: '',
      part: '',
      prelevation_date: null,
      prelevated_quantity: 0,
      ba_rompharm_no: '',
      ba_rompharm_date: null,
      test_result: '',
      transactionable: false,
      comment: '',
      quarantine_delivery: false
    });
    setEditingRecord(null);
  };

  const isFormComplete = () => {
    return qcData.batch_code && 
           qcData.part && 
           qcData.prelevation_date && 
           qcData.prelevated_quantity > 0 &&
           qcData.ba_rompharm_no &&
           qcData.ba_rompharm_date &&
           qcData.test_result;
  };

  // Get unique batch codes from received items
  const batchCodes = Array.from(new Set(receivedItems.map(item => item.batch_code || item.batch)))
    .filter(batch => batch && batch.trim() !== '')
    .map(batch => ({
      value: batch,
      label: batch
    }));

  // Get parts for selected batch code with quantity info
  const partsForBatch = receivedItems
    .filter(item => (item.batch_code || item.batch) === qcData.batch_code)
    .map(item => ({
      value: item.part_id,  // Use part_id (ObjectId string)
      label: `${item.part_detail?.name || 'Part ' + item.part_id} (${item.part_detail?.IPN || 'No IPN'}) - Qty: ${item.quantity}`,
      maxQuantity: item.quantity  // Store max quantity for validation
    }));
  
  // Get max quantity for selected part
  const selectedPartData = partsForBatch.find(p => p.value === qcData.part);
  const maxPrelevatedQty = selectedPartData?.maxQuantity || 0;

  const getResultBadge = (result: string) => {
    const colors: Record<string, string> = {
      'conform': 'green',
      'neconform': 'red',
      '': 'gray'
    };
    return <Badge color={colors[result] || 'gray'}>{result || 'Pending'}</Badge>;
  };

  const getTransactionableBadge = (transactionable: boolean) => {
    return <Badge color={transactionable ? 'green' : 'red'}>
      {transactionable ? t('Yes') : t('No')}
    </Badge>;
  };
  
  const handleSaveOrderState = async () => {
    setSavingState(true);
    try {
      await api.patch(`/modules/depo_procurement/api/purchase-orders/${orderId}/state`, null, {
        params: { state_name: orderState }
      });
      
      notifications.show({
        title: t('Success'),
        message: t('Order state updated successfully'),
        color: 'green'
      });
    } catch (error: any) {
      console.error('Failed to update order state:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update order state'),
        color: 'red'
      });
    } finally {
      setSavingState(false);
    }
  };
  
  // Check if user can change order state (admin or qc role)
  const canChangeOrderState = () => {
    if (!currentUser) return false;
    const isAdmin = currentUser.is_staff || currentUser.is_superuser || false;
    // Check if user has QC role (you may need to adjust this based on your role structure)
    const hasQCRole = currentUser.role_name === 'QC' || currentUser.role_slug === 'qc';
    return isAdmin || hasQCRole;
  };

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={4}>{t('Quality Control Records')}</Title>
        <Button 
          leftSection={<IconPlus size={16} />}
          onClick={() => setQcModalOpened(true)}
          disabled={batchCodes.length === 0}
        >
          {t('New QC Record')}
        </Button>
      </Group>

      {batchCodes.length === 0 && (
        <Text size="sm" c="dimmed" mb="md">
          {t('No batch codes available. Please receive stock with batch codes first.')}
        </Text>
      )}

      {qcRecords.length === 0 ? (
        <Text size="sm" c="dimmed">{t('No QC records')}</Text>
      ) : (
        <Table striped withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Article')}</Table.Th>
              <Table.Th>{t('Lot')}</Table.Th>
              <Table.Th>{t('Prelevation Date')}</Table.Th>
              <Table.Th>{t('Result')}</Table.Th>
              <Table.Th>{t('BA Rompharm')}</Table.Th>
              <Table.Th>{t('Transactionable')}</Table.Th>
              <Table.Th>{t('Comment')}</Table.Th>
              <Table.Th>{t('Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {qcRecords.map((record) => (
              <Table.Tr key={record._id}>
                <Table.Td>{record.part_name}</Table.Td>
                <Table.Td>{record.batch_code}</Table.Td>
                <Table.Td>{new Date(record.prelevation_date).toLocaleDateString()}</Table.Td>
                <Table.Td>{getResultBadge(record.test_result)}</Table.Td>
                <Table.Td>
                  {record.ba_rompharm_no}
                  {record.ba_rompharm_date && ` (${new Date(record.ba_rompharm_date).toLocaleDateString()})`}
                </Table.Td>
                <Table.Td>{getTransactionableBadge(record.transactionable)}</Table.Td>
                <Table.Td>{record.comment || '-'}</Table.Td>
                <Table.Td>
                  {!record.confirmed && (
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => handleEditRecord(record)}
                      title={t('Edit')}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* Order State Management - Only for Admin/QC */}
      {canChangeOrderState() && (
        <Paper p="md" withBorder mt="xl">
          <Title order={5} mb="md">{t('Order State Management')}</Title>
          <Text size="sm" c="dimmed" mb="md">
            {t('Set the final state of the purchase order after QC completion')}
          </Text>
          <Grid>
            <Grid.Col span={8}>
              <Select
                label={t('Order State')}
                value={orderState}
                onChange={(value) => setOrderState(value || 'Finished')}
                data={[
                  { value: 'Finished', label: t('Finished') },
                  { value: 'Refused', label: t('Refused') },
                  { value: 'Canceled', label: t('Canceled') }
                ]}
                required
              />
            </Grid.Col>
            <Grid.Col span={4} style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button
                fullWidth
                onClick={handleSaveOrderState}
                loading={savingState}
              >
                {t('Save State')}
              </Button>
            </Grid.Col>
          </Grid>
        </Paper>
      )}

      {/* LOTALLEXP Items Table - Separate section */}
      {lotallexpItems.length > 0 && (
        <>
          <Title order={5} mt="xl" mb="md">{t('LOTALLEXP - Auto-received Items')}</Title>
          <Text size="sm" c="dimmed" mb="md">
            {t('These items were automatically received as transactionable (OK) without quarantine.')}
          </Text>
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Article')}</Table.Th>
                <Table.Th>{t('IPN')}</Table.Th>
                <Table.Th>{t('Quantity')}</Table.Th>
                <Table.Th>{t('Location')}</Table.Th>
                <Table.Th>{t('Status')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lotallexpItems.map((item) => (
                <Table.Tr key={item._id || item.pk}>
                  <Table.Td>{item.part_detail?.name || `Part ${item.part}`}</Table.Td>
                  <Table.Td>{item.part_detail?.IPN || '-'}</Table.Td>
                  <Table.Td>{item.quantity}</Table.Td>
                  <Table.Td>{item.location_detail?.name || '-'}</Table.Td>
                  <Table.Td>
                    <Badge color="green">{t('OK - Transactionable')}</Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {/* QC Record Modal */}
      <Modal
        opened={qcModalOpened}
        onClose={() => { setQcModalOpened(false); resetForm(); }}
        title={editingRecord ? t('Edit QC Record') : t('New QC Record')}
        size="lg"
      >
        <Grid>
          {/* Batch Code - READ ONLY when editing */}
          <Grid.Col span={12}>
            {editingRecord ? (
              <TextInput
                label={t('Batch Code')}
                value={qcData.batch_code}
                readOnly
                disabled
              />
            ) : (
              <Select
                label={t('Batch Code')}
                placeholder={t('Select batch code')}
                data={batchCodes}
                value={qcData.batch_code}
                onChange={(value) => setQcData({ ...qcData, batch_code: value || '', part: '' })}
                searchable
                required
              />
            )}
          </Grid.Col>

          {/* Part (Article) - READ ONLY when editing */}
          <Grid.Col span={12}>
            {editingRecord ? (
              <TextInput
                label={t('Part (Article)')}
                value={editingRecord.part_name}
                readOnly
                disabled
              />
            ) : (
              <Select
                label={t('Part (Article)')}
                placeholder={t('Select part')}
                data={partsForBatch}
                value={qcData.part}
                onChange={(value) => setQcData({ ...qcData, part: value || '' })}
                searchable
                required
                disabled={!qcData.batch_code}
              />
            )}
          </Grid.Col>

          {/* Prelevation Date & Quantity - READ ONLY when editing */}
          <Grid.Col span={6}>
            <DatePickerInput
              label={t('Prelevation Date')}
              placeholder={t('Select date')}
              value={qcData.prelevation_date}
              onChange={(date) => setQcData({ ...qcData, prelevation_date: date })}
              required
              readOnly={!!editingRecord}
              disabled={!!editingRecord}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <NumberInput
              label={t('Prelevated Quantity')}
              placeholder="0"
              value={qcData.prelevated_quantity}
              onChange={(value) => setQcData({ ...qcData, prelevated_quantity: Number(value) || 0 })}
              min={0}
              max={maxPrelevatedQty}
              step={1}
              required
              readOnly={!!editingRecord}
              disabled={!!editingRecord}
              description={maxPrelevatedQty > 0 ? `Max: ${maxPrelevatedQty}` : ''}
              error={qcData.prelevated_quantity > maxPrelevatedQty ? t('Quantity exceeds received stock') : ''}
            />
          </Grid.Col>

          {/* BA Rompharm No & Date */}
          <Grid.Col span={6}>
            <TextInput
              label={t('No BA Rompharm')}
              placeholder={t('Enter BA number')}
              value={qcData.ba_rompharm_no}
              onChange={(e) => setQcData({ ...qcData, ba_rompharm_no: e.target.value })}
              required
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <DatePickerInput
              label={t('Date BA Rompharm')}
              placeholder={t('Select date')}
              value={qcData.ba_rompharm_date}
              onChange={(date) => setQcData({ ...qcData, ba_rompharm_date: date })}
              required
            />
          </Grid.Col>

          {/* Test Result */}
          <Grid.Col span={12}>
            <Select
              label={t('Test Result (Conform/Neconform)')}
              placeholder={t('Select result')}
              data={[
                { value: 'conform', label: t('Conform') },
                { value: 'neconform', label: t('Neconform') }
              ]}
              value={qcData.test_result}
              onChange={(value) => setQcData({ ...qcData, test_result: value || '' })}
              required
            />
          </Grid.Col>

          {/* Transactionable Checkbox */}
          <Grid.Col span={12}>
            <Checkbox
              label={t('Transactionable (În carantină tranzacționabil)')}
              checked={qcData.transactionable}
              onChange={(e) => setQcData({ ...qcData, transactionable: e.currentTarget.checked })}
            />
          </Grid.Col>

          {/* Comment */}
          <Grid.Col span={12}>
            <Textarea
              label={t('Comment')}
              placeholder={t('Additional comments')}
              value={qcData.comment}
              onChange={(e) => setQcData({ ...qcData, comment: e.target.value })}
              minRows={3}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md" gap="sm">
          <Button variant="default" onClick={() => { setQcModalOpened(false); resetForm(); }}>
            {t('Cancel')}
          </Button>
          {editingRecord ? (
            <>
              <Button 
                onClick={handleUpdateQCRecord} 
                loading={submitting}
              >
                {t('Save')}
              </Button>
              {qcData.ba_rompharm_no && qcData.ba_rompharm_date && qcData.test_result && (
                <Button 
                  onClick={handleConfirmEditedRecord} 
                  loading={submitting}
                  color="green"
                  leftSection={<IconCheck size={16} />}
                >
                  {t('Confirm')}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button 
                onClick={handleSaveQCRecord} 
                loading={submitting}
                disabled={!qcData.batch_code || !qcData.part}
              >
                {t('Save')}
              </Button>
              {isFormComplete() && (
                <Button 
                  onClick={handleConfirmQCRecord} 
                  loading={submitting}
                  color="green"
                  leftSection={<IconCheck size={16} />}
                >
                  {t('Confirm')}
                </Button>
              )}
            </>
          )}
        </Group>
      </Modal>
    </Paper>
  );
}
