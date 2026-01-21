import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Table,
  Button,
  Group,
  TextInput,
  ActionIcon,
  Modal,
  Select,
  Checkbox,
  Textarea,
  NumberInput,
  LoadingOverlay,
  Text,
  Badge,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconEdit, IconTrash, IconSearch } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';

interface Article {
  _id: string;
  name: string;
  ipn: string;
  um: string;
  system_um_detail?: {
    name: string;
    abrev: string;
    symbol?: string;
  };
  category_detail?: {
    name: string;
  };
  description?: string;
  category_id?: string;
  is_active: boolean;
  total_stock?: number;
}

interface Location {
  _id: string;
  name: string;
}

interface Company {
  _id: string;
  name: string;
}

interface Category {
  _id: string;
  name: string;
}

export function ArticlesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [opened, { open, close }] = useDisclosure(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [suppliers, setSuppliers] = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    ipn: '',
    default_location_id: '',
    um: 'buc',
    supplier_id: '',
    minimum_stock: 0,
    default_expiry: 0,
    notes: '',
    is_component: true,
    is_assembly: true,
    is_testable: true,
    is_salable: false,
    is_active: true,
  });

  useEffect(() => {
    fetchArticles();
    fetchLocations();
    fetchSuppliers();
    fetchCategories();
  }, [search, sortBy, sortOrder, categoryFilter]);

  // Update category filter from URL params
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setCategoryFilter(categoryParam);
    }
  }, [searchParams]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (categoryFilter) params.append('category', categoryFilter);
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);

      const response = await api.get(`/modules/inventory/api/articles?${params.toString()}`);
      setArticles(response.data.results || []);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch articles',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await api.get('/modules/inventory/api/locations');
      setLocations(response.data || []);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/modules/inventory/api/companies?is_supplier=true');
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/modules/inventory/api/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleCategoryFilterChange = (value: string | null) => {
    const newValue = value || '';
    setCategoryFilter(newValue);
    
    // Update URL params
    if (newValue) {
      setSearchParams({ category: newValue });
    } else {
      setSearchParams({});
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/modules/inventory/api/articles', formData);
      notifications.show({
        title: 'Success',
        message: 'Article created successfully',
        color: 'green',
      });
      close();
      resetForm();
      fetchArticles();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to create article',
        color: 'red',
      });
    }
  };

  const handleDelete = (id: string, name: string) => {
    modals.openConfirmModal({
      title: 'Delete Article',
      children: (
        <Text size="sm">
          Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(`/modules/inventory/api/articles/${id}`);
          notifications.show({
            title: 'Success',
            message: 'Article deleted successfully',
            color: 'green',
          });
          fetchArticles();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: 'Failed to delete article',
            color: 'red',
          });
        }
      },
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      ipn: '',
      default_location_id: '',
      um: 'buc',
      supplier_id: '',
      minimum_stock: 0,
      default_expiry: 0,
      notes: '',
      is_component: true,
      is_assembly: true,
      is_testable: true,
      is_salable: false,
      is_active: true,
    });
  };

  const openCreateModal = () => {
    resetForm();
    open();
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>Articles</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
          Add Article
        </Button>
      </Group>

      <Paper p="md" mb="md">
        <Group>
          <TextInput
            placeholder="Search articles..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Category filter"
            data={[
              { value: '', label: 'All Categories' },
              ...categories.map(c => ({ value: c._id, label: c.name }))
            ]}
            value={categoryFilter}
            onChange={handleCategoryFilterChange}
            searchable
            clearable
            style={{ minWidth: '200px' }}
          />
        </Group>
      </Paper>

      <Paper p="md" pos="relative">
        <LoadingOverlay visible={loading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('ipn')}>
                Code {sortBy === 'ipn' && (sortOrder === 'asc' ? '↑' : '↓')}
              </Table.Th>
              <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </Table.Th>
              <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('um')}>
                MU {sortBy === 'um' && (sortOrder === 'asc' ? '↑' : '↓')}
              </Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th>Total Stock</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {articles.map((article) => (
              <Table.Tr key={article._id}>
                <Table.Td>{article.ipn}</Table.Td>
                <Table.Td>{article.name}</Table.Td>
                <Table.Td>{article.system_um_detail?.abrev || article.um || '-'}</Table.Td>
                <Table.Td>{article.description || '-'}</Table.Td>
                <Table.Td>{article.category_detail?.name || '-'}</Table.Td>
                <Table.Td>{article.total_stock || 0}</Table.Td>
                <Table.Td>
                  <Badge color={article.is_active ? 'green' : 'gray'}>
                    {article.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      component="a"
                      href={`/web/inventory/articles/${article._id}`}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => handleDelete(article._id, article.name)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal opened={opened} onClose={close} title="Add Article" size="lg">
        <TextInput
          label="Name"
          placeholder="Article name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
          mb="sm"
        />

        <TextInput
          label="IPN (Internal Part Number)"
          placeholder="IPN"
          required
          value={formData.ipn}
          onChange={(e) => setFormData({ ...formData, ipn: e.currentTarget.value })}
          mb="sm"
        />

        <Select
          label="Default Location"
          placeholder="Select location"
          data={locations.map((loc) => ({ value: loc._id, label: loc.name }))}
          value={formData.default_location_id}
          onChange={(value) => setFormData({ ...formData, default_location_id: value || '' })}
          searchable
          clearable
          mb="sm"
        />

        <TextInput
          label="Unit of Measure"
          placeholder="e.g., buc, kg, L"
          required
          value={formData.um}
          onChange={(e) => setFormData({ ...formData, um: e.currentTarget.value })}
          mb="sm"
        />

        <Select
          label="Supplier"
          placeholder="Select supplier"
          data={suppliers.map((sup) => ({ value: sup._id, label: sup.name }))}
          value={formData.supplier_id}
          onChange={(value) => setFormData({ ...formData, supplier_id: value || '' })}
          searchable
          clearable
          mb="sm"
        />

        <NumberInput
          label="Minimum Stock"
          placeholder="0"
          value={formData.minimum_stock}
          onChange={(value) => setFormData({ ...formData, minimum_stock: Number(value) || 0 })}
          mb="sm"
        />

        <NumberInput
          label="Default Expiry (days)"
          placeholder="0"
          value={formData.default_expiry}
          onChange={(value) => setFormData({ ...formData, default_expiry: Number(value) || 0 })}
          mb="sm"
        />

        <Group grow mb="sm">
          <Checkbox
            label="Component"
            checked={formData.is_component}
            onChange={(e) => setFormData({ ...formData, is_component: e.currentTarget.checked })}
          />
          <Checkbox
            label="Assembly"
            checked={formData.is_assembly}
            onChange={(e) => setFormData({ ...formData, is_assembly: e.currentTarget.checked })}
          />
        </Group>

        <Group grow mb="sm">
          <Checkbox
            label="Testable"
            checked={formData.is_testable}
            onChange={(e) => setFormData({ ...formData, is_testable: e.currentTarget.checked })}
          />
          <Checkbox
            label="Salable"
            checked={formData.is_salable}
            onChange={(e) => setFormData({ ...formData, is_salable: e.currentTarget.checked })}
          />
        </Group>

        <Checkbox
          label="Active"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.currentTarget.checked })}
          mb="sm"
        />

        <Textarea
          label="Notes"
          placeholder="Additional notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.currentTarget.value })}
          minRows={3}
          mb="md"
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create</Button>
        </Group>
      </Modal>
    </Container>
  );
}
