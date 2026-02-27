import React from 'react';
import { Paper, Table, Text, ActionIcon, Group, Button, Collapse, Badge, Box, Modal, Stack, TextInput, NumberInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconEdit, IconTruck, IconChevronDown, IconChevronRight, IconLink, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { SalesOrder, Shipment } from '../../../services/sales';
import { salesService } from '../../../services/sales';
import { notifications } from '@mantine/notifications';
import { ApiSelect } from '../../Common/ApiSelect';

interface SalesDeliveryTabProps {
    order: SalesOrder;
    shipments: Shipment[];
    items: any[];
    allocations: any[];
    onShipmentUpdate: () => void;
}

export function SalesDeliveryTab({ order, shipments, items, allocations, onShipmentUpdate }: SalesDeliveryTabProps) {
    const { t } = useTranslation();
    const [expandedRows, setExpandedRows] = useState<string[]>([]);
    const [modalOpened, setModalOpened] = useState(false);
    const [allocModalOpened, setAllocModalOpened] = useState(false);
    const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
    const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [shipmentForm, setShipmentForm] = useState({
        reference: '',
        carrier: '',
        uit: '',
        tracking_number: '',
        shipment_date: '',
        delivery_date: '',
        notes: ''
    });
    const [allocForm, setAllocForm] = useState({
        order_item_id: '',
        quantity: 0,
        batch_code: '',
        source_location_id: ''
    });

    const toggleRow = (id: string) => {
        setExpandedRows((prev) =>
            prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
        );
    };

    const openNewShipment = () => {
        setEditingShipment(null);
        setShipmentForm({
            reference: '',
            carrier: '',
            uit: '',
            tracking_number: '',
            shipment_date: '',
            delivery_date: '',
            notes: ''
        });
        setModalOpened(true);
    };

    const handleEdit = (shipment: Shipment) => {
        setEditingShipment(shipment);
        setShipmentForm({
            reference: shipment.reference || '',
            carrier: (shipment as any).carrier || '',
            uit: (shipment as any).uit || '',
            tracking_number: shipment.tracking_number || '',
            shipment_date: shipment.shipment_date || '',
            delivery_date: (shipment as any).delivery_date || '',
            notes: shipment.notes || ''
        });
        setModalOpened(true);
    };

    const handleDelete = (shipment: Shipment) => {
        if (!confirm(t('Delete this delivery?'))) return;
        salesService.deleteShipment(order._id, shipment._id)
            .then(() => {
                notifications.show({ title: t('Success'), message: t('Delivery deleted'), color: 'green' });
                onShipmentUpdate();
            })
            .catch(err => {
                console.error(err);
                notifications.show({ title: t('Error'), message: err.response?.data?.detail || t('Failed to delete'), color: 'red' });
            });
    };

    const saveShipment = async () => {
        setSubmitting(true);
        try {
            if (editingShipment) {
                await salesService.updateShipment(order._id, editingShipment._id, shipmentForm);
            } else {
                await salesService.createShipment(order._id, shipmentForm);
            }
            notifications.show({ title: t('Success'), message: editingShipment ? t('Delivery updated') : t('Delivery created'), color: 'green' });
            setModalOpened(false);
            onShipmentUpdate();
        } catch (err: any) {
            console.error(err);
            notifications.show({ title: t('Error'), message: err.response?.data?.detail || t('Save failed'), color: 'red' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleAllocateToTransport = (shipment: Shipment) => {
        setSelectedShipment(shipment);
        setAllocForm({
            order_item_id: '',
            quantity: 0,
            batch_code: '',
            source_location_id: ''
        });
        setAllocModalOpened(true);
    };

    const remainingForItem = (itemId: string) => {
        const item = items.find((it) => it._id === itemId);
        if (!item) return 0;
        const allocated = allocations
            .filter((a: any) => a.order_item_id === itemId)
            .reduce((sum: number, a: any) => sum + Number(a.quantity || 0), 0);
        return Number(item.quantity || 0) - allocated;
    };

    const submitAllocation = async () => {
        if (!selectedShipment?._id) return;
        if (!allocForm.order_item_id || allocForm.quantity <= 0) {
            notifications.show({ title: t('Error'), message: t('Select item and quantity'), color: 'red' });
            return;
        }
        const remaining = remainingForItem(allocForm.order_item_id);
        if (allocForm.quantity > remaining + 1e-6) {
            notifications.show({ title: t('Error'), message: t('Quantity exceeds remaining'), color: 'red' });
            return;
        }
        setSubmitting(true);
        try {
            const item = items.find((it) => it._id === allocForm.order_item_id);
            await salesService.createAllocation(order._id, {
                order_item_id: allocForm.order_item_id,
                part_id: item?.part_detail?._id || item?.part_id || item?.part,
                source_location_id: allocForm.source_location_id || undefined,
                batch_code: allocForm.batch_code || undefined,
                quantity: allocForm.quantity,
                shipment_id: selectedShipment._id,
            });
            notifications.show({ title: t('Success'), message: t('Allocation added'), color: 'green' });
            setAllocModalOpened(false);
            onShipmentUpdate();
        } catch (err: any) {
            console.error(err);
            notifications.show({ title: t('Error'), message: err.response?.data?.detail || t('Failed to allocate'), color: 'red' });
        } finally {
            setSubmitting(false);
        }
    };

    const allocateAllRemaining = async (shipment: Shipment) => {
        const payloads = items.map((it) => {
            const remaining = remainingForItem(it._id);
            if (remaining > 0) {
                return salesService.createAllocation(order._id, {
                    order_item_id: it._id,
                    part_id: it.part_detail?._id || it.part_id || it.part,
                    quantity: remaining,
                    shipment_id: shipment._id,
                });
            }
            return null;
        }).filter(Boolean) as Promise<any>[];

        if (payloads.length === 0) {
            notifications.show({ title: t('Info'), message: t('No remaining quantities to allocate'), color: 'blue' });
            return;
        }
        try {
            await Promise.all(payloads);
            notifications.show({ title: t('Success'), message: t('All remaining items allocated'), color: 'green' });
            onShipmentUpdate();
        } catch (err: any) {
            console.error(err);
            notifications.show({ title: t('Error'), message: err.response?.data?.detail || t('Allocation failed'), color: 'red' });
        }
    };

    return (
        <Paper shadow="sm" p="md">
            <Group justify="flex-end" mb="md">
                <Button variant="light" leftSection={<IconTruck size={16} />} onClick={openNewShipment}>
                    {t('New Delivery')}
                </Button>
            </Group>

            <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th w={40}></Table.Th>
                        <Table.Th>{t('Reference')}</Table.Th>
                        <Table.Th>{t('Carrier')}</Table.Th>
                        <Table.Th>{t('UIT')}</Table.Th>
                        <Table.Th>{t('AWB')}</Table.Th>
                        <Table.Th>{t('Date')}</Table.Th>
                        <Table.Th>{t('Items Allocated')}</Table.Th>
                        <Table.Th>{t('Status')}</Table.Th>
                        <Table.Th>{t('Actions')}</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {shipments.length === 0 ? (
                        <Table.Tr>
                            <Table.Td colSpan={9} style={{ textAlign: 'center' }}>
                                <Text c="dimmed">{t('No deliveries/shipments found')}</Text>
                            </Table.Td>
                        </Table.Tr>
                    ) : (
                        shipments.map((shipment) => {
                            const isExpanded = expandedRows.includes(shipment._id);

                            // Mock items for tree table
                            const attachedItems: any[] = (shipment as any).items || [];

                            return (
                                <React.Fragment key={shipment._id}>
                                    <Table.Tr>
                                        <Table.Td>
                                            <ActionIcon
                                                variant="subtle"
                                                onClick={() => toggleRow(shipment._id)}
                                            >
                                                {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                                            </ActionIcon>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text fw={500}>{shipment.reference || '-'}</Text>
                                        </Table.Td>
                                        <Table.Td>{(shipment as any).carrier || '-'}</Table.Td>
                                        <Table.Td>{(shipment as any).uit || '-'}</Table.Td>
                                        <Table.Td>{shipment.tracking_number || '-'}</Table.Td>
                                        <Table.Td>{shipment.shipment_date || '-'}</Table.Td>
                                        <Table.Td>
                                            <Badge variant="light" color="blue">
                                                {attachedItems.length}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge color="gray">{t('Pending')}</Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap="xs">
                                                <ActionIcon variant="subtle" color="teal" onClick={() => handleAllocateToTransport(shipment)} title={t('Allocate Items')}>
                                                    <IconLink size={16} />
                                                </ActionIcon>
                                                <ActionIcon variant="subtle" color="blue" onClick={() => handleEdit(shipment)}>
                                                    <IconEdit size={16} />
                                                </ActionIcon>
                                                <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(shipment)}>
                                                    <IconTrash size={16} />
                                                </ActionIcon>
                                            </Group>
                                        </Table.Td>
                                    </Table.Tr>

                                    {/* Sub-rows for Tree Table */}
                                    {isExpanded && (
                                        <Table.Tr>
                                            <Table.Td colSpan={9} p={0}>
                                                <Collapse in={isExpanded}>
                                                    <Box p="md" bg="var(--mantine-color-gray-0)">
                                                        {attachedItems.length === 0 ? (
                                                            <Text size="sm" c="dimmed" fs="italic">
                                                                {t('No items allocated to this transport yet.')}
                                                            </Text>
                                                        ) : (
                                                            <Table size="sm" withTableBorder>
                                                                <Table.Thead>
                                                                    <Table.Tr>
                                                                        <Table.Th>{t('Part')}</Table.Th>
                                                                        <Table.Th>{t('Batch')}</Table.Th>
                                                                        <Table.Th>{t('Quantity')}</Table.Th>
                                                                    </Table.Tr>
                                                                </Table.Thead>
                                                                <Table.Tbody>
                                                                    {attachedItems.map((item: any, i: number) => (
                                                                        <Table.Tr key={i}>
                                                                            <Table.Td>{item.part_name || '-'}</Table.Td>
                                                                            <Table.Td ff="monospace">{item.batch_code || '-'}</Table.Td>
                                                                            <Table.Td>{item.quantity}</Table.Td>
                                                                   </Table.Tr>
                                                                ))}
                                                            </Table.Tbody>
                                                            </Table>
                                                        )}
                                                        <Group mt="md" justify="flex-end">
                                                            <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={() => handleAllocateToTransport(shipment)}>
                                                                {t('Allocate item')}
                                                            </Button>
                                                            <Button variant="filled" size="xs" onClick={() => allocateAllRemaining(shipment)}>
                                                                {t('Allocate all items')}
                                                            </Button>
                                                        </Group>
                                                    </Box>
                                                </Collapse>
                                            </Table.Td>
                                        </Table.Tr>
                                    )}
                                </React.Fragment>
                            );
                        })
                    )}
            </Table.Tbody>
            </Table>

            {/* New/Edit Delivery Modal */}
            <Modal opened={modalOpened} onClose={() => setModalOpened(false)} title={editingShipment ? t('Edit Delivery') : t('New Delivery')} centered size="lg">
                <Stack gap="md">
                    <Group grow>
                        <TextInput label={t('Reference')} value={shipmentForm.reference} onChange={(e) => setShipmentForm({ ...shipmentForm, reference: e.target.value })} />
                        <TextInput label="UIT" value={shipmentForm.uit} onChange={(e) => setShipmentForm({ ...shipmentForm, uit: e.target.value })} />
                    </Group>
                    <Group grow>
                        <TextInput label={t('Carrier')} value={shipmentForm.carrier} onChange={(e) => setShipmentForm({ ...shipmentForm, carrier: e.target.value })} />
                        <TextInput label="AWB" value={shipmentForm.tracking_number} onChange={(e) => setShipmentForm({ ...shipmentForm, tracking_number: e.target.value })} />
                    </Group>
                    <Group grow>
                        <DateInput
                            label={t('Shipment Date')}
                            value={shipmentForm.shipment_date ? new Date(shipmentForm.shipment_date) : null}
                            onChange={(d) => setShipmentForm({ ...shipmentForm, shipment_date: d ? d.toISOString().split('T')[0] : '' })}
                            placeholder="YYYY-MM-DD"
                        />
                        <DateInput
                            label={t('Delivery Date')}
                            value={shipmentForm.delivery_date ? new Date(shipmentForm.delivery_date) : null}
                            onChange={(d) => setShipmentForm({ ...shipmentForm, delivery_date: d ? d.toISOString().split('T')[0] : '' })}
                            placeholder="YYYY-MM-DD"
                        />
                    </Group>
                    <TextInput label={t('Notes')} value={shipmentForm.notes} onChange={(e) => setShipmentForm({ ...shipmentForm, notes: e.target.value })} />
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setModalOpened(false)}>{t('Cancel')}</Button>
                        <Button onClick={saveShipment} loading={submitting}>{t('Save')}</Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Allocation Modal */}
            <Modal opened={allocModalOpened} onClose={() => setAllocModalOpened(false)} title={t('Allocate Item to Delivery')} centered size="lg">
                <Stack gap="md">
                    <ApiSelect
                        label={t('Item')}
                        endpoint={`/api/sales/sales-orders/${order._id}/items`}
                        value={allocForm.order_item_id}
                        onChange={(val) => setAllocForm({ ...allocForm, order_item_id: val || '', quantity: 0 })}
                        valueField="_id"
                        labelFormat={(it) => `${it.part_detail?.name || it.part_id} (${it.quantity || 0} ${t('ordered')})`}
                        dataPath="results"
                        searchable
                        required
                    />
                    <NumberInput
                        label={t('Quantity')}
                        value={allocForm.quantity}
                        onChange={(v) => setAllocForm({ ...allocForm, quantity: Number(v) || 0 })}
                        min={0.01}
                        step={0.01}
                        required
                        description={
                            allocForm.order_item_id
                                ? `${t('Remaining')}: ${remainingForItem(allocForm.order_item_id)}`
                                : undefined
                        }
                    />
                    <TextInput
                        label={t('Batch Code')}
                        value={allocForm.batch_code}
                        onChange={(e) => setAllocForm({ ...allocForm, batch_code: e.target.value })}
                    />
                    <ApiSelect
                        label={t('Source Location')}
                        endpoint="/modules/inventory/api/locations"
                        value={allocForm.source_location_id}
                        onChange={(val) => setAllocForm({ ...allocForm, source_location_id: val || '' })}
                        valueField="_id"
                        labelField="name"
                        searchable
                        clearable
                    />
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setAllocModalOpened(false)}>{t('Cancel')}</Button>
                        <Button onClick={submitAllocation} loading={submitting}>{t('Save')}</Button>
                    </Group>
                </Stack>
            </Modal>
        </Paper>
    );
}
