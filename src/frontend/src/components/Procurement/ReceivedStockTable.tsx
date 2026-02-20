import { Table, Text, Badge, ActionIcon, Checkbox } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ReceivedItem } from '../../types/procurement';

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

    return (
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
                    {canModifyStock && <Table.Th style={{ width: '60px' }}>{t('Actions')}</Table.Th>}
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
                        {canModifyStock && (
                            <Table.Td>
                                <ActionIcon
                                    color="red"
                                    variant="subtle"
                                    onClick={() => onDeleteStock(item)}
                                    title={t('Delete')}
                                >
                                    <IconTrash size={16} />
                                </ActionIcon>
                            </Table.Td>
                        )}
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
    );
}
