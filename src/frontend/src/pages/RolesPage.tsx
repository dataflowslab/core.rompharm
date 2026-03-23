import { useEffect, useMemo, useState } from 'react';
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
  Paper,
  Tabs,
  Checkbox,
  ScrollArea,
  Badge
} from '@mantine/core';
import {
  IconAlertCircle,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
  IconLock,
  IconShieldLock
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/Common/ConfirmModal';
import { hasSectionPermission } from '../utils/permissions';
import adminMenuTemplate from '../config/admin_menu.json';

type PermissionAction = 'get' | 'post' | 'patch' | 'delete' | 'own' | 'dep';

interface Role {
  _id?: string;
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  menu_items?: MenuItem[];
  sections?: Record<string, string[]>;
  created_at?: string;
  updated_at?: string;
}

interface MenuItem {
  id?: string;
  label?: string;
  icon?: string;
  path?: string;
  order?: number;
  submenu?: MenuItem[];
}

const PERMISSION_ACTIONS: PermissionAction[] = ['get', 'post', 'patch', 'delete', 'own', 'dep'];

const DEFAULT_ADMIN_MENU: MenuItem[] = adminMenuTemplate as MenuItem[];

const SECTION_DEFINITIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'requests', label: 'Requests' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'build-orders', label: 'Build orders' },
  { key: 'build-simulation', label: 'Build simulation' },
  { key: 'procurement', label: 'Procurement' },
  { key: 'sales', label: 'Sales' },
  { key: 'returns', label: 'Returns' },
  { key: 'withdrawals', label: 'Withdrawals' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'inventory/stocks', label: 'Stocks' },
  { key: 'inventory/articles', label: 'Inventory articles' },
  { key: 'inventory/suppliers', label: 'Inventory suppliers' },
  { key: 'inventory/manufacturers', label: 'Inventory manufacturers' },
  { key: 'inventory/clients', label: 'Inventory clients' },
  { key: 'inventory/locations', label: 'Inventory locations' },
  { key: 'inventory/categories', label: 'Inventory categories' },
  { key: 'users', label: 'Users' },
  { key: 'roles', label: 'Roles' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'forms', label: 'Forms' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'system', label: 'System' },
];

const menuKey = (item: MenuItem) => item.id || item.path || item.label || '';

