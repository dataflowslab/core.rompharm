import { useEffect, useState } from 'react';
import { Container, Title, Alert, Loader, Text, Stack, Button, Badge, Table, Paper, Tabs } from '@mantine/core';
import { IconAlertCircle, IconInfoCircle, IconAlertTriangle, IconCheck, IconFileCheck, IconBell, IconSignature } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface Notification {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  action?: string;
}

interface ApprovalFlow {
  _id: string;
  object_type: string;
  object_id: string;
  status: string;
  created_at: string;
  officer_type: 'required' | 'optional';
  object_details?: {
    reference: string;
    description: string;
    supplier: string;
  };
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [approvals, setApprovals] = useState<ApprovalFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('approvals');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sysRes, appRes] = await Promise.all([
          api.get('/api/system/notifications'),
          api.get('/api/approvals/pending')
        ]);
        setNotifications(sysRes.data.notifications);
        setApprovals(appRes.data.approvals);

        // Auto-select tab based on content
        if (appRes.data.approvals.length > 0) {
          setActiveTab('approvals');
        } else if (sysRes.data.notifications.length > 0) {
          setActiveTab('system');
        }

      } catch (error) {
        console.error('Failed to load notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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

  const handleOpenDocument = (approval: ApprovalFlow) => {
    if (approval.object_type === 'procurement_order') {
      navigate(`/procurement/${approval.object_id}`);
    } else if (approval.object_type === 'purchase_request') {
      navigate(`/requests/${approval.object_id}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    <Container size="xl">
      <Title order={2} mb="xl">{t('Notifications Center')}</Title>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="approvals" leftSection={<IconSignature size={16} />}>
            {t('Approval Requests')} ({approvals.length})
          </Tabs.Tab>
          <Tabs.Tab value="system" leftSection={<IconBell size={16} />}>
            {t('System Notifications')} ({notifications.length})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="approvals" pt="xs">
          {approvals.length === 0 ? (
            <Alert icon={<IconCheck size={16} />} title={t('No pending approvals')} color="green" mt="md">
              {t('You have no documents waiting for your signature.')}
            </Alert>
          ) : (
            <Paper withBorder radius="md" mt="md" style={{ overflow: 'hidden' }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('Request Type')}</Table.Th>
                    <Table.Th>{t('Subject')}</Table.Th>
                    <Table.Th>{t('Status')}</Table.Th>
                    <Table.Th>{t('Role')}</Table.Th>
                    <Table.Th>{t('Created On')}</Table.Th>
                    <Table.Th>{t('Action')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {approvals.map((approval) => (
                    <Table.Tr key={approval._id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>{t(approval.object_type)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={700}>{approval.object_details?.reference}</Text>
                        <Text size="xs" c="dimmed">{approval.object_details?.description}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="yellow" variant="light">{t(approval.status)}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={approval.officer_type === 'required' ? 'red' : 'blue'}>
                          {approval.officer_type === 'required' ? t('Must Sign') : t('Can Sign')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(approval.created_at)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => handleOpenDocument(approval)}
                          leftSection={<IconFileCheck size={14} />}
                        >
                          {t('Review')}
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="system" pt="xs">
          <Stack mt="md">
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
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
