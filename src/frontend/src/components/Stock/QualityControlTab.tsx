import { useState, useEffect } from 'react';
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
  Select,
  ActionIcon,
  Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconDeviceFloppy, IconSignature, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { formatDate, formatDateTime } from '../../utils/dateFormat';

interface QualityControlTabProps {
  stockId: string;
  stock: any;
  onUpdate: () => void;
}

interface ApprovalFlow {
  _id: string;
  signatures: Array<{
    user_id: string;
    username: string;
    user_name?: string;
    signed_at: string;
    signature_hash: string;
  }>;
  status: string;
  required_officers: any[];
  optional_officers: any[];
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
  const [signing, setSigning] = useState(false);

  // QA Rompharm form
  const [qaDate, setQaDate] = useState<Date | null>(null);
  const [qaNo, setQaNo] = useState('');
  const [qaTestResult, setQaTestResult] = useState<'conform' | 'neconform' | ''>('');
  const [qaReason, setQaReason] = useState('');
  const [signingQA, setSigningQA] = useState(false);

  // Transactionable
  const [transactionable, setTransactionable] = useState(false);
  const [savingTransactionable, setSavingTransactionable] = useState(false);

  // Approval flow
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlow | null>(null);
  const [loadingFlow, setLoadingFlow] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    loadApprovalFlow();
    loadCurrentUser();

    // Load transactionable status from stock
    if (stock.transactionable !== undefined) {
      setTransactionable(stock.transactionable);
    }

