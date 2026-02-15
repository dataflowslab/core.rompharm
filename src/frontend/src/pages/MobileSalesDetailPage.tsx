import { useState, useEffect } from 'react';
import {
    Container,
    Text,
    Paper,
    Stack,
    Group,
    Badge,
    Loader,
    Button,
    ActionIcon,
    Divider,
    Checkbox,
    Title,
    Modal,
    TextInput,
    Center
} from '@mantine/core';
import {
    IconArrowLeft,
    IconCheck,
    IconBarcode,
    IconUser,
    IconCalendar
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { salesService, SalesOrder, SalesOrderItem } from '../services/sales';

interface EnhancedOrderItem extends SalesOrderItem {
    scanned_quantity?: number;
    checked?: boolean;
}

export function MobileSalesDetailPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    const [order, setOrder] = useState<SalesOrder | null>(null);
    const [items, setItems] = useState<EnhancedOrderItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Scanner Modal
    const [opened, { open, close }] = useDisclosure(false);
    const [scanInput, setScanInput] = useState('');

    useEffect(() => {
        if (id) loadOrder(id);
    }, [id]);

    const loadOrder = async (orderId: string) => {
        setLoading(true);
        try {
            const [orderData, itemsData] = await Promise.all([
                salesService.getSalesOrder(Number(orderId)),
                salesService.getSalesOrderItems(Number(orderId))
            ]);

            setOrder(orderData);

            const rawItems = itemsData.results || itemsData || [];
            setItems(rawItems.map((item: SalesOrderItem) => ({
                ...item,
                scanned_quantity: 0,
                checked: false
            })));

        } catch (error) {
            console.error('Failed to load sales order:', error);
            notifications.show({
                title: t('Error'),
                message: t('Failed to load sales order details'),
                color: 'red'
            });
            navigate('/mobile/sales');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleItem = (index: number) => {
        const newItems = [...items];
        newItems[index].checked = !newItems[index].checked;

        if (newItems[index].checked) {
            newItems[index].scanned_quantity = newItems[index].quantity;
        } else {
            newItems[index].scanned_quantity = 0;
        }
        setItems(newItems);
    };

    const handleScanSubmit = () => {
        // Mock Scan Logic: Find item by IPN or Part Name
        if (!scanInput) return;

        const index = items.findIndex(
            item => item.part_detail?.IPN === scanInput ||
                item.part_detail?.name.toLowerCase().includes(scanInput.toLowerCase())
        );

        if (index !== -1) {
            const newItems = [...items];
            newItems[index].checked = true;
            newItems[index].scanned_quantity = newItems[index].quantity;
            setItems(newItems);
            notifications.show({ message: t('Item verified'), color: 'green' });
            setScanInput('');
            close();
        } else {
            notifications.show({ message: t('Item not found in this order'), color: 'red' });
        }
    };

    const handleDispatch = async () => {
        if (!order) return;

        // Check if all items are verified? Or at least one?
        const verifiedDetails = items.filter(i => i.checked);
        if (verifiedDetails.length === 0) {
            notifications.show({ message: t('No items verified'), color: 'yellow' });
            return;
        }

        setSubmitting(true);
        try {
            // Dispatch logic: 
            // 1. Update status to 30 (Shipped)
            await salesService.updateOrderStatus(order.pk, 30);

            notifications.show({
                title: t('Success'),
                message: t('Order dispatched (Status: Shipped)'),
                color: 'green'
            });

            navigate('/mobile/sales');

        } catch (error: any) {
            console.error('Dispatch failed:', error);
            notifications.show({
                title: t('Error'),
                message: error.response?.data?.detail || t('Failed to dispatch order'),
                color: 'red'
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !order) {
        return (
            <Center h="100vh">
                <Loader size="lg" />
            </Center>
        );
    }

    return (
        <Container p={0} pb={80} style={{ minHeight: '100vh', background: '#f8f9fa' }}>
            {/* Header */}
            <Paper p="md" radius={0} shadow="xs" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <Group>
                    <ActionIcon variant="subtle" onClick={() => navigate('/mobile/sales')}>
                        <IconArrowLeft size={24} />
                    </ActionIcon>
                    <Stack gap={0} style={{ flex: 1 }}>
                        <Text fw={700} size="lg">{order.reference}</Text>
                        <Badge size="sm" color={order.status === 30 ? 'green' : 'blue'}>
                            {order.status_text || `Status ${order.status}`}
                        </Badge>
                    </Stack>
                </Group>
            </Paper>

            {/* Content */}
            <Stack p="md" gap="md">
                {/* Info Card */}
                <Paper p="md" radius="md" withBorder>
                    <Group align="start" gap="xs">
                        <IconUser size={20} color="gray" />
                        <Stack gap={2}>
                            <Text size="xs" c="dimmed">{t('Customer')}</Text>
                            <Text fw={500}>{order.customer_detail?.name || order.customer}</Text>
                        </Stack>
                    </Group>
                    <Divider my="xs" />
                    <Group align="start" gap="xs">
                        <IconCalendar size={20} color="gray" />
                        <Stack gap={2}>
                            <Text size="xs" c="dimmed">{t('Target Date')}</Text>
                            <Text fw={500}>{order.target_date || order.creation_date || '-'}</Text>
                        </Stack>
                    </Group>
                </Paper>

                <Title order={5} mt="sm">{t('Items for Dispatch')}</Title>

                <Stack gap="sm">
                    {items.map((item, index) => (
                        <Paper
                            key={item.pk}
                            p="md"
                            radius="md"
                            withBorder
                            style={item.checked ? { borderColor: 'var(--mantine-color-green-filled)', background: '#f0fff4' } : {}}
                            onClick={() => handleToggleItem(index)}
                        >
                            <Group justify="space-between" align="start">
                                <Stack gap={2} style={{ flex: 1 }}>
                                    <Text fw={600} lineClamp={2}>{item.part_detail?.name || item.part}</Text>
                                    <Text size="sm" c="dimmed">IPN: {item.part_detail?.IPN}</Text>
                                </Stack>
                                <Checkbox
                                    checked={!!item.checked}
                                    onChange={() => handleToggleItem(index)}
                                    size="lg"
                                />
                            </Group>
                            <Divider my="sm" />
                            <Group justify="space-between">
                                <Text size="sm">{t('Ordered')}: {item.quantity}</Text>
                                <Text size="sm" fw={700} c={item.checked ? 'green' : 'dimmed'}>
                                    {item.checked ? item.quantity : 0} {t('Ready')}
                                </Text>
                            </Group>
                        </Paper>
                    ))}
                </Stack>
            </Stack>

            {/* Floating Action Bar */}
            <Paper
                p="md"
                shadow="md"
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    borderTop: '1px solid #eee'
                }}
            >
                <Group grow>
                    <Button
                        leftSection={<IconBarcode size={20} />}
                        variant="light"
                        size="lg"
                        onClick={open}
                    >
                        {t('Scan')}
                    </Button>
                    <Button
                        leftSection={<IconCheck size={20} />}
                        color="green"
                        size="lg"
                        loading={submitting}
                        onClick={handleDispatch}
                        disabled={!items.some(i => i.checked)}
                    >
                        {t('Dispatch')}
                    </Button>
                </Group>
            </Paper>

            {/* Scan Modal */}
            <Modal opened={opened} onClose={close} title={t('Scan Item')} centered>
                <Stack>
                    <Text size="sm" c="dimmed">Enter IPN or Name manually (or scan)</Text>
                    <TextInput
                        placeholder="Scan..."
                        value={scanInput}
                        onChange={(e) => setScanInput(e.currentTarget.value)}
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleScanSubmit();
                        }}
                    />
                    <Button fullWidth onClick={handleScanSubmit}>{t('Submit')}</Button>
                </Stack>
            </Modal>

        </Container>
    );
}
