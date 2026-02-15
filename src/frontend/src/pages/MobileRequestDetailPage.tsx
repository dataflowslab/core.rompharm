import { useState, useEffect } from 'react';
import {
    Container,
    Text,
    Paper,
    Stack,
    Group,
    Badge,
    Loader,
    Center,
    ActionIcon,
    Tabs,
    Title,
    Divider
} from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import { requestsApi } from '../services/requests';
import { formatDateTime, formatDate } from '../utils/dateFormat';

export function MobileRequestDetailPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    const [request, setRequest] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (id) loadRequest(id);
    }, [id]);

    const loadRequest = async (requestId: string) => {
        setLoading(true);
        try {
            const response = await api.get(requestsApi.getRequest(requestId));
            setRequest(response.data);
        } catch (error) {
            console.error('Failed to load request:', error);
            notifications.show({
                title: t('Error'),
                message: t('Failed to load request details'),
                color: 'red'
            });
            navigate('/mobile/requests');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status?: string) => {
        const value = (status || '').toLowerCase();
        if (value.includes('cancel') || value.includes('refuz') || value.includes('rejected')) return 'red';
        if (value.includes('finished') || value.includes('approved') || value.includes('done')) return 'green';
        if (value.includes('processing') || value.includes('issued')) return 'blue';
        if (value.includes('pending')) return 'yellow';
        return 'gray';
    };

    if (loading || !request) {
        return (
            <Center h="100vh">
                <Loader size="lg" />
            </Center>
        );
    }

    return (
        <Container p={0} pb={80} style={{ minHeight: '100vh', background: '#f8f9fa' }}>
            <Paper p="md" radius={0} shadow="xs" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <Group>
                    <ActionIcon variant="subtle" onClick={() => navigate('/mobile/requests')}>
                        <IconArrowLeft size={24} />
                    </ActionIcon>
                    <Stack gap={0} style={{ flex: 1 }}>
                        <Text fw={700} size="lg">{request.reference || request._id}</Text>
                        <Badge size="sm" color={getStatusColor(request.status)}>
                            {request.status || t('Unknown')}
                        </Badge>
                    </Stack>
                </Group>
            </Paper>

            <Stack p="md" gap="md">
                <Tabs defaultValue="summary">
                    <Tabs.List grow>
                        <Tabs.Tab value="summary">{t('Summary')}</Tabs.Tab>
                        <Tabs.Tab value="details">{t('Details')}</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="summary" pt="md">
                        <Paper p="md" radius="md" withBorder>
                            <Stack gap="xs">
                                <Group justify="space-between">
                                    <Text size="sm" c="dimmed">{t('Source')}</Text>
                                    <Text fw={500}>{request.source_detail?.name || request.source_name || request.source || '-'}</Text>
                                </Group>
                                <Group justify="space-between">
                                    <Text size="sm" c="dimmed">{t('Destination')}</Text>
                                    <Text fw={500}>{request.destination_detail?.name || request.destination_name || request.destination || '-'}</Text>
                                </Group>
                                <Group justify="space-between">
                                    <Text size="sm" c="dimmed">{t('Issue Date')}</Text>
                                    <Text fw={500}>{formatDate(request.issue_date || request.created_at)}</Text>
                                </Group>
                                <Group justify="space-between">
                                    <Text size="sm" c="dimmed">{t('Items')}</Text>
                                    <Text fw={500}>{request.line_items || request.items?.length || 0}</Text>
                                </Group>
                            </Stack>
                        </Paper>

                        <Paper p="md" radius="md" withBorder mt="md">
                            <Title order={6}>{t('Actions')}</Title>
                            <Divider my="sm" />
                            <Text size="sm" c="dimmed">
                                {t('Actions will appear here based on your role.')}
                            </Text>
                        </Paper>
                    </Tabs.Panel>

                    <Tabs.Panel value="details" pt="md">
                        <Paper p="md" radius="md" withBorder>
                            <Text size="xs" c="dimmed" mb="xs">
                                {t('Raw request data')}
                            </Text>
                            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                {JSON.stringify(request, null, 2)}
                            </pre>
                        </Paper>
                    </Tabs.Panel>
                </Tabs>
            </Stack>
        </Container>
    );
}
