import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell, Burger, Group, Image, Text, Button, Select } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLogout, IconLanguage } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DataListPage } from './pages/DataListPage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SubmissionsListPage } from './pages/SubmissionsListPage';
import { SubmissionDetailPage } from './pages/SubmissionDetailPage';
import { RequestsPage } from './pages/RequestsPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { RecipesPage } from './pages/RecipesPage';
import { NewRecipePage } from './pages/NewRecipePage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { ProcurementPage } from './pages/ProcurementPage';
import { ProcurementDetailPage } from './pages/ProcurementDetailPage';
import { SalesPage } from './pages/SalesPage';
import { SalesDetailPage } from './pages/SalesDetailPage';
import { BuildOrdersPage } from './pages/BuildOrdersPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { ArticlesPage } from './pages/ArticlesPage';
import { ArticleDetailPage } from './pages/ArticleDetailPage';
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
  const [opened, { toggle }] = useDisclosure();
  const [config, setConfig] = useState<Config | null>(null);
  const [language, setLanguage] = useState<string>(i18n.language || 'en');

  useEffect(() => {
    api.get('/api/config/')
      .then((response) => setConfig(response.data))
      .catch((error) => console.error('Failed to load config:', error));
  }, []);

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
      <AppShell.Header style={{ backgroundColor: '#e8f3fc' }}>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Image
              src={config?.company_logo || '/media/img/logo.svg'}
              alt={config?.company_name || 'DataFlows Core'}
              h={40}
              w="auto"
              fit="contain"
            />
          </Group>

          <Group>
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
          <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
          <Route path="/requests/:id" element={<ProtectedRoute><RequestDetailPage /></ProtectedRoute>} />
          <Route path="/recipes" element={<ProtectedRoute><RecipesPage /></ProtectedRoute>} />
          <Route path="/recipes/new" element={<ProtectedRoute><NewRecipePage /></ProtectedRoute>} />
          <Route path="/recipes/:id" element={<ProtectedRoute><RecipeDetailPage /></ProtectedRoute>} />
          <Route path="/build-orders" element={<ProtectedRoute><BuildOrdersPage /></ProtectedRoute>} />
          <Route path="/build-simulation" element={<ProtectedRoute><div /></ProtectedRoute>} />
          <Route path="/procurement" element={<ProtectedRoute><ProcurementPage /></ProtectedRoute>} />
          <Route path="/procurement/:id" element={<ProtectedRoute><ProcurementDetailPage /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
          <Route path="/sales/:id" element={<ProtectedRoute><SalesDetailPage /></ProtectedRoute>} />
          <Route path="/inventory/articles" element={<ProtectedRoute><ArticlesPage /></ProtectedRoute>} />
          <Route path="/inventory/articles/:id" element={<ProtectedRoute><ArticleDetailPage /></ProtectedRoute>} />
          <Route path="/returns" element={<ProtectedRoute><div /></ProtectedRoute>} />
          <Route path="/withdrawals" element={<ProtectedRoute><div /></ProtectedRoute>} />
          <Route path="/deliveries" element={<ProtectedRoute><div /></ProtectedRoute>} />
          <Route path="/submissions" element={<ProtectedRoute><SubmissionsListPage /></ProtectedRoute>} />
          <Route path="/submission/:submissionId" element={<ProtectedRoute><SubmissionDetailPage /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/data/:formId" element={<ProtectedRoute><DataListPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}

export default App;
