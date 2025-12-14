import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Title, Paper, Table, TextInput, Button, Group, Badge, ActionIcon, Text } from '@mantine/core';
import { IconSearch, IconPlus, IconArrowUp, IconArrowDown, IconEye } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import api from '../services/api';

interface Recipe {
  _id: string;
  id: number;
  name: string;
  code: string;
  rev: number;
  items_count: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

type SortField = 'name' | 'code' | 'items_count' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

export function RecipesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/recipes', {
        params: { search: search || undefined }
      });
      setRecipes(response.data);
    } catch (error: any) {
      console.error('Failed to load recipes:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to load recipes'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRecipes = useMemo(() => {
    const sorted = [...recipes].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle dates
      if (sortField === 'created_at' || sortField === 'updated_at') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      // Handle numbers
      if (sortField === 'items_count') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      }

      // Handle strings
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [recipes, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Recipes')}</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/recipes/new')}
        >
          {t('New Recipe')}
        </Button>
      </Group>

      <TextInput
        placeholder={t('Search by product name or code...')}
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            loadRecipes();
          }
        }}
        mb="md"
        size="md"
      />

      <Paper withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('name')}
              >
                <Group gap="xs">
                  {t('Product Name')}
                  <SortIcon field="name" />
                </Group>
              </Table.Th>
              <Table.Th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('code')}
              >
                <Group gap="xs">
                  {t('Code')}
                  <SortIcon field="code" />
                </Group>
              </Table.Th>
              <Table.Th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('items_count')}
              >
                <Group gap="xs">
                  {t('Items')}
                  <SortIcon field="items_count" />
                </Group>
              </Table.Th>
              <Table.Th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('updated_at')}
              >
                <Group gap="xs">
                  {t('Updated')}
                  <SortIcon field="updated_at" />
                </Group>
              </Table.Th>
              <Table.Th style={{ width: '80px' }}>{t('Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                  {t('Loading...')}
                </Table.Td>
              </Table.Tr>
            ) : sortedRecipes.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                  <Text c="dimmed">{t('No recipes found')}</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              sortedRecipes.map((recipe) => (
                <Table.Tr
                  key={recipe._id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/recipes/${recipe._id}`)}
                >
                  <Table.Td>
                    {recipe.name} <Text span c="dimmed">(rev {recipe.rev})</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">{recipe.code || '-'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color="blue">{recipe.items_count}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatDate(recipe.updated_at)}</Text>
                    <Text size="xs" c="dimmed">{recipe.updated_by}</Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/recipes/${recipe._id}`);
                      }}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Container>
  );
}
