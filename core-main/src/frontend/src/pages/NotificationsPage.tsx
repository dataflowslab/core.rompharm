import { useEffect, useState } from 'react';
import { Container, Title, Alert, Loader, Text, Stack } from '@mantine/core';
import { IconAlertCircle, IconInfoCircle, IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';

interface Notification {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  action?: string;
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/system/notifications')
      .then((response) => setNotifications(response.data.notifications))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <IconAlertCircle size={16} />;
      case 'warning':
        return <IconAlertTriangle size={16} />;
      case 'success':
        return <IconCheck size={16} />;
      default:
        return <IconInfoCircle size={16} />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'red';
      case 'warning':
        return 'yellow';
      case 'success':
        return 'green';
      default:
        return 'blue';
    }
  };

  if (loading) {
    return (
      <Container size="md" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading notifications...')}</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="md">
      <Stack>
        <Title order={2}>{t('System Notifications')}</Title>

        {notifications.length === 0 ? (
          <Alert icon={<IconCheck size={16} />} title={t('No notifications')} color="green">
            {t('All systems operational')}
          </Alert>
        ) : (
          <Stack>
            {notifications.map((notification, index) => (
              <Alert
                key={index}
                icon={getIcon(notification.type)}
                title={notification.title}
                color={getColor(notification.type)}
              >
                {notification.message}
              </Alert>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
