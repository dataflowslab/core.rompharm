import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Table,
  Loader,
  Alert,
  Text,
  Stack,
  Badge,
  Button,
  Group,
  Modal,
  TextInput,
  PasswordInput,
  Switch,
  ActionIcon,
  Select
} from '@mantine/core';
import {
  IconAlertCircle,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/Common/ConfirmModal';

interface User {
  id: string;
  username: string;
  email?: string;
  is_staff: boolean;
  role?: string;
  last_login?: string;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
}

export function UsersPage() {
  const { isStaff } = useAuth();
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    is_staff: false,
    role: ''
  });

  useEffect(() => {
    if (isStaff) {
      loadUsers();
      loadRoles();
    } else {
      setLoading(false);
    }
  }, [isStaff]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/users/');
      setUsers(response.data);
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to load users'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await api.get('/api/users/roles');
      setRoles(response.data);
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email || '',
        password: '',
        is_staff: user.is_staff,
        role: user.role || ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        is_staff: false,
        role: ''
      });
    }
    setModalOpened(true);
  };

  const handleSave = async () => {
    if (!formData.username) {
      notifications.show({
        title: t('Error'),
        message: t('Username is required'),
        color: 'red'
      });
      return;
    }

    if (!editingUser && !formData.password) {
      notifications.show({
        title: t('Error'),
        message: t('Password is required for new users'),
        color: 'red'
      });
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        // Update existing user
        const updateData: any = {
          username: formData.username,
          email: formData.email,
          is_staff: formData.is_staff,
          role: formData.role
        };
        if (formData.password) {
          updateData.password = formData.password;
        }

        await api.put(`/api/users/${editingUser.id}`, updateData);
        notifications.show({
          title: t('Success'),
          message: t('User updated successfully'),
          color: 'green',
          icon: <IconCheck size={16} />
        });
      } else {
        // Create new user
        await api.post('/api/users/', formData);
        notifications.show({
          title: t('Success'),
          message: t('User created successfully'),
          color: 'green',
          icon: <IconCheck size={16} />
        });
      }

      setModalOpened(false);
      loadUsers();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save user'),
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      await api.delete(`/api/users/${userToDelete}`);
      notifications.show({
        title: t('Success'),
        message: t('User deleted successfully'),
        color: 'green',
        icon: <IconCheck size={16} />
      });
      loadUsers();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete user'),
        color: 'red'
      });
    } finally {
      setDeleteConfirmOpened(false);
      setUserToDelete(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('Never');
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading users...')}</Text>
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

  const roleOptions = roles.map(r => ({ value: r.id, label: r.name }));

  return (
    <Container size="xl">
      <Stack>
        <Group justify="space-between">
          <Title order={2}>{t('Users')}</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => handleOpenModal()}
          >
            {t('Add User')}
          </Button>
        </Group>

        {users.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No users found')}>
            {t('No users found. Create your first user.')}
          </Alert>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Username')}</Table.Th>
                <Table.Th>{t('Email')}</Table.Th>
                <Table.Th>{t('Role')}</Table.Th>
                <Table.Th>{t('Last Login')}</Table.Th>
                <Table.Th>{t('Actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>
                    <Text fw={500}>{user.username}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{user.email || '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={user.is_staff ? 'blue' : 'gray'}>
                      {user.is_staff ? t('Admin') : user.role || t('User')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{formatDate(user.last_login)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        color="blue"
                        onClick={() => handleOpenModal(user)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="red"
                        onClick={() => {
                          setUserToDelete(user.id);
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
        title={editingUser ? t('Edit User') : t('Add User')}
        size="md"
      >
        <Stack>
          <TextInput
            label={t('Username')}
            placeholder={t('Enter username')}
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
          />

          <TextInput
            label={t('Email')}
            placeholder={t('Enter email')}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <PasswordInput
            label={t('Password')}
            placeholder={editingUser ? t('Leave empty to keep current') : t('Enter password')}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required={!editingUser}
          />

          {roleOptions.length > 0 && (
            <Select
              label={t('Role')}
              placeholder={t('Select role')}
              data={roleOptions}
              value={formData.role}
              onChange={(value) => setFormData({ ...formData, role: value || '' })}
              clearable
            />
          )}

          <Switch
            label={t('Administrator')}
            description={t('Grant full administrative access')}
            checked={formData.is_staff}
            onChange={(e) => setFormData({ ...formData, is_staff: e.target.checked })}
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
              {editingUser ? t('Update') : t('Create')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={deleteConfirmOpened}
        onClose={() => setDeleteConfirmOpened(false)}
        onConfirm={handleDelete}
        title={t('Delete User')}
        message={t('Are you sure you want to delete this user? This action cannot be undone.')}
      />
    </Container>
  );
}
