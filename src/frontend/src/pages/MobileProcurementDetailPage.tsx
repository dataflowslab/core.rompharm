import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container, Title, Group, Button, Tabs, Text, Badge, Paper, Stack,
    ActionIcon, Loader, Center, Modal, NumberInput, TextInput, Select, Textarea
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconArrowLeft, IconInfoCircle, IconPackage, IconTruckDelivery, IconPrinter } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDisclosure } from '@mantine/hooks';
import api from '../services/api';
import { procurementApi } from '../services/procurement';
import { PurchaseOrder, PurchaseOrderItem } from '../types/procurement';
import { notifications } from '@mantine/notifications';

export function MobileProcurementDetailPage() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [items, setItems] = useState<PurchaseOrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string | null>('details');

    // Reception State
    const [selectedItem, setSelectedItem] = useState<PurchaseOrderItem | null>(null);
    const [receiveModalOpen, { open: openReceive, close: closeReceive }] = useDisclosure(false);
    const [printModalOpen, { open: openPrint, close: closePrint }] = useDisclosure(false);
    const [submitting, setSubmitting] = useState(false);
    const [lastStockId, setLastStockId] = useState<string | null>(null);
    const [locations, setLocations] = useState<any[]>([]);

    // Form State
    const [rxQty, setRxQty] = useState<number | ''>('');
    const [rxBatch, setRxBatch] = useState('');
    const [rxExpiry, setRxExpiry] = useState<Date | null>(null);
    const [rxLocation, setRxLocation] = useState<string | null>(null);
    const [rxNotes, setRxNotes] = useState('');

    useEffect(() => {
        if (id) {
            loadData();
            loadLocations();
        }
    }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [orderRes, itemsRes] = await Promise.all([
                api.get(procurementApi.getPurchaseOrder(id!)),
                api.get(procurementApi.getOrderItems(id!))
            ]);
            setOrder(orderRes.data);
            setItems(itemsRes.data.results || itemsRes.data || []);
        } catch (error) {
            console.error('Failed to load data:', error);
            notifications.show({
                title: t('Error'),
                message: t('Failed to load order data'),
                color: 'red'
            });
        } finally {
            setLoading(false);
        }
    };

    const loadLocations = async () => {
        try {
            const res = await api.get('/modules/inventory/api/locations');
            const locs = res.data.results || res.data || [];
            setLocations(locs.map((l: any) => ({ value: l._id, label: l.name })));
        } catch (e) { console.error('Failed to load locations', e); }
    };

    const handleReceiveClick = (item: PurchaseOrderItem) => {
        setSelectedItem(item);
        setRxQty(item.quantity - item.received);
        setRxBatch('');
        setRxExpiry(null);
        setRxLocation(null);
        setRxNotes('');
        openReceive();
    };

    const handleReceiveSubmit = async () => {
        if (!selectedItem || !rxQty || !rxLocation) {
            notifications.show({ message: t('Please fill required fields'), color: 'red' });
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                part_id: selectedItem.part_id,
                quantity: Number(rxQty),
                location_id: rxLocation,
                batch_code: rxBatch,
                expiry_date: rxExpiry ? rxExpiry.toISOString() : null,
                notes: rxNotes
            };

            const res = await api.post(procurementApi.receiveStock(id!), payload);
            const stockId = res.data._id;

            setLastStockId(stockId);
            notifications.show({ title: t('Success'), message: t('Stock received'), color: 'green' });
            closeReceive();
            loadData(); // Refresh items
            openPrint(); // Ask to print
        } catch (error: any) {
            console.error('Receive failed:', error);
            notifications.show({
                title: t('Error'),
                message: error.response?.data?.detail || t('Failed to receive stock'),
                color: 'red'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handlePrintLabel = async () => {
        if (!lastStockId) return;
        try {
            // Get default template (mock logic: get first 'depo_stocks' template)
            const tmplRes = await api.get('/modules/inventory/api/label-templates?table=depo_stocks');
            const templates = tmplRes.data;
            const templateId = templates.length > 0 ? templates[0]._id : null;

            if (!templateId) {
                notifications.show({ message: t('No label template found'), color: 'red' });
                return;
            }

            const response = await api.post(
                '/modules/inventory/api/generate-labels',
                {
                    template_id: templateId,
                    items: [{ id: lastStockId, quantity: 1 }]
                },
                { responseType: 'blob' }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'label.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
            closePrint();
        } catch (error) {
            console.error('Print failed:', error);
            notifications.show({ message: t('Failed to generate label'), color: 'red' });
        }
    };

    if (loading) {
        return (
            <Center h="100vh">
                <Loader />
            </Center>
        );
    }

    if (!order) {
        return (
            <Container p="md">
                <Text>{t('Order not found')}</Text>
                <Button onClick={() => navigate('/mobile/procurement')} mt="md">
                    {t('Back to List')}
                </Button>
            </Container>
        );
    }

    return (
        <Container p={0} pb={80}>
            <Group mb="md" p="md" style={{ backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
                <ActionIcon variant="subtle" onClick={() => navigate('/mobile/procurement')}>
                    <IconArrowLeft size={24} />
                </ActionIcon>
                <div style={{ flex: 1 }}>
                    <Title order={4}>{order.reference}</Title>
                    <Text size="xs" c="dimmed">{order.supplier_detail?.name}</Text>
                </div>
                <Badge color={order.state_detail?.color || 'gray'}>
                    {order.state_detail?.name || order.status}
                </Badge>
            </Group>

            <Tabs value={activeTab} onChange={setActiveTab} bg="white">
                <Tabs.List grow>
                    <Tabs.Tab value="details" leftSection={<IconInfoCircle size={18} />}>
                        {t('Info')}
                    </Tabs.Tab>
                    <Tabs.Tab value="items" leftSection={<IconPackage size={18} />}>
                        {t('Items')}
                    </Tabs.Tab>
                    <Tabs.Tab value="receive" leftSection={<IconTruckDelivery size={18} />}>
                        {t('Receive')}
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="details" p="md">
                    <Stack gap="sm">
                        <Paper withBorder p="sm" radius="md">
                            <Text size="xs" c="dimmed">{t('Supplier')}</Text>
                            <Text fw={500}>{order.supplier_detail?.name}</Text>
                        </Paper>
                        <Paper withBorder p="sm" radius="md">
                            <Text size="xs" c="dimmed">{t('Issue Date')}</Text>
                            <Text>{order.issue_date ? new Date(order.issue_date).toLocaleDateString() : '-'}</Text>
                        </Paper>
                        <Paper withBorder p="sm" radius="md">
                            <Text size="xs" c="dimmed">{t('Target Date')}</Text>
                            <Text>{order.target_date ? new Date(order.target_date).toLocaleDateString() : '-'}</Text>
                        </Paper>
                        {order.notes && (
                            <Paper withBorder p="sm" radius="md">
                                <Text size="xs" c="dimmed">{t('Notes')}</Text>
                                <Text size="sm">{order.notes}</Text>
                            </Paper>
                        )}
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="items" p="md">
                    <Stack gap="sm">
                        {items.map(item => (
                            <Paper key={item._id} withBorder p="sm" radius="md">
                                <Group justify="space-between" mb={4}>
                                    <Text fw={500} size="sm">{item.part_detail?.name || t('Unknown Item')}</Text>
                                    <Badge variant="light">{item.quantity} {item.part_detail?.um || 'units'}</Badge>
                                </Group>
                                <Text size="xs" c="dimmed">IPN: {item.part_detail?.ipn || item.part_detail?.IPN}</Text>
                                <Group justify="space-between" mt="xs">
                                    <Text size="xs">{item.purchase_price} {item.purchase_price_currency}</Text>
                                    <Text size="xs" c={item.received >= item.quantity ? 'green' : 'orange'}>
                                        {t('Received')}: {item.received} / {item.quantity}
                                    </Text>
                                </Group>
                            </Paper>
                        ))}
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="receive" p="md">
                    <Paper p="sm" radius="md" bg="gray.1" mb="md">
                        <Text size="sm" ta="center">{t('Tap an item to receive stock')}</Text>
                    </Paper>
                    <Stack gap="sm">
                        {items
                            .filter(item => item.received < item.quantity)
                            .map(item => (
                                <Paper
                                    key={item._id}
                                    withBorder
                                    p="sm"
                                    radius="md"
                                    onClick={() => handleReceiveClick(item)}
                                    style={{ cursor: 'pointer', borderColor: '#228be6' }}
                                >
                                    <Group justify="space-between" mb={4}>
                                        <Text fw={500} size="sm">{item.part_detail?.name}</Text>
                                        <Badge color="blue">
                                            {t('Remaining')}: {item.quantity - item.received}
                                        </Badge>
                                    </Group>
                                    <Text size="xs" c="dimmed">IPN: {item.part_detail?.ipn}</Text>
                                </Paper>
                            ))}
                        {items.filter(item => item.received < item.quantity).length === 0 && (
                            <Text c="dimmed" ta="center" py="xl">{t('All items received')}</Text>
                        )}
                    </Stack>
                </Tabs.Panel>
            </Tabs>

            {/* RECEIVE MODAL */}
            <Modal opened={receiveModalOpen} onClose={closeReceive} title={t('Receive Stock')} centered>
                {selectedItem && (
                    <Stack>
                        <Text size="sm" fw={500}>{selectedItem.part_detail?.name}</Text>
                        <NumberInput
                            label={t('Quantity')}
                            value={rxQty}
                            onChange={(v) => setRxQty(Number(v))}
                            max={selectedItem.quantity - selectedItem.received}
                            min={0}
                            required
                        />
                        <TextInput
                            label={t('Batch Code')}
                            placeholder="Scan or type batch"
                            value={rxBatch}
                            onChange={(e) => setRxBatch(e.currentTarget.value)}
                        />
                        <DatePickerInput
                            label={t('Expiry Date')}
                            placeholder="Pick date"
                            value={rxExpiry}
                            onChange={setRxExpiry}
                            clearable
                        />
                        <Select
                            label={t('Location')}
                            placeholder="Select location"
                            data={locations}
                            value={rxLocation}
                            onChange={setRxLocation}
                            required
                            searchable
                        />
                        <Textarea
                            label={t('Notes')}
                            value={rxNotes}
                            onChange={(e) => setRxNotes(e.currentTarget.value)}
                        />
                        <Button onClick={handleReceiveSubmit} loading={submitting} fullWidth mt="md">
                            {t('Confirm Reception')}
                        </Button>
                    </Stack>
                )}
            </Modal>

            {/* PRINT LABEL MODAL */}
            <Modal opened={printModalOpen} onClose={closePrint} title={t('Print Label')} centered>
                <Stack align="center">
                    <IconPrinter size={48} color="gray" />
                    <Text ta="center">{t('Stock received successfully. Do you want to print a label?')}</Text>
                    <Group mt="md">
                        <Button variant="default" onClick={closePrint}>{t('No, thanks')}</Button>
                        <Button onClick={handlePrintLabel}>{t('Yes, Print')}</Button>
                    </Group>
                </Stack>
            </Modal>
        </Container>
    );
}
