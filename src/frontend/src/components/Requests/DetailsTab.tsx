import { useState, useEffect } from 'react';
import { Grid, TextInput, Textarea, Select, Button, Group, Title, Table, Text, ActionIcon, NumberInput, Modal, Paper } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconTrash, IconPlus, IconFileText } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import api from '../../services/api';

interface StockLocation {
  pk: number;
  name: string;
}

interface Part {
  pk: number;
  name: string;
  IPN: string;
}

interface RequestItem {
  part: number;
  quantity: number;
  notes?: string;
  part_detail?: Part;
}

interface Request {
  _id: string;
  reference: string;
  source: number;
  destination: number;
  items: RequestItem[];
  line_items: number;
  status: string;
  notes: string;
  issue_date: string;
  created_at: string;
  created_by: string;
  source_detail?: StockLocation;
  destination_detail?: StockLocation;
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
      items: [...request.items]
    });
  }, [request]);

  const checkApprovalSignatures = async () => {
    try {
      const response = await api.get(`/api/requests/${request._id}/approval-flow`);
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

  const handleAddItem = () => {
    if (!newItem.part || !newItem.quantity) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a part and enter quantity'),
        color: 'red'
      });
      return;
    }

    const partDetail = parts.find(p => String(p.pk) === newItem.part);
    const item: RequestItem = {
      part: parseInt(newItem.part),
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
      await api.patch(`/api/requests/${request._id}`, {
        source: parseInt(formData.source),
        destination: parseInt(formData.destination),
        issue_date: formData.issue_date.toISOString().split('T')[0],
        notes: formData.notes || undefined,
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

  // Generate Document Component
  const GenerateDocumentButton = ({ requestId, reference, status }: { requestId: string; reference: string; status: string }) => {
    const [generating, setGenerating] = useState(false);

    const handleGenerate = async () => {
      setGenerating(true);
      try {
        const response = await api.post(
          '/api/documents/stock-request/generate',
          {
            request_id: requestId,
            template_code: '6LL5WVTR8BTY',
            template_name: 'P-Distrib-102_F1'
          },
          { responseType: 'blob' }
        );

        // Download PDF
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Fisa_Solicitare_${reference}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        notifications.show({
          title: t('Success'),
          message: t('Document generated successfully'),
          color: 'green'
        });
      } catch (error: any) {
        console.error('Failed to generate document:', error);
        notifications.show({
          title: t('Error'),
          message: error.response?.data?.detail || t('Failed to generate document'),
          color: 'red'
        });
      } finally {
        setGenerating(false);
      }
    };

    return (
      <>
        <Button
          leftSection={<IconFileText size={16} />}
          onClick={handleGenerate}
          loading={generating}
          disabled={status !== 'Approved'}
        >
          {t('Generate P-Distrib-102_F1')}
        </Button>
        {status !== 'Approved' && (
          <Text size="sm" c="dimmed" mt="xs">
            {t('Document can only be generated after approval')}
          </Text>
        )}
      </>
    );
  };

  return (
    <div>
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
        <Grid.Col span={6}>
          <TextInput
            label={t('Reference')}
            value={request.reference}
            readOnly
            styles={editing ? { input: { backgroundColor: '#f1f3f5', color: '#868e96' } } : undefined}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label={t('Status')}
            value={request.status}
            readOnly
            styles={editing ? { input: { backgroundColor: '#f1f3f5', color: '#868e96' } } : undefined}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          {editing ? (
            <Select
              label={t('Source Location')}
              data={stockLocations.map(loc => ({ value: String(loc.pk), label: loc.name }))}
              value={formData.source}
              onChange={(value) => setFormData({ ...formData, source: value || '' })}
              searchable
              required
            />
          ) : (
            <TextInput
              label={t('Source Location')}
              value={request.source_detail?.name || String(request.source)}
              readOnly
            />
          )}
        </Grid.Col>

        <Grid.Col span={6}>
          {editing ? (
            <Select
              label={t('Destination Location')}
              data={stockLocations
                .filter(loc => String(loc.pk) !== formData.source)
                .map(loc => ({ value: String(loc.pk), label: loc.name }))}
              value={formData.destination}
              onChange={(value) => setFormData({ ...formData, destination: value || '' })}
              searchable
              required
            />
          ) : (
            <TextInput
              label={t('Destination Location')}
              value={request.destination_detail?.name || String(request.destination)}
              readOnly
            />
          )}
        </Grid.Col>

        <Grid.Col span={6}>
          {editing ? (
            <DatePickerInput
              label={t('Issue Date')}
              value={formData.issue_date}
              onChange={(value) => setFormData({ ...formData, issue_date: value || new Date() })}
              valueFormat="DD/MM/YYYY"
              required
            />
          ) : (
            <TextInput
              label={t('Issue Date')}
              value={formatDate(request.issue_date)}
              readOnly
            />
          )}
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label={t('Created By')}
            value={request.created_by}
            readOnly
          />
        </Grid.Col>

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
              readOnly
              minRows={3}
            />
          )}
        </Grid.Col>

        <Grid.Col span={12}>
          <Group justify="space-between" mb="md">
            <Title order={4}>{t('Items')}</Title>
            {editing && (
              <Button
                leftSection={<IconPlus size={16} />}
                size="sm"
                onClick={() => setAddItemModalOpened(true)}
              >
                {t('Add Item')}
              </Button>
            )}
          </Group>

          {formData.items && formData.items.length > 0 ? (
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Part')}</Table.Th>
                  <Table.Th>{t('IPN')}</Table.Th>
                  <Table.Th>{t('Quantity')}</Table.Th>
                  <Table.Th>{t('Notes')}</Table.Th>
                  {editing && <Table.Th style={{ width: '60px' }}>{t('Actions')}</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {formData.items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{item.part_detail?.name || item.part}</Table.Td>
                    <Table.Td>{item.part_detail?.IPN || '-'}</Table.Td>
                    <Table.Td>{item.quantity}</Table.Td>
                    <Table.Td>{item.notes || '-'}</Table.Td>
                    {editing && (
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => handleRemoveItem(index)}
                          title={t('Remove')}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text size="sm" c="dimmed">{t('No items')}</Text>
          )}
        </Grid.Col>
      </Grid>

      {/* Document Generation Section */}
      {!editing && (
        <Paper withBorder p="md" mt="md">
          <Group justify="space-between" mb="md">
            <Title order={5}>{t('Documents')}</Title>
          </Group>
          
          <GenerateDocumentButton requestId={request._id} reference={request.reference} status={request.status} />
        </Paper>
      )}

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
                value: String(part.pk),
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
    </div>
  );
}
