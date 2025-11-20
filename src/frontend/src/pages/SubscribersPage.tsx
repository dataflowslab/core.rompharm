import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Button,
  Table,
  Modal,
  TextInput,
  Checkbox,
  Group,
  Stack,
  ActionIcon,
  Badge,
  MultiSelect,
  Alert,
  Loader
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconDownload, IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import { ConfirmModal } from '../components/Common/ConfirmModal';

interface Subscriber {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  anaf?: any;
  email_marketing_consent: boolean;
  sms_marketing_consent: boolean;
  segments: string[];
  created_at: string;
}

interface Segment {
  id: string;
  name: string;
}

export function SubscribersPage() {
  const { t } = useTranslation();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const [subscriberToDelete, setSubscriberToDelete] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    tax_id: '',
    email_marketing_consent: false,
    sms_marketing_consent: false,
    segments: [] as string[]
  });

  useEffect(() => {
    loadSubscribers();
    loadSegments();
  }, []);

  const loadSubscribers = async () => {
    try {
      const response = await api.get('/api/crm/subscribers');
      setSubscribers(response.data);
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to load subscribers'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSegments = async () => {
    try {
      const response = await api.get('/api/crm/segments');
      setSegments(response.data);
    } catch (error) {
      console.error('Failed to load segments:', error);
    }
  };

  const handleOpenModal = (subscriber?: Subscriber) => {
    if (subscriber) {
      setEditingSubscriber(subscriber);
      setFormData({
        name: subscriber.name,
        email: subscriber.email || '',
        phone: subscriber.phone || '',
        tax_id: subscriber.tax_id || '',
        email_marketing_consent: subscriber.email_marketing_consent,
        sms_marketing_consent: subscriber.sms_marketing_consent,
        segments: subscriber.segments
      });
    } else {
      setEditingSubscriber(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        tax_id: '',
        email_marketing_consent: false,
        sms_marketing_consent: false,
        segments: []
      });
    }
    setModalOpened(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingSubscriber) {
        await api.put(`/api/crm/subscribers/${editingSubscriber.id}`, formData);
        notifications.show({
          title: t('Success'),
          message: t('Subscriber updated successfully'),
          color: 'green'
        });
      } else {
        await api.post('/api/crm/subscribers', formData);
        notifications.show({
          title: t('Success'),
          message: t('Subscriber created successfully'),
          color: 'green'
        });
      }
      setModalOpened(false);
      loadSubscribers();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save subscriber'),
        color: 'red'
      });
    }
  };

  const handleDelete = async () => {
    if (!subscriberToDelete) return;

    try {
      await api.delete(`/api/crm/subscribers/${subscriberToDelete}`);
      notifications.show({
        title: t('Success'),
        message: t('Subscriber deleted successfully'),
        color: 'green'
      });
      loadSubscribers();
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to delete subscriber'),
        color: 'red'
      });
    } finally {
      setDeleteConfirmOpened(false);
      setSubscriberToDelete(null);
    }
  };

  const handleImportFromInventree = async () => {
    setImporting(true);
    try {
      const response = await api.post('/api/crm/subscribers/import-inventree');
      notifications.show({
        title: t('Success'),
        message: `${t('Imported')}: ${response.data.imported}, ${t('Skipped')}: ${response.data.skipped}`,
        color: 'green'
      });
      loadSubscribers();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to import from InvenTree'),
        color: 'red'
      });
    } finally {
      setImporting(false);
    }
  };

  const segmentOptions = segments.map(s => ({ value: s.id, label: s.name }));

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Title order={3}>{t('Loading subscribers...')}</Title>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Group justify="space-between">
          <Title order={2}>{t('Subscribers')}</Title>
          <Group>
            <Button
              leftSection={<IconDownload size={16} />}
              onClick={handleImportFromInventree}
              loading={importing}
              variant="light"
            >
              {t('Import from InvenTree')}
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => handleOpenModal()}
            >
              {t('Add Subscriber')}
            </Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Name')}</Table.Th>
              <Table.Th>{t('Email')}</Table.Th>
              <Table.Th>{t('Phone')}</Table.Th>
              <Table.Th>{t('Tax ID')}</Table.Th>
              <Table.Th>{t('Consents')}</Table.Th>
              <Table.Th>{t('Segments')}</Table.Th>
              <Table.Th>{t('Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {subscribers.map((subscriber) => (
              <Table.Tr key={subscriber.id}>
                <Table.Td>{subscriber.name}</Table.Td>
                <Table.Td>{subscriber.email || '-'}</Table.Td>
                <Table.Td>{subscriber.phone || '-'}</Table.Td>
                <Table.Td>
                  {subscriber.tax_id || '-'}
                  {subscriber.anaf && (
                    <Badge size="xs" color="green" ml="xs">ANAF ✓</Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {subscriber.email_marketing_consent && (
                      <Badge size="xs" color="blue">Email</Badge>
                    )}
                    {subscriber.sms_marketing_consent && (
                      <Badge size="xs" color="cyan">SMS</Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {subscriber.segments.map(segId => {
                      const seg = segments.find(s => s.id === segId);
                      return seg ? (
                        <Badge key={segId} size="xs" variant="light">
                          {seg.name}
                        </Badge>
                      ) : null;
                    })}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      color="blue"
                      onClick={() => handleOpenModal(subscriber)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      onClick={() => {
                        setSubscriberToDelete(subscriber.id);
                        setDeleteConfirmOpened(true);
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {subscribers.length === 0 && (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No subscribers')}>
            {t('No subscribers found. Add your first subscriber or import from InvenTree.')}
          </Alert>
        )}
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingSubscriber ? t('Edit Subscriber') : t('Add Subscriber')}
        size="lg"
      >
        <Stack>
          <TextInput
            label={t('Name')}
            placeholder={t('Enter name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <TextInput
            label={t('Email')}
            placeholder={t('Enter email')}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <TextInput
            label={t('Phone')}
            placeholder={t('Enter phone')}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <TextInput
            label={t('Tax ID (CUI/CIF)')}
            placeholder={t('Enter tax ID')}
            value={formData.tax_id}
            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
            description={t('Will be verified with ANAF if provided')}
          />
          <Checkbox
            label={t('Email marketing consent')}
            checked={formData.email_marketing_consent}
            onChange={(e) => setFormData({ ...formData, email_marketing_consent: e.target.checked })}
          />
          <Checkbox
            label={t('SMS marketing consent')}
            checked={formData.sms_marketing_consent}
            onChange={(e) => setFormData({ ...formData, sms_marketing_consent: e.target.checked })}
          />
          <MultiSelect
            label={t('Segments')}
            placeholder={t('Select segments')}
            data={segmentOptions}
            value={formData.segments}
            onChange={(value) => setFormData({ ...formData, segments: value })}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setModalOpened(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingSubscriber ? t('Update') : t('Create')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={deleteConfirmOpened}
        onClose={() => setDeleteConfirmOpened(false)}
        onConfirm={handleDelete}
        title={t('Delete Subscriber')}
        message={t('Are you sure you want to delete this subscriber?')}
      />
    </Container>
  );
}
