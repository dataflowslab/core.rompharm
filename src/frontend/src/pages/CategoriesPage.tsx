/**
 * CategoriesPage
 * 
 * Hierarchical category management with:
 * - Tree structure with indentation
 * - Parent-child relationships
 * - Alphabetical ordering
 * - Link to filtered articles
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Table,
  Button,
  Group,
  TextInput,
  Modal,
  Grid,
  Select,
  LoadingOverlay,
  ActionIcon,
  Textarea,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconSearch, IconList } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';

interface Category {
  _id: string;
  name: string;
  description?: string;
  parent_id?: string;
  parent_detail?: {
    name: string;
  };
  level?: number; // For tree rendering
  children?: Category[];
}

export function CategoriesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_id: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const response = await api.get('/modules/inventory/api/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load categories'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      parent_id: '',
    });
    setModalOpened(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parent_id: category.parent_id || '',
    });
    setModalOpened(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      notifications.show({
        title: t('Error'),
        message: t('Name is required'),
        color: 'red',
      });
      return;
    }

    // Prevent self-parenting
    if (editingCategory && formData.parent_id === editingCategory._id) {
      notifications.show({
        title: t('Error'),
        message: t('A category cannot be its own parent'),
        color: 'red',
      });
      return;
    }

    // Prevent circular references (child cannot be parent of its ancestor)
    if (editingCategory && formData.parent_id) {
      const isDescendant = checkIfDescendant(formData.parent_id, editingCategory._id);
      if (isDescendant) {
        notifications.show({
          title: t('Error'),
          message: t('Cannot set a descendant as parent (circular reference)'),
          color: 'red',
        });
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        parent_id: formData.parent_id || undefined,
      };

      if (editingCategory) {
        await api.put(`/modules/inventory/api/categories/${editingCategory._id}`, payload);
        notifications.show({
          title: t('Success'),
          message: t('Category updated successfully'),
          color: 'green',
        });
      } else {
        await api.post('/modules/inventory/api/categories', payload);
        notifications.show({
          title: t('Success'),
          message: t('Category created successfully'),
          color: 'green',
        });
      }

      setModalOpened(false);
      loadCategories();
    } catch (error: any) {
      console.error('Failed to save category:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save category'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (category: Category) => {
    modals.openConfirmModal({
      title: t('Delete Category'),
      children: t('Are you sure you want to delete this category? This action cannot be undone.'),
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(`/modules/inventory/api/categories/${category._id}`);
          notifications.show({
            title: t('Success'),
            message: t('Category deleted successfully'),
            color: 'green',
          });
          loadCategories();
        } catch (error: any) {
          console.error('Failed to delete category:', error);
          notifications.show({
            title: t('Error'),
            message: error.response?.data?.detail || t('Failed to delete category'),
            color: 'red',
          });
        }
      },
    });
  };

  // Check if targetId is a descendant of categoryId
  const checkIfDescendant = (targetId: string, categoryId: string): boolean => {
    const target = categories.find(c => c._id === targetId);
    if (!target) return false;
    if (target.parent_id === categoryId) return true;
    if (target.parent_id) return checkIfDescendant(target.parent_id, categoryId);
    return false;
  };

  // Build tree structure with levels for indentation
  const buildTree = (cats: Category[]): Category[] => {
    const categoryMap = new Map<string, Category>();
    const roots: Category[] = [];

    // Create map and initialize
    cats.forEach(cat => {
      categoryMap.set(cat._id, { ...cat, children: [], level: 0 });
    });

    // Build parent-child relationships
    categoryMap.forEach(cat => {
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        const parent = categoryMap.get(cat.parent_id)!;
        parent.children!.push(cat);
      } else {
        roots.push(cat);
      }
    });

    // Sort alphabetically at each level
    const sortChildren = (items: Category[]) => {
      items.sort((a, b) => a.name.localeCompare(b.name));
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          sortChildren(item.children);
        }
      });
    };
    sortChildren(roots);

    // Flatten tree with levels
    const flatten = (items: Category[], level: number = 0): Category[] => {
      const result: Category[] = [];
      items.forEach(item => {
        result.push({ ...item, level });
        if (item.children && item.children.length > 0) {
          result.push(...flatten(item.children, level + 1));
        }
      });
      return result;
    };

    return flatten(roots);
  };

  // Filter and build tree
  const filteredCategories = useMemo(() => {
    let filtered = categories;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = categories.filter(cat => 
        cat.name.toLowerCase().includes(query) ||
        cat.description?.toLowerCase().includes(query)
      );
    }

    return buildTree(filtered);
  }, [categories, searchQuery]);

  // Get parent options (exclude self and descendants when editing)
  const parentOptions = useMemo(() => {
    let available = categories;
    
    if (editingCategory) {
      // Exclude self
      available = available.filter(c => c._id !== editingCategory._id);
      
      // Exclude descendants
      const descendants = new Set<string>();
      const findDescendants = (parentId: string) => {
        categories.forEach(c => {
          if (c.parent_id === parentId && !descendants.has(c._id)) {
            descendants.add(c._id);
            findDescendants(c._id);
          }
        });
      };
      findDescendants(editingCategory._id);
      available = available.filter(c => !descendants.has(c._id));
    }

    return [
      { value: '', label: t('None (Root Category)') },
      ...available.map(c => ({ value: c._id, label: c.name }))
    ];
  }, [categories, editingCategory, t]);

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Categories')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
          {t('New Category')}
        </Button>
      </Group>

      <Paper p="md" pos="relative">
        <LoadingOverlay visible={loading} />

        <TextInput
          placeholder={t('Search categories...')}
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          mb="md"
        />

        <Table striped withTableBorder withColumnBorders highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Name')}</Table.Th>
              <Table.Th>{t('Description')}</Table.Th>
              <Table.Th>{t('Parent')}</Table.Th>
              <Table.Th style={{ width: '150px' }}>{t('Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredCategories.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  {searchQuery ? t('No results found') : t('No categories')}
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredCategories.map((category) => (
                <Table.Tr key={category._id}>
                  <Table.Td>
                    <span style={{ paddingLeft: `${(category.level || 0) * 24}px` }}>
                      {category.name}
                    </span>
                  </Table.Td>
                  <Table.Td>{category.description || '-'}</Table.Td>
                  <Table.Td>{category.parent_detail?.name || '-'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => navigate(`/inventory/articles?category=${category._id}`)}
                        title={t('View Articles')}
                      >
                        <IconList size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => handleEdit(category)}
                        title={t('Edit')}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(category)}
                        title={t('Delete')}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Create/Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingCategory ? t('Edit Category') : t('New Category')}
        size="lg"
      >
        <Grid>
          <Grid.Col span={12}>
            <TextInput
              label={t('Name')}
              placeholder={t('Category name')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Textarea
              label={t('Description')}
              placeholder={t('Category description')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              minRows={3}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Select
              label={t('Parent Category')}
              placeholder={t('Select parent category')}
              data={parentOptions}
              value={formData.parent_id}
              onChange={(value) => setFormData({ ...formData, parent_id: value || '' })}
              searchable
              clearable
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setModalOpened(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {editingCategory ? t('Update') : t('Create')}
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
