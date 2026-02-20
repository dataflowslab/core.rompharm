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
    Select
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { IconSearch, IconArrowRight, IconRefresh, IconFilter } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { salesService, SalesOrder } from '../services/sales';
import { formatDateTime } from '../utils/dateFormat';

export function MobileSalesPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [orders, setOrders] = useState<SalesOrder[]>([]);
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
        loadOrders({ reset: true, pageOverride: 0 });
    }, [debouncedSearch, dateFrom, dateTo, statusFilter]);

    const loadOrders = async ({ reset = false, pageOverride }: { reset?: boolean; pageOverride?: number } = {}) => {
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
            if (statusFilter) params.status = statusFilter;
            if (dateFrom) params.date_from = dateFrom.toISOString().split('T')[0];
            if (dateTo) params.date_to = dateTo.toISOString().split('T')[0];

            const data = await salesService.getSalesOrders(params);
            const results = data.results || data || [];
            const totalCount = typeof data.total === 'number' ? data.total : null;

            if (reset) {
                setOrders(results);
            } else {
                setOrders((prev) => [...prev, ...results]);
            }
            setTotal(totalCount);
        } catch (error) {
            console.error('Failed to load sales orders:', error);
            notifications.show({
                title: t('Error'),
                message: t('Failed to load sales orders'),
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

    const loadStatusOptions = async () => {
        try {
            const data = await salesService.getOrderStatuses();
            const statuses = data.statuses || data || [];
            if (statuses.length > 0) {
                setStatusOptions(statuses.map((s: any) => ({
                    value: String(s.value ?? s.status ?? s.id ?? s.code ?? s),
                    label: s.name || s.label || s.text || String(s)
                })));
            } else {
                setStatusOptions([
                    { value: '10', label: t('Pending') },
                    { value: '20', label: t('In Progress') },
                    { value: '30', label: t('Shipped') },
                    { value: '40', label: t('Cancelled') },
                ]);
            }
        } catch (error) {
            setStatusOptions([
                { value: '10', label: t('Pending') },
                { value: '20', label: t('In Progress') },
                { value: '30', label: t('Shipped') },
                { value: '40', label: t('Cancelled') },
            ]);
        }
    };

    const getStatusColor = (status: number) => {
        switch (status) {
            case 10: return 'yellow'; // Pending
            case 20: return 'blue';   // In Progress
            case 30: return 'green';  // Shipped
            case 40: return 'red';    // Cancelled
            default: return 'gray';
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

    const canLoadMore = total === null ? orders.length > 0 : orders.length < total;

    return (
        <Container p="md" pb={80}>
            <Group justify="space-between" mb="md">
                <Text size="xl" fw={700}>{t('Sales Orders')}</Text>
                <ActionIcon
                    variant="light"
                    onClick={() => {
                        setPage(0);
                        loadOrders({ reset: true, pageOverride: 0 });
                    }}
                    size="lg"
                >
                    <IconRefresh size={20} />
                </ActionIcon>
            </Group>

            <Group gap="xs" mb="md">
                <TextInput
                    placeholder={t('Search sales...')}
                    leftSection={<IconSearch size={16} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    size="md"
                    style={{ flex: 1 }}
                />
                <ActionIcon variant="light" size="lg" onClick={handleOpenFilters}>
                    <IconFilter size={20} />
                </ActionIcon>
            </Group>

            {loading ? (
                <Center h={200}>
                    <Loader size="lg" />
                </Center>
            ) : orders.length === 0 ? (
                <Center h={200}>
                    <Text c="dimmed">{t('No sales orders found')}</Text>
                </Center>
            ) : (
                <Stack gap="sm">
                    {orders.map((order) => (
                        <Paper
                            key={order._id}
                            p="md"
                            shadow="sm"
                            radius="md"
                            withBorder
                            onClick={() => navigate(`/mobile/sales/${order._id}`)}
                            style={{ cursor: 'pointer' }}
                        >
                            <Group justify="space-between" mb="xs">
                                <Text fw={600} size="lg">{order.reference}</Text>
                                <Badge color={getStatusColor(order.status)} variant="light">
                                    {order.status_text || `Status ${order.status}`}
                                </Badge>
                            </Group>

                            <Group gap="xs" mb="xs">
                                <Text size="sm" c="dimmed">{t('Customer')}:</Text>
                                <Text size="sm" fw={500} lineClamp={1}>
                                    {order.customer_detail?.name || order.customer}
                                </Text>
                            </Group>

                            <Group justify="space-between" align="center">
                                <Text size="xs" c="dimmed">
                                    {formatDateTime(order.target_date || order.creation_date)}
                                </Text>
                                <Group gap={4}>
                                    <Text size="sm" fw={700}>{order.total_price}</Text>
                                    <IconArrowRight size={16} />
                                </Group>
                            </Group>
                        </Paper>
                    ))}

                    {canLoadMore && (
                        <Button
                            variant="light"
                            onClick={() => {
                                const nextPage = page + 1;
                                setPage(nextPage);
                                loadOrders({ pageOverride: nextPage });
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
