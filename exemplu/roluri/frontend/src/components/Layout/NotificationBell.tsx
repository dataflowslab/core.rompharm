import { useState, useEffect } from 'react';
import { 
  Indicator, 
  Menu, 
  ActionIcon, 
  Text, 
  Stack, 
  Badge, 
  Group, 
  ScrollArea,
  Button,
  Divider,
  Box
} from '@mantine/core';
import { IconBell, IconCheck, IconTrash, IconExternalLink } from '@tabler/icons-react';
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

interface NotificationBellProps {
  refreshInterval?: number; // milliseconds
}

export function NotificationBell({ refreshInterval = 30000 }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get('/api/notifications', {
        params: { limit: 10 },
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Fetch unread count only
  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get('/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
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

      // Update local state
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post(
        '/api/notifications/mark-all-read',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setLoading(false);
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

      // Update local state
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      
      // Update unread count if notification was unread
      const notification = notifications.find(n => n._id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification._id);
    }

    // Navigate to document if action_url exists
    if (notification.action_url) {
      navigate(notification.action_url);
      setOpened(false);
    }
  };

  // Request Windows notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  // Show Windows notification
  const showWindowsNotification = (notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notif = new Notification(notification.title, {
        body: notification.message,
        icon: '/media/img/favicon.png',
        badge: '/media/img/favicon.png',
        tag: notification._id,
        requireInteraction: true
      });

      notif.onclick = () => {
        window.focus();
        if (notification.action_url) {
          navigate(notification.action_url);
        }
        notif.close();
      };
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
    requestNotificationPermission();
  }, []);

  // Polling for new notifications
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Check for new notifications and show Windows notification
  useEffect(() => {
    if (notifications.length > 0) {
      const latestUnread = notifications.find(n => !n.read);
      if (latestUnread) {
        showWindowsNotification(latestUnread);
      }
    }
  }, [notifications]);

  // Get badge color based on notification type
  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'approval': return 'blue';
      case 'success': return 'green';
      case 'warning': return 'yellow';
      case 'error': return 'red';
      default: return 'gray';
    }
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

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      width={400}
      position="bottom-end"
      shadow="md"
      onOpen={fetchNotifications}
    >
      <Menu.Target>
        <Indicator
          inline
          label={unreadCount > 0 ? unreadCount : null}
          size={16}
          color="red"
          disabled={unreadCount === 0}
        >
          <ActionIcon variant="subtle" size="lg">
            <IconBell size={20} />
          </ActionIcon>
        </Indicator>
      </Menu.Target>

      <Menu.Dropdown>
        <Group justify="space-between" px="md" py="sm">
          <Text fw={600} size="sm">Notificări</Text>
          {unreadCount > 0 && (
            <Button
              size="xs"
              variant="subtle"
              onClick={markAllAsRead}
              loading={loading}
            >
              Marchează toate citite
            </Button>
          )}
        </Group>

        <Divider />

        <ScrollArea h={400} type="auto">
          {notifications.length === 0 ? (
            <Box p="md">
              <Text size="sm" c="dimmed" ta="center">
                Nu aveți notificări
              </Text>
            </Box>
          ) : (
            <Stack gap={0}>
              {notifications.map((notification) => (
                <Menu.Item
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    backgroundColor: notification.read ? 'transparent' : 'var(--mantine-color-blue-0)',
                    borderLeft: notification.read ? 'none' : '3px solid var(--mantine-color-blue-6)',
                    padding: '12px 16px',
                    cursor: 'pointer'
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Group gap="xs">
                        <Text size="sm" fw={notification.read ? 400 : 600}>
                          {notification.title}
                        </Text>
                        <Badge
                          size="xs"
                          color={getBadgeColor(notification.type)}
                          variant="light"
                        >
                          {notification.type}
                        </Badge>
                      </Group>
                      
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-line' }}>
                        {notification.message}
                      </Text>
                      
                      <Text size="xs" c="dimmed">
                        {formatTimeAgo(notification.created_at)}
                      </Text>
                    </Stack>

                    <Group gap={4}>
                      {!notification.read && (
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="blue"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification._id);
                          }}
                          title="Marchează ca citită"
                        >
                          <IconCheck size={14} />
                        </ActionIcon>
                      )}
                      
                      {notification.action_url && (
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="blue"
                          title="Deschide"
                        >
                          <IconExternalLink size={14} />
                        </ActionIcon>
                      )}
                      
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification._id);
                        }}
                        title="Șterge"
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Menu.Item>
              ))}
            </Stack>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Divider />
            <Box p="sm">
              <Button
                fullWidth
                variant="subtle"
                size="sm"
                onClick={() => {
                  navigate('/notifications');
                  setOpened(false);
                }}
              >
                Vezi toate notificările
              </Button>
            </Box>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
