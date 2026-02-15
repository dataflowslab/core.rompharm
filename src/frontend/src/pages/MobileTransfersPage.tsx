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
    TextInput,
    ActionIcon
} from '@mantine/core';
import { IconSearch, IconArrowRight, IconRefresh } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import { requestsApi } from '../services/requests';
import { formatDateTime } from '../utils/dateFormat';

interface Request {
    _id: string;
    reference: string;
    source_name?: string;
    destination_name?: string;
    status: string;
    issue_date: string;
    line_items: number;
}

export function MobileTransfersPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const url = requestsApi.getRequests();
            const response = await api.get(url);
            // Backend returns { results: [...] }
            setRequests(response.data.results || []);
        } catch (error) {
            console.error('Failed to load requests:', error);
            notifications.show({
                title: t('Error'),
                message: t('Failed to load transfer requests'),
                color: 'red'
            });
        } finally {
            setLoading(false);
        }
    };

    const filteredRequests = requests.filter(req => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                req.reference?.toLowerCase().includes(query) ||
                req.source_name?.toLowerCase().includes(query) ||
                req.destination_name?.toLowerCase().includes(query)
            );
        }
        return true;
    });

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'yellow';
            case 'approved': return 'blue';
            case 'completed': return 'green';
            case 'cancelled': return 'red';
            case 'in progress': return 'cyan';
            default: return 'gray';
        }
    };

    return (
        <Container p="md" pb={80}> {/* Padding bottom for bottom nav if exists */}
            <Group justify="space-between" mb="md">
                <Text size="xl" fw={700}>{t('Transfers')}</Text>
                <ActionIcon variant="light" onClick={loadRequests} size="lg">
                    <IconRefresh size={20} />
                </ActionIcon>
            </Group>

            <TextInput
                placeholder={t('Search transfers...')}
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                mb="md"
                size="md"
            />

            {loading ? (
                <Center h={200}>
                    <Loader size="lg" />
                </Center>
            ) : filteredRequests.length === 0 ? (
                <Center h={200}>
                    <Text c="dimmed">{t('No transfer requests found')}</Text>
                </Center>
            ) : (
                <Stack gap="sm">
                    {filteredRequests.map((req) => (
                        <Paper
                            key={req._id}
                            p="md"
                            shadow="sm"
                            radius="md"
                            withBorder
                            onClick={() => navigate(`/mobile/transfers/${req._id}`)}
                            style={{ cursor: 'pointer' }}
                        >
                            <Group justify="space-between" mb="xs">
                                <Text fw={600} size="lg">{req.reference}</Text>
                                <Badge color={getStatusColor(req.status)} variant="light">
                                    {req.status}
                                </Badge>
                            </Group>

                            <Group gap="xs" mb="xs">
                                <Text size="sm" c="dimmed">{t('From')}:</Text>
                                <Text size="sm" fw={500}>{req.source_name || '-'}</Text>
                                <IconArrowRight size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                                <Text size="sm" c="dimmed">{t('To')}:</Text>
                                <Text size="sm" fw={500}>{req.destination_name || '-'}</Text>
                            </Group>

                            <Group justify="space-between" align="center">
                                <Text size="xs" c="dimmed">
                                    {formatDateTime(req.issue_date)}
                                </Text>
                                <Group gap={4}>
                                    <Text size="sm">{req.line_items} {t('Items')}</Text>
                                    <IconArrowRight size={16} />
                                </Group>
                            </Group>
                        </Paper>
                    ))}
                </Stack>
            )}
        </Container>
    );
}