const sortMenuItems = (items: MenuItem[]) => (
  [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
);

const normalizePermissions = (sections: Record<string, string[]> | undefined | null) => {
  if (!sections || typeof sections !== 'object') return {};
  const normalized: Record<string, string[]> = {};
  Object.entries(sections).forEach(([key, perms]) => {
    if (!key) return;
    const normalizedPerms = Array.isArray(perms)
      ? perms.map((perm) => String(perm).toLowerCase())
      : [String(perms).toLowerCase()];
    normalized[key] = normalizedPerms;
  });
  return normalized;
};

const expandWildcardPermissions = (perms: string[]) => {
  if (perms.includes('*')) {
    return [...PERMISSION_ACTIONS];
  }
  return perms;
};

const buildMenuSelection = (roleMenuItems: MenuItem[], template: MenuItem[]) => {
  const selection: Record<string, boolean> = {};
  const markItem = (item: MenuItem) => {
    const key = menuKey(item);
    if (key) {
      selection[key] = true;
    }
    if (Array.isArray(item.submenu)) {
      item.submenu.forEach(markItem);
    }
  };
  roleMenuItems.forEach(markItem);

  template.forEach((item) => {
    if (!Array.isArray(item.submenu) || item.submenu.length === 0) return;
    const parentKey = menuKey(item);
    const childKeys = item.submenu.map(menuKey).filter(Boolean);
    if (parentKey && selection[parentKey] && childKeys.every((key) => !selection[key])) {
      childKeys.forEach((key) => {
        selection[key] = true;
      });
    }
  });

  return selection;
};

const buildMenuItemsPayload = (template: MenuItem[], selection: Record<string, boolean>) => {
  const payload: MenuItem[] = [];

  template.forEach((item) => {
    const children = Array.isArray(item.submenu) ? item.submenu : [];
    if (children.length > 0) {
      const selectedChildren = children.filter((child) => selection[menuKey(child)]);
      if (selectedChildren.length > 0) {
        payload.push({
          ...item,
          submenu: sortMenuItems(selectedChildren),
        });
      }
      return;
    }

    if (selection[menuKey(item)]) {
      payload.push({ ...item });
    }
  });

  return sortMenuItems(payload);
};

export function RolesPage() {
  const { roleSections } = useAuth();
  const { t } = useTranslation();
  const canViewRoles = hasSectionPermission(roleSections, 'roles', 'get');
  const canCreateRoles = hasSectionPermission(roleSections, 'roles', 'post');
  const canEditRoles = hasSectionPermission(roleSections, 'roles', 'patch');
  const canDeleteRoles = hasSectionPermission(roleSections, 'roles', 'delete');

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [accessModalOpened, setAccessModalOpened] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [menuTemplate, setMenuTemplate] = useState<MenuItem[]>(DEFAULT_ADMIN_MENU);
  const [activeTab, setActiveTab] = useState<'menu' | 'rights'>('menu');
  const [globalAccess, setGlobalAccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: ''
  });

  const [permissionsData, setPermissionsData] = useState<Record<string, string[]>>({});
  const [menuSelection, setMenuSelection] = useState<Record<string, boolean>>({});

  const normalizedMenuTemplate = useMemo(() => sortMenuItems(menuTemplate), [menuTemplate]);

  useEffect(() => {
    if (canViewRoles) {
      loadRoles();
    } else {
      setLoading(false);
    }
  }, [canViewRoles]);

  const loadRoles = async () => {
    try {
      const response = await api.get('/api/roles/');
      const data = response.data?.results || response.data || [];
      setRoles(data);

      const adminRole = data.find((role: Role) => {
        const slug = (role.slug || '').toLowerCase();
        const name = (role.name || '').toLowerCase();
        return slug === 'admin' || name === 'admin';
      });
      if (adminRole?.menu_items && adminRole.menu_items.length > 0) {
        setMenuTemplate(adminRole.menu_items);
      }
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

  const getRoleId = (role?: Role | null) => role?._id || role?.id || '';

  const handleOpenModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name || '',
        slug: role.slug || '',
        description: role.description || ''
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: '',
        slug: '',
        description: ''
      });
    }
    setModalOpened(true);
  };

  const handleOpenAccessModal = async (role: Role) => {
    const roleId = getRoleId(role);
    if (!roleId) return;
    setEditingRole(role);
    setActiveTab('menu');

    try {
      const response = await api.get(`/api/roles/${roleId}`);
      const roleData: Role = response.data || role;
      const normalizedSections = normalizePermissions(roleData.sections);
      const global = Array.isArray(normalizedSections['*']) && normalizedSections['*'].includes('*');
      setGlobalAccess(global);

      const cleanedSections: Record<string, string[]> = {};
      Object.entries(normalizedSections).forEach(([key, perms]) => {
        if (key === '*') return;
        cleanedSections[key] = expandWildcardPermissions(perms);
      });
      setPermissionsData(cleanedSections);

      const roleMenuItems = Array.isArray(roleData.menu_items) ? roleData.menu_items : [];
      setMenuSelection(buildMenuSelection(roleMenuItems, normalizedMenuTemplate));

      setAccessModalOpened(true);
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to load role access'),
        color: 'red'
      });
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) {
      notifications.show({
        title: t('Error'),
        message: t('Role name and slug are required'),
        color: 'red'
      });
      return;
    }

    setSaving(true);
    try {
      if (editingRole) {
        await api.put(`/api/roles/${getRoleId(editingRole)}`, formData);
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

  const handleSaveAccess = async () => {
    if (!editingRole) return;
    const roleId = getRoleId(editingRole);
    if (!roleId) return;

    setSaving(true);
    try {
      const sectionsPayload = globalAccess
        ? { '*': ['*'] }
        : Object.entries(permissionsData).reduce<Record<string, string[]>>((acc, [key, perms]) => {
          const uniquePerms = Array.from(new Set(perms));
          if (uniquePerms.length > 0) {
            acc[key] = uniquePerms;
          }
          return acc;
        }, {});

      const menuItemsPayload = buildMenuItemsPayload(normalizedMenuTemplate, menuSelection);

      await api.put(`/api/roles/${roleId}`, {
        sections: sectionsPayload,
        menu_items: menuItemsPayload
      });

      notifications.show({
        title: t('Success'),
        message: t('Role access updated successfully'),
        color: 'green',
        icon: <IconCheck size={16} />
      });

      setAccessModalOpened(false);
      loadRoles();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save role access'),
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (section: string, permission: PermissionAction) => {
    setPermissionsData((prev) => {
      const current = prev[section] || [];
      const normalizedCurrent = current.map((perm) => perm.toLowerCase());
      const hasPermission = normalizedCurrent.includes(permission);

      if (hasPermission) {
        return {
          ...prev,
          [section]: normalizedCurrent.filter((perm) => perm !== permission)
        };
      }
      return {
        ...prev,
        [section]: [...normalizedCurrent, permission]
      };
    });
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

  const handleToggleParentMenu = (item: MenuItem) => {
    if (!Array.isArray(item.submenu) || item.submenu.length === 0) return;
    const childKeys = item.submenu.map(menuKey).filter(Boolean);
    if (childKeys.length === 0) return;

    setMenuSelection((prev) => {
      const allSelected = childKeys.every((key) => prev[key]);
      const nextValue = !allSelected;
      const nextSelection = { ...prev };
      childKeys.forEach((key) => {
        nextSelection[key] = nextValue;
      });
      const parentKey = menuKey(item);
      if (parentKey) {
        nextSelection[parentKey] = nextValue;
      }
      return nextSelection;
    });
  };

  const handleToggleChildMenu = (child: MenuItem, parent?: MenuItem) => {
    const childKey = menuKey(child);
    if (!childKey) return;

    setMenuSelection((prev) => {
      const nextSelection = { ...prev, [childKey]: !prev[childKey] };
      if (parent && Array.isArray(parent.submenu)) {
        const parentKey = menuKey(parent);
        const childKeys = parent.submenu.map(menuKey).filter(Boolean);
        const selectedCount = childKeys.filter((key) => nextSelection[key]).length;
        if (parentKey) {
          nextSelection[parentKey] = selectedCount > 0 && selectedCount === childKeys.length;
        }
      }
      return nextSelection;
    });
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

  if (!canViewRoles) {
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
        <Group justify="space-between">
          <Title order={2}>{t('Roles')}</Title>
          {canCreateRoles && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => handleOpenModal()}
            >
              {t('Add Role')}
            </Button>
          )}
        </Group>

        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          {t('Roles define menu visibility and section permissions for users.')}
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
                  <Table.Th>{t('Slug')}</Table.Th>
                  <Table.Th>{t('Description')}</Table.Th>
                  <Table.Th>{t('Created')}</Table.Th>
                  <Table.Th>{t('Actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {roles.map((role) => (
                  <Table.Tr key={getRoleId(role)}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconShieldLock size={16} />
                        <Text fw={500}>{role.name}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="gray" variant="light">
                        {role.slug || '-'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{role.description || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{formatDate(role.created_at)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {canEditRoles && (
                          <ActionIcon
                            color="green"
                            variant="light"
                            onClick={() => handleOpenAccessModal(role)}
                            title={t('Edit Access')}
                          >
                            <IconLock size={16} />
                          </ActionIcon>
                        )}
                        {canEditRoles && (
                          <ActionIcon
                            color="blue"
                            onClick={() => handleOpenModal(role)}
                            title={t('Edit Role')}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        )}
                        {canDeleteRoles && (
                          <ActionIcon
                            color="red"
                            onClick={() => {
                              setRoleToDelete(getRoleId(role));
                              setDeleteConfirmOpened(true);
                            }}
                            title={t('Delete Role')}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
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

          <TextInput
            label={t('Slug')}
            placeholder={t('Enter role slug')}
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
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

      <Modal
        opened={accessModalOpened}
        onClose={() => setAccessModalOpened(false)}
        title={`${t('Edit Role Access')}: ${editingRole?.name || ''}`}
        size="90%"
      >
        <Stack>
          <Tabs value={activeTab} onChange={(value) => setActiveTab((value || 'menu') as 'menu' | 'rights')}>
            <Tabs.List>
              <Tabs.Tab value="menu">{t('Menu')}</Tabs.Tab>
              <Tabs.Tab value="rights">{t('Rights')}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="menu" pt="md">
              <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                {t('Select the menu items visible for this role.')}
              </Alert>
              <ScrollArea h={420} offsetScrollbars>
                <Stack mt="md">
                  {normalizedMenuTemplate.map((item) => {
                    const hasChildren = Array.isArray(item.submenu) && item.submenu.length > 0;
                    const childKeys = hasChildren ? item.submenu!.map(menuKey).filter(Boolean) : [];
                    const selectedChildrenCount = childKeys.filter((key) => menuSelection[key]).length;
                    const parentChecked = hasChildren && selectedChildrenCount > 0 && selectedChildrenCount === childKeys.length;
                    const parentIndeterminate = hasChildren && selectedChildrenCount > 0 && selectedChildrenCount < childKeys.length;

                    return (
                      <Paper key={menuKey(item)} withBorder p="sm">
                        <Group justify="space-between">
                          <Checkbox
                            checked={hasChildren ? parentChecked : Boolean(menuSelection[menuKey(item)])}
                            indeterminate={parentIndeterminate}
                            onChange={() => {
                              if (hasChildren) {
                                handleToggleParentMenu(item);
                              } else {
                                const key = menuKey(item);
                                if (!key) return;
                                setMenuSelection((prev) => ({ ...prev, [key]: !prev[key] }));
                              }
                            }}
                            label={t(item.label || item.id || '')}
                          />
                          {item.path && (
                            <Text size="xs" c="dimmed">
                              {item.path}
                            </Text>
                          )}
                        </Group>

                        {hasChildren && (
                          <Stack mt="sm" ml="lg" gap="xs">
                            {sortMenuItems(item.submenu || []).map((child) => (
                              <Checkbox
                                key={menuKey(child)}
                                checked={Boolean(menuSelection[menuKey(child)])}
                                onChange={() => handleToggleChildMenu(child, item)}
                                label={t(child.label || child.id || '')}
                              />
                            ))}
                          </Stack>
                        )}
                      </Paper>
                    );
                  })}
                </Stack>
              </ScrollArea>
            </Tabs.Panel>

            <Tabs.Panel value="rights" pt="md">
              <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                {t('Configure section permissions for this role.')}
              </Alert>
              <Group mt="md">
                <Checkbox
                  checked={globalAccess}
                  onChange={(event) => setGlobalAccess(event.currentTarget.checked)}
                  label={t('Global access (*)')}
                />
                {globalAccess && (
                  <Text size="sm" c="dimmed">
                    {t('All sections and actions are allowed.')}
                  </Text>
                )}
              </Group>

              <Paper withBorder p="md" mt="md">
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('Section')}</Table.Th>
                      {PERMISSION_ACTIONS.map((action) => (
                        <Table.Th key={action} style={{ textAlign: 'center' }}>
                          {action}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {SECTION_DEFINITIONS.map((section) => (
                      <Table.Tr key={section.key}>
                        <Table.Td>
                          <Text size="sm" fw={500}>{t(section.label)}</Text>
                          <Text size="xs" c="dimmed">{section.key}</Text>
                        </Table.Td>
                        {PERMISSION_ACTIONS.map((action) => {
                          const currentPerms = permissionsData[section.key] || [];
                          const isChecked = currentPerms.map((perm) => perm.toLowerCase()).includes(action);
                          return (
                            <Table.Td key={action} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              <Checkbox
                                checked={isChecked}
                                onChange={() => togglePermission(section.key, action)}
                                disabled={globalAccess}
                              />
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </Tabs.Panel>
          </Tabs>

          <Group justify="flex-end" mt="md">
            <Button
              variant="light"
              onClick={() => setAccessModalOpened(false)}
              leftSection={<IconX size={16} />}
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleSaveAccess}
              loading={saving}
              leftSection={<IconCheck size={16} />}
            >
              {t('Save')}
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
