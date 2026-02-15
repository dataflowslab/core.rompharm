import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Stack,
  Group,
  Text,
  Badge,
  ActionIcon,
  Button,
  SegmentedControl,
  Box,
  Loader,
  Center
} from '@mantine/core';
import { IconCheck, IconTrash, IconExternalLink, IconBell } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'approval';
  document_type?: string;
  document_id?: string;
  action_url?: string;
  read: boolean;
  created_at: string;
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get('/api/notifications', {
        params: {
          unread_only: filter === 'unread',
          limit: 100
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post(
        `/api/notifications/${notificationId}/mark-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post(
        '/api/notifications/mark-all-read',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.delete(`/api/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotifications(prev => prev.filter(n => n._id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Delete all notifications
  const deleteAllNotifications = async () => {
    if (!confirm('Sigur doriți să ștergeți toate notificările?')) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.delete('/api/notifications/delete-all', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotifications([]);
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification._id);
    }

    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  // Get badge color
  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'approval': return 'blue';
      case 'success': return 'green';
      case 'warning': return 'yellow';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'acum';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ore`;
    return `${Math.floor(seconds / 86400)} zile`;
  };

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const unreadNotifications = notifications.filter(n => !n.read);

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <IconBell size={32} />
            <Title order={2}>Notificări</Title>
            {unreadNotifications.length > 0 && (
              <Badge size="lg" color="red" variant="filled">
                {unreadNotifications.length} necitite
              </Badge>
            )}
          </Group>

          <Group>
            {notifications.length > 0 && (
              <>
                <Button
                  variant="light"
                  color="blue"
                  onClick={markAllAsRead}
                  disabled={unreadNotifications.length === 0}
                >
                  Marchează toate citite
                </Button>
                <Button
                  variant="light"
                  color="red"
                  onClick={deleteAllNotifications}
                >
                  Șterge toate
                </Button>
              </>
            )}
          </Group>
        </Group>

        {/* Filter */}
        <SegmentedControl
          value={filter}
          onChange={(value) => setFilter(value as 'all' | 'unread')}
          data={[
            { label: `Toate (${notifications.length})`, value: 'all' },
            { label: `Necitite (${unreadNotifications.length})`, value: 'unread' }
          ]}
        />

        {/* Notifications List */}
        {loading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : notifications.length === 0 ? (
          <Paper p="xl" withBorder>
            <Center>
              <Stack align="center" gap="md">
                <IconBell size={48} stroke={1.5} color="gray" />
                <Text size="lg" c="dimmed">
                  {filter === 'unread' ? 'Nu aveți notificări necitite' : 'Nu aveți notificări'}
                </Text>
              </Stack>
            </Center>
          </Paper>
        ) : (
          <Stack gap="sm">
            {notifications.map((notification) => (
              <Paper
                key={notification._id}
                p="md"
                withBorder
                style={{
                  backgroundColor: notification.read ? 'white' : 'var(--mantine-color-blue-0)',
                  borderLeft: notification.read ? 'none' : '4px solid var(--mantine-color-blue-6)',
                  cursor: notification.action_url ? 'pointer' : 'default'
                }}
                onClick={() => notification.action_url && handleNotificationClick(notification)}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text size="sm" fw={notification.read ? 400 : 600}>
                        {notification.title}
                      </Text>
                      <Badge
                        size="sm"
                        color={getBadgeColor(notification.type)}
                        variant="light"
                      >
                        {notification.type}
                      </Badge>
                      {!notification.read && (
                        <Badge size="sm" color="red" variant="filled">
                          NOU
                        </Badge>
                      )}
                    </Group>

                    <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
                      {notification.message}
                    </Text>

                    <Group gap="xs">
                      <Text size="xs" c="dimmed">
                        {formatDate(notification.created_at)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        ({formatTimeAgo(notification.created_at)})
                      </Text>
                    </Group>
                  </Stack>

                  <Group gap={4}>
                    {!notification.read && (
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification._id);
                        }}
                        title="Marchează ca citită"
                      >
                        <IconCheck size={18} />
                      </ActionIcon>
                    )}

                    {notification.action_url && (
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNotificationClick(notification);
                        }}
                        title="Deschide"
                      >
                        <IconExternalLink size={18} />
                      </ActionIcon>
                    )}

                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification._id);
                      }}
                      title="Șterge"
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
