import { useState, useEffect } from 'react';
import { NavLink, Stack, Badge } from '@mantine/core';
import {
  IconDashboard,
  IconUsers,
  IconBell,
  IconChevronRight,
  IconTruckDelivery,
  IconShoppingCart,
  IconArrowsExchange,
  IconBox,
  IconClipboardList,
  IconFileText,
  IconTemplate,
  IconChefHat,
  IconPackage,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    // Check notifications 
    api.get('/api/system/notifications')
      .then((response) => {
        setNotificationCount(response.data.count || 0);
      })
      .catch(() => {});
  }, []);

  const isActive = (path: string) => location.pathname === path;
  const isInSection = (basePath: string) => location.pathname.startsWith(basePath);

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
        label={t('Recipes')}
        leftSection={<IconChefHat size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/recipes')}
        onClick={() => navigate('/recipes')}
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
        label={t('Inventory')}
        leftSection={<IconPackage size={20} />}
        childrenOffset={28}
        defaultOpened={isInSection('/inventory')}
        active={isInSection('/inventory')}
      >
        <NavLink
          label={t('Articles')}
          active={isActive('/inventory/articles')}
          onClick={() => navigate('/inventory/articles')}
          style={{ fontWeight: isActive('/inventory/articles') ? 'bold' : 'normal' }}
        />
        <NavLink
          label={t('Categories')}
          active={isActive('/inventory/categories')}
          onClick={() => navigate('/inventory/categories')}
          style={{ fontWeight: isActive('/inventory/categories') ? 'bold' : 'normal' }}
        />
        <NavLink
          label={t('Locations')}
          active={isActive('/inventory/locations')}
          onClick={() => navigate('/inventory/locations')}
          style={{ fontWeight: isActive('/inventory/locations') ? 'bold' : 'normal' }}
        />
        <NavLink
          label={t('Stocks')}
          active={isActive('/inventory/stocks')}
          onClick={() => navigate('/inventory/stocks')}
          style={{ fontWeight: isActive('/inventory/stocks') ? 'bold' : 'normal' }}
        />
        <NavLink
          label={t('Suppliers')}
          active={isActive('/inventory/suppliers')}
          onClick={() => navigate('/inventory/suppliers')}
          style={{ fontWeight: isActive('/inventory/suppliers') ? 'bold' : 'normal' }}
        />
        <NavLink
          label={t('Manufacturers')}
          active={isActive('/inventory/manufacturers')}
          onClick={() => navigate('/inventory/manufacturers')}
          style={{ fontWeight: isActive('/inventory/manufacturers') ? 'bold' : 'normal' }}
        />
        <NavLink
          label={t('Clients')}
          active={isActive('/inventory/clients')}
          onClick={() => navigate('/inventory/clients')}
          style={{ fontWeight: isActive('/inventory/clients') ? 'bold' : 'normal' }}
        />
      </NavLink>

      <NavLink
        label={t('Procurement')}
        leftSection={<IconShoppingCart size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/procurement')}
        onClick={() => navigate('/procurement')}
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
        label={t('Templates')}
        leftSection={<IconTemplate size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive('/templates')}
        onClick={() => navigate('/templates')}
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
