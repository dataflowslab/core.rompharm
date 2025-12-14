import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Group,
  Button,
  Table,
  Badge,
  Text,
  ActionIcon,
  Stack,
  Loader,
  Modal,
  Select,
  NumberInput,
  Checkbox,
  Textarea,
  Divider,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconChefHat,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import api from '../services/api';

interface PartDetail {
  name: string;
  IPN: string;
}

interface RecipeItem {
  type: number;
  id?: number;
  q?: number;
  start?: string;
  fin?: string;
  mandatory: boolean;
  notes?: string;
  part_detail?: PartDetail;
  items?: RecipeItem[];
}

interface Recipe {
  _id: string;
  id: number;
  rev: number;
  rev_date: string;
  items: RecipeItem[];
  product_detail: PartDetail;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

interface Part {
  id: number;
  name: string;
  IPN: string;
}

export function RecipeDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [addModalOpened, setAddModalOpened] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [searchValue, setSearchValue] = useState('');

  // Form state for adding ingredient
  const [itemType, setItemType] = useState<string>('1');
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [mandatory, setMandatory] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      loadRecipe();
    }
  }, [id]);

  const loadRecipe = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/recipes/${id}`);
      setRecipe(response.data);
    } catch (error: any) {
      console.error('Failed to load recipe:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to load recipe'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const searchParts = async (query: string) => {
    if (!query || query.length < 2) {
      setParts([]);
      return;
    }

    try {
      const response = await api.get('/api/recipes/parts', {
        params: { search: query },
      });
      setParts(response.data);
    } catch (error) {
      console.error('Failed to search parts:', error);
    }
  };

  const handleAddItem = async () => {
    if (itemType === '1' && !selectedPart) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a product'),
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      const itemData: any = {
        type: parseInt(itemType),
        mandatory,
        notes: notes || undefined,
      };

      if (itemType === '1') {
        itemData.product_id = parseInt(selectedPart!);
        itemData.q = quantity;
        itemData.start = startDate.toISOString();
        if (endDate) {
          itemData.fin = endDate.toISOString();
        }
      }

      await api.post(`/api/recipes/${id}/items`, itemData);

      notifications.show({
        title: t('Success'),
        message: t('Ingredient added successfully'),
        color: 'green',
      });

      setAddModalOpened(false);
      resetForm();
      loadRecipe();
    } catch (error: any) {
      console.error('Failed to add item:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to add ingredient'),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (index: number) => {
    if (!confirm(t('Are you sure you want to delete this ingredient?'))) {
      return;
    }

    try {
      await api.delete(`/api/recipes/${id}/items/${index}`);

      notifications.show({
        title: t('Success'),
        message: t('Ingredient deleted successfully'),
        color: 'green',
      });

      loadRecipe();
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete ingredient'),
        color: 'red',
      });
    }
  };

  const resetForm = () => {
    setItemType('1');
    setSelectedPart(null);
    setQuantity(1);
    setStartDate(new Date());
    setEndDate(null);
    setMandatory(true);
    setNotes('');
    setSearchValue('');
    setParts([]);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const renderAlternatives = (items?: RecipeItem[]) => {
    if (!items || items.length === 0) return '-';
    return items
      .map((item) => `${item.part_detail?.name || 'Unknown'} (x${item.q || 0})`)
      .join(', ');
  };

  const renderItemRow = (item: RecipeItem, index: number) => {
    const isGroup = item.type === 2;

    return (
      <Table.Tr key={index}>
        <Table.Td>
          {isGroup ? (
            <Text fw={500}>{renderAlternatives(item.items)}</Text>
          ) : (
            <Text>{item.part_detail?.name || `Product ${item.id}`}</Text>
          )}
          {item.notes && (
            <Text size="xs" c="dimmed" mt={4}>
              {item.notes}
            </Text>
          )}
        </Table.Td>
        <Table.Td>
          <Badge color={isGroup ? 'blue' : 'gray'}>
            {isGroup ? t('Alternatives') : t('Single')}
          </Badge>
        </Table.Td>
        <Table.Td>{isGroup ? '-' : item.q}</Table.Td>
        <Table.Td>{formatDate(item.start)}</Table.Td>
        <Table.Td>{formatDate(item.fin)}</Table.Td>
        <Table.Td>
          <Badge color={item.mandatory ? 'green' : 'gray'}>
            {item.mandatory ? t('Yes') : t('No')}
          </Badge>
        </Table.Td>
        <Table.Td>
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={() => handleDeleteItem(index)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Table.Td>
      </Table.Tr>
    );
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (!recipe) {
    return (
      <Container size="xl" py="xl">
        <Text>{t('Recipe not found')}</Text>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Group mb="xl">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/recipes')}
        >
          {t('Back')}
        </Button>
      </Group>

      {/* Recipe Header */}
      <Paper p="md" withBorder mb="md">
        <Group justify="space-between">
          <Group>
            <IconChefHat size={32} />
            <div>
              <Title order={3}>{recipe.product_detail.name}</Title>
              <Text size="sm" c="dimmed">
                {t('Code')}: {recipe.product_detail.IPN}
              </Text>
            </div>
          </Group>
          <div style={{ textAlign: 'right' }}>
            <Text size="sm">
              {t('Revision')}: {recipe.rev}
            </Text>
            <Text size="xs" c="dimmed">
              {formatDate(recipe.rev_date)}
            </Text>
          </div>
        </Group>
      </Paper>

      {/* Ingredients Table */}
      <Paper withBorder mb="md">
        <Group justify="space-between" p="md" style={{ borderBottom: '1px solid #dee2e6' }}>
          <Title order={4}>{t('Ingredients')}</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setAddModalOpened(true)}
          >
            {t('Add Ingredient')}
          </Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Description')}</Table.Th>
              <Table.Th>{t('Type')}</Table.Th>
              <Table.Th>{t('Quantity')}</Table.Th>
              <Table.Th>{t('Start Date')}</Table.Th>
              <Table.Th>{t('End Date')}</Table.Th>
              <Table.Th>{t('Mandatory')}</Table.Th>
              <Table.Th style={{ width: '80px' }}>{t('Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {recipe.items.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                  <Text c="dimmed">{t('No ingredients added yet')}</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              recipe.items.map((item, index) => renderItemRow(item, index))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Recipe Info */}
      <Paper p="md" withBorder>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {t('Created')}:
            </Text>
            <Text size="sm">
              {formatDate(recipe.created_at)} {t('by')} {recipe.created_by}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {t('Updated')}:
            </Text>
            <Text size="sm">
              {formatDate(recipe.updated_at)} {t('by')} {recipe.updated_by}
            </Text>
          </Group>
        </Stack>
      </Paper>

      {/* Add Ingredient Modal */}
      <Modal
        opened={addModalOpened}
        onClose={() => {
          setAddModalOpened(false);
          resetForm();
        }}
        title={t('Add Ingredient')}
        size="lg"
      >
        <Stack gap="md">
          <Select
            label={t('Type')}
            data={[
              { value: '1', label: t('Single Product') },
              { value: '2', label: t('Alternative Group') },
            ]}
            value={itemType}
            onChange={(value) => setItemType(value || '1')}
          />

          {itemType === '1' && (
            <>
              <Select
                label={t('Product')}
                placeholder={t('Search for product...')}
                data={parts.map((part) => ({
                  value: String(part.id),
                  label: `${part.name} (${part.IPN})`,
                }))}
                value={selectedPart}
                onChange={setSelectedPart}
                onSearchChange={(query) => {
                  setSearchValue(query);
                  searchParts(query);
                }}
                searchValue={searchValue}
                searchable
                clearable
                nothingFoundMessage={
                  searchValue.length < 2
                    ? t('Type at least 2 characters')
                    : t('No products found')
                }
              />

              <NumberInput
                label={t('Quantity')}
                value={quantity}
                onChange={(value) => setQuantity(Number(value) || 1)}
                min={0}
                step={0.1}
              />

              <DatePickerInput
                label={t('Start Date')}
                value={startDate}
                onChange={(date) => setStartDate(date || new Date())}
              />

              <DatePickerInput
                label={t('End Date')}
                placeholder={t('Optional')}
                value={endDate}
                onChange={setEndDate}
                clearable
              />
            </>
          )}

          {itemType === '2' && (
            <Text size="sm" c="dimmed">
              {t('After creating the group, you can add alternative products to it.')}
            </Text>
          )}

          <Checkbox
            label={t('Mandatory')}
            checked={mandatory}
            onChange={(e) => setMandatory(e.currentTarget.checked)}
          />

          <Textarea
            label={t('Notes')}
            placeholder={t('Optional notes...')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={3}
          />

          <Divider />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setAddModalOpened(false);
                resetForm();
              }}
            >
              {t('Cancel')}
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleAddItem}
              loading={saving}
            >
              {t('Add')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
