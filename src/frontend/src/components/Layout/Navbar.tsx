import { useState, useEffect } from 'react';
import { NavLink, Stack, Badge } from '@mantine/core';
import {
  IconDashboard,
  IconUsers,
  IconBell,
  IconChevronRight,
  IconTruckDelivery,
  IconShoppingCart,
  IconPackageImport,
  IconArrowsExchange,
  IconBox,
  IconClipboardList,
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
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <Stack gap="xs">
      <NavLink
        label="Dashboard"
        leftSection={<IconDashboard size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/dashboard')}
        onClick={() => navigate('/dashboard')}
      />

      <NavLink
        label={t('Requests')}
        leftSection={<IconClipboardList size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/requests')}
        onClick={() => navigate('/requests')}
      />

      <NavLink
        label={t('Build orders')}
        leftSection={<IconBox size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/build-orders')}
        onClick={() => navigate('/build-orders')}
      />

      <NavLink
        label={t('Build simulation')}
        leftSection={<IconArrowsExchange size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/build-simulation')}
        onClick={() => navigate('/build-simulation')}
      />

      <NavLink
        label={t('Procurement')}
        leftSection={<IconShoppingCart size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/procurement')}
        onClick={() => navigate('/procurement')}
      />

      <NavLink
        label={t('Reception')}
        leftSection={<IconPackageImport size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/reception')}
        onClick={() => navigate('/reception')}
      />

      <NavLink
        label={t('Sales')}
        leftSection={<IconTruckDelivery size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/sales')}
        onClick={() => navigate('/sales')}
      />

      <NavLink
        label={t('Returns')}
        leftSection={<IconArrowsExchange size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/returns')}
        onClick={() => navigate('/returns')}
      />

      <NavLink
        label={t('Withdrawals')}
        leftSection={<IconBox size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/withdrawals')}
        onClick={() => navigate('/withdrawals')}
      />

      <NavLink
        label={t('Deliveries')}
        leftSection={<IconTruckDelivery size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/deliveries')}
        onClick={() => navigate('/deliveries')}
      />

      <NavLink
        label={t('Notifications')}
        leftSection={<IconBell size={20} />}
        rightSection={
          notificationCount > 0 ? (
            <Badge size="sm" color="red" variant="filled">
              {notificationCount}
            </Badge>
          ) : (
            <IconChevronRight size={14} />
          )
        }
        active={isActive('/notifications')}
        onClick={() => navigate('/notifications')}
      />

      <NavLink
        label={t('Users')}
        leftSection={<IconUsers size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/users')}
        onClick={() => navigate('/users')}
      />

      <NavLink
        label={t('Audit Log')}
        leftSection={<IconFileText size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/audit')}
        onClick={() => navigate('/audit')}
      />
    </Stack>
  );
}
