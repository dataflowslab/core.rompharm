import { useState, useEffect, useMemo } from 'react';
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
  IconFileCheck,
  IconFileDescription,
  IconFileInvoice,
  IconChefHat,
  IconPackage,
  IconStack2,
  IconShieldLock,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [notificationCount, setNotificationCount] = useState(0);
  const { roleMenuItems } = useAuth();

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

  const iconMap: Record<string, any> = useMemo(() => ({
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
    IconFileCheck,
    IconFileDescription,
    IconFileInvoice,
    IconChefHat,
    IconPackage,
    IconStack2,
    IconShieldLock,
    IconFileContract: IconFileText,
  }), []);

  const renderIcon = (iconName?: string) => {
    if (!iconName) return null;
    const IconComponent = iconMap[iconName];
    if (!IconComponent) return null;
    return <IconComponent size={20} />;
  };

  const menuItems = useMemo(() => {
    if (!Array.isArray(roleMenuItems)) return [];
    return [...roleMenuItems].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  }, [roleMenuItems]);

  return (
    <Stack gap={0}>
      {menuItems.map((item) => {
        const hasSubmenu = Array.isArray(item.submenu) && item.submenu.length > 0;
        const itemPath = item.path || '';
        const rightSection = item.id === 'notifications' ? (
          notificationCount > 0 ? (
            <Badge size="sm" color="red" variant="filled">
              {notificationCount}
            </Badge>
          ) : (
            <IconChevronRight size={14} />
          )
        ) : (
          <IconChevronRight size={14} />
        );

        if (hasSubmenu) {
          return (
            <NavLink
              key={item.id || itemPath}
              label={t(item.label || item.id || '')}
              leftSection={renderIcon(item.icon)}
              childrenOffset={28}
              defaultOpened={itemPath ? isInSection(itemPath) : false}
              active={itemPath ? isInSection(itemPath) : false}
            >
              {item.submenu.map((child: any) => (
                <NavLink
                  key={child.id || child.path}
                  label={t(child.label || child.id || '')}
                  leftSection={renderIcon(child.icon)}
                  active={child.path ? isActive(child.path) : false}
                  onClick={() => child.path && navigate(child.path)}
                  style={{ fontWeight: child.path && isActive(child.path) ? 'bold' : 'normal' }}
                />
              ))}
            </NavLink>
          );
        }

        return (
          <NavLink
            key={item.id || itemPath}
            label={t(item.label || item.id || '')}
            leftSection={renderIcon(item.icon)}
            rightSection={rightSection}
            active={itemPath ? isActive(itemPath) : false}
            onClick={() => itemPath && navigate(itemPath)}
          />
        );
      })}
    </Stack>
  );
}
