import { useState, useEffect } from 'react';
import { Grid, TextInput, Textarea, Select, Button, Group, Title, Table, Text, ActionIcon, NumberInput, Modal, TagsInput, Paper } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconTrash, IconPlus } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';
import { DocumentGenerator } from '../Common/DocumentGenerator';

interface StockLocation {
  _id: string;
  name: string;
}

interface Part {
  _id: string;
  id?: number;
  name: string;
  IPN: string;
}

interface RequestItem {
  part: string;
  quantity: number;
  notes?: string;
  part_detail?: Part;
}

interface Request {
  _id: string;
  reference: string;
  source: string;  // ObjectId string
  destination: string;  // ObjectId string
  items: RequestItem[];
  line_items: number;
  status: string;
  notes: string;
  batch_codes?: string[];
  issue_date: string;
  created_at: string;
  created_by: string;
  source_detail?: StockLocation;
  destination_detail?: StockLocation;
  product_id?: string;
  product_quantity?: number;
  product_detail?: {
    _id: string;
    name: string;
    IPN: string;
    description: string;
  };
}

interface DetailsTabProps {
  request: Request;
  onUpdate: () => void;
}

export function DetailsTab({ request, onUpdate }: DetailsTabProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [partSearch, setPartSearch] = useState('');
  const [addItemModalOpened, setAddItemModalOpened] = useState(false);
  const [hasSignatures, setHasSignatures] = useState(false);
  const [checkingSignatures, setCheckingSignatures] = useState(true);
  
  const [formData, setFormData] = useState({
    source: String(request.source),
    destination: String(request.destination),
    issue_date: request.issue_date ? new Date(request.issue_date) : new Date(),
    notes: request.notes || '',
    batch_codes: request.batch_codes || [],
    items: [...request.items]
  });

  const [newItem, setNewItem] = useState({
    part: '',
    quantity: 1,
    notes: ''
  });

  useEffect(() => {
    loadStockLocations();
    checkApprovalSignatures();
  }, []);

  useEffect(() => {
    setFormData({
      source: String(request.source),
      destination: String(request.destination),
      issue_date: request.issue_date ? new Date(request.issue_date) : new Date(),
      notes: request.notes || '',
      batch_codes: request.batch_codes || [],
      items: [...request.items]
    });
  }, [request]);

  const checkApprovalSignatures = async () => {
    try {
      const response = await api.get(requestsApi.getApprovalFlow(request._id));
      const flow = response.data.flow;
      setHasSignatures(flow && flow.signatures && flow.signatures.length > 0);
    } catch (error) {
      console.error('Failed to check signatures:', error);
      setHasSignatures(false);
    } finally {
      setCheckingSignatures(false);
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

  const handleAddItem = () => {
    if (!newItem.part || !newItem.quantity) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a part and enter quantity'),
        color: 'red'
      });
      return;
    }

    // Check for duplicates
    const isDuplicate = formData.items.some(item => item.part === newItem.part);
    if (isDuplicate) {
      notifications.show({
        title: t('Error'),
        message: t('This part is already in the list'),
        color: 'red'
      });
      return;
    }

    const partDetail = parts.find(p => String(p._id) === newItem.part);
    const item: RequestItem = {
      part: newItem.part,
      quantity: newItem.quantity,
      notes: newItem.notes || undefined,
      part_detail: partDetail
    };

    setFormData({
      ...formData,
      items: [...formData.items, item]
    });

    setNewItem({ part: '', quantity: 1, notes: '' });
    setPartSearch('');
    setParts([]);
    setAddItemModalOpened(false);
  };

  const handleRemoveItem = (index: number) => {
    modals.openConfirmModal({
      title: t('Remove Item'),
      children: (
        <Text size="sm">
          {t('Are you sure you want to remove this item?')}
        </Text>
      ),
      labels: { confirm: t('Remove'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
      }
    });
  };

  const handleSave = async () => {
    if (formData.source === formData.destination) {
      notifications.show({
        title: t('Error'),
        message: t('Source and destination cannot be the same'),
        color: 'red'
      });
      return;
    }

    if (formData.items.length === 0) {
      notifications.show({
        title: t('Error'),
        message: t('Request must have at least one item'),
        color: 'red'
      });
      return;
    }

    setSaving(true);
    try {
      await api.patch(requestsApi.updateRequest(request._id), {
        source: formData.source,  // Keep as string (ObjectId)
        destination: formData.destination,  // Keep as string (ObjectId)
        issue_date: formData.issue_date.toISOString().split('T')[0],
        notes: formData.notes || undefined,
        batch_codes: formData.batch_codes,
        items: formData.items.map(item => ({
          part: item.part,
          quantity: item.quantity,
          notes: item.notes
        }))
      });

      notifications.show({
        title: t('Success'),
        message: t('Request updated successfully'),
        color: 'green'
      });

      setEditing(false);
      onUpdate();
    } catch (error: any) {
      console.error('Failed to update request:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update request'),
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      source: String(request.source),
      destination: String(request.destination),
      issue_date: request.issue_date ? new Date(request.issue_date) : new Date(),
      notes: request.notes || '',
      batch_codes: request.batch_codes || [],
      items: [...request.items]
    });
    setEditing(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const canEdit = !hasSignatures && !checkingSignatures;

  return (
    <>
      <Grid gutter="md">
        {/* Left side - Documents (1/4 width) */}
        <Grid.Col span={3}>
          <Title order={5} mb="md">{t('Documents')}</Title>
          <Paper withBorder p="sm" style={{ border: '1px solid #e9ecef' }}>
            <DocumentGenerator
              objectId={request._id}
              templateCodes={['6LL5WVTR8BTY']}
              templateNames={{
                '6LL5WVTR8BTY': 'P-Distrib-102_F1'
              }}
            />
          </Paper>
        </Grid.Col>

      {/* Right side - Form (3/4 width) */}
      <Grid.Col span={9}>
        {/* Product Info - Only show if exists */}
        {request.product_detail && (
          <Paper p="md" mb="md" withBorder style={{ backgroundColor: '#f8f9fa' }}>
            <Text size="lg" fw={600} mb="xs">
              {request.product_detail.name} ({request.product_detail.IPN})
            </Text>
            <Text size="sm" c="dimmed">
              {t('Product Quantity')}: {request.product_quantity || 0}
            </Text>
          </Paper>
        )}

        <Group justify="flex-end" mb="md">
          {!editing ? (
            <Button onClick={() => setEditing(true)} disabled={!canEdit}>
              {t('Edit')}
            </Button>
          ) : (
            <>
              <Button variant="default" onClick={handleCancel}>
                {t('Cancel')}
              </Button>
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSave}
                loading={saving}
              >
                {t('Save')}
              </Button>
            </>
          )}
        </Group>

        {!canEdit && !checkingSignatures && (
          <Text size="sm" c="orange" mb="md">
            {t('This request has signatures and cannot be edited. Remove all signatures to enable editing.')}
          </Text>
        )}

        <Grid>
        {/* Batch Codes - First field */}
        <Grid.Col span={12}>
          {editing ? (
            <TagsInput
              label={t('Batch Codes')}
              placeholder={t('Add batch codes')}
              value={formData.batch_codes}
              onChange={(value) => setFormData({ ...formData, batch_codes: value })}
            />
          ) : (
            <TagsInput
              label={t('Batch Codes')}
              value={request.batch_codes || []}
              disabled
            />
          )}
        </Grid.Col>

        {/* Source and Destination */}
        <Grid.Col span={6}>
          {editing ? (
            <Select
              label={t('Source Location')}
              data={stockLocations.map(loc => ({ value: String(loc._id), label: loc.name }))}
              value={formData.source}
              onChange={(value) => {
                if (value) setFormData({ ...formData, source: value });
              }}
              searchable
              required
              disabled={stockLocations.length === 0}
            />
          ) : (
            <TextInput
              label={t('Source Location')}
              value={request.source_detail?.name || String(request.source)}
              disabled
            />
          )}
        </Grid.Col>

        <Grid.Col span={6}>
          {editing ? (
            <Select
              label={t('Destination Location')}
              data={stockLocations
                .filter(loc => String(loc._id) !== formData.source)
                .map(loc => ({ value: String(loc._id), label: loc.name }))}
              value={formData.destination}
              onChange={(value) => {
                if (value) setFormData({ ...formData, destination: value });
              }}
              searchable
              required
              disabled={stockLocations.length === 0}
            />
          ) : (
            <TextInput
              label={t('Destination Location')}
              value={request.destination_detail?.name || String(request.destination)}
              disabled
            />
          )}
        </Grid.Col>

        {/* Notes */}
        <Grid.Col span={12}>
          {editing ? (
            <Textarea
              label={t('Notes')}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              minRows={3}
            />
          ) : (
            <Textarea
              label={t('Notes')}
              value={request.notes || ''}
              disabled
              minRows={3}
            />
          )}
        </Grid.Col>

        {/* Metadata section - separated by divider */}
        <Grid.Col span={12}>
          <div style={{ borderTop: '1px solid #dee2e6', marginTop: '1rem', paddingTop: '1rem' }}>
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed" mb={4}>{t('Issue Date')}</Text>
                <Text size="sm">{formatDate(request.issue_date)}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed" mb={4}>{t('Created By')}</Text>
                <Text size="sm">{request.created_by}</Text>
              </Grid.Col>
            </Grid>
          </div>
        </Grid.Col>
        </Grid>
      </Grid.Col>
      </Grid>

      {/* Add Item Modal */}
      <Modal
        opened={addItemModalOpened}
        onClose={() => {
          setAddItemModalOpened(false);
          setNewItem({ part: '', quantity: 1, notes: '' });
          setPartSearch('');
          setParts([]);
        }}
        title={t('Add Item')}
        size="md"
      >
        <Grid>
          <Grid.Col span={12}>
            <Select
              label={t('Part')}
              placeholder={t('Search for part...')}
              data={parts.map(part => ({
                value: String(part._id),
                label: `${part.name} (${part.IPN})`
              }))}
              value={newItem.part}
              onChange={(value) => setNewItem({ ...newItem, part: value || '' })}
              onSearchChange={(query) => {
                setPartSearch(query);
                searchParts(query);
              }}
              searchValue={partSearch}
              searchable
              required
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <NumberInput
              label={t('Quantity')}
              placeholder="1"
              value={newItem.quantity}
              onChange={(value) => setNewItem({ ...newItem, quantity: Number(value) || 1 })}
              min={1}
              step={1}
              required
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Textarea
              label={t('Notes')}
              placeholder={t('Additional notes')}
              value={newItem.notes}
              onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
              minRows={2}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => {
            setAddItemModalOpened(false);
            setNewItem({ part: '', quantity: 1, notes: '' });
            setPartSearch('');
            setParts([]);
          }}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleAddItem}>
            {t('Add')}
          </Button>
        </Group>
      </Modal>
    </>
  );
}
