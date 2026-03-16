import { useEffect, useMemo, useState } from 'react';
import { Container, Title, Stack, SimpleGrid, Paper, Text, Group, Table, Badge, Button, Loader } from '@mantine/core';
import { IconSignature } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getApprovalRoute, getApprovalTypeLabelKey } from '../utils/approvalHelpers';

interface ApprovalFlow {
  _id: string;
  object_type: string;
  object_id: string;
  status: string;
  created_at: string;
  officer_type: 'required' | 'optional';
  object_details?: {
    reference?: string;
    description?: string;
    supplier?: string;
  };
}

interface QuickAction {
  name: string;
  url: string;
}

export function DashboardPage() {
  const { username } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<ApprovalFlow[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [loadingQuickActions, setLoadingQuickActions] = useState(true);

  useEffect(() => {
    const fetchApprovals = async () => {
      try {
        const appRes = await api.get('/api/approvals/pending');
        setApprovals(appRes.data.approvals || []);
      } catch (error) {
        console.error('Failed to load approvals:', error);
      } finally {
        setLoadingApprovals(false);
      }
    };

    fetchApprovals();
  }, []);

  useEffect(() => {
    const fetchQuickActions = async () => {
      try {
        const response = await api.get('/api/auth/me');
        const actions = Array.isArray(response.data?.quick_actions) ? response.data.quick_actions : [];
        setQuickActions(
          actions.filter((action: QuickAction) => action && action.name && action.url)
        );
      } catch (error) {
        console.error('Failed to load quick actions:', error);
      } finally {
        setLoadingQuickActions(false);
      }
    };

    fetchQuickActions();
  }, []);

  const latestApprovals = useMemo(() => {
    return [...approvals]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [approvals]);

  const handleOpenDocument = (approval: ApprovalFlow) => {
    const target = getApprovalRoute(approval);
    if (target) {
      navigate(target);
      return;
    }
    navigate('/notifications');
  };

  const handleQuickAction = (action: QuickAction) => {
    const rawUrl = (action.url || '').trim();
    if (!rawUrl) {
      return;
    }

    if (/^https?:\/\//i.test(rawUrl)) {
      window.open(rawUrl, '_blank');
      return;
    }

    let targetPath = rawUrl;
    if (targetPath.startsWith('/web/')) {
      targetPath = targetPath.replace(/^\/web/, '');
    } else if (targetPath === '/web') {
      targetPath = '/';
    }

    if (!targetPath.startsWith('/')) {
      targetPath = `/${targetPath}`;
    }

    navigate(targetPath);
  };

  return (
    <Container size="xl" mt={30}>
      <Stack gap="xl">
        <Title order={2}>
          {t('Welcome')}, {username}!
        </Title>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          {/* Column 1: Approval Requests */}
          <Paper shadow="sm" p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconSignature size={24} />
                <Title order={3}>{t('Approval Requests')}</Title>
              </Group>
              {loadingApprovals ? (
                <Group justify="center" py="sm">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">{t('Loading approvals...')}</Text>
                </Group>
              ) : latestApprovals.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t('No pending approvals')}
                </Text>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('Request')}</Table.Th>
                      <Table.Th>{t('Status')}</Table.Th>
                      <Table.Th>{t('Action')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {latestApprovals.map((approval) => (
                      <Table.Tr key={approval._id}>
                      <Table.Td>
                        <Text size="xs" c="dimmed">{t(getApprovalTypeLabelKey(approval.object_type))}</Text>
                        <Text size="sm" fw={700}>{approval.object_details?.reference || approval.object_id}</Text>
                        {approval.object_details?.description ? (
                          <Text size="xs" c="dimmed">{approval.object_details.description}</Text>
                        ) : null}
                      </Table.Td>
                        <Table.Td>
                          <Badge color="yellow" variant="light">{t(approval.status)}</Badge>
                        </Table.Td>
                        <Table.Td>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => handleOpenDocument(approval)}
                        >
                          {t('Review')}
                        </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}

              <Button
                variant="light"
                size="xs"
                onClick={() => navigate('/notifications')}
              >
                {t('View all pending requests')}
              </Button>
            </Stack>
          </Paper>

          {/* Column 2: Reserved for future use */}
          <Paper shadow="sm" p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={3}>{t('Quick Actions')}</Title>
              {loadingQuickActions ? (
                <Group justify="center" py="sm">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">{t('Loading...')}</Text>
                </Group>
              ) : quickActions.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t('No quick actions configured')}
                </Text>
              ) : (
                <Stack gap="xs">
                  {quickActions.map((action, index) => (
                    <Button
                      key={`${action.name}-${index}`}
                      variant="light"
                      size="sm"
                      onClick={() => handleQuickAction(action)}
                      fullWidth
                    >
                      {action.name}
                    </Button>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>

          {/* Column 3: Reserved for future use */}
          <Paper shadow="sm" p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={3}>{t('Recent Activity')}</Title>
              <Text size="sm" c="dimmed">
                {t('Coming soon...')}
              </Text>
            </Stack>
          </Paper>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
