/**
 * LocationsPage
 * 
 * Hierarchical location management with:
 * - Tree structure with indentation
 * - Parent-child relationships
 * - Alphabetical ordering
 * - Link to filtered stocks
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
import { IconPlus, IconEdit, IconTrash, IconSearch, IconList, IconPrinter } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { Checkbox } from '@mantine/core';
import { PrintLabelsModal } from '../components/Common/PrintLabelsModal';

interface Location {
  _id: string;
  name: string;
  code?: string;
  type?: string;
  description?: string;
  parent_id?: string;
  parent_detail?: {
    name: string;
  };
  level?: number; // For tree rendering
  children?: Location[];
}

const LOCATION_TYPES = [
  { value: 'Depozit', label: 'Depozit' },
  { value: 'Secție', label: 'Secție' },
  { value: 'Laborator', label: 'Laborator' },
  { value: 'Altele', label: 'Altele' },
];

export function LocationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: '',
    description: '',
    parent_id: '',
  });

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const response = await api.get('/modules/inventory/api/locations');
      setLocations(response.data || []);
    } catch (error) {
      console.error('Failed to load locations:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load locations'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingLocation(null);
    setFormData({
      name: '',
      code: '',
      type: '',
      description: '',
      parent_id: '',
    });
    setModalOpened(true);
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      code: location.code || '',
      type: location.type || '',
      description: location.description || '',
      parent_id: location.parent_id || '',
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
    if (editingLocation && formData.parent_id === editingLocation._id) {
      notifications.show({
        title: t('Error'),
        message: t('A location cannot be its own parent'),
        color: 'red',
      });
      return;
    }

    // Prevent circular references (child cannot be parent of its ancestor)
    if (editingLocation && formData.parent_id) {
      const isDescendant = checkIfDescendant(formData.parent_id, editingLocation._id);
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
        code: formData.code || undefined,
        type: formData.type || undefined,
        description: formData.description || undefined,
        parent_id: formData.parent_id || undefined,
      };

      if (editingLocation) {
        await api.put(`/modules/inventory/api/locations/${editingLocation._id}`, payload);
        notifications.show({
          title: t('Success'),
          message: t('Location updated successfully'),
          color: 'green',
        });
      } else {
        await api.post('/modules/inventory/api/locations', payload);
        notifications.show({
          title: t('Success'),
          message: t('Location created successfully'),
          color: 'green',
        });
      }

      setModalOpened(false);
      loadLocations();
    } catch (error: any) {
      console.error('Failed to save location:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save location'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (location: Location) => {
    modals.openConfirmModal({
      title: t('Delete Location'),
      children: t('Are you sure you want to delete this location? This action cannot be undone.'),
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(`/modules/inventory/api/locations/${location._id}`);
          notifications.show({
            title: t('Success'),
            message: t('Location deleted successfully'),
            color: 'green',
          });
          loadLocations();
        } catch (error: any) {
          console.error('Failed to delete location:', error);
          notifications.show({
            title: t('Error'),
            message: error.response?.data?.detail || t('Failed to delete location'),
            color: 'red',
          });
        }
      },
    });
  };

  // Check if targetId is a descendant of locationId
  const checkIfDescendant = (targetId: string, locationId: string): boolean => {
    const target = locations.find(c => c._id === targetId);
    if (!target) return false;
    if (target.parent_id === locationId) return true;
    if (target.parent_id) return checkIfDescendant(target.parent_id, locationId);
    return false;
  };

  // Build tree structure with levels for indentation
  const buildTree = (locs: Location[]): Location[] => {
    const locationMap = new Map<string, Location>();
    const roots: Location[] = [];

    // Create map and initialize
    locs.forEach(loc => {
      locationMap.set(loc._id, { ...loc, children: [], level: 0 });
    });

    // Build parent-child relationships
    locationMap.forEach(loc => {
      if (loc.parent_id && locationMap.has(loc.parent_id)) {
        const parent = locationMap.get(loc.parent_id)!;
        parent.children!.push(loc);
      } else {
        roots.push(loc);
      }
    });

    // Sort alphabetically at each level
    const sortChildren = (items: Location[]) => {
      items.sort((a, b) => a.name.localeCompare(b.name));
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          sortChildren(item.children);
        }
      });
    };
    sortChildren(roots);

    // Flatten tree with levels
    const flatten = (items: Location[], level: number = 0): Location[] => {
      const result: Location[] = [];
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
  const filteredLocations = useMemo(() => {
    let filtered = locations;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = locations.filter(loc =>
        loc.name.toLowerCase().includes(query) ||
        loc.code?.toLowerCase().includes(query) ||
        loc.description?.toLowerCase().includes(query)
      );
    }

    return buildTree(filtered);
  }, [locations, searchQuery]);

  // Get parent options (exclude self and descendants when editing)
  const parentOptions = useMemo(() => {
    let available = locations;

    if (editingLocation) {
      // Exclude self
      available = available.filter(c => c._id !== editingLocation._id);

      // Exclude descendants
      const descendants = new Set<string>();
      const findDescendants = (parentId: string) => {
        locations.forEach(c => {
          if (c.parent_id === parentId && !descendants.has(c._id)) {
            descendants.add(c._id);
            findDescendants(c._id);
          }
        });
      };
      findDescendants(editingLocation._id);
      available = available.filter(c => !descendants.has(c._id));
    }

    return [
      { value: '', label: t('None (Root Location)') },
      ...available.map(c => ({ value: c._id, label: c.name }))
    ];
  }, [locations, editingLocation, t]);

  const toggleAll = () => {
    if (selectedLocations.length === filteredLocations.length) {
      setSelectedLocations([]);
    } else {
      setSelectedLocations(filteredLocations.map((l) => l._id));
    }
  };

  const toggleLocation = (id: string) => {
    if (selectedLocations.includes(id)) {
      setSelectedLocations(selectedLocations.filter((l) => l !== id));
    } else {
      setSelectedLocations([...selectedLocations, id]);
    }
  };

  const getSelectedItems = () => {
    return locations
      .filter((l) => selectedLocations.includes(l._id))
      .map((l) => ({
        id: l._id,
        name: l.name,
        code: l.code
      }));
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Locations')}</Title>
        <Group>
          {selectedLocations.length > 0 && (
            <Button
              variant="light"
              leftSection={<IconPrinter size={16} />}
              onClick={() => setPrintModalOpen(true)}
            >
              {t('Print Labels')} ({selectedLocations.length})
            </Button>
          )}
          <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
            {t('New Location')}
          </Button>
        </Group>
      </Group>

      <PrintLabelsModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        items={getSelectedItems()}
        table="depo_locations"
      />

      <Paper p="md" pos="relative">
        <LoadingOverlay visible={loading} />

        <TextInput
          placeholder={t('Search locations...')}
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          mb="md"
        />

        <Table striped withTableBorder withColumnBorders highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>
                <Checkbox
                  onChange={toggleAll}
                  checked={filteredLocations.length > 0 && selectedLocations.length === filteredLocations.length}
                  indeterminate={selectedLocations.length > 0 && selectedLocations.length !== filteredLocations.length}
                />
              </Table.Th>
              <Table.Th>{t('Name')}</Table.Th>
              <Table.Th>{t('Code')}</Table.Th>
              <Table.Th>{t('Type')}</Table.Th>
              <Table.Th>{t('Parent')}</Table.Th>
              <Table.Th style={{ width: '150px' }}>{t('Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredLocations.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  {searchQuery ? t('No results found') : t('No locations')}
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredLocations.map((location) => (
                <Table.Tr key={location._id}>
                  <Table.Td>
                    <Checkbox
                      checked={selectedLocations.includes(location._id)}
                      onChange={() => toggleLocation(location._id)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <span style={{ paddingLeft: `${(location.level || 0) * 24}px` }}>
                      {location.name}
                    </span>
                  </Table.Td>
                  <Table.Td>{location.code || '-'}</Table.Td>
                  <Table.Td>{location.type || '-'}</Table.Td>
                  <Table.Td>{location.parent_detail?.name || '-'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => navigate(`/inventory/stocks?location=${location._id}`)}
                        title={t('View Stocks')}
                      >
                        <IconList size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => handleEdit(location)}
                        title={t('Edit')}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(location)}
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
        title={editingLocation ? t('Edit Location') : t('New Location')}
        size="lg"
      >
        <Grid>
          <Grid.Col span={12}>
            <TextInput
              label={t('Name')}
              placeholder={t('Location name')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput
              label={t('Code')}
              placeholder={t('Location code')}
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Select
              label={t('Type')}
              placeholder={t('Select type')}
              data={LOCATION_TYPES}
              value={formData.type}
              onChange={(value) => setFormData({ ...formData, type: value || '' })}
              clearable
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Textarea
              label={t('Description')}
              placeholder={t('Location description')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              minRows={3}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Select
              label={t('Parent Location')}
              placeholder={t('Select parent location')}
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
            {editingLocation ? t('Update') : t('Create')}
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
