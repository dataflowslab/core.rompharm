import { useEffect, useMemo, useState } from 'react';
import { Paper, Table, Text, ActionIcon, Group, Button, Modal, NumberInput, TextInput, Stack } from '@mantine/core';
import { IconTrash, IconEdit, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { SalesOrder } from '../../../services/sales';
import { salesService } from '../../../services/sales';
import { notifications } from '@mantine/notifications';
import { ApiSelect } from '../../Common/ApiSelect';
import api from '../../../services/api';

interface SalesAllocationTabProps {
    order: SalesOrder;
    allocations: any[];
    items: any[];
    onAllocationUpdate: () => void;
    prefillItemId?: string | null;
    openExternalModal?: boolean;
    onExternalModalHandled?: () => void;
}

export function SalesAllocationTab({ order, allocations, items, onAllocationUpdate, prefillItemId, openExternalModal, onExternalModalHandled }: SalesAllocationTabProps) {
    const { t } = useTranslation();
    const [modalOpened, setModalOpened] = useState(false);
    const [editing, setEditing] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        order_item_id: '',
        part_id: '',
        source_location_id: '',
        batch_code: '',
        quantity: 0,
        shipment_id: ''
    });
    const [batches, setBatches] = useState<any[]>([]);
    const [batchQty, setBatchQty] = useState<Record<string, number>>({});

    const remainingByItem = useMemo(() => {
        const map: Record<string, number> = {};
        items.forEach((it) => {
            const allocated = allocations
                .filter((a: any) => a.order_item_id === it._id)
                .reduce((sum: number, a: any) => sum + Number(a.quantity || 0), 0);
            map[it._id] = Number(it.quantity || 0) - allocated;
        });
        return map;
    }, [items, allocations]);

    useEffect(() => {
        if (openExternalModal) {
            if (prefillItemId) {
                setForm((f) => ({ ...f, order_item_id: prefillItemId, part_id: findPartId(prefillItemId) || '' }));
                loadBatches(findPartId(prefillItemId));
            }
            setModalOpened(true);
            onExternalModalHandled?.();
        }
    }, [openExternalModal, prefillItemId]);

    const findPartId = (itemId?: string | null) => {
        const it = items.find((i) => i._id === itemId);
        return it?.part_detail?._id || (it as any)?.part_id || it?.part;
    };

    const loadBatches = async (partId?: string | null) => {
        if (!partId) {
            setBatches([]);
            return;
        }
        try {
            const res = await api.get(`/modules/requests/api/parts/${partId}/batch-codes`);
            const list = res.data?.batch_codes || res.data?.results || [];
            setBatches(list);
            // reset qty defaults
            const defaults: Record<string, number> = {};
            list.forEach((b: any) => defaults[b.batch_code + '__' + b.location_id] = 0);
            setBatchQty(defaults);
        } catch (err) {
            console.error(err);
            setBatches([]);
        }
    };

    const openNew = () => {
        setEditing(null);
        setForm({
            order_item_id: '',
            part_id: '',
            source_location_id: '',
            batch_code: '',
            quantity: 0,
            shipment_id: ''
        });
        setBatches([]);
        setModalOpened(true);
    };

    const handleEdit = (allocation: any) => {
        setEditing(allocation);
        setForm({
            order_item_id: allocation.order_item_id || '',
            part_id: allocation.part_id || '',
            source_location_id: allocation.source_location_id || '',
            batch_code: allocation.batch_code || '',
            quantity: allocation.quantity || 0,
            shipment_id: allocation.shipment_id || ''
        });
        setBatches([]);
        setModalOpened(true);
    };

    const handleDelete = (allocation: any) => {
        if (!confirm(t('Are you sure you want to remove this allocation?'))) return;
        salesService.deleteAllocation(order._id, allocation._id)
            .then(() => {
                notifications.show({ title: t('Success'), message: t('Allocation removed'), color: 'green' });
                onAllocationUpdate();
            })
            .catch((err) => {
                console.error(err);
                notifications.show({ title: t('Error'), message: err.response?.data?.detail || t('Failed to delete allocation'), color: 'red' });
            });
    };

    const submit = async () => {
        // legacy single-field submit kept for edit; new flow uses table buttons
        if (!form.part_id || form.quantity <= 0) {
            notifications.show({ title: t('Error'), message: t('Fill required fields'), color: 'red' });
            return;
        }
        setSubmitting(true);
        try {
            if (editing) {
                await salesService.updateAllocation(order._id, editing._id, form);
            } else {
                await salesService.createAllocation(order._id, form);
            }
            notifications.show({ title: t('Success'), message: editing ? t('Allocation updated') : t('Allocation created'), color: 'green' });
            setModalOpened(false);
            onAllocationUpdate();
        } catch (err: any) {
            console.error(err);
            notifications.show({ title: t('Error'), message: err.response?.data?.detail || t('Save failed'), color: 'red' });
        } finally {
            setSubmitting(false);
        }
    };

    const allocateBatch = async (row: any, qty: number) => {
        if (!form.order_item_id) {
            notifications.show({ title: t('Error'), message: t('Select item first'), color: 'red' });
            return;
        }
        const remaining = remainingByItem[form.order_item_id] || 0;
        if (qty <= 0) {
            notifications.show({ title: t('Error'), message: t('Quantity must be greater than zero'), color: 'red' });
            return;
        }
        if (qty > remaining) {
            notifications.show({ title: t('Error'), message: t('Quantity exceeds remaining'), color: 'red' });
            return;
        }
        setSubmitting(true);
        try {
            await salesService.createAllocation(order._id, {
                order_item_id: form.order_item_id,
                part_id: form.part_id,
                source_location_id: row.location_id,
                batch_code: row.batch_code,
                quantity: qty
            });
            notifications.show({ title: t('Success'), message: t('Allocation created'), color: 'green' });
            onAllocationUpdate();
            setBatchQty((prev) => ({ ...prev, [row.batch_code + '__' + row.location_id]: 0 }));
        } catch (err: any) {
            console.error(err);
            notifications.show({ title: t('Error'), message: err.response?.data?.detail || t('Save failed'), color: 'red' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Paper shadow="sm" p="md">
            <Group justify="flex-end" mb="md">
                <Button variant="light" leftSection={<IconPlus size={16} />} onClick={openNew}>
                    {t('New Allocation')}
                </Button>
            </Group>
            <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>{t('Part')}</Table.Th>
                        <Table.Th>{t('Source')}</Table.Th>
                        <Table.Th>{t('Batch Code')}</Table.Th>
                        <Table.Th>{t('Allocated Quantity')}</Table.Th>
                        <Table.Th>{t('Actions')}</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {allocations.length === 0 ? (
                        <Table.Tr>
                            <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                                <Text c="dimmed">{t('No allocations')}</Text>
                            </Table.Td>
                        </Table.Tr>
                    ) : (
                        allocations.map((allocation) => (
                            <Table.Tr key={allocation._id}>
                                <Table.Td>
                                    <Text size="sm" fw={500}>
                                        {allocation.part_detail?.name || allocation.part_id}
                                    </Text>
                                </Table.Td>
                                <Table.Td>{allocation.source_location_detail?.name || allocation.source_location_id || '-'}</Table.Td>
                                <Table.Td>
                                    {allocation.batch_code ? (
                                        <Text size="sm" ff="monospace">
                                            {allocation.batch_code}
                                        </Text>
                                    ) : (
                                        '-'
                                    )}
                                </Table.Td>
                                <Table.Td>{allocation.quantity || 0}</Table.Td>
                                <Table.Td>
                                    <Group gap="xs">
                                        <ActionIcon variant="subtle" color="blue" onClick={() => handleEdit(allocation)}>
                                            <IconEdit size={16} />
                                        </ActionIcon>
                                        <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(allocation)}>
                                            <IconTrash size={16} />
                                        </ActionIcon>
                                    </Group>
                                </Table.Td>
                            </Table.Tr>
                        ))
                    )}
                </Table.Tbody>
            </Table>

            <Modal opened={modalOpened} onClose={() => setModalOpened(false)} title={editing ? t('Edit Allocation') : t('New Allocation')} centered size="lg">
                <Stack gap="md">
                    <ApiSelect
                        label={t('Item')}
                        endpoint={`/api/sales/sales-orders/${order._id}/items`}
                        value={form.order_item_id}
                        onChange={(val, item) => {
                            const partId = item?.part_id || item?.part || item?.part_detail?._id;
                            setForm({
                                ...form,
                                order_item_id: val || '',
                                part_id: partId || ''
                            });
                            loadBatches(partId);
                        }}
                        valueField="_id"
                        labelFormat={(it) => `${it.part_detail?.name || it.part_id} (${it.part_detail?.IPN || ''})`}
                        dataPath="results"
                        searchable
                        required
                    />
                    {form.order_item_id && (
                        <>
                            <Text size="sm" fw={500}>{t('Available batches')}</Text>
                            <Table withTableBorder>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>{t('Batch')}</Table.Th>
                                        <Table.Th>{t('Location')}</Table.Th>
                                        <Table.Th>{t('Available')}</Table.Th>
                                        <Table.Th>{t('Qty to allocate')}</Table.Th>
                                        <Table.Th></Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {batches.length === 0 ? (
                                        <Table.Tr><Table.Td colSpan={5}>{t('No batches found')}</Table.Td></Table.Tr>
                                    ) : batches.map((row) => {
                                        const key = row.batch_code + '__' + row.location_id;
                                        const max = Math.min(Number(row.quantity || 0), remainingByItem[form.order_item_id] || 0);
                                        return (
                                            <Table.Tr key={key}>
                                                <Table.Td>{row.batch_code}</Table.Td>
                                                <Table.Td>{row.location_name}</Table.Td>
                                                <Table.Td>{row.quantity}</Table.Td>
                                                <Table.Td>
                                                    <NumberInput
                                                        value={batchQty[key] ?? 0}
                                                        min={0}
                                                        max={max}
                                                        step={0.01}
                                                        onChange={(v) => setBatchQty({ ...batchQty, [key]: Number(v) || 0 })}
                                                    />
                                                </Table.Td>
                                                <Table.Td>
                                                    <Button size="xs" onClick={() => allocateBatch(row, batchQty[key] ?? max)} disabled={max <= 0}>
                                                        {t('Allocate')}
                                                    </Button>
                                                </Table.Td>
                                            </Table.Tr>
                                        );
                                    })}
                                </Table.Tbody>
                            </Table>
                            <Group justify="flex-end">
                                <Text size="xs" c="dimmed">
                                    {t('Remaining to allocate')}: {remainingByItem[form.order_item_id] ?? 0}
                                </Text>
                                <Button variant="default" onClick={() => setModalOpened(false)}>{t('Close')}</Button>
                            </Group>
                        </>
                    )}
                </Stack>
            </Modal>
        </Paper>
    );
}
