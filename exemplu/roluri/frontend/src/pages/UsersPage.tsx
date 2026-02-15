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
  ActionIcon,
  Select,
  MultiSelect,
  Paper,
  Pagination,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
  IconDownload,
  IconSearch,
  IconArrowUp,
  IconArrowDown
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/Common/ConfirmModal';
import { useDebouncedValue } from '@mantine/hooks';

interface User {
  id: string;
  username: string;
  name?: string;
  email?: string;
  role?: string;
  role_name?: string;
  deps?: string[];
  last_login?: string;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
}

interface Department {
  id: string;
  nume: string;
  cod?: string;
}

export function UsersPage() {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('last_login');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const limit = 10;
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const [nameParts, setNameParts] = useState({ lastName: '', firstName: '' });

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    name: '',
    password: '',
    role: '',
    deps: [] as string[]
  });

  useEffect(() => {
    if (isAdmin) {
      loadRoles();
      loadDepartments();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
  }, [page, debouncedSearch, sortBy, sortOrder, isAdmin]);

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [debouncedSearch]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users/', {
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
          sort_by: sortBy || undefined,
          sort_order: sortOrder || undefined,
        },
      });
      if (Array.isArray(response.data)) {
        setUsers(response.data);
        setTotal(response.data.length);
        setTotalPages(1);
      } else {
        setUsers(response.data.items || []);
        setTotal(response.data.total || 0);
        setTotalPages(response.data.pages || 1);
      }
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

  const loadDepartments = async () => {
    try {
      const response = await api.get('/api/users/departments');
      setDepartments(response.data);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const splitName = (nameValue?: string) => {
    const cleaned = (nameValue || '').trim();
    if (!cleaned) {
      return { lastName: '', firstName: '' };
    }
    const parts = cleaned.split(/\s+/);
    if (parts.length === 1) {
      return { lastName: parts[0], firstName: '' };
    }
    return { lastName: parts[0], firstName: parts.slice(1).join(' ') };
  };

  const buildName = (lastName: string, firstName: string) => {
    return [lastName.trim(), firstName.trim()].filter(Boolean).join(' ').trim();
  };

  const handleOpenModal = (user?: User) => {
    setUsernameManuallyEdited(Boolean(user));
    if (user) {
      setEditingUser(user);
      const parts = splitName(user.name);
      setNameParts(parts);
      setFormData({
        username: user.username,
        email: user.email || '',
        name: user.name || '',
        password: '',
        role: user.role || '',
        deps: user.deps || []
      });
    } else {
      setEditingUser(null);
      setNameParts({ lastName: '', firstName: '' });
      setFormData({
        username: '',
        email: '',
        name: '',
        password: '',
        role: '',
        deps: []
      });
    }
    setModalOpened(true);
  };

  const handleSave = async () => {
    const composedName = buildName(nameParts.lastName, nameParts.firstName);
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
          name: composedName,
          role: formData.role,
          deps: formData.deps
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
        await api.post('/api/users/', {
          ...formData,
          name: composedName
        });
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

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
  };

  const csvEscape = (value: string) => {
    const text = String(value ?? '');
    const escaped = text.replace(/\"/g, '""');
    return `"${escaped}"`;
  };

  const exportUsers = async () => {
    try {
      setExporting(true);
      const response = await api.get('/api/users/', {
        params: {
          page: 1,
          limit: 10000,
          search: debouncedSearch || undefined,
          sort_by: sortBy || undefined,
          sort_order: sortOrder || undefined,
        },
      });
      const data = Array.isArray(response.data) ? response.data : (response.data.items || []);
      const deptMap = new Map(departments.map((d) => [d.id, d.nume]));
      const lines = [
        ['Nume si prenume', 'Email', 'Lista departamente', 'Rol'].map(csvEscape).join(';'),
        ...data.map((user: User) => {
          const name = user.name || user.username || '';
          const email = user.email || '';
          const depsList = (user.deps || [])
            .map((id) => deptMap.get(id) || id)
            .join(', ');
          const role = user.role_name || '';
          return [name, email, depsList, role].map(csvEscape).join(';');
        }),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'users_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to export users'),
        color: 'red',
      });
    } finally {
      setExporting(false);
    }
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

  if (!isAdmin) {
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
          <Group>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={exportUsers}
              loading={exporting}
            >
              Export CSV
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => handleOpenModal()}
            >
              {t('Add User')}
            </Button>
          </Group>
        </Group>

        <Paper withBorder shadow="sm" p="md">
          <Group mb="md">
            <TextInput
              placeholder="Caută utilizatori..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Text size="sm" c="dimmed">Total: {total}</Text>
          </Group>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('username')}
                >
                  <Group gap="xs">
                    {t('Username')}
                    {renderSortIcon('username')}
                  </Group>
                </Table.Th>
                <Table.Th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('name')}
                >
                  <Group gap="xs">
                    Nume și prenume
                    {renderSortIcon('name')}
                  </Group>
                </Table.Th>
                <Table.Th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('email')}
                >
                  <Group gap="xs">
                    {t('Email')}
                    {renderSortIcon('email')}
                  </Group>
                </Table.Th>
                <Table.Th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('role_name')}
                >
                  <Group gap="xs">
                    {t('Role')}
                    {renderSortIcon('role_name')}
                  </Group>
                </Table.Th>
                <Table.Th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('last_login')}
                >
                  <Group gap="xs">
                    {t('Last Login')}
                    {renderSortIcon('last_login')}
                  </Group>
                </Table.Th>
                <Table.Th>{t('Actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="md">
                      {t('No users found')}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                users.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>
                      <Text fw={500}>{user.username}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{user.name || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{user.email || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={user.role_name ? 'blue' : 'gray'}>
                        {user.role_name || t('No role')}
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
                ))
              )}
            </Table.Tbody>
          </Table>
          {totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination value={page} onChange={setPage} total={totalPages} />
            </Group>
          )}
        </Paper>
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingUser ? t('Edit User') : t('Add User')}
        size="md"
      >
        <Stack>
          <Group grow>
            <TextInput
              label="Nume"
              placeholder="Introduceți numele"
              value={nameParts.lastName}
              onChange={(e) => setNameParts((prev) => ({ ...prev, lastName: e.target.value }))}
            />
            <TextInput
              label="Prenume"
              placeholder="Introduceți prenumele"
              value={nameParts.firstName}
              onChange={(e) => setNameParts((prev) => ({ ...prev, firstName: e.target.value }))}
            />
          </Group>

          <TextInput
            label={t('Email')}
            placeholder={t('Enter email')}
            type="email"
            value={formData.email}
            onChange={(e) => {
              const nextEmail = e.target.value;
              setFormData((prev) => ({
                ...prev,
                email: nextEmail,
                username: usernameManuallyEdited ? prev.username : nextEmail
              }));
            }}
          />

          <TextInput
            label={t('Username')}
            placeholder={t('Enter username')}
            value={formData.username}
            onChange={(e) => {
              setUsernameManuallyEdited(true);
              setFormData({ ...formData, username: e.target.value });
            }}
            required
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

          {departments.length > 0 && (
            <MultiSelect
              label={t('Departments')}
              placeholder={t('Select departments')}
              data={departments.map(d => ({ value: d.id, label: d.nume }))}
              value={formData.deps}
              onChange={(value) => setFormData({ ...formData, deps: value })}
              searchable
              clearable
            />
          )}

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
