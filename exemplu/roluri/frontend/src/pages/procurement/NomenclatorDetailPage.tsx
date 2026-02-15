/**
 * NomenclatorDetailPage - Pagină pentru gestionarea unui nomenclator
 * Cu AJAX loading, paginare, căutare și sortare pe coloane
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Title,
  Paper,
  Table,
  TextInput,
  Button,
  Group,
  Pagination,
  LoadingOverlay,
  Text,
  ActionIcon,
  Tooltip,
  Modal,
  Stack,
  Alert
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconArrowLeft,
  IconArrowUp,
  IconArrowDown
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useDebouncedValue } from '@mantine/hooks';

interface NomenclatorItem {
  _id?: string;
  [key: string]: any;
}

interface FieldDefinition {
  type: string;
  required: boolean;
  name: string;
}

export function NomenclatorDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { table } = useParams<{ table: string }>();
  
  // State pentru listă
  const [items, setItems] = useState<NomenclatorItem[]>([]);
  const [fields, setFields] = useState<Record<string, FieldDefinition>>({});
  const [nomenclatorName, setNomenclatorName] = useState('');
  const [loading, setLoading] = useState(true);
  
  // State pentru paginare
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  
  // State pentru căutare
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  
  // State pentru sortare
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // State pentru modale
  const [modalOpened, setModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<NomenclatorItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  
  const form = useForm({
    initialValues: {} as Record<string, any>
  });
  
  // Încărcare nomenclator
  const loadNomenclator = useCallback(async () => {
    if (!table) return;
    
    try {
      setLoading(true);
      
      // Load nomenclator definition
      const defResponse = await api.get(`/api/datasets/${table}/definition`);
      const fieldsData = defResponse.data.fields;
      
      // Handle both array and object formats
      let fieldsObj: Record<string, FieldDefinition> = {};
      if (Array.isArray(fieldsData)) {
        fieldsObj = fieldsData[0] || {};
      } else if (typeof fieldsData === 'object') {
        fieldsObj = fieldsData;
      }
      
      setFields(fieldsObj);
      setNomenclatorName(defResponse.data.name);
      
      // Load items with pagination, search and sorting
      const params: any = {
        page,
        limit,
      };
      
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      
      if (sortBy) {
        params.sort_by = sortBy;
        params.sort_order = sortOrder;
      }
      
      const itemsResponse = await api.get(`/api/datasets/${table}/items`, { params });
      
      // Handle both array and object response formats
      if (Array.isArray(itemsResponse.data)) {
        setItems(itemsResponse.data);
        setTotal(itemsResponse.data.length);
        setTotalPages(1);
      } else {
        setItems(itemsResponse.data.items || []);
        setTotal(itemsResponse.data.total || 0);
        setTotalPages(itemsResponse.data.pages || 1);
      }
      
    } catch (error) {
      console.error('Failed to load nomenclator:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load nomenclator'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [table, page, limit, debouncedSearch, sortBy, sortOrder, t]);
  
  useEffect(() => {
    loadNomenclator();
  }, [loadNomenclator]);
  
  // Reset page când se schimbă căutarea
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [debouncedSearch]);
  
  // Deschide modal pentru adăugare/editare
  const handleOpenModal = (item?: NomenclatorItem) => {
    if (item) {
      setEditingItem(item);
      const formValues: Record<string, any> = {};
      Object.keys(fields).forEach(key => {
        formValues[key] = item[key] || '';
      });
      form.setValues(formValues);
    } else {
      setEditingItem(null);
      const formValues: Record<string, any> = {};
      Object.keys(fields).forEach(key => {
        formValues[key] = '';
      });
      form.setValues(formValues);
    }
    setModalOpened(true);
  };
  
  // Salvare item
  const handleSave = async (values: Record<string, any>) => {
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
      loadNomenclator();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save item'),
        color: 'red',
      });
    }
  };
  
  // Deschide modal pentru ștergere
  const handleOpenDeleteModal = (itemId: string) => {
    setDeletingItemId(itemId);
    setDeleteModalOpened(true);
  };
  
  // Ștergere item
  const handleDelete = async () => {
    if (!deletingItemId) return;
    
    try {
      await api.delete(`/api/datasets/${table}/items/${deletingItemId}`);
      notifications.show({
        title: t('Success'),
        message: t('Item deleted successfully'),
        color: 'green',
      });
      setDeleteModalOpened(false);
      setDeletingItemId(null);
      loadNomenclator();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete item'),
        color: 'red',
      });
    }
  };
  
  // Sortare pe coloană
  const handleSort = (fieldName: string) => {
    if (sortBy === fieldName) {
      // Toggle sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(fieldName);
      setSortOrder('asc');
    }
  };
  
  // Render sort icon
  const renderSortIcon = (fieldName: string) => {
    if (sortBy !== fieldName) return null;
    return sortOrder === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
  };
  
  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate('/procurement/nomenclatoare')}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={2}>{nomenclatorName}</Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => handleOpenModal()}
        >
          {t('New item')}
        </Button>
      </Group>
      
      <Paper shadow="xs" p="md" mb="md">
        <Group>
          <TextInput
            placeholder={t('Search...')}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Text size="sm" c="dimmed">
            Total: {total} {t('items')}
          </Text>
        </Group>
      </Paper>
      
      <Paper shadow="xs" p="md" pos="relative">
        <LoadingOverlay visible={loading} />
        
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 60 }}>#</Table.Th>
              {Object.entries(fields).map(([fieldName, fieldDef]) => (
                <Table.Th
                  key={fieldName}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort(fieldName)}
                >
                  <Group gap="xs">
                    {fieldDef.name}
                    {renderSortIcon(fieldName)}
                  </Group>
                </Table.Th>
              ))}
              <Table.Th style={{ width: 120 }}>{t('Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item, index) => (
              <Table.Tr key={item._id}>
                <Table.Td>{(page - 1) * limit + index + 1}</Table.Td>
                {Object.keys(fields).map((fieldName) => (
                  <Table.Td key={fieldName}>
                    {item[fieldName] !== undefined && item[fieldName] !== null
                      ? String(item[fieldName])
                      : '-'}
                  </Table.Td>
                ))}
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label={t('Edit')}>
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => handleOpenModal(item)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('Delete')}>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleOpenDeleteModal(item._id!)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !loading && (
              <Table.Tr>
                <Table.Td colSpan={Object.keys(fields).length + 2}>
                  <Text ta="center" c="dimmed" py="xl">
                    {t('No items found')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
        
        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination
              value={page}
              onChange={setPage}
              total={totalPages}
            />
          </Group>
        )}
      </Paper>
      
      {/* Modal pentru adăugare/editare */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingItem ? t('Edit item') : t('New item')}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSave)}>
          <Stack>
            {Object.entries(fields).map(([fieldName, fieldDef]) => (
              <TextInput
                key={fieldName}
                label={fieldDef.name}
                required={fieldDef.required}
                {...form.getInputProps(fieldName)}
              />
            ))}
            
            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={() => setModalOpened(false)}>
                {t('Cancel')}
              </Button>
              <Button type="submit">
                {t('Save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      
      {/* Modal pentru confirmare ștergere */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title={t('Confirm deletion')}
      >
        <Stack>
          <Alert color="red" icon={<IconTrash size={16} />}>
            {t('Are you sure you want to delete this item? This action cannot be undone.')}
          </Alert>
          
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setDeleteModalOpened(false)}>
              {t('Cancel')}
            </Button>
            <Button color="red" onClick={handleDelete}>
              {t('Delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

export default NomenclatorDetailPage;
