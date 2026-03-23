import { useEffect, useMemo, useState } from 'react';
import { Container, Title, Paper, Table, Loader, Alert, Text, Stack, Badge, Group, ActionIcon, Modal, TextInput, PasswordInput, Select, MultiSelect, Button } from '@mantine/core';
import { IconAlertCircle, IconEdit } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { notifications } from '@mantine/notifications';
import { hasSectionPermission } from '../utils/permissions';

interface User {
  id?: string;
  _id?: string;
  username: string;
  name?: string;
  last_login?: string;
  created_at: string;
  role?: {
    _id: string;
    name: string;
    slug?: string;
  };
  role_id?: string;
  locations?: string[];
}

interface LocationItem {
  _id?: string;
  oid?: string;
  id?: string;
  name?: string;
  code?: string;
}

export function UsersPage() {
  const { roleSections } = useAuth();
  const { t } = useTranslation();
  const canViewUsers = hasSectionPermission(roleSections, 'users', 'get');
  const canEditUsers = hasSectionPermission(roleSections, 'users', 'patch');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Array<{ _id: string; name: string }>>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [editOpened, setEditOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    username: '',
    name: '',
    password: '',
    role_id: '',
    locations: [] as string[]
  });

  useEffect(() => {
    if (canViewUsers) {
      api.get('/api/users/')
        .then((response) => {
          const data = response.data?.results || response.data || [];
          setUsers(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
      api.get('/api/roles/')
        .then((response) => setRoles(response.data?.results || []))
        .catch(() => {});
      api.get('/modules/requests/api/stock-locations')
        .then((response) => setLocations(response.data?.results || response.data || []))
        .catch(() => {});
    } else {
      setLoading(false);
    }
  }, [canViewUsers]);

  const objectIdRegex = useMemo(() => /^[0-9a-fA-F]{24}$/, []);

  const getLocationId = (loc: LocationItem) => loc._id || loc.oid || loc.id || '';

  const locationOptions = useMemo(() => (
    locations
      .map((loc) => {
        const id = getLocationId(loc);
        if (!id) return null;
        return {
          value: id,
          label: loc.name || loc.code || id
        };
      })
      .filter(Boolean) as Array<{ value: string; label: string }>
  ), [locations]);

  const locationLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    locations.forEach((loc) => {
      const id = getLocationId(loc);
      if (!id) return;
      lookup.set(id, id);
      if (loc.code) lookup.set(loc.code, id);
      if (loc.name) lookup.set(loc.name, id);
      if (loc.oid) lookup.set(loc.oid, id);
      if (loc._id) lookup.set(loc._id, id);
      if (loc.id) lookup.set(loc.id, id);
    });
    return lookup;
  }, [locations]);

  const normalizeLocationIds = (values: string[]) => {
    if (!values || values.length === 0) return [];
    return values
      .map((value) => {
        const mapped = locationLookup.get(value);
        if (mapped) return mapped;
        if (objectIdRegex.test(value)) return value;
        return null;
      })
      .filter((value): value is string => Boolean(value));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('Never');
    return new Date(dateString).toLocaleString();
  };

  const openEditModal = (user: User) => {
    const userId = user._id || user.id || '';
    const roleId = user.role?._id || user.role_id || '';
    setEditUserId(userId);
    setEditForm({
      username: user.username || '',
      name: user.name || '',
      password: '',
      role_id: roleId,
      locations: normalizeLocationIds(user.locations || [])
    });
    setEditOpened(true);
  };

  const handleSave = async () => {
    if (!editUserId) return;
    setSaving(true);
    try {
      const normalizedLocations = normalizeLocationIds(editForm.locations);
      const payload: any = {
        username: editForm.username,
        name: editForm.name,
        role_id: editForm.role_id,
        locations: normalizedLocations
      };
      if (editForm.password) {
        payload.password = editForm.password;
      }
      await api.put(`/api/users/${editUserId}`, payload);
      notifications.show({
        title: t('Success'),
        message: t('User updated successfully'),
        color: 'green'
      });
      setEditOpened(false);
      const response = await api.get('/api/users/');
      setUsers(response.data?.results || response.data || []);
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update user'),
        color: 'red'
      });
    } finally {
      setSaving(false);
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

  if (!canViewUsers) {
    return (
      <Container size="md" mt={50}>
        <Alert icon={<IconAlertCircle size={16} />} title={t('Access Denied')} color="red">
          {t('Access Denied')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Title order={2}>{t('Users List')}</Title>

        {users.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No users found')}>
            {t('No users found')}
          </Alert>
        ) : (
          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Username')}</Table.Th>
                  <Table.Th>{t('Role')}</Table.Th>
                  <Table.Th>{t('Last Login')}</Table.Th>
                  <Table.Th style={{ width: '80px' }}>{t('Actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((user) => (
                  <Table.Tr key={user._id || user.id}>
                    <Table.Td>{user.username}</Table.Td>
                    <Table.Td>
                      {user.role?.name ? (
                        <Badge color="blue">{user.role.name}</Badge>
                      ) : (
                        <Badge color="gray">
                          {t('User')}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>{formatDate(user.last_login)}</Table.Td>
                    <Table.Td>
                      {canEditUsers && (
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => openEditModal(user)}
                          title={t('Edit')}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>

      <Modal
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title={t('Edit User')}
      >
        <Stack>
          <TextInput
            label={t('Username')}
            value={editForm.username}
            onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
            required
          />
          <TextInput
            label={t('Name')}
            value={editForm.name}
            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
          />
          <PasswordInput
            label={t('New Password')}
            value={editForm.password}
            onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
            placeholder="••••••••"
          />
          <Select
            label={t('Role')}
            data={roles.map(role => ({ value: role._id, label: role.name }))}
            value={editForm.role_id}
            onChange={(value) => setEditForm(prev => ({ ...prev, role_id: value || '' }))}
            searchable
            required
          />
          <MultiSelect
            label={t('Destination Locations')}
            data={locationOptions}
            value={editForm.locations}
            onChange={(value) => setEditForm(prev => ({ ...prev, locations: value }))}
            searchable
            clearable
            placeholder={t('Select destinations...')}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setEditOpened(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {t('Save')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
