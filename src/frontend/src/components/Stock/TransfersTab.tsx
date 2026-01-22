import { useState, useEffect } from 'react';
import {
  Paper,
  Title,
  Table,
  Text,
  LoadingOverlay,
  Group,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { formatDateTime } from '../../utils/dateFormat';

interface Movement {
  _id: string;
  stock_id: string;
  movement_type: string;
  quantity: number;
  date: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

interface TransfersTabProps {
  stockId: string;
}

export function TransfersTab({ stockId }: TransfersTabProps) {
  const { t } = useTranslation();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

  useEffect(() => {
    fetchMovements();
  }, [stockId, dateRange]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('stock_id', stockId);
      
      if (dateRange[0]) {
        params.append('start_date', dateRange[0].toISOString().split('T')[0]);
      }
      if (dateRange[1]) {
        params.append('end_date', dateRange[1].toISOString().split('T')[0]);
      }

      const response = await api.get(`/modules/inventory/api/stock-movements?${params.toString()}`);
      setMovements(response.data.results || response.data || []);
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to load movements',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper shadow="xs" p="md" withBorder pos="relative">
      <LoadingOverlay visible={loading} />
      
      <Group justify="space-between" mb="md">
        <Title order={4}>{t('Stock Movements')}</Title>
        <DatePickerInput
          type="range"
          placeholder={t('Select date range')}
          value={dateRange}
          onChange={setDateRange}
          clearable
          style={{ width: 300 }}
        />
      </Group>

      {movements.length === 0 && !loading ? (
        <Text c="dimmed" ta="center" py="xl">
          {t('No movements found')}
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Date')}</Table.Th>
              <Table.Th>{t('Type')}</Table.Th>
              <Table.Th>{t('Quantity')}</Table.Th>
              <Table.Th>{t('Notes')}</Table.Th>
              <Table.Th>{t('Created By')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {movements.map((movement) => (
              <Table.Tr key={movement._id}>
                <Table.Td>{formatDateTime(movement.date)}</Table.Td>
                <Table.Td>{movement.movement_type}</Table.Td>
                <Table.Td>{movement.quantity}</Table.Td>
                <Table.Td>{movement.notes || '-'}</Table.Td>
                <Table.Td>{movement.created_by || '-'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
