import { useState, useEffect } from 'react';
import { Paper, Title, Table, Button, Group, Modal, Grid, Select, NumberInput, Textarea, Badge, ActionIcon, Text } from '@mantine/core';
import { IconPlus, IconEye, IconTrash } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../services/api';
import { notifications } from '@mantine/notifications';

interface StockLocation {
  pk: number;
  name: string;
}

interface Part {
  pk: number;
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
  const [partSearch, setPartSearch] = useState('');
  const [stockInfo, setStockInfo] = useState<any>(null);
  const [bomComponents, setBomComponents] = useState<any[]>([]);
  
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
      const response = await api.get('/api/requests/');
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
      const response = await api.get('/api/requests/stock-locations');
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
      const response = await api.get('/api/requests/parts', {
        params: { search: query }
      });
      const results = response.data.results || response.data || [];
      setParts(results);
    } catch (error) {
      console.error('Failed to search parts:', error);
    }
  };

  const loadStockInfo = async (partId: number) => {
    try {
      const response = await api.get(`/api/requests/parts/${partId}/stock-info`);
      setStockInfo(response.data);
    } catch (error) {
      console.error('Failed to load stock info:', error);
      setStockInfo(null);
    }
  };

  const loadBOM = async (partId: number) => {
    try {
      const response = await api.get(`/api/requests/parts/${partId}/bom`);
      const bomItems = response.data.results || [];
      setBomComponents(bomItems);
    } catch (error) {
      console.error('Failed to load BOM:', error);
      setBomComponents([]);
    }
  };

  const handlePartChange = (value: string | null) => {
    setFormData({ ...formData, part: value || '' });
    if (value) {
      const partId = parseInt(value);
      loadStockInfo(partId);
      loadBOM(partId);
    } else {
      setStockInfo(null);
      setBomComponents([]);
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
      await api.post('/api/requests/', {
        source: parseInt(formData.source),
        destination: parseInt(formData.destination),
        items: [{
          part: parseInt(formData.part),
          quantity: formData.quantity,
          notes: formData.notes || undefined
        }],
        notes: formData.notes || undefined
      });

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
          await api.delete(`/api/requests/${request._id}`);
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
        size="lg"
      >
        <Grid>
          <Grid.Col span={12}>
            <Select
              label={t('Source Location')}
              placeholder={t('Select source location')}
              data={stockLocations.map(loc => ({ value: String(loc.pk), label: loc.name }))}
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
                .filter(loc => String(loc.pk) !== formData.source)
                .map(loc => ({ value: String(loc.pk), label: loc.name }))}
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
          data={parts.map(part => ({
          value: String(part.pk),
          label: `${part.name} (${part.IPN})`
          }))}
          value={formData.part}
          onChange={handlePartChange}
          onSearchChange={(query) => {
          setPartSearch(query);
          searchParts(query);
          }}
          searchValue={partSearch}
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

          {bomComponents.length > 0 && (
            <Grid.Col span={12}>
              <Paper p="xs" withBorder>
                <Text size="sm" fw={500} mb="xs" c="blue">
                  {t('This part has')} {bomComponents.length} {t('component(s)')}
                </Text>
                <Text size="xs" c="dimmed">
                  {t('Components')}: {bomComponents.map((bom: any) => 
                    bom.sub_part_detail?.name || bom.sub_part
                  ).join(', ')}
                </Text>
              </Paper>
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
