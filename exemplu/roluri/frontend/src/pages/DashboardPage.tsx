import { useEffect, useState } from 'react';
import { Container, Title, Stack, SimpleGrid, Paper, Text, Button, Group, Loader, Badge, ActionIcon, Anchor } from '@mantine/core';
import { IconForms, IconExternalLink, IconBell, IconFileText, IconFileDescription, IconChevronRight } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface FormShortcut {
  slug: string;
  title: string;
  description: string;
}

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  link?: string;
}

export function DashboardPage() {
  const { username } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [shortcuts, setShortcuts] = useState<FormShortcut[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  useEffect(() => {
    loadShortcuts();
    loadNotifications();
  }, []);

  const loadShortcuts = async () => {
    try {
      const response = await api.get('/api/auth/dashboard/shortcuts');
      setShortcuts(response.data.forms || []);
    } catch (error) {
      console.error('Failed to load shortcuts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await api.get('/api/notifications', {
        params: { limit: 3, unread_only: false }
      });
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Marchează ca citită
    try {
      await api.post(`/api/notifications/${notification._id}/mark-read`);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
    
    // Navighează la link dacă există
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Acum';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}z`;
  };

  return (
    <Container size="xl" mt={30}>
      <Stack gap="xl">
        <Title order={2}>
          {t('Welcome')}, {username}!
        </Title>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          {/* Column 1: Notificări */}
          <Paper shadow="sm" p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Group gap="xs">
                  <IconBell size={24} />
                  <Title order={3}>Notificări</Title>
                </Group>
              </Group>

              {notificationsLoading ? (
                <Stack align="center" py="md">
                  <Loader size="sm" />
                </Stack>
              ) : notifications.length > 0 ? (
                <Stack gap="xs">
                  {notifications.map((notification) => (
                    <Paper
                      key={notification._id}
                      p="sm"
                      withBorder
                      style={{ 
                        cursor: notification.link ? 'pointer' : 'default',
                        backgroundColor: notification.read ? 'transparent' : 'var(--mantine-color-blue-0)'
                      }}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Group gap="xs">
                            <Text size="sm" fw={notification.read ? 400 : 600} lineClamp={1}>
                              {notification.title}
                            </Text>
                            {!notification.read && (
                              <Badge size="xs" color="blue">Nou</Badge>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {notification.message}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {formatDate(notification.created_at)}
                          </Text>
                        </Stack>
                        {notification.link && (
                          <ActionIcon variant="subtle" size="sm">
                            <IconChevronRight size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Paper>
                  ))}
                  
                  <Anchor
                    size="sm"
                    onClick={() => navigate('/admin/notifications')}
                    style={{ textAlign: 'center', marginTop: '8px' }}
                  >
                    Vezi toate notificările →
                  </Anchor>
                </Stack>
              ) : (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  Nu există notificări
                </Text>
              )}
            </Stack>
          </Paper>

          {/* Column 2: Acțiuni Rapide */}
          <Paper shadow="sm" p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={3}>Acțiuni Rapide</Title>
              
              <Stack gap="xs">
                <Button
                  leftSection={<IconFileDescription size={20} />}
                  variant="light"
                  fullWidth
                  size="md"
                  onClick={() => navigate('/procurement/fundamentare')}
                  styles={{
                    inner: { justifyContent: 'flex-start' }
                  }}
                >
                  Notă de Fundamentare
                </Button>
                
                <Button
                  leftSection={<IconFileText size={20} />}
                  variant="light"
                  fullWidth
                  size="md"
                  onClick={() => navigate('/procurement/referate/new')}
                  styles={{
                    inner: { justifyContent: 'flex-start' }
                  }}
                >
                  Referat
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {/* Column 3: Forms Shortcuts */}
          <Paper shadow="sm" p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconForms size={24} />
                <Title order={3}>{t('Forms')}</Title>
              </Group>

              {loading ? (
                <Stack align="center" py="md">
                  <Loader size="sm" />
                </Stack>
              ) : shortcuts.length > 0 ? (
                <Stack gap="xs">
                  {shortcuts.map((form) => (
                    <Button
                      key={form.slug}
                      component="a"
                      href={`/web/forms/${form.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="light"
                      fullWidth
                      leftSection={<IconExternalLink size={16} />}
                      styles={{
                        inner: { justifyContent: 'flex-start' },
                        label: { overflow: 'hidden', textOverflow: 'ellipsis' }
                      }}
                    >
                      {form.title}
                    </Button>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  {t('No form shortcuts configured')}
                </Text>
              )}
            </Stack>
          </Paper>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