    // Check if stock state is Quarantined Transactionable
    if (stock.state_id === '694322878728e4d75ae72790') {
      setTransactionable(true);
    }
  }, [stockId, stock]);

  const loadCurrentUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setCurrentUserId(response.data._id);
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  };

  const loadApprovalFlow = async () => {
    setLoadingFlow(true);
    try {
      const response = await api.get(`/modules/inventory/api/stocks/${stockId}/approval-flow`);
      setApprovalFlow(response.data.flow);
    } catch (error) {
      console.error('Failed to load approval flow:', error);
    } finally {
      setLoadingFlow(false);
    }
  };

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

  const handleSignBA = async () => {
    if (!baDate || !baNo || !testResult) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        color: 'red',
      });
      return;
    }

    try {
      setSigning(true);

      // Sign BA Rompharm
      await api.post(`/modules/inventory/api/stocks/${stockId}/sign`, {
        rompharm_ba_no: baNo,
        rompharm_ba_date: baDate.toISOString().split('T')[0],
        test_result: testResult,
      });

      notifications.show({
        title: 'Success',
        message: 'BA Rompharm signed successfully',
        color: 'green',
      });

      // Reset form
      setBaDate(null);
      setBaNo('');
      setTestResult('');

      // Reload approval flow and stock
      await loadApprovalFlow();
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to sign BA Rompharm',
        color: 'red',
      });
    } finally {
      setSigning(false);
    }
  };

  const handleRemoveSignature = (userId: string, username: string) => {
    modals.openConfirmModal({
      title: 'Remove Signature',
      children: (
        <Text size="sm">
          Are you sure you want to remove the signature from <strong>{username}</strong>?
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(`/modules/inventory/api/stocks/${stockId}/signatures/${userId}`);
          notifications.show({
            title: 'Success',
            message: 'Signature removed successfully',
            color: 'green',
          });
          await loadApprovalFlow();
          onUpdate();
        } catch (error: any) {
          notifications.show({
            title: 'Error',
            message: error.response?.data?.detail || 'Failed to remove signature',
            color: 'red',
          });
        }
      },
    });
  };

  const handleSignQA = async () => {
    if (!qaDate || !qaNo || !qaTestResult) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required fields (Date, No, Result)',
        color: 'red',
      });
      return;
    }

    if (qaTestResult === 'neconform' && !qaReason) {
      notifications.show({
        title: 'Validation Error',
        message: 'Reason is required for Non-conforming result',
        color: 'red',
      });
      return;
    }

    try {
      setSigningQA(true);

      await api.post(`/modules/inventory/api/stocks/${stockId}/sign-qa`, {
        qa_rompharm_ba_no: qaNo,
        qa_rompharm_ba_date: qaDate.toISOString().split('T')[0],
        qa_test_result: qaTestResult,
        qa_reason: qaReason,
      });

      notifications.show({
        title: 'Success',
        message: 'QA Rompharm signed successfully',
        color: 'green',
      });

      // Reset form
      setQaDate(null);
      setQaNo('');
      setQaTestResult('');
      setQaReason('');

      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to sign QA Rompharm',
        color: 'red',
      });
    } finally {
      setSigningQA(false);
    }
  };

  const handleRemoveQASignature = () => {
    modals.openConfirmModal({
      title: 'Remove QA Signature',
      children: (
        <Text size="sm">
          Are you sure you want to remove the QA signature? This will revert the decision.
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          // Use current user ID for the endpoint path parameter requirement, 
          // although specific implementation might just check current user from token.
          // The route asks for {user_id} in path.
          await api.delete(`/modules/inventory/api/stocks/${stockId}/signatures-qa/${currentUserId}`);
          notifications.show({
            title: 'Success',
            message: 'QA Signature removed successfully',
            color: 'green',
          });
          onUpdate();
        } catch (error: any) {
          notifications.show({
            title: 'Error',
            message: error.response?.data?.detail || 'Failed to remove signature',
            color: 'red',
          });
        }
      },
    });
  };

  const handleSaveTransactionable = async () => {
    try {
      setSavingTransactionable(true);

      await api.put(`/modules/inventory/api/stocks/${stockId}/transactionable`, {
        transactionable: transactionable,
      });

      notifications.show({
        title: 'Success',
        message: 'Transactionable status updated successfully',
        color: 'green',
      });

      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to update transactionable status',
        color: 'red',
      });
    } finally {
      setSavingTransactionable(false);
    }
  };

  const hasSignatures = approvalFlow && approvalFlow.signatures && approvalFlow.signatures.length > 0;
  const isApproved = approvalFlow && approvalFlow.status === 'approved';
  const isQuarantinedTransactionable = stock.state_id === '694322878728e4d75ae72790';

  // Show transactionable checkbox only if:
  // 1. Not signed yet (no signatures), OR
  // 2. Has Quarantined Transactionable state
  const showTransactionable = !hasSignatures || isQuarantinedTransactionable;

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

          {/* Transactionable Checkbox - Only show if not signed OR has transactionable state */}
          {showTransactionable && (
            <Paper shadow="xs" p="md" withBorder>
              <Stack gap="sm">
                <Checkbox
                  label={t('Transactionable (În carantină tranzacționabil)')}
                  checked={transactionable}
                  onChange={(e) => setTransactionable(e.currentTarget.checked)}
                />
                <Button
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSaveTransactionable}
                  loading={savingTransactionable}
                  fullWidth
                  variant="light"
                >
                  {t('Save Transactionable Status')}
                </Button>
              </Stack>
            </Paper>
          )}

          {/* BA Rompharm Form - Only show if not signed */}
          {!hasSignatures && (
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
                <Select
                  label={t('Test Result')}
                  placeholder={t('Select result')}
                  value={testResult}
                  onChange={(value) => setTestResult(value as 'conform' | 'neconform' | '')}
                  data={[
                    { value: 'conform', label: t('Conform') },
                    { value: 'neconform', label: t('Neconform') }
                  ]}
                  required
                  clearable
                />
                <Button
                  leftSection={<IconSignature size={16} />}
                  onClick={handleSignBA}
                  loading={signing}
                  fullWidth
                  color="blue"
                >
                  {t('Sign BA Rompharm')}
                </Button>
              </Stack>
            </Paper>
          )}

          {/* BA Rompharm Data - Show if signed */}
          {hasSignatures && stock.rompharm_ba_no && (
            <Paper shadow="xs" p="md" withBorder>
              <Title order={5} mb="md">{t('BA Rompharm Information')}</Title>
              <Table>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td fw={500}>{t('BA No')}</Table.Td>
                    <Table.Td>{stock.rompharm_ba_no}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td fw={500}>{t('BA Date')}</Table.Td>
                    <Table.Td>{formatDate(stock.rompharm_ba_date)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td fw={500}>{t('Test Result')}</Table.Td>
                    <Table.Td>
                      <Badge color={stock.test_result === 'conform' ? 'green' : 'red'}>
                        {stock.test_result === 'conform' ? t('Conform') : t('Neconform')}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          {/* Signatures Table */}
          {hasSignatures && (
            <Paper shadow="xs" p="md" withBorder>
              <Title order={5} mb="md">{t('Signatures')}</Title>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('User')}</Table.Th>
                    <Table.Th>{t('Signed At')}</Table.Th>
                    <Table.Th>{t('Actions')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {approvalFlow.signatures.map((sig) => (
                    <Table.Tr key={sig.user_id}>
                      <Table.Td>{sig.user_name || sig.username}</Table.Td>
                      <Table.Td>{formatDateTime(sig.signed_at)}</Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => handleRemoveSignature(sig.user_id, sig.user_name || sig.username)}
                          title={t('Remove signature')}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
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

        {/* QA Rompharm Section */}
        <Stack mt="md">
          {/* Form - Only show if not signed */}
          {!stock.qa_signed_at && (
            <Paper shadow="xs" p="md" withBorder>
              <Title order={5} mb="md">{t('QA Rompharm')}</Title>
              <Stack gap="sm">
                <DatePickerInput
                  label={t('Date')}
                  placeholder={t('Select date')}
                  value={qaDate}
                  onChange={setQaDate}
                  required
                />
                <TextInput
                  label={t('No')}
                  placeholder={t('QA Number')}
                  value={qaNo}
                  onChange={(e) => setQaNo(e.currentTarget.value)}
                  required
                />
                <Select
                  label={t('Result')}
                  placeholder={t('Select result')}
                  value={qaTestResult}
                  onChange={(value) => setQaTestResult(value as 'conform' | 'neconform' | '')}
                  data={[
                    { value: 'conform', label: t('Conform') },
                    { value: 'neconform', label: t('Neconform') }
                  ]}
                  required
                />

                {qaTestResult === 'neconform' && (
                  <Textarea
                    label={t('Reason')}
                    placeholder={t('Enter reason for non-conformity')}
                    value={qaReason}
                    onChange={(e) => setQaReason(e.currentTarget.value)}
                    required
                    minRows={3}
                  />
                )}

                <Button
                  leftSection={<IconSignature size={16} />}
                  onClick={handleSignQA}
                  loading={signingQA}
                  fullWidth
                  color="blue"
                  disabled={!hasSignatures} // Optional implicitly: Should QA wait for BA? Assuming Yes.
                >
                  {t('Sign QA Rompharm')}
                </Button>
                {!hasSignatures && (
                  <Text size="xs" c="red" ta="center">
                    {t('BA Rompharm must be signed first')}
                  </Text>
                )}
              </Stack>
            </Paper>
          )}

          {/* QA Info - Show if signed */}
          {stock.qa_signed_at && (
            <Paper shadow="xs" p="md" withBorder>
              <Group justify="space-between" mb="md">
                <Title order={5}>{t('QA Rompharm Information')}</Title>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={handleRemoveQASignature}
                  title={t('Remove signature')}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
              <Table>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td fw={500}>{t('QA No')}</Table.Td>
                    <Table.Td>{stock.qa_rompharm_ba_no}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td fw={500}>{t('QA Date')}</Table.Td>
                    <Table.Td>{formatDate(stock.qa_rompharm_ba_date)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td fw={500}>{t('Result')}</Table.Td>
                    <Table.Td>
                      <Badge color={stock.qa_test_result === 'conform' ? 'green' : 'red'}>
                        {stock.qa_test_result === 'conform' ? t('Conform') : t('Neconform')}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                  {stock.qa_reason && (
                    <Table.Tr>
                      <Table.Td fw={500}>{t('Reason')}</Table.Td>
                      <Table.Td>{stock.qa_reason}</Table.Td>
                    </Table.Tr>
                  )}
                  <Table.Tr>
                    <Table.Td fw={500}>{t('Signed By')}</Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm">{stock.qa_signed_by}</Text>
                        <Text size="xs" c="dimmed">{formatDateTime(stock.qa_signed_at)}</Text>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
