import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Select,
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
  status_detail?: {
    name: string;
    value: number;
    color: string;
  };
  location_detail?: {
    name: string;
  };
  stock_value: number;
  supplier_name?: string;
  quantity: number;
  received_date?: string;
}

interface Location {
  _id: string;
  name: string;
}

export function StocksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>(searchParams.get('location') || '');
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    fetchStocks();
    fetchLocations();
  }, [search, locationFilter]);

  // Update location filter from URL params
  useEffect(() => {
    const locationParam = searchParams.get('location');
    if (locationParam) {
      setLocationFilter(locationParam);
    }
  }, [searchParams]);

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (locationFilter) params.append('location', locationFilter);

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

  const fetchLocations = async () => {
    try {
      const response = await api.get('/modules/inventory/api/locations');
      setLocations(response.data || []);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const handleLocationFilterChange = (value: string | null) => {
    const newValue = value || '';
    setLocationFilter(newValue);
    
    // Update URL params
    if (newValue) {
      setSearchParams({ location: newValue });
    } else {
      setSearchParams({});
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (stock: Stock) => {
    if (stock.status_detail) {
      return (
        <Badge
          style={{
            backgroundColor: stock.status_detail.color || '#gray',
            color: '#fff',
          }}
        >
          {stock.status_detail.name}
        </Badge>
      );
    }
    return <Badge color="gray">{stock.status}</Badge>;
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
        <Group>
          <TextInput
            placeholder="Search stocks..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Location filter"
            data={[
              { value: '', label: 'All Locations' },
              ...locations.map(l => ({ value: l._id, label: l.name }))
            ]}
            value={locationFilter}
            onChange={handleLocationFilterChange}
            searchable
            clearable
            style={{ minWidth: '200px' }}
          />
        </Group>
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
              <Table.Th>Supplier</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stocks.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text ta="center" c="dimmed">
                    No stocks found
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              stocks.map((stock) => (
                <Table.Tr
                  key={stock._id}
                  onClick={() => navigate(`/inventory/stocks/${stock._id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <Table.Td>{stock.batch_code || '-'}</Table.Td>
                  <Table.Td>{formatDate(stock.batch_date || stock.received_date)}</Table.Td>
                  <Table.Td>{stock.part_detail?.name || '-'}</Table.Td>
                  <Table.Td>{stock.part_detail?.ipn || '-'}</Table.Td>
                  <Table.Td>{getStatusBadge(stock)}</Table.Td>
                  <Table.Td>{stock.location_detail?.name || '-'}</Table.Td>
                  <Table.Td>
                    {stock.quantity} {stock.part_detail?.um || 'buc'}
                  </Table.Td>
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
