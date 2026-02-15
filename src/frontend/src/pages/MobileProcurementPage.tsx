import { useState, useEffect } from 'react';
import { Container, Title, TextInput, Stack, Paper, Text, Badge, Group, ActionIcon, Loader, Center, Drawer, Button, Select } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { IconSearch, IconFilter, IconChevronRight, IconRefresh } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { procurementApi } from '../services/procurement';
import { notifications } from '@mantine/notifications';
import { PurchaseOrder } from '../types/procurement';

export function MobileProcurementPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState<number | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [filtersOpened, { open: openFilters, close: closeFilters }] = useDisclosure(false);
    const [dateFrom, setDateFrom] = useState<Date | null>(null);
    const [dateTo, setDateTo] = useState<Date | null>(null);
    const [draftDateFrom, setDraftDateFrom] = useState<Date | null>(null);
    const [draftDateTo, setDraftDateTo] = useState<Date | null>(null);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [draftStatusFilter, setDraftStatusFilter] = useState<string | null>(null);
    const [orderStates, setOrderStates] = useState<Array<{ value: string; label: string }>>([]);
    const pageSize = 10;

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim());
        }, 300);
        return () => clearTimeout(handle);
    }, [searchQuery]);

    useEffect(() => {
        setPage(0);
        loadPurchaseOrders({ reset: true, pageOverride: 0 });
    }, [debouncedSearch, dateFrom, dateTo, statusFilter]);

    useEffect(() => {
        loadOrderStates();
    }, []);

    const loadPurchaseOrders = async ({ reset = false, pageOverride }: { reset?: boolean; pageOverride?: number } = {}) => {
        if (reset) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }
        try {
            const currentPage = pageOverride ?? page;
            const params = new URLSearchParams();
            if (debouncedSearch) params.append('search', debouncedSearch);
            if (dateFrom) params.append('date_from', dateFrom.toISOString().split('T')[0]);
            if (dateTo) params.append('date_to', dateTo.toISOString().split('T')[0]);
            if (statusFilter) params.append('state_id', statusFilter);
            params.append('skip', String(currentPage * pageSize));
            params.append('limit', String(pageSize));

            const url = `${procurementApi.getPurchaseOrders()}${params.toString() ? '?' + params.toString() : ''}`;
            const response = await api.get(url);
            const results = response.data.results || response.data || [];
            const totalCount = typeof response.data.total === 'number' ? response.data.total : null;

            if (reset) {
                setOrders(results);
            } else {
                setOrders((prev) => [...prev, ...results]);
            }
            setTotal(totalCount);
        } catch (error) {
            console.error('Failed to load purchase orders:', error);
            notifications.show({
                title: t('Error'),
                message: t('Failed to load purchase orders'),
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

    const loadOrderStates = async () => {
        try {
            const response = await api.get(procurementApi.getOrderStatuses());
            const statuses = response.data.statuses || [];
            setOrderStates(statuses.map((s: any) => ({
                value: s._id,
                label: s.name
            })));
        } catch (error) {
            console.error('Failed to load order statuses:', error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'gray';
            case 'pending': return 'yellow';
            case 'approved': return 'green';
            case 'rejected': return 'red';
            case 'completed': return 'blue';
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
        <Container size="xs" p={0}>
            <Group justify="space-between" mb="md" align="center">
                <Title order={3}>{t('Procurement')}</Title>
                <ActionIcon
                    variant="light"
                    size="lg"
                    radius="md"
                    onClick={() => {
                        setPage(0);
                        loadPurchaseOrders({ reset: true, pageOverride: 0 });
                    }}
                >
                    <IconRefresh size={20} />
                </ActionIcon>
            </Group>

            <Group mb="md">
                <TextInput
                    placeholder={t('Search PO...')}
                    leftSection={<IconSearch size={16} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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
                    {orders.map((order) => (
                        <Paper
                            key={order._id}
                            withBorder
                            p="md"
                            radius="md"
                            onClick={() => navigate(`/mobile/procurement/${order._id}`)}
                            style={{ cursor: 'pointer' }}
                        >
                            <Group justify="space-between" mb="xs">
                                <Text fw={600}>{order.reference}</Text>
                                <Badge color={order.state_detail?.color || getStatusColor(String(order.status || ''))} size="sm">
                                    {order.state_detail?.name || order.status}
                                </Badge>
                            </Group>

                            <Text size="sm" mb="xs">{order.supplier_detail?.name || t('Unknown Supplier')}</Text>

                            <Group justify="space-between" align="center">
                                <Text size="xs" c="dimmed">
                                    {order.target_date ? new Date(order.target_date).toLocaleDateString() : '-'}
                                </Text>
                                <IconChevronRight size={16} color="gray" />
                            </Group>
                        </Paper>
                    ))}

                    {orders.length === 0 && (
                        <Text c="dimmed" ta="center" py="xl">
                            {t('No orders found')}
                        </Text>
                    )}

                    {orders.length > 0 && canLoadMore && (
                        <Button
                            variant="light"
                            onClick={() => {
                                const nextPage = page + 1;
                                setPage(nextPage);
                                loadPurchaseOrders({ pageOverride: nextPage });
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
                        data={orderStates}
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
