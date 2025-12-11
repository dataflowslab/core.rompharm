import { useState, useEffect } from 'react';
import { Grid, TextInput, Textarea, Select, Button, Group, Title, Table, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy } from '@tabler/icons-react';
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
  
  const [formData, setFormData] = useState({
    source: String(request.source),
    destination: String(request.destination),
    issue_date: request.issue_date ? new Date(request.issue_date) : new Date(),
    notes: request.notes || ''
  });

  useEffect(() => {
    loadStockLocations();
  }, []);

  useEffect(() => {
    setFormData({
      source: String(request.source),
      destination: String(request.destination),
      issue_date: request.issue_date ? new Date(request.issue_date) : new Date(),
      notes: request.notes || ''
    });
  }, [request]);

  const loadStockLocations = async () => {
    try {
      const response = await api.get('/api/requests/stock-locations');
      const locations = response.data.results || response.data || [];
      setStockLocations(locations);
    } catch (error) {
      console.error('Failed to load stock locations:', error);
    }
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

    setSaving(true);
    try {
      await api.patch(`/api/requests/${request._id}`, {
        source: parseInt(formData.source),
        destination: parseInt(formData.destination),
        issue_date: formData.issue_date.toISOString().split('T')[0],
        notes: formData.notes || undefined
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
      notes: request.notes || ''
    });
    setEditing(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div>
      <Group justify="flex-end" mb="md">
        {!editing ? (
          <Button onClick={() => setEditing(true)}>
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

      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label={t('Reference')}
            value={request.reference}
            readOnly
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label={t('Status')}
            value={request.status}
            readOnly
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
          <Title order={4} mb="md">{t('Items')}</Title>
          {request.items && request.items.length > 0 ? (
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Part')}</Table.Th>
                  <Table.Th>{t('IPN')}</Table.Th>
                  <Table.Th>{t('Quantity')}</Table.Th>
                  <Table.Th>{t('Notes')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {request.items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{item.part_detail?.name || item.part}</Table.Td>
                    <Table.Td>{item.part_detail?.IPN || '-'}</Table.Td>
                    <Table.Td>{item.quantity}</Table.Td>
                    <Table.Td>{item.notes || '-'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text size="sm" c="dimmed">{t('No items')}</Text>
          )}
        </Grid.Col>
      </Grid>
    </div>
  );
}
