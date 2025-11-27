import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Button,
  Table,
  Modal,
  TextInput,
  Textarea,
  Group,
  Stack,
  ActionIcon,
  Alert,
  Loader
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import { ConfirmModal } from '../components/Common/ConfirmModal';

interface Segment {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export function SegmentsPage() {
  const { t } = useTranslation();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const [segmentToDelete, setSegmentToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    loadSegments();
  }, []);

  const loadSegments = async () => {
    try {
      const response = await api.get('/api/crm/segments');
      setSegments(response.data);
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to load segments'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (segment?: Segment) => {
    if (segment) {
      setEditingSegment(segment);
      setFormData({
        name: segment.name,
        description: segment.description || ''
      });
    } else {
      setEditingSegment(null);
      setFormData({
        name: '',
        description: ''
      });
    }
    setModalOpened(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingSegment) {
        await api.put(`/api/crm/segments/${editingSegment.id}`, formData);
        notifications.show({
          title: t('Success'),
          message: t('Segment updated successfully'),
          color: 'green'
        });
      } else {
        await api.post('/api/crm/segments', formData);
        notifications.show({
          title: t('Success'),
          message: t('Segment created successfully'),
          color: 'green'
        });
      }
      setModalOpened(false);
      loadSegments();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save segment'),
        color: 'red'
      });
    }
  };

  const handleDelete = async () => {
    if (!segmentToDelete) return;

    try {
      await api.delete(`/api/crm/segments/${segmentToDelete}`);
      notifications.show({
        title: t('Success'),
        message: t('Segment deleted successfully'),
        color: 'green'
      });
      loadSegments();
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to delete segment'),
        color: 'red'
      });
    } finally {
      setDeleteConfirmOpened(false);
      setSegmentToDelete(null);
    }
  };

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Title order={3}>{t('Loading segments...')}</Title>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Group justify="space-between">
          <Title order={2}>{t('Segments')}</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => handleOpenModal()}
          >
            {t('Add Segment')}
          </Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Name')}</Table.Th>
              <Table.Th>{t('Description')}</Table.Th>
              <Table.Th>{t('Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {segments.map((segment) => (
              <Table.Tr key={segment.id}>
                <Table.Td>{segment.name}</Table.Td>
                <Table.Td>{segment.description || '-'}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      color="blue"
                      onClick={() => handleOpenModal(segment)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      onClick={() => {
                        setSegmentToDelete(segment.id);
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

        {segments.length === 0 && (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No segments')}>
            {t('No segments found. Add your first segment to organize subscribers.')}
          </Alert>
        )}
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingSegment ? t('Edit Segment') : t('Add Segment')}
      >
        <Stack>
          <TextInput
            label={t('Name')}
            placeholder={t('Enter segment name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Textarea
            label={t('Description')}
            placeholder={t('Enter description')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setModalOpened(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingSegment ? t('Update') : t('Create')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={deleteConfirmOpened}
        onClose={() => setDeleteConfirmOpened(false)}
        onConfirm={handleDelete}
        title={t('Delete Segment')}
        message={t('Are you sure you want to delete this segment?')}
      />
    </Container>
  );
}
