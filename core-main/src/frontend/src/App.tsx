import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AppShell, Burger, Group, Image, Text, Button, Select, ActionIcon, Indicator } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLogout, IconLanguage, IconBell } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { FormsPage } from './pages/FormsPage';
import { FormPage } from './pages/FormPage';
import { DataListPage } from './pages/DataListPage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { SubscribersPage } from './pages/SubscribersPage';
import { SegmentsPage } from './pages/SegmentsPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { SubmissionsListPage } from './pages/SubmissionsListPage';
import { SubmissionDetailPage } from './pages/SubmissionDetailPage';
import { RegistersPage } from './pages/RegistersPage';
import { RegistryDetailPage } from './pages/RegistryDetailPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { RolesPage } from './pages/admin/RolesPage';
import { LibraryPage } from './pages/LibraryPage';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { Navbar } from './components/Layout/Navbar';
import { useAuth } from './context/AuthContext';
import { api } from './services/api';

interface Config {
  company_name: string;
  company_logo: string;
}

function App() {
  const { isAuthenticated, username, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [opened, { toggle }] = useDisclosure();
  const [config, setConfig] = useState<Config | null>(null);
  const [language, setLanguage] = useState<string>(i18n.language || 'en');
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    api.get('/api/config/')
      .then((response) => setConfig(response.data))
      .catch((error) => console.error('Failed to load config:', error));
    
    // Load notification count if authenticated
    if (isAuthenticated) {
      api.get('/api/system/notifications')
        .then((response) => setNotificationCount(response.data.count || 0))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const handleLanguageChange = (value: string | null) => {
    if (value) {
      setLanguage(value);
      i18n.changeLanguage(value);
    }
  };

  const handleLogout = () => {
    logout();
  };

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forms/:slug" element={<FormPage />} />
        <Route path="/:slug" element={<FormPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header style={{ backgroundColor: '#FFFFFF' }}>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Image
              src={config?.company_logo || '/media/img/logo.svg'}
              alt={config?.company_name || 'DataFlows Core'}
              h={40}
              w="auto"
              fit="contain"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/dashboard')}
            />
          </Group>

          <Group>
            <Indicator
              inline
              label={notificationCount}
              size={16}
              disabled={notificationCount === 0}
              color="red"
            >
              <ActionIcon
                variant="subtle"
                color="blue"
                size="lg"
                onClick={() => navigate('/admin/notifications')}
                title={t('Notifications')}
              >
                <IconBell size={20} />
              </ActionIcon>
            </Indicator>
            <Select
              value={language}
              onChange={handleLanguageChange}
              data={[
                { value: 'en', label: t('English') },
                { value: 'ro', label: t('Română') },
              ]}
              leftSection={<IconLanguage size={16} />}
              w={120}
              size="xs"
            />
            <Text size="sm" c="dimmed">
              {username}
            </Text>
            <Button
              variant="subtle"
              color="red"
              leftSection={<IconLogout size={16} />}
              onClick={handleLogout}
              size="sm"
            >
              {t('Logout')}
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Navbar />
      </AppShell.Navbar>

      <AppShell.Main>
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/forms" element={<ProtectedRoute><FormsPage /></ProtectedRoute>} />
          <Route path="/submissions" element={<ProtectedRoute><SubmissionsListPage /></ProtectedRoute>} />
          <Route path="/submission/:submissionId" element={<ProtectedRoute><SubmissionDetailPage /></ProtectedRoute>} />
          <Route path="/registers" element={<ProtectedRoute><RegistersPage /></ProtectedRoute>} />
          <Route path="/registry/:registryId" element={<ProtectedRoute><RegistryDetailPage /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
          <Route path="/crm/subscribers" element={<ProtectedRoute><SubscribersPage /></ProtectedRoute>} />
          <Route path="/crm/segments" element={<ProtectedRoute><SegmentsPage /></ProtectedRoute>} />
          <Route path="/crm/campaigns" element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
          
          {/* Admin routes */}
          <Route path="/admin/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="/admin/roles" element={<ProtectedRoute><RolesPage /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
          <Route path="/admin/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          
          {/* Legacy redirects */}
          <Route path="/users" element={<Navigate to="/admin/users" replace />} />
          <Route path="/audit" element={<Navigate to="/admin/audit" replace />} />
          <Route path="/notifications" element={<Navigate to="/admin/notifications" replace />} />
          
          <Route path="/data/:formId" element={<ProtectedRoute><DataListPage /></ProtectedRoute>} />
          <Route path="/forms/:slug" element={<FormPage />} />
          <Route path="/:slug" element={<FormPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}

export default App;
