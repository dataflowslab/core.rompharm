import { Table, Text, Badge, ActionIcon, Checkbox, Modal, Stack, Group, Tooltip, Grid, Divider } from '@mantine/core';
import { IconTrash, IconEye, IconExternalLink, IconAlertTriangle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ReceivedItem } from '../../types/procurement';
import { useState } from 'react';

interface ReceivedStockTableProps {
    items: ReceivedItem[];
    canModifyStock: boolean;
    onDeleteStock: (item: ReceivedItem) => void;
    getStatusLabel: (statusValue: number) => string;
    selectedItems: string[];
    onSelectionChange: (ids: string[]) => void;
}

export function ReceivedStockTable({ items, canModifyStock, onDeleteStock, getStatusLabel, selectedItems, onSelectionChange }: ReceivedStockTableProps) {
    const { t } = useTranslation();
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ReceivedItem | null>(null);

    const toggleAll = () => {
        if (selectedItems.length === items.length) {
            onSelectionChange([]);
        } else {
            onSelectionChange(items.map(i => i._id));
        }
    };

    const toggleItem = (id: string) => {
        if (selectedItems.includes(id)) {
            onSelectionChange(selectedItems.filter(i => i !== id));
        } else {
            onSelectionChange([...selectedItems, id]);
        }
    };

    const openDetailsModal = (item: ReceivedItem) => {
        setSelectedItem(item);
        setDetailsModalOpen(true);
    };

    const openStockEntry = (stockId: string) => {
        window.open(`/web/inventory/stocks/${stockId}`, '_blank');
    };

    const formatDate = (date: any) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString();
    };

    const renderContainerInfo = (item: ReceivedItem) => {
        const containers = item.containers || [];
        if (containers.length === 0) return '-';

        const hasIssues = containers.some((c: any) => c.damaged || c.unsealed || c.mislabeled);

        return (
            <Group gap="xs">
                <Text>{containers.length}</Text>
                {hasIssues && (
                    <Tooltip
                        label={
                            <Stack gap="xs">
                                {containers.map((c: any, idx: number) => {
                                    const issues = [];
                                    if (c.damaged) issues.push('Damaged');
                                    if (c.unsealed) issues.push('Unsealed');
                                    if (c.mislabeled) issues.push('Mislabeled');
                                    if (issues.length === 0) return null;
                                    return (
                                        <Text key={idx} size="xs">
                                            Container {idx + 1}: {c.quantity} - {issues.join(', ')}
                                        </Text>
                                    );
                                })}
                            </Stack>
                        }
                        multiline
                        w={250}
                    >
                        <IconAlertTriangle size={16} color="orange" style={{ cursor: 'pointer' }} />
                    </Tooltip>
                )}
            </Group>
        );
    };

    return (
        <>
        <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th style={{ width: 40 }}>
                        <Checkbox
                            checked={items.length > 0 && selectedItems.length === items.length}
                            indeterminate={selectedItems.length > 0 && selectedItems.length !== items.length}
                            onChange={toggleAll}
                        />
                    </Table.Th>
                    <Table.Th>{t('Part')}</Table.Th>
                    <Table.Th>
                        {t('Quantity')}
                        {items[0]?.system_um_detail && (
                            <Text span size="xs" c="dimmed"> ({items[0].system_um_detail.abrev})</Text>
                        )}
                    </Table.Th>
                    <Table.Th>{t('Location')}</Table.Th>
                    <Table.Th>{t('Batch')}</Table.Th>
                    <Table.Th>{t('Status')}</Table.Th>
                    <Table.Th>{t('Container')}</Table.Th>
                    <Table.Th style={{ width: '140px' }}>{t('Actions')}</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {items.map((item) => (
                    <Table.Tr key={item._id}>
                        <Table.Td>
                            <Checkbox
                                checked={selectedItems.includes(item._id)}
                                onChange={() => toggleItem(item._id)}
                            />
                        </Table.Td>
                        <Table.Td>
                            {item.part_detail?.name || item.part}
                            {item.part_detail?.IPN && ` (${item.part_detail.IPN})`}
                        </Table.Td>
                        <Table.Td>
                            {item.quantity_system_um !== undefined ? (
                                <>
                                    <Text fw={500}>{item.quantity_system_um.toFixed(2)}</Text>
                                    {item.quantity_received !== item.quantity_system_um && (
                                        <Text size="xs" c="dimmed">
                                            ({item.quantity_received} {item.manufacturer_um_detail?.abrev || ''} × {item.conversion_modifier})
                                        </Text>
                                    )}
                                </>
                            ) : (
                                item.quantity
                            )}
                        </Table.Td>
                        <Table.Td>{item.location_detail?.name || item.location}</Table.Td>
                        <Table.Td>{item.batch_code || item.batch || '-'}</Table.Td>
                        <Table.Td>
                            {item.status_detail ? (
                                <Badge
                                    style={{
                                        backgroundColor: item.status_detail.color || '#gray',
                                        color: '#fff',
                                    }}
                                >
                                    {item.status_detail.name}
                                </Badge>
                            ) : (
                                <Badge color="gray">{getStatusLabel(item.status)}</Badge>
                            )}
                        </Table.Td>
                        <Table.Td>{renderContainerInfo(item)}</Table.Td>
                        <Table.Td>
                            <Group gap={4} wrap="nowrap">
                                <ActionIcon
                                    color="blue"
                                    variant="subtle"
                                    onClick={() => openDetailsModal(item)}
                                    title={t('View Details')}
                                    size="sm"
                                >
                                    <IconEye size={16} />
                                </ActionIcon>
                                <ActionIcon
                                    color="blue"
                                    variant="subtle"
                                    onClick={() => openStockEntry(item._id)}
                                    title={t('Manage')}
                                    size="sm"
                                >
                                    <IconExternalLink size={16} />
                                </ActionIcon>
                                {canModifyStock && (
                                    <ActionIcon
                                        color="red"
                                        variant="subtle"
                                        onClick={() => onDeleteStock(item)}
                                        title={t('Delete')}
                                        size="sm"
                                    >
                                        <IconTrash size={16} />
                                    </ActionIcon>
                                )}
                            </Group>
                        </Table.Td>
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>

        {/* Details Modal - Improved Layout */}
        <Modal
            opened={detailsModalOpen}
            onClose={() => setDetailsModalOpen(false)}
            title={t('Receive Stock Details')}
            size="xl"
        >
            {selectedItem && (
                <Stack gap="md">
                    {/* Basic Info - 2 columns */}
                    <Grid>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Part')}:</Text>
                                <Text>{selectedItem.part_detail?.name || selectedItem.part}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Quantity')}:</Text>
                                <Text>{selectedItem.quantity_system_um?.toFixed(2) || selectedItem.quantity}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Location')}:</Text>
                                <Text>{selectedItem.location_detail?.name || selectedItem.location}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Batch Code')}:</Text>
                                <Text>{selectedItem.batch_code || '-'}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Supplier Batch')}:</Text>
                                <Text>{selectedItem.supplier_batch_code || '-'}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Serial Numbers')}:</Text>
                                <Text>{selectedItem.serial_numbers || '-'}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Packaging')}:</Text>
                                <Text>{selectedItem.packaging || '-'}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Expected Quantity')}:</Text>
                                <Text>{selectedItem.expected_quantity || '-'}</Text>
                            </Group>
                        </Grid.Col>
                    </Grid>

                    <Divider />

                    {/* Dates - 2 columns */}
                    <Grid>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Manufacturing Date')}:</Text>
                                <Text>{formatDate(selectedItem.manufacturing_date)}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Expiry Date')}:</Text>
                                <Text>{formatDate(selectedItem.expiry_date)}</Text>
                            </Group>
                        </Grid.Col>
                    </Grid>

                    <Divider />

                    {/* Supplier BA Info - 2 columns */}
                    <Grid>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Supplier BA No')}:</Text>
                                <Text>{selectedItem.supplier_ba_no || '-'}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Supplier BA Date')}:</Text>
                                <Text>{formatDate(selectedItem.supplier_ba_date)}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Accord BA')}:</Text>
                                <Text>{selectedItem.accord_ba ? t('Yes') : t('No')}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('List Supplier')}:</Text>
                                <Text>{selectedItem.is_list_supplier ? t('Yes') : t('No')}</Text>
                            </Group>
                        </Grid.Col>
                    </Grid>

                    <Divider />

                    {/* Transport Conditions - 2 columns */}
                    <Grid>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Clean Transport')}:</Text>
                                <Text>{selectedItem.clean_transport ? t('Yes') : t('No')}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Temperature Control')}:</Text>
                                <Text>{selectedItem.temperature_control ? t('Yes') : t('No')}</Text>
                            </Group>
                        </Grid.Col>
                        {selectedItem.temperature_control && (
                            <Grid.Col span={6}>
                                <Group>
                                    <Text fw={500} w={140}>{t('Temp. Conditions Met')}:</Text>
                                    <Text>{selectedItem.temperature_conditions_met ? t('Yes') : t('No')}</Text>
                                </Group>
                            </Grid.Col>
                        )}
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Containers Cleaned')}:</Text>
                                <Text>{selectedItem.containers_cleaned ? t('Yes') : t('No')}</Text>
                            </Group>
                        </Grid.Col>
                    </Grid>

                    {/* Containers - Full width table */}
                    {selectedItem.containers && selectedItem.containers.length > 0 && (
                        <>
                            <Divider />
                            <Text fw={500} size="sm">{t('Containers')}:</Text>
                            <Table striped withTableBorder withColumnBorders>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>{t('No.')}</Table.Th>
                                        <Table.Th>{t('Quantity')}</Table.Th>
                                        <Table.Th>{t('Extra')}</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {selectedItem.containers.map((container: any, idx: number) => {
                                        const extras = [];
                                        if (container.damaged) extras.push('Damaged');
                                        if (container.unsealed) extras.push('Unsealed');
                                        if (container.mislabeled) extras.push('Mislabeled');
                                        return (
                                            <Table.Tr key={idx}>
                                                <Table.Td>{idx + 1}</Table.Td>
                                                <Table.Td>{container.quantity}</Table.Td>
                                                <Table.Td>
                                                    {extras.length > 0 ? (
                                                        <Group gap="xs">
                                                            {container.damaged && <Badge color="red" size="sm">Damaged</Badge>}
                                                            {container.unsealed && <Badge color="orange" size="sm">Unsealed</Badge>}
                                                            {container.mislabeled && <Badge color="yellow" size="sm">Mislabeled</Badge>}
                                                        </Group>
                                                    ) : '-'}
                                                </Table.Td>
                                            </Table.Tr>
                                        );
                                    })}
                                </Table.Tbody>
                            </Table>
                        </>
                    )}

                    <Divider />

                    {/* Additional Info - 2 columns */}
                    <Grid>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Received By')}:</Text>
                                <Text>{selectedItem.received_by || '-'}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Group>
                                <Text fw={500} w={140}>{t('Received Date')}:</Text>
                                <Text>{formatDate(selectedItem.received_date)}</Text>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={12}>
                            <Group align="flex-start">
                                <Text fw={500} w={140}>{t('Notes')}:</Text>
                                <Text style={{ flex: 1 }}>{selectedItem.notes || '-'}</Text>
                            </Group>
                        </Grid.Col>
                    </Grid>
                </Stack>
            )}
        </Modal>
        </>
    );
}
