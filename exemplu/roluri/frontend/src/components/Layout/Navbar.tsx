import { useState, useEffect } from 'react';
import { NavLink, Stack, Badge, Loader } from '@mantine/core';
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
  IconShoppingCart,
  IconFileInvoice,
  IconTable,
  IconDatabase,
  IconFileDescription,
  IconFileCheck,
  IconList,
  IconCash,
  IconReportAnalytics,
  IconChartBar,
  IconBuilding,
  IconMapPin,
  IconWorld,
  IconBuildingBank,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';

// Icon mapping for dynamic menu
const iconMap: Record<string, any> = {
  IconShoppingCart,
  IconFileText,
  IconFileInvoice,
  IconFolder,
  IconBook,
  IconTemplate,
  IconAddressBook,
  IconTags,
  IconMail,
  IconSettings,
  IconUsers,
  IconShieldLock,
  IconHistory,
  IconBell,
  IconDashboard,
  IconTable,
  IconDatabase,
  IconFileDescription,
  IconFileCheck,
  IconList,
  IconCash,
  IconReportAnalytics,
  IconChartBar,
  IconBuilding,
  IconMapPin,
  IconWorld,
  IconBuildingBank,
};

interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  order?: number;
  submenu?: MenuItem[];
}

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [userMenu, setUserMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user-specific menu based on role
    api.get('/api/system/menu/user')
      .then((response) => {
        const menuItems = response.data.menu_items || [];
        // Sort by order
        const sortedMenu = [...menuItems].sort((a, b) => (a.order || 0) - (b.order || 0));
        setUserMenu(sortedMenu);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load user menu:', error);
        setLoading(false);
      });
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const renderMenuItem = (item: MenuItem) => {
    const IconComponent = iconMap[item.icon] || IconFolder;
    const hasSubmenu = item.submenu && item.submenu.length > 0;

    if (hasSubmenu) {
      // Check if any submenu item is active
      const isAnySubmenuActive = item.submenu!.some(subItem => 
        location.pathname.startsWith(subItem.path)
      );
      
      return (
        <NavLink
          key={item.id}
          label={t(item.label)}
          leftSection={<IconComponent size={20} />}
          childrenOffset={28}
          defaultOpened={isAnySubmenuActive}
          opened={isAnySubmenuActive ? true : undefined}
        >
          {item.submenu!.map((subItem) => {
            const SubIconComponent = iconMap[subItem.icon] || IconFileText;
            const isSubItemActive = location.pathname.startsWith(subItem.path);
            return (
              <NavLink
                key={subItem.id}
                label={t(subItem.label)}
                leftSection={<SubIconComponent size={16} />}
                active={isSubItemActive}
                onClick={() => navigate(subItem.path)}
                style={isSubItemActive ? { fontWeight: 'bold' } : undefined}
              />
            );
          })}
        </NavLink>
      );
    }

    return (
      <NavLink
        key={item.id}
        label={t(item.label)}
        leftSection={<IconComponent size={20} />}
        rightSection={<IconChevronRight size={14} />}
        active={isActive(item.path)}
        onClick={() => navigate(item.path)}
      />
    );
  };

  if (loading) {
    return (
      <Stack gap="xs" align="center" py="md">
        <Loader size="sm" />
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      {/* Render dynamic menu items based on user role */}
      {userMenu.map((item) => renderMenuItem(item))}
    </Stack>
  );
}
