import { useState, useEffect, Fragment } from 'react';
import { Paper, Title, Table, Group, Badge, ActionIcon, Text, TextInput, Select, LoadingOverlay, Box } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconEye, IconSearch, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { requestsApi } from '../services/requests';
import { notifications } from '@mantine/notifications';
import { formatDate } from '../utils/dateFormat';
import { debounce } from '../utils/selectHelpers';

interface RelatedRequest {
  _id: string;
  reference: string;
  created_at?: string;
  issue_date?: string;
  state_name?: string;
  open?: boolean;
}

interface BuildOrder {
  _id: string;
  batch_code: string;
  location_name?: string;
  product_name?: string;
  product_ipn?: string;
  state_name?: string;
  campaign?: boolean;
  created_at?: string;
  requests?: RelatedRequest[];
}

export function BuildOrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [buildOrders, setBuildOrders] = useState<BuildOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadStates();
  }, []);

  useEffect(() => {
    const isDateRangeValid =
      (dateRange[0] === null && dateRange[1] === null) ||
      (dateRange[0] !== null && dateRange[1] !== null);

    if (isDateRangeValid) {
      loadBuildOrders();
    }
  }, [search, statusFilter, dateRange]);

  const debouncedSearch = debounce((value: string) => {
    setSearch(value);
  }, 300);

  const loadBuildOrders = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.state_id = statusFilter;
      if (dateRange[0]) params.date_from = dateRange[0].toISOString().split('T')[0];
      if (dateRange[1]) params.date_to = dateRange[1].toISOString().split('T')[0];

      const response = await api.get(requestsApi.getBuildOrders(), { params });
      setBuildOrders(response.data.results || []);
    } catch (error) {
      console.error('Failed to load build orders:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load build orders'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStates = async () => {
    try {
      const response = await api.get(requestsApi.getBuildOrderStates());
      setStates(response.data.results || []);
    } catch (error) {
      console.error('Failed to load build order states:', error);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'gray';
    const normalized = status.toLowerCase();
    if (normalized.includes('pending')) return 'gray';
    if (normalized.includes('approved') || normalized.includes('done') || normalized.includes('signed')) return 'green';
    if (normalized.includes('refused') || normalized.includes('failed')) return 'red';
    if (normalized.includes('canceled')) return 'orange';
    return 'blue';
  };

  const getRequestDate = (request: RelatedRequest) => {
    return request.issue_date || request.created_at || '';
  };

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Build orders')}</Title>
      </Group>

      <Paper p="md" mb="md">
        <Group>
          <TextInput
            placeholder={t('Search by batch, product, location...')}
            leftSection={<IconSearch size={16} />}
            value={searchInput}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setSearchInput(value);
              debouncedSearch(value);
            }}
            style={{ flex: 1 }}
          />
          <Select
            placeholder={t('Any status')}
            data={[
              { value: '', label: t('Any status') },
              ...states.map(state => ({ value: state._id, label: state.name }))
            ]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || '')}
            searchable
            clearable
            style={{ minWidth: '180px' }}
          />
          <DatePickerInput
            type="range"
            placeholder={t('Date range')}
            value={dateRange}
            onChange={setDateRange}
            clearable
            style={{ minWidth: '220px' }}
          />
        </Group>
      </Paper>

      <Paper p="md" pos="relative">
        <LoadingOverlay visible={loading} />
        {!loading && buildOrders.length === 0 ? (
          <Text size="sm" c="dimmed">{t('No build orders found')}</Text>
        ) : (
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Batch Code')}</Table.Th>
                <Table.Th>{t('Location')}</Table.Th>
                <Table.Th>{t('Product')}</Table.Th>
                <Table.Th>{t('Status')}</Table.Th>
                <Table.Th>{t('Campaign')}</Table.Th>
                <Table.Th>{t('Created')}</Table.Th>
                <Table.Th style={{ width: '80px' }}>{t('Action')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {buildOrders.map((order) => {
                const isExpanded = !!expandedRows[order._id];
                const hasRequests = (order.requests || []).length > 0;
                return (
                  <Fragment key={order._id}>
                    <Table.Tr key={order._id} style={{ cursor: 'pointer' }}>
                      <Table.Td onClick={() => toggleRow(order._id)}>
                        <Group gap="xs">
                          <ActionIcon size="sm" variant="subtle" onClick={() => toggleRow(order._id)}>
                            {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                          </ActionIcon>
                          <Text>{order.batch_code}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td onClick={() => toggleRow(order._id)}>
                        {order.location_name || '-'}
                      </Table.Td>
                      <Table.Td onClick={() => toggleRow(order._id)}>
                        {order.product_name ? (
                          <Box>
                            <Text size="sm">{order.product_name}</Text>
                            <Text size="xs" c="dimmed">{order.product_ipn}</Text>
                          </Box>
                        ) : (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td onClick={() => toggleRow(order._id)}>
                        <Badge color={getStatusColor(order.state_name)}>{order.state_name || '-'}</Badge>
                      </Table.Td>
                      <Table.Td onClick={() => toggleRow(order._id)}>
                        <Badge color={order.campaign ? 'blue' : 'gray'}>
                          {order.campaign ? t('Yes') : t('No')}
                        </Badge>
                      </Table.Td>
                      <Table.Td onClick={() => toggleRow(order._id)}>
                        {formatDate(order.created_at || '')}
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => navigate(`/build-orders/${order._id}`)}
                          title={t('View')}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                    {isExpanded && hasRequests && (
                      <Table.Tr key={`${order._id}-requests`}>
                        <Table.Td colSpan={7}>
                          <Table striped withTableBorder>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>{t('Request')}</Table.Th>
                                <Table.Th>{t('Date')}</Table.Th>
                                <Table.Th>{t('Status')}</Table.Th>
                                <Table.Th>{t('Open')}</Table.Th>
                                <Table.Th style={{ width: '80px' }}>{t('Action')}</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {(order.requests || []).map((req) => (
                                <Table.Tr key={req._id}>
                                  <Table.Td>{req.reference}</Table.Td>
                                  <Table.Td>{formatDate(getRequestDate(req))}</Table.Td>
                                  <Table.Td>
                                    <Badge color={getStatusColor(req.state_name)}>{req.state_name || '-'}</Badge>
                                  </Table.Td>
                                  <Table.Td>
                                    {typeof req.open === 'boolean' ? (req.open ? t('Yes') : t('No')) : '-'}
                                  </Table.Td>
                                  <Table.Td>
                                    <ActionIcon
                                      variant="subtle"
                                      color="blue"
                                      onClick={() => window.open(`/web/requests/${req._id}`, '_blank')}
                                      title={t('View')}
                                    >
                                      <IconEye size={16} />
                                    </ActionIcon>
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Fragment>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Paper>
  );
}
