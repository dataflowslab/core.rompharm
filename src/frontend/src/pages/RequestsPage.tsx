import { useState, useEffect, useMemo } from 'react';
import { Paper, Title, Table, Button, Group, Modal, Grid, Select, NumberInput, Textarea, Badge, ActionIcon, Text, TextInput, LoadingOverlay } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus, IconEye, IconTrash, IconSearch, IconChevronUp, IconChevronDown } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../services/api';
import { requestsApi } from '../services/requests';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../context/AuthContext';
import { ComponentsTable } from '../components/Requests/ComponentsTable';
import { BatchCodesTable } from '../components/Requests/BatchCodesTable';
import { debounce } from '../utils/selectHelpers';
import { sanitizeSelectOptions } from '../utils/selectHelpers';
import { formatDate } from '../utils/dateFormat';

interface StockLocation {
  _id: string;
  name: string;
}

interface Part {
  _id: string;
  name: string;
  IPN: string;
}

interface BatchOption {
  batch_code: string;
  quantity: number;
  location_name: string;
  location_id: string;
  location_parent_name?: string;
  location_parent_id?: string;
  state_name: string;
  state_id: string;
  state_color?: string;
  expiry_date?: string;
  is_transferable?: boolean;
  is_requestable?: boolean;
  is_transactionable?: boolean;
}

interface BatchSelection {
  batch_code: string;
  location_id: string;
  requested_quantity: number;
}


interface RequestItem {
  part: string;
  quantity: number;
  location_id?: string;
  part_detail?: {
    name: string;
    IPN: string;
  };
}

interface Request {
  _id: string;
  reference: string;
  source: number;
  destination: number;
  source_name?: string;
  destination_name?: string;
  line_items: number;
  status: string;
  issue_date: string;
  created_at: string;
  labels?: string[];
  items?: RequestItem[];
  product_detail?: {
    name: string;
    IPN: string;
  };
  open?: boolean;
}

type SortKey = 'reference' | 'source' | 'destination' | 'line_items' | 'product' | 'status' | 'issue_date';

