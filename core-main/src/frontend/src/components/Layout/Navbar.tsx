import { useState, useEffect } from 'react';
import { NavLink, Stack, Badge } from '@mantine/core';
import {
  IconDashboard,
  IconUsers,
  IconFileText,
  IconBell,
  IconTemplate,
  IconChevronRight,
  IconAddressBook,
  IconTags,
  IconMail,
  IconBook,
  IconSettings,
  IconShieldLock,
  IconHistory,
  IconFolder,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [depoConfigured, setDepoConfigured] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [hasRegistries, setHasRegistries] = useState(false);

  useEffect(() => {
    // Check system status
    api.get('/api/system/status')
      .then((response) => {
        setDepoConfigured(response.data.dataflows_docu?.configured || false);
      })
      .catch(() => {});

    // Check notifications 
    api.get('/api/system/notifications')
      .then((response) => {
        setNotificationCount(response.data.count || 0);
      })
      .catch(() => {});

    // Check if registries exist
    api.get('/api/forms/registries/list')
      .then((response) => {
        setHasRegistries((response.data || []).length > 0);
      })
      .catch(() => {});
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <Stack gap="xs">
      <NavLink
        label={t('Dashboard')}
        leftSection={<IconDashboard size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/dashboard')}
        onClick={() => navigate('/dashboard')}
      />

      {hasRegistries && (
        <NavLink
          label={t('Registers')}
          leftSection={<IconBook size={20} />}
          rightSection={<IconChevronRight size={14} />}
          active={isActive('/registers')}
          onClick={() => navigate('/registers')}
        />
      )}

      <NavLink
        label={t('Forms')}
        leftSection={<IconFileText size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/forms')}
        onClick={() => navigate('/forms')}
      />

      <NavLink
        label={t('Library')}
        leftSection={<IconFolder size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/library')}
        onClick={() => navigate('/library')}
      />

      {depoConfigured && (
        <NavLink
          label={t('Templates')}
          leftSection={<IconTemplate size={20} />}
          rightSection={<IconChevronRight size={14} />}
          active={isActive('/templates')}
          onClick={() => navigate('/templates')}
        />
      )}

      <NavLink
        label="CRM"
        leftSection={<IconAddressBook size={20} />}
        childrenOffset={28}
      >
        <NavLink
          label={t('Subscribers')}
          leftSection={<IconAddressBook size={16} />}
          active={isActive('/crm/subscribers')}
          onClick={() => navigate('/crm/subscribers')}
        />
        <NavLink
          label={t('Segments')}
          leftSection={<IconTags size={16} />}
          active={isActive('/crm/segments')}
          onClick={() => navigate('/crm/segments')}
        />
        <NavLink
          label={t('Campaigns')}
          leftSection={<IconMail size={16} />}
          active={isActive('/crm/campaigns')}
          onClick={() => navigate('/crm/campaigns')}
        />
      </NavLink>

      <NavLink
        label={t('Administration')}
        leftSection={<IconSettings size={20} />}
        childrenOffset={28}
      >
        <NavLink
          label={t('Users')}
          leftSection={<IconUsers size={16} />}
          active={isActive('/admin/users')}
          onClick={() => navigate('/admin/users')}
        />
        <NavLink
          label={t('Roles')}
          leftSection={<IconShieldLock size={16} />}
          active={isActive('/admin/roles')}
          onClick={() => navigate('/admin/roles')}
        />
        <NavLink
          label={t('Notifications')}
          leftSection={<IconBell size={16} />}
          rightSection={
            notificationCount > 0 ? (
              <Badge size="xs" color="red" variant="filled">
                {notificationCount}
              </Badge>
            ) : null
          }
          active={isActive('/admin/notifications')}
          onClick={() => navigate('/admin/notifications')}
        />
        <NavLink
          label={t('Audit Log')}
          leftSection={<IconHistory size={16} />}
          active={isActive('/admin/audit')}
          onClick={() => navigate('/admin/audit')}
        />
        <NavLink
          label={t('Settings')}
          leftSection={<IconSettings size={16} />}
          active={isActive('/admin/settings')}
          onClick={() => navigate('/admin/settings')}
        />
      </NavLink>
    </Stack>
  );
}
