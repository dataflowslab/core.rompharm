import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Stack,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../../../src/frontend/src/services/api';
import { formatDate } from '../../../../src/frontend/src/utils/dateFormat';

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
  supplier_batch_code?: string;
  quantity: number;
  received_date?: string;
}

interface Location {
  _id: string;
  name: string;
}

interface StockState {
  _id: string;
  name: string;
  value: number;
  color: string;
}

// LocalStorage key for filters
const FILTERS_STORAGE_KEY = 'stocks_filters';
const FILTERS_EXPIRY_HOURS = 9;

interface StoredFilters {
  search: string;
  locationFilter: string;
  statusFilter: string;
  dateRange: [string | null, string | null];
  timestamp: number;
}

export function StocksPage() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters state
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  
  // Options
  const [locations, setLocations] = useState<Location[]>([]);
  const [stockStates, setStockStates] = useState<StockState[]>([]);

  // Load filters from localStorage on mount
  useEffect(() => {
    loadFiltersFromStorage();
    fetchLocations();
    fetchStockStates();
  }, []);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    saveFiltersToStorage();
  }, [search, locationFilter, statusFilter, dateRange]);

  // Fetch stocks when filters change
  // Only fetch if date range is complete (both dates selected) or empty
  useEffect(() => {
    const isDateRangeValid = 
      (dateRange[0] === null && dateRange[1] === null) || // No date range selected
      (dateRange[0] !== null && dateRange[1] !== null);   // Both dates selected
    
    if (isDateRangeValid) {
      fetchStocks();
    }
  }, [search, locationFilter, statusFilter, dateRange]);

  const loadFiltersFromStorage = () => {
    try {
      const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (stored) {
        const filters: StoredFilters = JSON.parse(stored);
        
        // Check if filters are still valid (within 9 hours)
        const now = Date.now();
        const expiryTime = filters.timestamp + (FILTERS_EXPIRY_HOURS * 60 * 60 * 1000);
        
        if (now < expiryTime) {
          setSearch(filters.search || '');
          setLocationFilter(filters.locationFilter || '');
          setStatusFilter(filters.statusFilter || '');
          
          // Parse date range
          if (filters.dateRange) {
            const [start, end] = filters.dateRange;
            setDateRange([
              start ? new Date(start) : null,
              end ? new Date(end) : null,
            ]);
          }
        } else {
          // Filters expired, clear them
          localStorage.removeItem(FILTERS_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load filters from storage:', error);
    }
  };

  const saveFiltersToStorage = () => {
    try {
      const filters: StoredFilters = {
        search,
        locationFilter,
        statusFilter,
        dateRange: [
          dateRange[0] ? dateRange[0].toISOString() : null,
          dateRange[1] ? dateRange[1].toISOString() : null,
        ],
        timestamp: Date.now(),
      };
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('Failed to save filters to storage:', error);
    }
  };

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Search: batch_code, ipn, supplier_batch_code, supplier_name
      if (search) params.append('search', search);
      
      // Location filter
      if (locationFilter) params.append('location_id', locationFilter);
      
      // Status filter
      if (statusFilter) params.append('state_id', statusFilter);
      
      // Date range filter
      if (dateRange[0]) {
        params.append('start_date', dateRange[0].toISOString().split('T')[0]);
      }
      if (dateRange[1]) {
        params.append('end_date', dateRange[1].toISOString().split('T')[0]);
      }

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

  const fetchStockStates = async () => {
    try {
      const response = await api.get('/modules/inventory/api/stock-states');
      setStockStates(response.data || []);
    } catch (error) {
      console.error('Failed to fetch stock states:', error);
    }
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

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>Stocks</Title>
      </Group>

      <Paper p="md" mb="md">
        <Group>
          <TextInput
            placeholder="Search by batch code, IPN, supplier batch, supplier name..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Any location"
            data={[
              { value: '', label: 'Any location' },
              ...locations.map(l => ({ value: l._id, label: l.name }))
            ]}
            value={locationFilter}
            onChange={(value) => setLocationFilter(value || '')}
            searchable
            clearable
            style={{ minWidth: '180px' }}
          />
          <Select
            placeholder="Any status"
            data={[
              { value: '', label: 'Any status' },
              ...stockStates.map(s => ({ value: s._id, label: s.name }))
            ]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || '')}
            searchable
            clearable
            style={{ minWidth: '180px' }}
          />
          <DatePickerInput
            type="range"
            placeholder="Date range"
            value={dateRange}
            onChange={setDateRange}
            clearable
            style={{ minWidth: '220px' }}
          />
        </Group>
      </Paper>

      <Paper p="md" pos="relative">
        <LoadingOverlay visible={loading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Batch</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Supplier</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Product</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stocks.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
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
                  {/* Batch: Batch Code (bold) + Batch Date (smaller below) */}
                  <Table.Td>
                    <Stack gap={2}>
                      <Text fw={700}>{stock.batch_code || '-'}</Text>
                      <Text size="xs" c="dimmed">
                        {formatDate(stock.batch_date || stock.received_date)}
                      </Text>
                    </Stack>
                  </Table.Td>
                  
                  {/* Status */}
                  <Table.Td>{getStatusBadge(stock)}</Table.Td>
                  
                  {/* Supplier */}
                  <Table.Td>{stock.supplier_name || '-'}</Table.Td>
                  
                  {/* Location */}
                  <Table.Td>{stock.location_detail?.name || '-'}</Table.Td>
                  
                  {/* Quantity */}
                  <Table.Td>
                    {stock.quantity} {stock.part_detail?.um || 'buc'}
                  </Table.Td>
                  
                  {/* Product: Name + IPN in parentheses */}
                  <Table.Td>
                    {stock.part_detail?.name || '-'}
                    {stock.part_detail?.ipn && (
                      <Text span c="dimmed"> ({stock.part_detail.ipn})</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Container>
  );
}
