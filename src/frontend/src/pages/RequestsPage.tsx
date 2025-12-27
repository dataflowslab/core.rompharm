import { useState, useEffect } from 'react';
import { Paper, Title, Table, Button, Group, Modal, Grid, Select, NumberInput, Textarea, Badge, ActionIcon, Text } from '@mantine/core';
import { IconPlus, IconEye, IconTrash } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../services/api';
import { requestsApi } from '../services/requests';
import { notifications } from '@mantine/notifications';
import { ComponentsTable } from '../components/Requests/ComponentsTable';
import { debounce } from '../utils/selectHelpers';
import { sanitizeSelectOptions } from '../utils/selectHelpers';

interface StockLocation {
  _id: string;
  name: string;
}

interface Part {
  _id: string;
  name: string;
  IPN: string;
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
}

export function RequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    part: '',
    quantity: 1,
    notes: ''
  });

  useEffect(() => {
    loadRequests();
    loadStockLocations();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await api.get(requestsApi.getRequests());
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

  const searchParts = async (query: string) => {
    if (!query || query.length < 2) {
      setParts([]);
      return;
    }
    
    try {
      const response = await api.get(requestsApi.getParts(), {
        params: { search: query }
      });
      const results = response.data.results || response.data || [];
      setParts(results);
    } catch (error) {
      console.error('Failed to search parts:', error);
    }
  };

  const debouncedSearchParts = debounce(searchParts, 250);

  const loadStockInfo = async (partId: number) => {
    try {
      const response = await api.get(requestsApi.getPartStockInfo(partId));
      setStockInfo(response.data);
    } catch (error) {
      console.error('Failed to load stock info:', error);
      setStockInfo(null);
    }
  };

  const loadRecipe = async (partId: number) => {
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
    } else {
      setSelectedPartData(null);
      setStockInfo(null);
      setRecipeData(null);
      setPartSearch(''); // Reset search when clearing
    }
  };

  const handleCreate = async () => {
    if (!formData.source || !formData.destination || !formData.part || !formData.quantity) {
      notifications.show({
        title: t('Error'),
        message: t('Please fill in all required fields'),
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

      // If recipe/BOM exists with components data from ComponentsTable
      if (componentsData && componentsData.length > 0) {
        // Process components from ComponentsTable
        for (const component of componentsData) {
          if (component.type === 2 && component.alternatives) {
            // Alternative group - use selected alternative
            const selectedAlt = component.alternatives[component.selected_alternative || 0];
            
            // Calculate total allocated from batches
            const totalAllocated = selectedAlt.batch_allocations?.reduce((sum: number, b: any) => sum + b.quantity, 0) || 0;
            
            // Use batch allocations if available, otherwise use requested_quantity
            const quantityToUse = totalAllocated > 0 ? totalAllocated : (selectedAlt.requested_quantity || 0);
            
            if (quantityToUse > 0) {
              // Get batch_code from first allocation if available
              const batchCode = selectedAlt.batch_allocations && selectedAlt.batch_allocations.length > 0 
                ? selectedAlt.batch_allocations[0].batch_code 
                : undefined;
              
              itemsToSend.push({
                part: selectedAlt.part_id,
                quantity: quantityToUse,
                init_q: quantityToUse,  // Save initial quantity
                batch_code: batchCode,
                notes: formData.notes || undefined
              });
            }
          } else if (component.type === 1) {
            // Regular component
            // Calculate total allocated from batches
            const totalAllocated = component.batch_allocations?.reduce((sum: number, b: any) => sum + b.quantity, 0) || 0;
            
            // Use batch allocations if available, otherwise use requested_quantity
            const quantityToUse = totalAllocated > 0 ? totalAllocated : (component.requested_quantity || 0);
            
            if (quantityToUse > 0) {
              // Get batch_code from first allocation if available
              const batchCode = component.batch_allocations && component.batch_allocations.length > 0 
                ? component.batch_allocations[0].batch_code 
                : undefined;
              
              itemsToSend.push({
                part: component.part_id,
                quantity: quantityToUse,
                init_q: quantityToUse,  // Save initial quantity
                batch_code: batchCode,
                notes: formData.notes || undefined
              });
            }
          }
        }
      } else {
        // No recipe/BOM, use the selected part directly
        itemsToSend = [{
          part: formData.part,
          quantity: formData.quantity,
          init_q: formData.quantity,  // Save initial quantity
          notes: formData.notes || undefined
        }];
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

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Requests')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpened(true)}>
          {t('New Request')}
        </Button>
      </Group>

      {loading ? (
        <Text>{t('Loading...')}</Text>
      ) : requests.length === 0 ? (
        <Text size="sm" c="dimmed">{t('No requests found')}</Text>
      ) : (
        <Table striped withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Reference')}</Table.Th>
              <Table.Th>{t('Source')}</Table.Th>
              <Table.Th>{t('Destination')}</Table.Th>
              <Table.Th>{t('Line Items')}</Table.Th>
              <Table.Th>{t('Status')}</Table.Th>
              <Table.Th>{t('Issue Date')}</Table.Th>
              <Table.Th style={{ width: '100px' }}>{t('Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {requests.map((request) => (
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
                  <Badge color={getStatusColor(request.status)}>{request.status}</Badge>
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
              onChange={(value) => setFormData({ ...formData, source: value || '' })}
              searchable
              required
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Select
              label={t('Destination Location')}
              placeholder={t('Select destination location')}
              data={stockLocations
                .filter(loc => loc._id !== formData.source)
                .map(loc => ({ value: loc._id, label: loc.name }))}
              value={formData.destination}
              onChange={(value) => setFormData({ ...formData, destination: value || '' })}
              searchable
              required
              disabled={!formData.source}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Select
              label={t('Part')}
              placeholder={t('Search for part...')}
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
              onChange={(value) => setFormData({ ...formData, quantity: Number(value) || 1 })}
              min={1}
              step={1}
              required
            />
          </Grid.Col>

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
