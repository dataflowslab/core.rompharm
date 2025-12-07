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
  Badge
} from '@mantine/core';
import {
  IconAlertCircle,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
  IconShieldLock
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
  created_at?: string;
  updated_at?: string;
}

export function RolesPage() {
  const { isStaff } = useAuth();
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFirebaseMode, setIsFirebaseMode] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    if (isStaff) {
      loadRoles();
      checkIdentityServer();
    } else {
      setLoading(false);
    }
  }, [isStaff]);

  const checkIdentityServer = async () => {
    try {
      const response = await api.get('/api/system/identity-server');
      setIsFirebaseMode(response.data.provider === 'firebase');
    } catch (error) {
      console.error('Failed to check identity server:', error);
    }
  };

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

  if (!isStaff) {
    return (
      <Container size="md" mt={50}>
        <Alert icon={<IconAlertCircle size={16} />} title={t('Access Denied')} color="red">
          {t('Administrator access required to view this page.')}
        </Alert>
      </Container>
    );
  }

  if (!isFirebaseMode) {
    return (
      <Container size="md" mt={50}>
        <Alert icon={<IconShieldLock size={16} />} title={t('InvenTree Mode')} color="blue">
          {t('Role management is only available when using Firebase as identity server. Currently using InvenTree for authentication.')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Group justify="space-between">
          <Group>
            <Title order={2}>{t('Roles')}</Title>
            <Badge color="blue" variant="light">Firebase Mode</Badge>
          </Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => handleOpenModal()}
          >
            {t('Add Role')}
          </Button>
        </Group>

        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          {t('Roles define permissions and access levels for users in Firebase authentication mode.')}
        </Alert>

        {roles.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No roles found')}>
            {t('No roles found. Create your first role to assign to users.')}
          </Alert>
        ) : (
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
        )}
      </Stack>

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
