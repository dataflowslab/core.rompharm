/**
 * StockItemDetailPage
 * 
 * Detailed view of a single stock item with:
 * - All stock information (read-only)
 * - QC section (editable): BA Rompharm, test results, etc.
 * 
 * Route: /inventory/stocks/:id
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Grid,
  TextInput,
  Button,
  Group,
  LoadingOverlay,
  Divider,
  Badge,
  Text,
  Select,
  NumberInput,
  Textarea,
  Checkbox,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconArrowLeft, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';

interface StockItem {
  _id: string;
  part_id: string;
  part_detail?: {
    name: string;
    ipn: string;
  };
  quantity: number;
  location_id: string;
  location_detail?: {
    name: string;
  };
  batch_code: string;
  supplier_batch_code?: string;
  manufacturing_date?: string;
  expiry_date?: string;
  reset_date?: string;
  status: string;
  status_detail?: string;
  supplier_id?: string;
  supplier_detail?: {
    name: string;
  };
  notes?: string;
  // Extra data from depo_procurement
  expected_quantity?: number;
  containers?: any[];
  containers_cleaned?: boolean;
  supplier_ba_no?: string;
  supplier_ba_date?: string;
  accord_ba?: boolean;
  is_list_supplier?: boolean;
  clean_transport?: boolean;
  temperature_control?: boolean;
  temperature_conditions_met?: boolean;
}

interface QCRecord {
  _id?: string;
  batch_code: string;
  part: string;
  part_name?: string;
  prelevation_date: string;
  prelevated_quantity: number;
  ba_rompharm_no: string;
  ba_rompharm_date: string;
  test_result: string;
  transactionable: boolean;
  comment: string;
  confirmed: boolean;
}

export function StockItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stockItem, setStockItem] = useState<StockItem | null>(null);
  const [qcRecord, setQcRecord] = useState<QCRecord | null>(null);
  
  // QC Form data
  const [qcData, setQcData] = useState({
    prelevation_date: null as Date | null,
    prelevated_quantity: 0,
    ba_rompharm_no: '',
    ba_rompharm_date: null as Date | null,
    test_result: '',
    transactionable: false,
    comment: '',
  });

  useEffect(() => {
    if (id) {
      fetchStockItem();
      fetchQCRecord();
    }
  }, [id]);

  const fetchStockItem = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/modules/inventory/api/stocks/${id}`);
      setStockItem(response.data);
    } catch (error) {
      console.error('Failed to fetch stock item:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load stock item'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchQCRecord = async () => {
    try {
      const response = await api.get(`/modules/depo_procurement/api/qc-records?stock_item_id=${id}`);
      const records = response.data.results || response.data || [];
      
      if (records.length > 0) {
        const record = records[0];
        setQcRecord(record);
        setQcData({
          prelevation_date: record.prelevation_date ? new Date(record.prelevation_date) : null,
          prelevated_quantity: record.prelevated_quantity || 0,
          ba_rompharm_no: record.ba_rompharm_no || '',
          ba_rompharm_date: record.ba_rompharm_date ? new Date(record.ba_rompharm_date) : null,
          test_result: record.test_result || '',
          transactionable: record.transactionable || false,
          comment: record.comment || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch QC record:', error);
    }
  };

  const handleSaveQC = async () => {
    if (!stockItem) return;

    setSubmitting(true);
    try {
      const payload = {
        stock_item_id: id,
        batch_code: stockItem.batch_code,
        part: stockItem.part_id,
        part_name: stockItem.part_detail?.name,
        prelevation_date: qcData.prelevation_date?.toISOString().split('T')[0],
        prelevated_quantity: qcData.prelevated_quantity,
        ba_rompharm_no: qcData.ba_rompharm_no,
        ba_rompharm_date: qcData.ba_rompharm_date?.toISOString().split('T')[0],
        test_result: qcData.test_result,
        transactionable: qcData.transactionable,
        comment: qcData.comment,
        confirmed: false,
      };

      if (qcRecord?._id) {
        // Update existing QC record
        await api.patch(`/modules/depo_procurement/api/qc-records/${qcRecord._id}`, payload);
      } else {
        // Create new QC record
        await api.post('/modules/depo_procurement/api/qc-records', payload);
      }

      notifications.show({
        title: t('Success'),
        message: t('QC data saved successfully'),
        color: 'green',
      });

      fetchQCRecord();
    } catch (error: any) {
      console.error('Failed to save QC data:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save QC data'),
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmQC = async () => {
    if (!stockItem) return;

    if (!qcData.ba_rompharm_no || !qcData.ba_rompharm_date || !qcData.test_result) {
      notifications.show({
        title: t('Error'),
        message: t('Please complete all required QC fields'),
        color: 'red',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        stock_item_id: id,
        batch_code: stockItem.batch_code,
        part: stockItem.part_id,
        part_name: stockItem.part_detail?.name,
        prelevation_date: qcData.prelevation_date?.toISOString().split('T')[0],
        prelevated_quantity: qcData.prelevated_quantity,
        ba_rompharm_no: qcData.ba_rompharm_no,
        ba_rompharm_date: qcData.ba_rompharm_date?.toISOString().split('T')[0],
        test_result: qcData.test_result,
        transactionable: qcData.test_result === 'conform',
        comment: qcData.comment,
        confirmed: true,
      };

      if (qcRecord?._id) {
        await api.patch(`/modules/depo_procurement/api/qc-records/${qcRecord._id}`, payload);
      } else {
        await api.post('/modules/depo_procurement/api/qc-records', payload);
      }

      notifications.show({
        title: t('Success'),
        message: qcData.test_result === 'conform' 
          ? t('QC confirmed - Batch is transactionable') 
          : t('QC confirmed - Non-conforming batch'),
        color: qcData.test_result === 'conform' ? 'green' : 'orange',
      });

      fetchQCRecord();
    } catch (error: any) {
      console.error('Failed to confirm QC:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to confirm QC'),
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!stockItem) {
    return (
      <Container size="xl">
        <LoadingOverlay visible />
      </Container>
    );
  }

  const isQCConfirmed = qcRecord?.confirmed || false;

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Group>
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(-1)}
          >
            {t('Back')}
          </Button>
          <Title order={2}>
            {t('Stock Item')}: {stockItem.part_detail?.name || stockItem.part_id}
          </Title>
        </Group>
      </Group>

      <Paper p="md" pos="relative" mb="md">
        <LoadingOverlay visible={loading} />
        
        <Title order={4} mb="md">{t('Stock Information')}</Title>
        
        <Grid>
          {/* Article */}
          <Grid.Col span={6}>
            <TextInput
              label={t('Article')}
              value={stockItem.part_detail?.name || stockItem.part_id}
              readOnly
              disabled
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput
              label={t('IPN')}
              value={stockItem.part_detail?.ipn || '-'}
              readOnly
              disabled
            />
          </Grid.Col>

          {/* Quantity & Location */}
          <Grid.Col span={6}>
            <NumberInput
              label={t('Quantity')}
              value={stockItem.quantity}
              readOnly
              disabled
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput
              label={t('Location')}
              value={stockItem.location_detail?.name || stockItem.location_id}
              readOnly
              disabled
            />
          </Grid.Col>

          {/* Batch Codes */}
          <Grid.Col span={6}>
            <TextInput
              label={t('Batch Code')}
              value={stockItem.batch_code || '-'}
              readOnly
              disabled
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput
              label={t('Supplier Batch Code')}
              value={stockItem.supplier_batch_code || '-'}
              readOnly
              disabled
            />
          </Grid.Col>

          {/* Dates */}
          {stockItem.manufacturing_date && (
            <Grid.Col span={6}>
              <TextInput
                label={t('Manufacturing Date')}
                value={new Date(stockItem.manufacturing_date).toLocaleDateString()}
                readOnly
                disabled
              />
            </Grid.Col>
          )}

          {stockItem.expiry_date && (
            <Grid.Col span={6}>
              <TextInput
                label={t('Expiry Date')}
                value={new Date(stockItem.expiry_date).toLocaleDateString()}
                readOnly
                disabled
              />
            </Grid.Col>
          )}

          {stockItem.reset_date && (
            <Grid.Col span={6}>
              <TextInput
                label={t('Reset Date')}
                value={new Date(stockItem.reset_date).toLocaleDateString()}
                readOnly
                disabled
              />
            </Grid.Col>
          )}

          {/* Status */}
          <Grid.Col span={6}>
            <Text size="sm" fw={500} mb={4}>{t('Status')}</Text>
            <Badge size="lg" color={stockItem.status === 'OK' ? 'green' : 'yellow'}>
              {stockItem.status_detail || stockItem.status}
            </Badge>
          </Grid.Col>

          {/* Supplier */}
          {stockItem.supplier_detail && (
            <Grid.Col span={6}>
              <TextInput
                label={t('Supplier')}
                value={stockItem.supplier_detail.name}
                readOnly
                disabled
              />
            </Grid.Col>
          )}

          {/* Notes */}
          {stockItem.notes && (
            <Grid.Col span={12}>
              <Textarea
                label={t('Notes')}
                value={stockItem.notes}
                readOnly
                disabled
                minRows={2}
              />
            </Grid.Col>
          )}
        </Grid>
      </Paper>

      {/* QC Section - Editable */}
      <Paper p="md" pos="relative">
        <LoadingOverlay visible={submitting} />
        
        <Group justify="space-between" mb="md">
          <Title order={4}>{t('Quality Control')}</Title>
          {isQCConfirmed && (
            <Badge size="lg" color="green">{t('Confirmed')}</Badge>
          )}
        </Group>

        <Grid>
          {/* Prelevation Date & Quantity */}
          <Grid.Col span={6}>
            <DateInput
              label={t('Prelevation Date')}
              placeholder={t('Select date')}
              value={qcData.prelevation_date}
              onChange={(date) => setQcData({ ...qcData, prelevation_date: date })}
              disabled={isQCConfirmed}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <NumberInput
              label={t('Prelevated Quantity')}
              placeholder="0"
              value={qcData.prelevated_quantity}
              onChange={(value) => setQcData({ ...qcData, prelevated_quantity: Number(value) || 0 })}
              min={0}
              step={1}
              disabled={isQCConfirmed}
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
              disabled={isQCConfirmed}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <DateInput
              label={t('Date BA Rompharm')}
              placeholder={t('Select date')}
              value={qcData.ba_rompharm_date}
              onChange={(date) => setQcData({ ...qcData, ba_rompharm_date: date })}
              required
              disabled={isQCConfirmed}
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
              disabled={isQCConfirmed}
            />
          </Grid.Col>

          {/* Transactionable Checkbox */}
          <Grid.Col span={12}>
            <Checkbox
              label={t('Transactionable (În carantină tranzacționabil)')}
              checked={qcData.transactionable}
              onChange={(e) => setQcData({ ...qcData, transactionable: e.currentTarget.checked })}
              disabled={isQCConfirmed}
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
              disabled={isQCConfirmed}
            />
          </Grid.Col>
        </Grid>

        {!isQCConfirmed && (
          <Group justify="flex-end" mt="md" gap="sm">
            <Button 
              onClick={handleSaveQC} 
              loading={submitting}
            >
              {t('Save QC Data')}
            </Button>
            {qcData.ba_rompharm_no && qcData.ba_rompharm_date && qcData.test_result && (
              <Button 
                onClick={handleConfirmQC} 
                loading={submitting}
                color="green"
                leftSection={<IconCheck size={16} />}
              >
                {t('Confirm QC')}
              </Button>
            )}
          </Group>
        )}
      </Paper>
    </Container>
  );
}
