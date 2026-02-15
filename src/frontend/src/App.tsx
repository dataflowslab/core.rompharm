import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppShell, Burger, Group, Image, Text, Button, Select, ScrollArea } from '@mantine/core';
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
import { StockItemDetailPage } from './pages/StockItemDetailPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { LocationsPage } from './pages/LocationsPage';
import { SuppliersPage, SupplierDetailPage, ManufacturersPage, ManufacturerDetailPage, ClientsPage, ClientDetailPage, StocksPage } from '../../../modules/inventory/frontend/pages';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { MobileDashboardPage } from './pages/MobileDashboardPage';
import { MobileProcurementPage } from './pages/MobileProcurementPage';
import { MobileProcurementDetailPage } from './pages/MobileProcurementDetailPage';
import { MobileTransfersPage } from './pages/MobileTransfersPage';
import { MobileTransferDetailPage } from './pages/MobileTransferDetailPage';
import { MobileSalesPage } from './pages/MobileSalesPage';
import { MobileSalesDetailPage } from './pages/MobileSalesDetailPage';
import { MobileInventoryPage } from './pages/MobileInventoryPage';
import { MobileRequestsPage } from './pages/MobileRequestsPage';
import { MobileRequestDetailPage } from './pages/MobileRequestDetailPage';
import { Navbar } from './components/Layout/Navbar';
import { MobileLayout } from './components/Layout/MobileLayout';
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
  const location = useLocation();
  const isMobileRoute = location.pathname.startsWith('/mobile');

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
      header={isMobileRoute ? undefined : { height: 60 }}
      navbar={isMobileRoute ? undefined : {
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding={isMobileRoute ? 0 : 'md'}
    >
      {!isMobileRoute && (
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
                  { value: 'ro', label: t('Rom??n??') },
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
      )}

      {!isMobileRoute && (
        <AppShell.Navbar p="md" style={{ backgroundColor: '#f6fbff' }}>
          <ScrollArea h="calc(100vh - 60px)" type="auto" offsetScrollbars scrollbarSize={8}>
            <Navbar />
          </ScrollArea>
        </AppShell.Navbar>
      )}

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
          <Route path="/inventory/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
          <Route path="/inventory/locations" element={<ProtectedRoute><LocationsPage /></ProtectedRoute>} />
          <Route path="/inventory/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
          <Route path="/inventory/suppliers/:id" element={<ProtectedRoute><SupplierDetailPage /></ProtectedRoute>} />
          <Route path="/inventory/manufacturers" element={<ProtectedRoute><ManufacturersPage /></ProtectedRoute>} />
          <Route path="/inventory/manufacturers/:id" element={<ProtectedRoute><ManufacturerDetailPage /></ProtectedRoute>} />
          <Route path="/inventory/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
          <Route path="/inventory/clients/:id" element={<ProtectedRoute><ClientDetailPage /></ProtectedRoute>} />
          <Route path="/inventory/stocks" element={<ProtectedRoute><StocksPage /></ProtectedRoute>} />
          <Route path="/inventory/stocks/:id" element={<ProtectedRoute><StockItemDetailPage /></ProtectedRoute>} />
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

          {/* Mobile Routes */}
          <Route path="/mobile" element={<ProtectedRoute><MobileLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/mobile/dashboard" replace />} />
            <Route path="dashboard" element={<MobileDashboardPage />} />
            <Route path="procurement" element={<MobileProcurementPage />} />
            <Route path="procurement/:id" element={<MobileProcurementDetailPage />} />
            <Route path="requests" element={<MobileRequestsPage />} />
            <Route path="requests/:id" element={<MobileRequestDetailPage />} />
            <Route path="transfers" element={<MobileTransfersPage />} />
            <Route path="transfers/:id" element={<MobileTransferDetailPage />} />
            <Route path="sales" element={<MobileSalesPage />} />
            <Route path="sales/:id" element={<MobileSalesDetailPage />} />
            <Route path="inventory" element={<MobileInventoryPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}

export default App;
