import { useEffect, useState } from 'react';
import { useParams, useNavigate } from '../../../src/frontend/node_modules/react-router-dom';
import {
  Container,
  Title,
  Button,
  Table,
  Group,
  Modal,
  TextInput,
  ActionIcon,
  Loader,
  Text,
  Paper,
  Stack,
} from '@mantine/core';
import { IconPlus, IconTrash, IconEdit, IconArrowLeft } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../src/frontend/src/services/api';
import { notifications } from '@mantine/notifications';

interface DatasetItem {
  _id?: string;
  [key: string]: any;
}

interface FieldDefinition {
  type: string;
  required: boolean;
  name: string;
}

export function DatasetDetailPage() {
  const { t } = useTranslation();
  const { table } = useParams<{ table: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<DatasetItem[]>([]);
  const [fields, setFields] = useState<Record<string, FieldDefinition>>({});
  const [datasetName, setDatasetName] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<DatasetItem | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  useEffect(() => {
    loadDataset();
  }, [table]);

  const loadDataset = async () => {
    try {
      setLoading(true);
      // Load dataset definition
      const defResponse = await api.get(`/api/datasets/${table}/definition`);
      setFields(defResponse.data.fields[0] || {});
      setDatasetName(defResponse.data.name);

      // Load items
      const itemsResponse = await api.get(`/api/datasets/${table}/items`);
      setItems(itemsResponse.data);
    } catch (error) {
      console.error('Failed to load dataset:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load dataset'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item?: DatasetItem) => {
    if (item) {
      setEditingItem(item);
      const values: any = {};
      Object.keys(fields).forEach((key) => {
        values[key] = item[key] || '';
      });
      setFormValues(values);
    } else {
      setEditingItem(null);
      const values: any = {};
      Object.keys(fields).forEach((key) => {
        values[key] = '';
      });
      setFormValues(values);
    }
    setModalOpened(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = formValues;
    try {
      if (editingItem) {
        await api.put(`/api/datasets/${table}/items/${editingItem._id}`, values);
        notifications.show({
          title: t('Success'),
          message: t('Item updated successfully'),
          color: 'green',
        });
      } else {
        await api.post(`/api/datasets/${table}/items`, values);
        notifications.show({
          title: t('Success'),
          message: t('Item created successfully'),
          color: 'green',
        });
      }
      setModalOpened(false);
      loadDataset();
    } catch (error: any) {
      console.error('Failed to save item:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save item'),
        color: 'red',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('Are you sure you want to delete this item?'))) {
      return;
    }

    try {
      await api.delete(`/api/datasets/${table}/items/${id}`);
      notifications.show({
        title: t('Success'),
        message: t('Item deleted successfully'),
        color: 'green',
      });
      loadDataset();
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete item'),
        color: 'red',
      });
    }
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate('/datasets')}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={2}>{datasetName}</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpenModal()}>
          {t('New item')}
        </Button>
      </Group>

      {loading ? (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      ) : items.length === 0 ? (
        <Paper withBorder shadow="sm" p="xl">
          <Text c="dimmed" ta="center">
            {t('No items found')}
          </Text>
        </Paper>
      ) : (
        <Paper withBorder shadow="sm" p="md">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                {Object.entries(fields).map(([key, field]) => (
                  <Table.Th key={key}>{field.name}</Table.Th>
                ))}
                <Table.Th>{t('Actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item, index) => (
                <Table.Tr key={item._id}>
                  <Table.Td>{index + 1}</Table.Td>
                  {Object.keys(fields).map((key) => (
                    <Table.Td key={key}>{item[key]}</Table.Td>
                  ))}
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon variant="subtle" color="blue" onClick={() => handleOpenModal(item)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item._id!)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingItem ? t('Edit item') : t('New item')}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {Object.entries(fields).map(([key, field]) => (
              <TextInput
                key={key}
                label={field.name}
                required={field.required}
                value={formValues[key] || ''}
                onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
              />
            ))}
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setModalOpened(false)}>
                {t('Cancel')}
              </Button>
              <Button type="submit">{t('Save')}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
