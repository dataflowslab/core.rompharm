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
  Tabs,
  Grid,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconChefHat,
  IconDeviceFloppy,
  IconEdit,
  IconChevronDown,
  IconChevronRight,
  IconBook,
  IconHistory,
} from '@tabler/icons-react';
import api from '../services/api';
import { EditIngredientModal } from '../components/Recipes/EditIngredientModal';
import { AddAlternativeModal } from '../components/Recipes/AddAlternativeModal';

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

  // Edit ingredient modal state
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<{ item: RecipeItem; index: number; altIndex?: number } | null>(null);

  // Add alternative modal state
  const [addAltModalOpened, setAddAltModalOpened] = useState(false);
  const [addAltItemIndex, setAddAltItemIndex] = useState<number | null>(null);

  // Duplicate modal state
  const [duplicateModalOpened, setDuplicateModalOpened] = useState(false);
  const [duplicateParts, setDuplicateParts] = useState<Part[]>([]);
  const [duplicateSearch, setDuplicateSearch] = useState('');
  const [duplicateProductId, setDuplicateProductId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  // Expandable rows state
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  // Journal state
  const [logs, setLogs] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Form state for adding ingredient
  const [itemType, setItemType] = useState<string>('1');
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [mandatory, setMandatory] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleGroup = (index: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedGroups(newExpanded);
  };

  useEffect(() => {
    if (id) {
      loadRecipe();
      loadJournalData();
    }
  }, [id]);

  const loadJournalData = async () => {
    if (!id) return;
    
    setLogsLoading(true);
    try {
      const [logsRes, revisionsRes] = await Promise.all([
        api.get(`/api/recipes/${id}/logs`),
        api.get(`/api/recipes/${id}/revisions`)
      ]);
      
      setLogs(logsRes.data);
      setRevisions(revisionsRes.data);
    } catch (error) {
      console.error('Failed to load journal data:', error);
    } finally {
      setLogsLoading(false);
    }
  };

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

  const searchDuplicateParts = async (query: string) => {
    if (!query || query.length < 2) {
      setDuplicateParts([]);
      return;
    }

    try {
      const response = await api.get('/api/recipes/parts', {
        params: { search: query },
      });
      setDuplicateParts(response.data);
    } catch (error) {
      console.error('Failed to search parts:', error);
    }
  };

  const handleIncrementVersion = () => {
    modals.openConfirmModal({
      title: t('Increment Version'),
      children: (
        <Text size="sm">
          {t('Are you sure you want to increment the version? This will update the revision number and date.')}
        </Text>
      ),
      labels: { confirm: t('Confirm'), cancel: t('Cancel') },
      onConfirm: async () => {
        try {
          const response = await api.post(`/api/recipes/${id}/increment-version`);
          
          notifications.show({
            title: t('Success'),
            message: `${t('Version incremented to')} ${response.data.new_rev}`,
            color: 'green',
          });

          loadRecipe();
        } catch (error: any) {
          console.error('Failed to increment version:', error);
          notifications.show({
            title: t('Error'),
            message: error.response?.data?.detail || t('Failed to increment version'),
            color: 'red',
          });
        }
      },
    });
  };

  const handleDuplicate = async () => {
    if (!duplicateProductId) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a product'),
        color: 'red',
      });
      return;
    }

    setDuplicating(true);
    try {
      const response = await api.post(`/api/recipes/${id}/duplicate`, {
        product_id: parseInt(duplicateProductId)
      });

      notifications.show({
        title: t('Success'),
        message: t('Recipe duplicated successfully'),
        color: 'green',
      });

      setDuplicateModalOpened(false);
      setDuplicateProductId(null);
      setDuplicateSearch('');
      setDuplicateParts([]);

      // Navigate to new recipe
      navigate(`/recipes/${response.data._id}`);
    } catch (error: any) {
      console.error('Failed to duplicate recipe:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to duplicate recipe'),
        color: 'red',
      });
    } finally {
      setDuplicating(false);
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

  const handleDeleteAlternative = async (groupIndex: number, altIndex: number) => {
    if (!confirm(t('Are you sure you want to delete this alternative?'))) {
      return;
    }

    try {
      await api.delete(`/api/recipes/${id}/items/${groupIndex}/alternatives/${altIndex}`);

      notifications.show({
        title: t('Success'),
        message: t('Alternative deleted successfully'),
        color: 'green',
      });

      loadRecipe();
    } catch (error: any) {
      console.error('Failed to delete alternative:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete alternative'),
        color: 'red',
      });
    }
  };

  const renderItemRow = (item: RecipeItem, index: number) => {
    const isGroup = item.type === 2;
    const isExpired = item.fin && new Date(item.fin) < new Date();
    const isActive = !isExpired && (!item.start || new Date(item.start) <= new Date());
    const isExpanded = expandedGroups.has(index);

    const rows = [];

    // Main row
    rows.push(
      <Table.Tr 
        key={`main-${index}`}
        style={{ 
          backgroundColor: isExpired ? '#f5f5f5' : (isActive ? '#f0fdf4' : 'transparent'),
          opacity: isExpired ? 0.6 : 1,
          cursor: isGroup ? 'pointer' : 'default'
        }}
        onClick={() => isGroup && toggleGroup(index)}
      >
        <Table.Td>
          <Group gap="xs">
            {isGroup && (
              <ActionIcon size="sm" variant="subtle" color="gray">
                {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              </ActionIcon>
            )}
            {isGroup ? (
              <Text fw={500}>
                {t('Alternative Group')} ({item.items?.length || 0} {t('items')})
              </Text>
            ) : (
              <Text>{item.part_detail?.name || `Product ${item.id}`}</Text>
            )}
          </Group>
          {item.notes && (
            <Text size="xs" c="dimmed" mt={4} ml={isGroup ? 28 : 0}>
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
        <Table.Td onClick={(e) => e.stopPropagation()}>
          <Group gap="xs">
            {!isGroup && (
              <ActionIcon
                color="blue"
                variant="subtle"
                onClick={() => {
                  setEditingItem({ item, index });
                  setEditModalOpened(true);
                }}
                title={t('Edit')}
              >
                <IconEdit size={16} />
              </ActionIcon>
            )}
            {isGroup && (
              <ActionIcon
                color="green"
                variant="subtle"
                onClick={() => {
                  setAddAltItemIndex(index);
                  setAddAltModalOpened(true);
                }}
                title={t('Add Alternative')}
              >
                <IconPlus size={16} />
              </ActionIcon>
            )}
            <ActionIcon
              color="red"
              variant="subtle"
              onClick={() => handleDeleteItem(index)}
              title={t('Delete')}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>
    );

    // Subrows for alternatives (if group is expanded)
    if (isGroup && isExpanded && item.items) {
      item.items.forEach((alt, altIndex) => {
        const altExpired = alt.fin && new Date(alt.fin) < new Date();
        const altActive = !altExpired && (!alt.start || new Date(alt.start) <= new Date());
        
        rows.push(
          <Table.Tr 
            key={`alt-${index}-${altIndex}`}
            style={{ 
              backgroundColor: altExpired ? '#f8f8f8' : (altActive ? '#f7fef9' : '#fafafa'),
              opacity: altExpired ? 0.5 : 0.9
            }}
          >
            <Table.Td style={{ paddingLeft: '48px' }}>
              <Text size="sm">↳ {alt.part_detail?.name || `Product ${alt.id}`}</Text>
              {alt.notes && (
                <Text size="xs" c="dimmed" mt={2}>
                  {alt.notes}
                </Text>
              )}
            </Table.Td>
            <Table.Td>
              <Badge size="sm" color="gray" variant="outline">{t('Alternative')}</Badge>
            </Table.Td>
            <Table.Td>{alt.q}</Table.Td>
            <Table.Td><Text size="sm">{formatDate(alt.start)}</Text></Table.Td>
            <Table.Td><Text size="sm">{formatDate(alt.fin)}</Text></Table.Td>
            <Table.Td>-</Table.Td>
            <Table.Td>
              <Group gap="xs">
                <ActionIcon
                  color="blue"
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    setEditingItem({ item: alt, index, altIndex });
                    setEditModalOpened(true);
                  }}
                  title={t('Edit Alternative')}
                >
                  <IconEdit size={14} />
                </ActionIcon>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  size="sm"
                  onClick={() => handleDeleteAlternative(index, altIndex)}
                  title={t('Delete Alternative')}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>
        );
      });
    }

    return rows;
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
      <Group mb="xl" justify="space-between">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/recipes')}
        >
          {t('Back')}
        </Button>
        <Group>
          <Button
            variant="light"
            onClick={handleIncrementVersion}
          >
            {t('Increment Version')}
          </Button>
          <Button
            variant="light"
            color="green"
            onClick={() => setDuplicateModalOpened(true)}
          >
            {t('Duplicate Recipe')}
          </Button>
        </Group>
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

      {/* Main Tabs: Recipe & Journal */}
      <Tabs defaultValue="recipe" mb="md">
        <Tabs.List>
          <Tabs.Tab value="recipe" leftSection={<IconBook size={16} />}>
            {t('Recipe')}
          </Tabs.Tab>
          <Tabs.Tab value="journal" leftSection={<IconHistory size={16} />}>
            {t('Journal')}
          </Tabs.Tab>
        </Tabs.List>

        {/* Recipe Tab */}
        <Tabs.Panel value="recipe">
          <Paper withBorder mt="md">
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
              <Table.Th style={{ width: '120px' }}>{t('Actions')}</Table.Th>
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
              // Sort items: active first (green), then expired (gray) at the end
              [...recipe.items]
                .map((item, originalIndex) => ({ item, originalIndex }))
                .sort((a, b) => {
                  const aExpired = a.item.fin && new Date(a.item.fin) < new Date();
                  const bExpired = b.item.fin && new Date(b.item.fin) < new Date();
                  if (aExpired && !bExpired) return 1;  // a expired, move to end
                  if (!aExpired && bExpired) return -1; // b expired, move to end
                  return 0; // keep original order
                })
                .map(({ item, originalIndex }) => renderItemRow(item, originalIndex))
            )}
          </Table.Tbody>
        </Table>
          </Paper>
        </Tabs.Panel>

        {/* Journal Tab */}
        <Tabs.Panel value="journal">
          <Grid mt="md" gutter="md">
            {/* 2/3 - Logs Table */}
            <Grid.Col span={8}>
              <Paper withBorder>
                <Title order={5} p="md" style={{ borderBottom: '1px solid #dee2e6' }}>
                  {t('Change History')}
                </Title>
                {logsLoading ? (
                  <Group justify="center" p="xl">
                    <Loader size="sm" />
                  </Group>
                ) : logs.length === 0 ? (
                  <Text c="dimmed" p="md" ta="center">{t('No changes recorded yet')}</Text>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t('Date')}</Table.Th>
                        <Table.Th>{t('Action')}</Table.Th>
                        <Table.Th>{t('User')}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {logs.map((log) => (
                        <Table.Tr key={log._id}>
                          <Table.Td><Text size="sm">{formatDate(log.timestamp)}</Text></Table.Td>
                          <Table.Td><Badge>{log.action}</Badge></Table.Td>
                          <Table.Td><Text size="sm">{log.user}</Text></Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
            </Grid.Col>

            {/* 1/3 - Revisions List */}
            <Grid.Col span={4}>
              <Paper withBorder>
                <Title order={5} p="md" style={{ borderBottom: '1px solid #dee2e6' }}>
                  {t('Revisions')}
                </Title>
                <Stack gap="xs" p="md">
                  {revisions.map((rev) => (
                    <Paper
                      key={rev._id}
                      p="sm"
                      withBorder
                      style={{
                        cursor: 'pointer',
                        backgroundColor: rev.is_current ? '#e7f5ff' : 'transparent'
                      }}
                      onClick={() => navigate(`/recipes/${rev._id}`)}
                    >
                      <Group justify="space-between">
                        <Text fw={500}>Rev {rev.rev}</Text>
                        {rev.is_current && <Badge color="blue" size="sm">{t('Current')}</Badge>}
                      </Group>
                      <Text size="xs" c="dimmed">{formatDate(rev.rev_date)}</Text>
                      <Text size="xs" c="dimmed">{rev.updated_by}</Text>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>
      </Tabs>

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

      {/* Duplicate Recipe Modal */}
      <Modal
        opened={duplicateModalOpened}
        onClose={() => {
          setDuplicateModalOpened(false);
          setDuplicateProductId(null);
          setDuplicateSearch('');
          setDuplicateParts([]);
        }}
        title={t('Duplicate Recipe')}
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('Select a product for the new recipe. All ingredients will be copied.')}
          </Text>

          <Select
            label={t('Product')}
            placeholder={t('Search for product...')}
            data={duplicateParts.map((part) => ({
              value: String(part.id),
              label: `${part.name} (${part.IPN})`,
            }))}
            value={duplicateProductId}
            onChange={setDuplicateProductId}
            onSearchChange={(query) => {
              setDuplicateSearch(query);
              searchDuplicateParts(query);
            }}
            searchValue={duplicateSearch}
            searchable
            clearable
            required
            nothingFoundMessage={
              duplicateSearch.length < 2
                ? t('Type at least 2 characters')
                : t('No products found')
            }
          />

          <Divider />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setDuplicateModalOpened(false);
                setDuplicateProductId(null);
                setDuplicateSearch('');
                setDuplicateParts([]);
              }}
            >
              {t('Cancel')}
            </Button>
            <Button
              color="green"
              onClick={handleDuplicate}
              loading={duplicating}
            >
              {t('Duplicate')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Ingredient Modal */}
      {editingItem && (
        <EditIngredientModal
          opened={editModalOpened}
          onClose={() => {
            setEditModalOpened(false);
            setEditingItem(null);
          }}
          recipeId={id!}
          item={editingItem.item}
          itemIndex={editingItem.index}
          altIndex={editingItem.altIndex}
          onSuccess={() => {
            loadRecipe();
            notifications.show({
              title: t('Success'),
              message: t('Ingredient updated successfully'),
              color: 'green',
            });
          }}
        />
      )}

      {/* Add Alternative Modal */}
      {addAltItemIndex !== null && (
        <AddAlternativeModal
          opened={addAltModalOpened}
          onClose={() => {
            setAddAltModalOpened(false);
            setAddAltItemIndex(null);
          }}
          recipeId={id!}
          itemIndex={addAltItemIndex}
          onSuccess={() => {
            loadRecipe();
            notifications.show({
              title: t('Success'),
              message: t('Alternative added successfully'),
              color: 'green',
            });
          }}
        />
      )}
    </Container>
  );
}
