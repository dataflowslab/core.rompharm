import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Table,
  Loader,
  Alert,
  Text,
  Stack,
  Button,
  Group,
  Modal,
  TextInput,
  Textarea,
  ActionIcon,
  Badge,
  Checkbox,
  Paper,
  Tabs
} from '@mantine/core';
import {
  IconAlertCircle,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
  IconShieldLock,
  IconLock
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/Common/ConfirmModal';

interface Role {
  id: string;
  name: string;
  description?: string;
  menu_items?: string[];
  sections?: Record<string, string[]>;
  created_at?: string;
  updated_at?: string;
}

interface Section {
  label: string;
  permissions: string[];
}

export function RolesPage() {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [availableSections, setAvailableSections] = useState<Record<string, Section>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [permissionsModalOpened, setPermissionsModalOpened] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const [permissionsData, setPermissionsData] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (isAdmin) {
      loadRoles();
      loadAvailableSections();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadRoles = async () => {
    try {
      const response = await api.get('/api/roles/');
      setRoles(response.data);
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to load roles'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSections = async () => {
    try {
      const response = await api.get('/api/roles/sections/available');
      setAvailableSections(response.data);
    } catch (error) {
      console.error('Failed to load sections:', error);
    }
  };

  const handleOpenModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description || ''
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: '',
        description: ''
      });
    }
    setModalOpened(true);
  };

  const handleOpenPermissionsModal = async (role: Role) => {
    setEditingRole(role);
    
    // Load full role details with permissions
    try {
      const response = await api.get(`/api/roles/${role.id}`);
      setPermissionsData(response.data.sections || {});
      setPermissionsModalOpened(true);
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to load role permissions'),
        color: 'red'
      });
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      notifications.show({
        title: t('Error'),
        message: t('Role name is required'),
        color: 'red'
      });
      return;
    }

    setSaving(true);
    try {
      if (editingRole) {
        await api.put(`/api/roles/${editingRole.id}`, formData);
        notifications.show({
          title: t('Success'),
          message: t('Role updated successfully'),
          color: 'green',
          icon: <IconCheck size={16} />
        });
      } else {
        await api.post('/api/roles/', formData);
        notifications.show({
          title: t('Success'),
          message: t('Role created successfully'),
          color: 'green',
          icon: <IconCheck size={16} />
        });
      }

      setModalOpened(false);
      loadRoles();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save role'),
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!editingRole) return;

    setSaving(true);
    try {
      await api.put(`/api/roles/${editingRole.id}/permissions`, {
        sections: permissionsData
      });
      
      notifications.show({
        title: t('Success'),
        message: t('Permissions updated successfully'),
        color: 'green',
        icon: <IconCheck size={16} />
      });

      setPermissionsModalOpened(false);
      loadRoles();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save permissions'),
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (section: string, permission: string) => {
    setPermissionsData(prev => {
      const current = prev[section] || [];
      const hasPermission = current.includes(permission);
      
      if (hasPermission) {
        return {
          ...prev,
          [section]: current.filter(p => p !== permission)
        };
      } else {
        return {
          ...prev,
          [section]: [...current, permission]
        };
      }
    });
  };

  const hasPermission = (section: string, permission: string) => {
    return (permissionsData[section] || []).includes(permission);
  };

  const handleDelete = async () => {
    if (!roleToDelete) return;

    try {
      await api.delete(`/api/roles/${roleToDelete}`);
      notifications.show({
        title: t('Success'),
        message: t('Role deleted successfully'),
        color: 'green',
        icon: <IconCheck size={16} />
      });
      loadRoles();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete role'),
        color: 'red'
      });
    } finally {
      setDeleteConfirmOpened(false);
      setRoleToDelete(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading roles...')}</Text>
        </Stack>
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container size="md" mt={50}>
        <Alert icon={<IconAlertCircle size={16} />} title={t('Access Denied')} color="red">
          {t('Administrator access required to view this page.')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Group justify="space-between">
          <Title order={2}>{t('Roles & Permissions')}</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => handleOpenModal()}
          >
            {t('Add Role')}
          </Button>
        </Group>

        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          {t('Roles define permissions and access levels for users. Configure menu access and section permissions for each role.')}
        </Alert>

        {roles.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No roles found')}>
            {t('No roles found. Create your first role to assign to users.')}
          </Alert>
        ) : (
          <Paper withBorder shadow="sm" p="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Name')}</Table.Th>
                  <Table.Th>{t('Description')}</Table.Th>
                  <Table.Th>{t('Created')}</Table.Th>
                  <Table.Th>{t('Actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {roles.map((role) => (
                  <Table.Tr key={role.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconShieldLock size={16} />
                        <Text fw={500}>{role.name}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{role.description || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{formatDate(role.created_at)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          color="green"
                          variant="light"
                          onClick={() => handleOpenPermissionsModal(role)}
                          title={t('Edit Permissions')}
                        >
                          <IconLock size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="blue"
                          onClick={() => handleOpenModal(role)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="red"
                          onClick={() => {
                            setRoleToDelete(role.id);
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
          </Paper>
        )}
      </Stack>

      {/* Basic Info Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingRole ? t('Edit Role') : t('Add Role')}
        size="md"
      >
        <Stack>
          <TextInput
            label={t('Role Name')}
            placeholder={t('Enter role name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Textarea
            label={t('Description')}
            placeholder={t('Enter role description')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            minRows={3}
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="light"
              onClick={() => setModalOpened(false)}
              leftSection={<IconX size={16} />}
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              leftSection={<IconCheck size={16} />}
            >
              {editingRole ? t('Update') : t('Create')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Permissions Modal */}
      <Modal
        opened={permissionsModalOpened}
        onClose={() => setPermissionsModalOpened(false)}
        title={`${t('Edit Permissions')}: ${editingRole?.name}`}
        size="xl"
      >
        <Stack>
          <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
            {t('Configure permissions for each section. OWNDATA = own data only, DEPDATA = department data only.')}
          </Alert>

          <Paper withBorder p="md">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Section')}</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>VIEW</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>ADD</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>EDIT</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>DELETE</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>OWNDATA</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>DEPDATA</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Object.entries(availableSections).map(([sectionKey, section]) => (
                  <Table.Tr key={sectionKey}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{section.label}</Text>
                      <Text size="xs" c="dimmed">{sectionKey}</Text>
                    </Table.Td>
                    {['VIEW', 'ADD', 'EDIT', 'DELETE', 'OWNDATA', 'DEPDATA'].map(permission => {
                      const isAvailable = section.permissions.includes(permission);
                      return (
                        <Table.Td key={permission} style={{ textAlign: 'center' }}>
                          {isAvailable ? (
                            <Checkbox
                              checked={hasPermission(sectionKey, permission)}
                              onChange={() => togglePermission(sectionKey, permission)}
                            />
                          ) : (
                            <Text c="dimmed" size="xs">-</Text>
                          )}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>

          <Group justify="flex-end" mt="md">
            <Button
              variant="light"
              onClick={() => setPermissionsModalOpened(false)}
              leftSection={<IconX size={16} />}
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleSavePermissions}
              loading={saving}
              leftSection={<IconCheck size={16} />}
            >
              {t('Save Permissions')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={deleteConfirmOpened}
        onClose={() => setDeleteConfirmOpened(false)}
        onConfirm={handleDelete}
        title={t('Delete Role')}
        message={t('Are you sure you want to delete this role? Users with this role may lose access.')}
      />
    </Container>
  );
}
