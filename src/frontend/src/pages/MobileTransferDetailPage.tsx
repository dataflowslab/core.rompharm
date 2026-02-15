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
    IconMapPin,
    IconTruckDelivery
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { api } from '../services/api';
import { requestsApi } from '../services/requests';

interface TransferItem {
    part: string; // ID
    part_detail?: {
        name: string;
        IPN: string;
    };
    quantity: number;
    batch_code?: string;
    notes?: string;
    scanned_quantity?: number; // Local state
    checked?: boolean; // Local state
}

interface RequestDetail {
    _id: string;
    reference: string;
    source: string;
    source_name: string;
    destination: string;
    destination_name: string;
    status: string;
    items: TransferItem[];
    notes?: string;
}

export function MobileTransferDetailPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    const [request, setRequest] = useState<RequestDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Scanner Modal
    const [opened, { open, close }] = useDisclosure(false);
    const [scanInput, setScanInput] = useState('');

    useEffect(() => {
        if (id) loadRequest(id);
    }, [id]);

    const loadRequest = async (reqId: string) => {
        setLoading(true);
        try {
            const url = requestsApi.getRequest(reqId);
            const response = await api.get(url);
            const data = response.data;

            // Initialize local state for items
            if (data.items) {
                data.items = data.items.map((item: any) => ({
                    ...item,
                    scanned_quantity: 0,
                    checked: false
                }));
            }

            setRequest(data);
        } catch (error) {
            console.error('Failed to load request:', error);
            notifications.show({
                title: t('Error'),
                message: t('Failed to load request details'),
                color: 'red'
            });
            navigate('/mobile/transfers');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleItem = (index: number) => {
        if (!request) return;
        const newItems = [...request.items];
        newItems[index].checked = !newItems[index].checked;
        // Auto-fill quantity if checked
        if (newItems[index].checked) {
            newItems[index].scanned_quantity = newItems[index].quantity;
        } else {
            newItems[index].scanned_quantity = 0;
        }
        setRequest({ ...request, items: newItems });
    };

    const handleScanSubmit = () => {
        // Mock Scan Logic: Find item by IPN or batch
        if (!request || !scanInput) return;

        const index = request.items.findIndex(
            item => item.part_detail?.IPN === scanInput || item.batch_code === scanInput
        );

        if (index !== -1) {
            const newItems = [...request.items];
            newItems[index].checked = true;
            newItems[index].scanned_quantity = newItems[index].quantity;
            setRequest({ ...request, items: newItems });
            notifications.show({ message: t('Item verified'), color: 'green' });
            setScanInput('');
            close(); // or keep open for next scan
        } else {
            notifications.show({ message: t('Item not found in this request'), color: 'red' });
        }
    };

    const handleExecuteTransfer = async () => {
        if (!request || !id) return;

        // Filter checked items
        const itemsToTransfer = request.items.filter(item => item.checked);

        if (itemsToTransfer.length === 0) {
            notifications.show({ message: t('No items selected'), color: 'yellow' });
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                items: itemsToTransfer.map(item => ({
                    part_id: item.part,
                    batch_code: item.batch_code || '', // Need batch code for transfer!
                    quantity: item.scanned_quantity || item.quantity,
                    notes: item.notes
                }))
            };

            await api.post(requestsApi.executeTransfer(id), payload);

            notifications.show({
                title: t('Success'),
                message: t('Transfer executed successfully'),
                color: 'green'
            });

            navigate('/mobile/transfers');

        } catch (error: any) {
            console.error('Transfer failed:', error);
            notifications.show({
                title: t('Error'),
                message: error.response?.data?.detail || t('Failed to execute transfer'),
                color: 'red'
            });
        } finally {
            setSubmitting(false);
        }
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
            {/* Header */}
            <Paper p="md" radius={0} shadow="xs" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <Group>
                    <ActionIcon variant="subtle" onClick={() => navigate('/mobile/transfers')}>
                        <IconArrowLeft size={24} />
                    </ActionIcon>
                    <Stack gap={0} style={{ flex: 1 }}>
                        <Text fw={700} size="lg">{request.reference}</Text>
                        <Badge size="sm" color={request.status === 'Approved' ? 'blue' : 'gray'}>
                            {request.status}
                        </Badge>
                    </Stack>
                </Group>
            </Paper>

            {/* Content */}
            <Stack p="md" gap="md">
                {/* Info Card */}
                <Paper p="md" radius="md" withBorder>
                    <Group align="start" gap="xs">
                        <IconMapPin size={20} color="gray" />
                        <Stack gap={2}>
                            <Text size="xs" c="dimmed">{t('From')}</Text>
                            <Text fw={500}>{request.source_name}</Text>
                        </Stack>
                    </Group>
                    <Divider my="xs" />
                    <Group align="start" gap="xs">
                        <IconTruckDelivery size={20} color="gray" />
                        <Stack gap={2}>
                            <Text size="xs" c="dimmed">{t('To')}</Text>
                            <Text fw={500}>{request.destination_name}</Text>
                        </Stack>
                    </Group>
                </Paper>

                <Title order={5} mt="sm">{t('Items')}</Title>

                <Stack gap="sm">
                    {request.items.map((item, index) => (
                        <Paper
                            key={`${item.part}-${index}`}
                            p="md"
                            radius="md"
                            withBorder
                            style={item.checked ? { borderColor: 'var(--mantine-color-green-filled)', background: '#f0fff4' } : {}}
                            onClick={() => handleToggleItem(index)}
                        >
                            <Group justify="space-between" align="start">
                                <Stack gap={2} style={{ flex: 1 }}>
                                    <Text fw={600} lineClamp={2}>{item.part_detail?.name || 'Unknown Part'}</Text>
                                    <Text size="sm" c="dimmed">IPN: {item.part_detail?.IPN}</Text>
                                    {item.batch_code && (
                                        <Badge size="sm" variant="outline" color="gray" mt={4}>
                                            Batch: {item.batch_code}
                                        </Badge>
                                    )}
                                </Stack>
                                <Checkbox
                                    checked={!!item.checked}
                                    onChange={() => handleToggleItem(index)}
                                    size="lg"
                                />
                            </Group>
                            <Divider my="sm" />
                            <Group justify="space-between">
                                <Text size="sm">{t('Requested')}: {item.quantity}</Text>
                                <Text size="sm" fw={700} c={item.checked ? 'green' : 'dimmed'}>
                                    {item.checked ? item.quantity : 0} {t('Verified')}
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
                        onClick={handleExecuteTransfer}
                        disabled={!request.items.some(i => i.checked)}
                    >
                        {t('Complete')}
                    </Button>
                </Group>
            </Paper>

            {/* Scan Modal */}
            <Modal opened={opened} onClose={close} title={t('Scan Item')} centered>
                <Stack>
                    <Text size="sm" c="dimmed">Enter IPN or Batch Code manually (or scan)</Text>
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