export function RequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { locations: userLocations } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedPartData, setSelectedPartData] = useState<Part | null>(null);
  const [partSearch, setPartSearch] = useState('');
  const [stockInfo, setStockInfo] = useState<any>(null);
  const [recipeData, setRecipeData] = useState<any>(null);
  const [componentsData, setComponentsData] = useState<any[]>([]);
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);
  const [batchSelections, setBatchSelections] = useState<BatchSelection[]>([]);

  const [states, setStates] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'issue_date',
    direction: 'desc'
  });
  
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    part: '',
    quantity: 1,
    notes: ''
  });

  const defaultDestination = userLocations && userLocations.length > 0 ? userLocations[0] : '';
  const allowedDestinationLocations = useMemo(() => {
    if (!userLocations || userLocations.length === 0) {
      return [];
    }
    return stockLocations.filter(loc => userLocations.includes(loc._id));
  }, [stockLocations, userLocations]);
  const sourceLocationId = formData.source ? String(formData.source) : '';
  const destinationOptions = useMemo(() => (
    allowedDestinationLocations.filter(loc => String(loc._id) !== sourceLocationId)
  ), [allowedDestinationLocations, sourceLocationId]);

  useEffect(() => {
    loadStockLocations();
    loadStates();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'new') {
      setModalOpened(true);
    }
  }, [location.search]);

  useEffect(() => {
    if (modalOpened && !formData.destination && defaultDestination && defaultDestination !== formData.source) {
      setFormData(prev => ({ ...prev, destination: defaultDestination }));
    }
  }, [modalOpened, defaultDestination, formData.destination, formData.source]);

  useEffect(() => {
    const isDateRangeValid =
      (dateRange[0] === null && dateRange[1] === null) ||
      (dateRange[0] !== null && dateRange[1] !== null);

    if (isDateRangeValid) {
      loadRequests();
    }
  }, [search, statusFilter, dateRange]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.state_id = statusFilter;
      if (dateRange[0]) params.date_from = dateRange[0].toISOString().split('T')[0];
      if (dateRange[1]) params.date_to = dateRange[1].toISOString().split('T')[0];
      const response = await api.get(requestsApi.getRequests(), { params });
      setRequests(response.data.results || []);
    } catch (error) {
      console.error('Failed to load requests:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load requests'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStockLocations = async () => {
    try {
      const response = await api.get(requestsApi.getStockLocations());
      const locations = response.data.results || response.data || [];
      setStockLocations(locations);
    } catch (error) {
      console.error('Failed to load stock locations:', error);
    }
  };

  const loadStates = async () => {
    try {
      const response = await api.get(requestsApi.getStates());
      setStates(response.data.results || []);
    } catch (error) {
      console.error('Failed to load request states:', error);
    }
  };

  const debouncedSearch = debounce((value: string) => {
    setSearch(value);
  }, 300);

  const searchParts = async (query: string) => {
    if (!formData.source) {
      setParts([]);
      return;
    }

    if (!query || query.length < 2) {
      setParts([]);
      return;
    }
    
    try {
      const response = await api.get(requestsApi.getParts(), {
        params: { search: query, location_id: formData.source }
      });
      const results = response.data.results || response.data || [];
      setParts(results);
    } catch (error) {
      console.error('Failed to search parts:', error);
    }
  };

  const debouncedSearchParts = debounce(searchParts, 250);

  const loadStockInfo = async (partId: string) => {
    try {
      const response = await api.get(requestsApi.getPartStockInfo(partId, formData.source || undefined));
      setStockInfo(response.data);
      const batches = response.data.batches || [];
      setBatchOptions(batches.map((b: any) => ({
        batch_code: b.batch_code,
        quantity: b.quantity,
        location_name: b.location_name || '',
        location_id: b.location_id || '',
        state_name: b.state_name || '',
        state_id: b.state_id || '',
        state_color: b.state_color,
        expiry_date: b.expiry_date,
        is_transferable: b.is_transferable,
        is_requestable: b.is_requestable,
        is_transactionable: b.is_transactionable
      })));
    } catch (error) {
      console.error('Failed to load stock info:', error);
      setStockInfo(null);
      setBatchOptions([]);
    }
  };

  const loadRecipe = async (partId: string) => {
    try {
      const response = await api.get(requestsApi.getPartRecipe(partId));
      setRecipeData(response.data);
    } catch (error) {
      console.error('Failed to load recipe:', error);
      setRecipeData(null);
    }
  };

  const handlePartChange = (value: string | null) => {
    setFormData({ ...formData, part: value || '' });
    
    if (value) {
      // Find and save selected part data
      const selected = parts.find(p => p._id === value);
      setSelectedPartData(selected || null);
      loadStockInfo(value);  // Pass _id directly
      loadRecipe(value);  // Pass _id directly
      setBatchSelections([]);
      setComponentsData([]);
    } else {
      setSelectedPartData(null);
      setStockInfo(null);
      setRecipeData(null);
      setPartSearch(''); // Reset search when clearing
      setBatchOptions([]);
      setBatchSelections([]);
      setComponentsData([]);
    }
  };

  const handleSourceChange = (value: string | null) => {
    const nextSource = value || '';
    setFormData(prev => ({
      ...prev,
      source: nextSource,
      destination: prev.destination === nextSource ? '' : prev.destination,
      part: ''
    }));
    setSelectedPartData(null);
    setStockInfo(null);
    setRecipeData(null);
    setComponentsData([]);
    setParts([]);
    setPartSearch('');
    setBatchOptions([]);
    setBatchSelections([]);
  };

  const handleGeneralQuantityChange = (value: number) => {
    const qty = Number(value) || 0;
    setFormData({ ...formData, quantity: qty });
    if (qty > 0 && batchSelections.length > 0) {
      setBatchSelections([]);
    }
  };

  const handleBatchSelectionsChange = (selections: BatchSelection[]) => {
    setBatchSelections(selections);
    const hasQty = selections.some(s => s.requested_quantity > 0);
    if (hasQty && formData.quantity > 0) {
      setFormData({ ...formData, quantity: 0 });
    }
  };

  const handleCreate = async () => {
    const hasBatchSelections = batchSelections.some(s => s.requested_quantity > 0);
    if (recipeData && recipeData.items && recipeData.items.length > 0 && formData.quantity <= 0) {
      notifications.show({
        title: t('Error'),
        message: t('Please set product quantity'),
        color: 'red'
      });
      return;
    }
    if (!formData.source || !formData.destination || !formData.part || (!hasBatchSelections && formData.quantity <= 0 && (!componentsData || componentsData.length === 0))) {
      notifications.show({
        title: t('Error'),
        message: t('Please fill in all required fields'),
        color: 'red'
      });
      return;
    }

    if (!userLocations || userLocations.length === 0) {
      notifications.show({
        title: t('Error'),
        message: t('No destination locations assigned to user'),
        color: 'red'
      });
      return;
    }

    if (userLocations && userLocations.length > 0 && !userLocations.includes(formData.destination)) {
      notifications.show({
        title: t('Error'),
        message: t('Destination location not allowed for current user'),
        color: 'red'
      });
      return;
    }

    if (formData.source === formData.destination) {
      notifications.show({
        title: t('Error'),
        message: t('Source and destination cannot be the same'),
        color: 'red'
      });
      return;
    }

    setSubmitting(true);
    try {
      // Prepare items list
      let itemsToSend: any[] = [];

      // Helper: push allocations as individual items
      const pushAllocations = (partId: string, allocations: any[], fallbackQty?: number) => {
        if (allocations && allocations.length > 0) {
          allocations
            .filter(a => a.quantity > 0)
            .forEach(a => {
              itemsToSend.push({
                part: partId,
                quantity: a.quantity,
                init_q: a.quantity,
                batch_code: a.batch_code,
                location_id: a.location_id || undefined,
                notes: formData.notes || undefined
              });
            });
        } else if (fallbackQty && fallbackQty > 0) {
          itemsToSend.push({
            part: partId,
            quantity: fallbackQty,
            init_q: fallbackQty,
            notes: formData.notes || undefined
          });
        }
      };

      // If recipe/BOM exists with components data from ComponentsTable
      if (componentsData && componentsData.length > 0) {
        for (const component of componentsData) {
          if (component.type === 2 && component.alternatives) {
            const selectedAlt = component.alternatives[component.selected_alternative || 0];
            pushAllocations(
              selectedAlt.part_id,
              selectedAlt.batch_allocations || [],
              selectedAlt.requested_quantity
            );
          } else if (component.type === 1) {
            pushAllocations(
              component.part_id,
              component.batch_allocations || [],
              component.requested_quantity
            );
          }
        }
      } else {
        // No recipe/BOM, use the selected part directly with batch selection support
        const validSelections = batchSelections.filter(s => s.requested_quantity > 0);
        if (validSelections.length > 0) {
          validSelections.forEach(sel => {
            itemsToSend.push({
              part: formData.part,
              quantity: sel.requested_quantity,
              init_q: sel.requested_quantity,
              batch_code: sel.batch_code,
              location_id: sel.location_id || undefined,
              notes: formData.notes || undefined
            });
          });
        } else {
          itemsToSend = [{
            part: formData.part,
            quantity: formData.quantity,
            init_q: formData.quantity,
            notes: formData.notes || undefined
          }];
        }
      }

      if (itemsToSend.length === 0) {
        notifications.show({
          title: t('Error'),
          message: t('Please enter at least one quantity'),
          color: 'red'
        });
        return;
      }

      const requestPayload: any = {
        source: formData.source,  // Already ObjectId string
        destination: formData.destination,  // Already ObjectId string
        items: itemsToSend,
        notes: formData.notes || undefined
      };

      // Add recipe information if available
      if (recipeData && recipeData.recipe_id) {
        requestPayload.recipe_id = recipeData.recipe_id;
        requestPayload.recipe_part_id = recipeData.recipe_part_id;
        requestPayload.product_id = formData.part;  // Already ObjectId string
        requestPayload.product_quantity = formData.quantity;
      }

      await api.post(requestsApi.createRequest(), requestPayload);

      notifications.show({
        title: t('Success'),
        message: t('Request created successfully'),
        color: 'green'
      });

      setFormData({
        source: '',
        destination: '',
        part: '',
        quantity: 1,
        notes: ''
      });
      setStockInfo(null);
      setRecipeData(null);
      setPartSearch('');
      setBatchOptions([]);
      setBatchSelections([]);
      setModalOpened(false);
      loadRequests();
    } catch (error: any) {
      console.error('Failed to create request:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to create request'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (request: Request) => {
    modals.openConfirmModal({
      title: t('Delete Request'),
      children: (
        <Text size="sm">
          {t('Are you sure you want to delete this request?')}
          <br />
          <strong>{request.reference}</strong>
        </Text>
      ),
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(requestsApi.deleteRequest(request._id));
          notifications.show({
            title: t('Success'),
            message: t('Request deleted successfully'),
            color: 'green'
          });
          loadRequests();
        } catch (error: any) {
          console.error('Failed to delete request:', error);
          notifications.show({
            title: t('Error'),
            message: error.response?.data?.detail || t('Failed to delete request'),
            color: 'red'
          });
        }
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'gray';
      case 'Approved': return 'green';
      case 'Refused': return 'red';
      case 'Canceled': return 'orange';
      default: return 'blue';
    }
  };

  const getProductName = (request: Request) => {
    if (request.product_detail?.name) return request.product_detail.name;
    if (request.items && request.items.length > 0) {
      return request.items[0].part_detail?.name || String(request.items[0].part || '');
    }
    return '';
  };

  const sortedRequests = useMemo(() => {
    const sorted = [...requests];
    const { key, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      const getValue = (req: Request) => {
        switch (key) {
          case 'reference':
            return req.reference || '';
          case 'source':
            return req.source_name || String(req.source || '');
          case 'destination':
            return req.destination_name || String(req.destination || '');
          case 'line_items':
            return req.line_items || 0;
          case 'product':
            return getProductName(req);
          case 'status':
            return req.status || '';
          case 'issue_date':
            return req.issue_date || req.created_at || '';
          default:
            return '';
        }
      };

      const aVal = getValue(a);
      const bVal = getValue(b);

      if (key === 'line_items') {
        return (Number(aVal) - Number(bVal)) * dir;
      }

      if (key === 'issue_date') {
        const aTime = aVal ? new Date(aVal as string).getTime() : 0;
        const bTime = bVal ? new Date(bVal as string).getTime() : 0;
        return (aTime - bTime) * dir;
      }

      return String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' }) * dir;
    });

    return sorted;
  }, [requests, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />;
  };

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Requests')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpened(true)}>
          {t('New Request')}
        </Button>
      </Group>

      <Paper p="md" mb="md">
        <Group>
          <TextInput
            placeholder={t('Search by reference, notes, batch code...')}
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
        {!loading && sortedRequests.length === 0 ? (
          <Text size="sm" c="dimmed">{t('No requests found')}</Text>
        ) : (
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th onClick={() => toggleSort('reference')} style={{ cursor: 'pointer' }}>
                  <Group gap={6}>
                    <span>{t('Reference')}</span>
                    {renderSortIcon('reference')}
                  </Group>
                </Table.Th>
                <Table.Th onClick={() => toggleSort('source')} style={{ cursor: 'pointer' }}>
                  <Group gap={6}>
                    <span>{t('Source')}</span>
                    {renderSortIcon('source')}
                  </Group>
                </Table.Th>
                <Table.Th onClick={() => toggleSort('destination')} style={{ cursor: 'pointer' }}>
                  <Group gap={6}>
                    <span>{t('Destination')}</span>
                    {renderSortIcon('destination')}
                  </Group>
                </Table.Th>
                <Table.Th onClick={() => toggleSort('line_items')} style={{ cursor: 'pointer' }}>
                  <Group gap={6}>
                    <span>{t('Line Items')}</span>
                    {renderSortIcon('line_items')}
                  </Group>
                </Table.Th>
                <Table.Th onClick={() => toggleSort('product')} style={{ cursor: 'pointer' }}>
                  <Group gap={6}>
                    <span>{t('Products')}</span>
                    {renderSortIcon('product')}
                  </Group>
                </Table.Th>
                <Table.Th onClick={() => toggleSort('status')} style={{ cursor: 'pointer' }}>
                  <Group gap={6}>
                    <span>{t('Status')}</span>
                    {renderSortIcon('status')}
                  </Group>
                </Table.Th>
                <Table.Th>{t('Labels')}</Table.Th>
                <Table.Th onClick={() => toggleSort('issue_date')} style={{ cursor: 'pointer' }}>
                  <Group gap={6}>
                    <span>{t('Issue Date')}</span>
                    {renderSortIcon('issue_date')}
                  </Group>
                </Table.Th>
                <Table.Th style={{ width: '100px' }}>{t('Actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedRequests.map((request) => (
                <Table.Tr key={request._id} style={{ cursor: 'pointer' }}>
                  <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                    {request.reference}
                  </Table.Td>
                  <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                    {request.source_name || request.source}
                  </Table.Td>
                  <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                    {request.destination_name || request.destination}
                  </Table.Td>
                  <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                    {request.line_items}
                  </Table.Td>
                  <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                    {request.product_detail ? (
                      <Text size="sm">{request.product_detail.name}</Text>
                    ) : request.items && request.items.length > 0 ? (
                      <Text size="sm">
                        {request.items[0].part_detail?.name || request.items[0].part}
                        {request.items.length > 1 && ` + ${request.items.length - 1} more`}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                    <Group gap="xs">
                      <Badge color={getStatusColor(request.status)}>{request.status}</Badge>
                      {typeof request.open === 'boolean' && (
                        <span
                          title={request.open ? t('Open') : t('Closed')}
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: request.open ? '#fa5252' : '#40c057',
                            display: 'inline-block'
                          }}
                        />
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                    {request.labels && request.labels.length > 0 ? (
                      <Group gap="xs">
                        {request.labels.map((label) => (
                          <Badge key={`${request._id}-${label}`} variant="light" color="gray">
                            {label}
                          </Badge>
                        ))}
                      </Group>
                    ) : (
                      <Text size="sm" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                    {formatDate(request.issue_date)}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => navigate(`/requests/${request._id}`)}
                        title={t('View')}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(request)}
                        title={t('Delete')}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Create Request Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={t('New Request')}
        size="80%"
        styles={{
          content: {
            maxWidth: '80%'
          }
        }}
      >
        <Grid>
          <Grid.Col span={12}>
            <Select
              label={t('Source Location')}
              placeholder={t('Select source location')}
              data={stockLocations.map(loc => ({ value: loc._id, label: loc.name }))}
              value={formData.source}
              onChange={handleSourceChange}
              searchable
              required
            />
          </Grid.Col>

          <Grid.Col span={12}>
          <Select
            label={t('Destination Location')}
            placeholder={
              allowedDestinationLocations.length === 0
                ? t('No destination locations assigned to user')
                : t('Select destination location')
            }
            data={destinationOptions.map(loc => ({ value: loc._id, label: loc.name }))}
            value={formData.destination}
            onChange={(value) => {
              const nextDestination = value || '';
              if (nextDestination && sourceLocationId && nextDestination === sourceLocationId) {
                setFormData({ ...formData, destination: '' });
                return;
              }
              setFormData({ ...formData, destination: nextDestination });
            }}
            searchable
            required
            disabled={!formData.source || allowedDestinationLocations.length === 0}
          />
          </Grid.Col>

          <Grid.Col span={12}>
            <Select
              label={t('Part')}
              placeholder={formData.source ? t('Search for part...') : t('Select source location first')}
              data={sanitizeSelectOptions([
                // Include selected part first if exists
                ...(selectedPartData ? [{
                  value: selectedPartData._id,
                  label: `${selectedPartData.name} (${selectedPartData.IPN})`
                }] : []),
                // Add search results (filter out selected to avoid duplicates)
                ...parts
                  .filter(p => !selectedPartData || p._id !== selectedPartData._id)
                  .map(part => ({
                    value: part._id,
                    label: `${part.name} (${part.IPN})`
                  }))
              ])}
              value={formData.part}
              onChange={handlePartChange}
              onSearchChange={(query) => {
                setPartSearch(query);
                debouncedSearchParts(query);
              }}
              searchable
              clearable
              required
              disabled={!formData.source}
            />
          </Grid.Col>

          {stockInfo && (
            <Grid.Col span={12}>
              <Paper p="xs" withBorder>
                <Text size="sm" fw={500} mb="xs">{t('Stock Information')}</Text>
                <Text size="xs">
                  <strong>{t('Total')}:</strong> {stockInfo.total} | 
                  <strong> {t('In sales')}:</strong> {stockInfo.in_sales} | 
                  <strong> {t('In builds')}:</strong> {stockInfo.in_builds} | 
                  <strong> {t('In procurement')}:</strong> {stockInfo.in_procurement} | 
                  <strong> {t('Available')}:</strong> {stockInfo.available}
                </Text>
              </Paper>
            </Grid.Col>
          )}

          {recipeData && recipeData.items && recipeData.items.length > 0 && (
            <Grid.Col span={12}>
              <ComponentsTable
                recipeData={recipeData}
                productQuantity={formData.quantity}
                sourceLocationId={formData.source}
                onComponentsChange={(components) => {
                  setComponentsData(components);
                }}
              />
            </Grid.Col>
          )}

          <Grid.Col span={12}>
            <NumberInput
              label={t('Quantity')}
              placeholder="1"
              value={formData.quantity}
              onChange={handleGeneralQuantityChange}
              min={0}
              step={1}
              required
              description={t('Leave at 0 to pick quantities per batch below')}
            />
          </Grid.Col>

          {/* Batch codes selection for products without recipe */}
          {(!recipeData || !recipeData.items || recipeData.items.length === 0) && (
            <Grid.Col span={12}>
              <BatchCodesTable
                batchCodes={batchOptions.map(b => ({
                  batch_code: b.batch_code,
                  quantity: b.quantity,
                  location_name: b.location_name,
                  location_id: b.location_id,
                  state_name: b.state_name,
                  state_id: b.state_id,
                  state_color: b.state_color,
                  expiry_date: b.expiry_date,
                  is_transferable: b.is_transferable,
                  is_requestable: b.is_requestable,
                  is_transactionable: b.is_transactionable
                }))}
                selections={batchSelections}
                onSelectionChange={handleBatchSelectionsChange}
              />
            </Grid.Col>
          )}

          <Grid.Col span={12}>
            <Textarea
              label={t('Notes')}
              placeholder={t('Additional notes')}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              minRows={3}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setModalOpened(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleCreate} loading={submitting}>
            {t('Create')}
          </Button>
        </Group>
      </Modal>
    </Paper>
  );
}
