import { useState } from 'react';
import {
  Grid,
  Paper,
  Title,
  Stack,
  TextInput,
  NumberInput,
  Button,
  Checkbox,
  Textarea,
  Table,
  Text,
  Badge,
  Group,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { formatDate } from '../../utils/dateFormat';

interface QualityControlTabProps {
  stockId: string;
  stock: any;
  onUpdate: () => void;
}

export function QualityControlTab({ stockId, stock, onUpdate }: QualityControlTabProps) {
  const { t } = useTranslation();
  
  // Prelevation form
  const [prelevationDate, setPrelevationDate] = useState<Date | null>(null);
  const [prelevationQuantity, setPrelevationQuantity] = useState<number>(0);
  const [savingPrelevation, setSavingPrelevation] = useState(false);

  // BA Rompharm form
  const [baDate, setBaDate] = useState<Date | null>(null);
  const [baNo, setBaNo] = useState('');
  const [testResult, setTestResult] = useState<'conform' | 'neconform' | ''>('');
  const [transactionable, setTransactionable] = useState(false);
  const [comments, setComments] = useState('');
  const [savingBA, setSavingBA] = useState(false);

  const handleSavePrelevation = async () => {
    if (!prelevationDate || prelevationQuantity <= 0) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        color: 'red',
      });
      return;
    }

    if (prelevationQuantity > stock.quantity) {
      notifications.show({
        title: 'Validation Error',
        message: `Quantity cannot exceed ${stock.quantity}`,
        color: 'red',
      });
      return;
    }

    try {
      setSavingPrelevation(true);
      
      // Create stock movement for prelevation
      await api.post('/modules/inventory/api/stock-movements', {
        stock_id: stockId,
        movement_type: 'prelevation',
        quantity: prelevationQuantity,
        date: prelevationDate.toISOString(),
        notes: 'Quality Control Prelevation',
      });

      notifications.show({
        title: 'Success',
        message: 'Prelevation saved successfully',
        color: 'green',
      });

      // Reset form
      setPrelevationDate(null);
      setPrelevationQuantity(0);
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to save prelevation',
        color: 'red',
      });
    } finally {
      setSavingPrelevation(false);
    }
  };

  const handleSaveBA = async () => {
    if (!baDate || !baNo || !testResult) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        color: 'red',
      });
      return;
    }

    try {
      setSavingBA(true);

      // Determine state_id based on test result
      const stateId = testResult === 'conform' 
        ? '694321db8728e4d75ae72789'  // Conform
        : '694322758728e4d75ae7278f';  // Neconform (Quarantine)

      // Update stock with BA information
      await api.put(`/modules/inventory/api/stocks/${stockId}`, {
        rompharm_ba_no: baNo,
        rompharm_ba_date: baDate.toISOString().split('T')[0],
        state_id: stateId,
        qc_test_result: testResult,
        qc_transactionable: transactionable,
        qc_comments: comments,
      });

      notifications.show({
        title: 'Success',
        message: 'BA Rompharm information saved successfully',
        color: 'green',
      });

      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to save BA information',
        color: 'red',
      });
    } finally {
      setSavingBA(false);
    }
  };

  return (
    <Grid>
      {/* Left Column: Forms */}
      <Grid.Col span={6}>
        <Stack gap="md">
          {/* Prelevation Form */}
          <Paper shadow="xs" p="md" withBorder>
            <Title order={5} mb="md">{t('Prelevation')}</Title>
            <Stack gap="sm">
              <DatePickerInput
                label={t('Date')}
                placeholder={t('Select date')}
                value={prelevationDate}
                onChange={setPrelevationDate}
                required
              />
              <NumberInput
                label={t('Quantity')}
                placeholder="0"
                value={prelevationQuantity}
                onChange={(val) => setPrelevationQuantity(Number(val) || 0)}
                min={0}
                max={stock.quantity}
                step={0.01}
                decimalScale={2}
                required
                description={`Max: ${stock.quantity} ${stock.part_detail?.um || ''}`}
              />
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSavePrelevation}
                loading={savingPrelevation}
                fullWidth
              >
                {t('Save Prelevation')}
              </Button>
            </Stack>
          </Paper>

          {/* BA Rompharm Form */}
          <Paper shadow="xs" p="md" withBorder>
            <Title order={5} mb="md">{t('BA Rompharm')}</Title>
            <Stack gap="sm">
              <DatePickerInput
                label={t('Date')}
                placeholder={t('Select date')}
                value={baDate}
                onChange={setBaDate}
                required
              />
              <TextInput
                label={t('No')}
                placeholder={t('BA Number')}
                value={baNo}
                onChange={(e) => setBaNo(e.currentTarget.value)}
                required
              />
              <TextInput
                label={t('Test Result')}
                placeholder={t('Conform/Neconform')}
                value={testResult}
                onChange={(e) => setTestResult(e.currentTarget.value as any)}
                required
                description={t('Enter "conform" or "neconform"')}
              />
              <Checkbox
                label={t('Transactionable (În carantină tranzacționabil)')}
                checked={transactionable}
                onChange={(e) => setTransactionable(e.currentTarget.checked)}
              />
              <Textarea
                label={t('Comments')}
                placeholder={t('Additional comments')}
                value={comments}
                onChange={(e) => setComments(e.currentTarget.value)}
                minRows={3}
              />
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSaveBA}
                loading={savingBA}
                fullWidth
              >
                {t('Save BA Information')}
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Grid.Col>

      {/* Right Column: Supplier BA Information */}
      <Grid.Col span={6}>
        <Paper shadow="xs" p="md" withBorder>
          <Title order={5} mb="md">{t('Supplier BA Information')}</Title>
          <Table>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={500}>{t('Supplier BA No')}</Table.Td>
                <Table.Td>{stock.supplier_ba_no || '-'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>{t('Supplier BA Date')}</Table.Td>
                <Table.Td>{formatDate(stock.supplier_ba_date)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>{t('In Accordance with Supplier BA')}</Table.Td>
                <Table.Td>
                  {stock.accord_ba !== undefined ? (
                    <Badge color={stock.accord_ba ? 'green' : 'red'}>
                      {stock.accord_ba ? t('Yes') : t('No')}
                    </Badge>
                  ) : '-'}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>{t('Is List Supplier')}</Table.Td>
                <Table.Td>
                  {stock.is_list_supplier !== undefined ? (
                    <Badge color={stock.is_list_supplier ? 'green' : 'gray'}>
                      {stock.is_list_supplier ? t('Yes') : t('No')}
                    </Badge>
                  ) : '-'}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>{t('Clean Transport')}</Table.Td>
                <Table.Td>
                  {stock.clean_transport !== undefined ? (
                    <Badge color={stock.clean_transport ? 'green' : 'red'}>
                      {stock.clean_transport ? t('Yes') : t('No')}
                    </Badge>
                  ) : '-'}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>{t('Temperature Control')}</Table.Td>
                <Table.Td>
                  {stock.temperature_control !== undefined ? (
                    <Badge color={stock.temperature_control ? 'green' : 'gray'}>
                      {stock.temperature_control ? t('Yes') : t('No')}
                    </Badge>
                  ) : '-'}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>{t('Temperature Conditions Met')}</Table.Td>
                <Table.Td>
                  {stock.temperature_conditions_met !== undefined ? (
                    <Badge color={stock.temperature_conditions_met ? 'green' : 'red'}>
                      {stock.temperature_conditions_met ? t('Yes') : t('No')}
                    </Badge>
                  ) : '-'}
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}
