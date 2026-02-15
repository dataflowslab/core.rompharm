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
    ActionIcon,
    Drawer,
    Button,
    Select,
    Title
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { IconSearch, IconFilter, IconChevronRight, IconRefresh } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import { requestsApi } from '../services/requests';
import { formatDate } from '../utils/dateFormat';

interface RequestListItem {
    _id: string;
    reference?: string;
    status?: string;
    source?: string;
    destination?: string;
    source_name?: string;
    destination_name?: string;
    issue_date?: string;
    created_at?: string;
    line_items?: number;
    items?: any[];
}

export function MobileRequestsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [requests, setRequests] = useState<RequestListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState<number | null>(null);
    const [filtersOpened, { open: openFilters, close: closeFilters }] = useDisclosure(false);
    const [dateFrom, setDateFrom] = useState<Date | null>(null);
    const [dateTo, setDateTo] = useState<Date | null>(null);
    const [draftDateFrom, setDraftDateFrom] = useState<Date | null>(null);
    const [draftDateTo, setDraftDateTo] = useState<Date | null>(null);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [draftStatusFilter, setDraftStatusFilter] = useState<string | null>(null);
    const [statusOptions, setStatusOptions] = useState<Array<{ value: string; label: string }>>([]);
    const pageSize = 10;

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim());
        }, 300);
        return () => clearTimeout(handle);
    }, [searchQuery]);

    useEffect(() => {
        loadStatusOptions();
    }, []);

    useEffect(() => {
        setPage(0);
        loadRequests({ reset: true, pageOverride: 0 });
    }, [debouncedSearch, dateFrom, dateTo, statusFilter]);

    const loadStatusOptions = async () => {
        try {
            const response = await api.get(requestsApi.getStates());
            const states = response.data.results || [];
            setStatusOptions(states.map((s: any) => ({
                value: s._id,
                label: s.name || s.label || s.value || s._id
            })));
        } catch (error) {
            console.error('Failed to load request states:', error);
        }
    };

    const loadRequests = async ({ reset = false, pageOverride }: { reset?: boolean; pageOverride?: number } = {}) => {
        if (reset) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const currentPage = pageOverride ?? page;
            const params: Record<string, string> = {
                skip: String(currentPage * pageSize),
                limit: String(pageSize)
            };
            if (debouncedSearch) params.search = debouncedSearch;
            if (statusFilter) params.state_id = statusFilter;
            if (dateFrom) params.date_from = dateFrom.toISOString().split('T')[0];
            if (dateTo) params.date_to = dateTo.toISOString().split('T')[0];

            const response = await api.get(requestsApi.getRequests(), { params });
            const results = response.data.results || response.data || [];
            const totalCount = typeof response.data.total === 'number' ? response.data.total : null;

            if (reset) {
                setRequests(results);
            } else {
                setRequests((prev) => [...prev, ...results]);
            }
            setTotal(totalCount);
        } catch (error) {
            console.error('Failed to load requests:', error);
            notifications.show({
                title: t('Error'),
                message: t('Failed to load requests'),
                color: 'red'
            });
        } finally {
            if (reset) {
                setLoading(false);
            } else {
                setLoadingMore(false);
            }
        }
    };

    const handleOpenFilters = () => {
        setDraftDateFrom(dateFrom);
        setDraftDateTo(dateTo);
        setDraftStatusFilter(statusFilter);
        openFilters();
    };

    const applyFilters = () => {
        setDateFrom(draftDateFrom);
        setDateTo(draftDateTo);
        setStatusFilter(draftStatusFilter);
        closeFilters();
    };

    const clearFilters = () => {
        setDraftDateFrom(null);
        setDraftDateTo(null);
        setDraftStatusFilter(null);
    };

    const canLoadMore = total === null ? requests.length > 0 : requests.length < total;

    const getStatusColor = (status?: string) => {
        const value = (status || '').toLowerCase();
        if (value.includes('cancel') || value.includes('refuz') || value.includes('rejected')) return 'red';
        if (value.includes('finished') || value.includes('approved') || value.includes('done')) return 'green';
        if (value.includes('processing') || value.includes('issued')) return 'blue';
        if (value.includes('pending')) return 'yellow';
        return 'gray';
    };

    return (
        <Container size="xs" p={0}>
            <Group justify="space-between" mb="md" align="center">
                <Title order={3}>{t('Requests')}</Title>
                <ActionIcon
                    variant="light"
                    size="lg"
                    radius="md"
                    onClick={() => {
                        setPage(0);
                        loadRequests({ reset: true, pageOverride: 0 });
                    }}
                >
                    <IconRefresh size={20} />
                </ActionIcon>
            </Group>

            <Group mb="md">
                <TextInput
                    placeholder={t('Search requests...')}
                    leftSection={<IconSearch size={16} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    style={{ flex: 1 }}
                />
                <ActionIcon variant="light" size="lg" radius="md" onClick={handleOpenFilters}>
                    <IconFilter size={20} />
                </ActionIcon>
            </Group>

            {loading ? (
                <Center py="xl">
                    <Loader />
                </Center>
            ) : (
                <Stack gap="sm">
                    {requests.map((req) => (
                        <Paper
                            key={req._id}
                            withBorder
                            p="md"
                            radius="md"
                            onClick={() => navigate(`/mobile/requests/${req._id}`)}
                            style={{ cursor: 'pointer' }}
                        >
                            <Group justify="space-between" mb="xs">
                                <Text fw={600}>{req.reference || req._id}</Text>
                                <Badge color={getStatusColor(req.status)} size="sm">
                                    {req.status || t('Unknown')}
                                </Badge>
                            </Group>

                            <Text size="sm" mb="xs">
                                {(req.source_name || req.source || t('Unknown'))} → {(req.destination_name || req.destination || t('Unknown'))}
                            </Text>

                            <Group justify="space-between" align="center">
                                <Text size="xs" c="dimmed">
                                    {formatDate(req.issue_date || req.created_at)}
                                </Text>
                                <IconChevronRight size={16} color="gray" />
                            </Group>
                        </Paper>
                    ))}

                    {requests.length === 0 && (
                        <Text c="dimmed" ta="center" py="xl">
                            {t('No requests found')}
                        </Text>
                    )}

                    {requests.length > 0 && canLoadMore && (
                        <Button
                            variant="light"
                            onClick={() => {
                                const nextPage = page + 1;
                                setPage(nextPage);
                                loadRequests({ pageOverride: nextPage });
                            }}
                            loading={loadingMore}
                        >
                            {t('Load more')}
                        </Button>
                    )}
                </Stack>
            )}

            <Drawer
                opened={filtersOpened}
                onClose={closeFilters}
                title={t('Filters')}
                padding="md"
                position="right"
            >
                <Stack gap="md">
                    <Select
                        label={t('Status')}
                        placeholder={t('Any status')}
                        data={statusOptions}
                        value={draftStatusFilter}
                        onChange={setDraftStatusFilter}
                        clearable
                        searchable
                    />
                    <DatePickerInput
                        label={t('From')}
                        placeholder={t('Select date')}
                        value={draftDateFrom}
                        onChange={setDraftDateFrom}
                        clearable
                    />
                    <DatePickerInput
                        label={t('To')}
                        placeholder={t('Select date')}
                        value={draftDateTo}
                        onChange={setDraftDateTo}
                        clearable
                    />
                    <Group justify="space-between" mt="sm">
                        <Button variant="default" onClick={clearFilters}>
                            {t('Clear')}
                        </Button>
                        <Button onClick={applyFilters}>
                            {t('Apply')}
                        </Button>
                    </Group>
                </Stack>
            </Drawer>
        </Container>
    );
}
