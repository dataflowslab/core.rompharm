import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppShell, Burger, Group, Image, Text, Button, Select } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLogout, IconLanguage } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { FormsPage } from './pages/FormsPage';
import { FormPage } from './pages/FormPage';
import { DataListPage } from './pages/DataListPage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { TemplatesPage } from './pages/TemplatesPage';
// CRM pages removed - no longer needed
import { SubmissionsListPage } from './pages/SubmissionsListPage';
import { SubmissionDetailPage } from './pages/SubmissionDetailPage';
import { RegistersPage } from './pages/RegistersPage';
import { RegistryDetailPage } from './pages/RegistryDetailPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { RolesPage } from './pages/admin/RolesPage';
import { LibraryPage } from './pages/LibraryPage';
import { FundamentarePage } from './pages/procurement/FundamentarePage';
import { FundamentareDetailPage } from './pages/procurement/FundamentareDetailPage';
import { ReferatePage } from './pages/procurement/ReferatePage';
import { ReferatNewPage } from './pages/procurement/ReferatNewPage';
import { ReferatDetailPage } from './pages/procurement/ReferatDetailPage';
import { DocTehnicePage } from './pages/procurement/DocTehnicePage';
import { DocTehnicNewPage } from './pages/procurement/DocTehnicNewPage';
import { DocTehnicDetailPage } from './pages/procurement/DocTehnicDetailPage';
import { PaapPage } from './pages/procurement/PaapPage';
import { PaapNewPage } from './pages/procurement/PaapNewPage';
import { PaapDetailPage } from './pages/procurement/PaapDetailPage';
import { ContractePage } from './pages/procurement/ContractePage';
import { ContractNewPage } from './pages/procurement/ContractNewPage';
import { ContractDetailPage } from './pages/procurement/ContractDetailPage';
import { ExecutieBugetaraPage } from './pages/procurement/ExecutieBugetaraPage';
import { ExecutieBugetaraNewPage } from './pages/procurement/ExecutieBugetaraNewPage';
import { ExecutieBugetaraDetailPage } from './pages/procurement/ExecutieBugetaraDetailPage';
import { OrdonantarePage } from './pages/procurement/OrdonantarePage';
import { OrdonantareDetailPage } from './pages/procurement/OrdonantareDetailPage';
import { NomenclatoarePage } from './pages/procurement/NomenclatoarePage';
import { NomenclatorDetailPage } from './pages/procurement/NomenclatorDetailPage';
import { CompaniiPage } from './pages/procurement/CompaniiPage';
import { BugetAprobatPage } from './pages/buget/BugetAprobatPage';
import { BugetInitialPage } from './pages/buget/BugetInitialPage';
import { AngajamenteBugetarePage } from './pages/buget/AngajamenteBugetarePage';
import { AngajamenteLegalePage } from './pages/buget/AngajamenteLegalePage';
import { ExecutieBugetaraReportPage } from './pages/rapoarte/ExecutieBugetaraReportPage';
import { NomenclatoareGenericPage } from './pages/NomenclatoareGenericPage';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { Navbar } from './components/Layout/Navbar';
import { NotificationBell } from './components/Layout/NotificationBell';
import { useAuth } from './context/AuthContext';
import { api } from './services/api';

interface Config {
  company_name: string;
  company_logo: string;
}

function DoctehniceRedirect() {
  const { id } = useParams();
  const target = id ? `/procurement/achizitii/${id}` : '/procurement/achizitii';
  return <Navigate to={target} replace />;
}

