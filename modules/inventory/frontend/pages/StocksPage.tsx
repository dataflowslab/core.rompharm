import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Table,
  Group,
  TextInput,
  LoadingOverlay,
  Badge,
  Text,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../../../src/frontend/src/services/api';

interface Stock {
  _id: string;
  batch_code: string;
  batch_date?: string;
  part_detail?: {
    name: string;
    ipn: string;
    um: string;
  };
  status: string;
  location_detail?: {
    name: string;
  };
  stock_value: number;
  supplier_name?: string;
  quantity: number;
  received_date?: string;
}

export function StocksPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchStocks();
  }, [search]);

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await api.get(`/modules/inventory/api/stocks?${params.toString()}`);
      setStocks(response.data.results || []);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch stocks',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      'OK': { color: 'green', label: 'OK' },
      'Quarantine': { color: 'yellow', label: 'Quarantine' },
      'Attention': { color: 'orange', label: 'Attention' },
      'Damaged': { color: 'red', label: 'Damaged' },
      'Destroyed': { color: 'red', label: 'Destroyed' },
      'Rejected': { color: 'red', label: 'Rejected' },
      'Lost': { color: 'gray', label: 'Lost' },
      'Returned': { color: 'blue', label: 'Returned' },
    };

    const statusInfo = statusMap[status] || { color: 'gray', label: status };
    return <Badge color={statusInfo.color}>{statusInfo.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>Stocks</Title>
      </Group>

      <Paper p="md" mb="md">
        <TextInput
          placeholder="Search stocks..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
      </Paper>

      <Paper p="md" pos="relative">
        <LoadingOverlay visible={loading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Batch Code</Table.Th>
              <Table.Th>Batch Date</Table.Th>
              <Table.Th>Product</Table.Th>
              <Table.Th>IPN</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Stock Value</Table.Th>
              <Table.Th>Supplier</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stocks.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text ta="center" c="dimmed">
                    No stocks found
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              stocks.map((stock) => (
                <Table.Tr key={stock._id}>
                  <Table.Td>{stock.batch_code || '-'}</Table.Td>
                  <Table.Td>{formatDate(stock.batch_date || stock.received_date)}</Table.Td>
                  <Table.Td>{stock.part_detail?.name || '-'}</Table.Td>
                  <Table.Td>{stock.part_detail?.ipn || '-'}</Table.Td>
                  <Table.Td>{getStatusBadge(stock.status)}</Table.Td>
                  <Table.Td>{stock.location_detail?.name || '-'}</Table.Td>
                  <Table.Td>
                    {stock.quantity} {stock.part_detail?.um || 'buc'}
                  </Table.Td>
                  <Table.Td>{formatCurrency(stock.stock_value)}</Table.Td>
                  <Table.Td>{stock.supplier_name || '-'}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Container>
  );
}