function App() {
  const { isAuthenticated, username, logout, domain } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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
        {/* Forms routes removed - no longer needed */}
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
            <Group gap="sm">
              <Image
                src={config?.company_logo || '/media/img/logo.svg'}
                alt={config?.company_name || 'DataFlows Core'}
                h={40}
                w="auto"
                fit="contain"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate('/dashboard')}
              />
              <div style={{ lineHeight: 1.1 }}>
                <Text size="xs" c="dimmed">
                  {t('Domain')}
                </Text>
                <Text size="sm" fw={700} c="black" style={{ textTransform: 'uppercase' }}>
                  {domain || '-'}
                </Text>
              </div>
            </Group>
          </Group>

          <Group>
            <NotificationBell refreshInterval={30000} />
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
          <Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
          {/* Forms, Submissions, and Registers routes removed - no longer needed */}
          <Route path="/templates" element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
          {/* CRM routes removed - no longer needed */}
          
          {/* Procurement module routes */}
          <Route path="/procurement/referate" element={<ProtectedRoute><ReferatePage /></ProtectedRoute>} />
          <Route path="/procurement/referate/new" element={<ProtectedRoute><ReferatNewPage /></ProtectedRoute>} />
          <Route path="/procurement/referate/:id" element={<ProtectedRoute><ReferatDetailPage /></ProtectedRoute>} />
          <Route path="/procurement/fundamentare" element={<ProtectedRoute><FundamentarePage /></ProtectedRoute>} />
          <Route path="/procurement/fundamentare/:id" element={<ProtectedRoute><FundamentareDetailPage /></ProtectedRoute>} />
          <Route path="/procurement/achizitii" element={<ProtectedRoute><DocTehnicePage /></ProtectedRoute>} />
          <Route path="/procurement/achizitii/new" element={<ProtectedRoute><DocTehnicNewPage /></ProtectedRoute>} />
          <Route path="/procurement/achizitii/:id" element={<ProtectedRoute><DocTehnicDetailPage /></ProtectedRoute>} />
          <Route path="/procurement/doctehnice" element={<Navigate to="/procurement/achizitii" replace />} />
          <Route path="/procurement/doctehnice/new" element={<Navigate to="/procurement/achizitii/new" replace />} />
          <Route path="/procurement/doctehnice/:id" element={<DoctehniceRedirect />} />
          <Route path="/procurement/paap" element={<ProtectedRoute><PaapPage /></ProtectedRoute>} />
          <Route path="/procurement/paap/new" element={<ProtectedRoute><PaapNewPage /></ProtectedRoute>} />
          <Route path="/procurement/paap/:id" element={<ProtectedRoute><PaapDetailPage /></ProtectedRoute>} />
          <Route path="/procurement/contracte" element={<ProtectedRoute><ContractePage /></ProtectedRoute>} />
          <Route path="/procurement/contracte/new" element={<ProtectedRoute><ContractNewPage /></ProtectedRoute>} />
          <Route path="/procurement/contracte/:id" element={<ProtectedRoute><ContractDetailPage /></ProtectedRoute>} />
          <Route path="/procurement/executie-bugetara" element={<ProtectedRoute><ExecutieBugetaraPage /></ProtectedRoute>} />
          <Route path="/procurement/executie-bugetara/new" element={<ProtectedRoute><ExecutieBugetaraNewPage /></ProtectedRoute>} />
          <Route path="/procurement/executie-bugetara/:id" element={<ProtectedRoute><ExecutieBugetaraDetailPage /></ProtectedRoute>} />
          <Route path="/procurement/ordonantare" element={<ProtectedRoute><OrdonantarePage /></ProtectedRoute>} />
          <Route path="/procurement/ordonantare/new" element={<Navigate to="/procurement/ordonantare" replace />} />
          <Route path="/procurement/ordonantare/:id" element={<ProtectedRoute><OrdonantareDetailPage /></ProtectedRoute>} />
          <Route path="/procurement/nomenclatoare" element={<ProtectedRoute><NomenclatoarePage /></ProtectedRoute>} />
          <Route path="/procurement/nomenclatoare/:table" element={<ProtectedRoute><NomenclatorDetailPage /></ProtectedRoute>} />
          <Route path="/procurement/nomenclatoare/nom_companii" element={<ProtectedRoute><CompaniiPage /></ProtectedRoute>} />
          
          {/* Buget routes */}
          <Route path="/buget/aprobat" element={<ProtectedRoute><BugetAprobatPage /></ProtectedRoute>} />
          <Route path="/buget/initial" element={<ProtectedRoute><BugetInitialPage /></ProtectedRoute>} />
          <Route path="/buget/angajamente-bugetare" element={<ProtectedRoute><AngajamenteBugetarePage /></ProtectedRoute>} />
          <Route path="/buget/angajamente-legale" element={<ProtectedRoute><AngajamenteLegalePage /></ProtectedRoute>} />

          {/* Rapoarte */}
          <Route path="/rapoarte/executie-bugetara" element={<ProtectedRoute><ExecutieBugetaraReportPage /></ProtectedRoute>} />
          
          {/* Nomenclatoare routes - generic route for all nomenclatoare */}
          <Route path="/nomenclatoare/:table" element={<ProtectedRoute><NomenclatoareGenericPage /></ProtectedRoute>} />
          
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
