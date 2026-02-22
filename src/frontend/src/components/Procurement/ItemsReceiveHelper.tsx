import { Table, Text, Button, Badge } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { PurchaseOrderItem } from '../../types/procurement';

interface ItemsReceiveHelperProps {
    items: PurchaseOrderItem[];
    onReceiveClick: (itemId: string) => void;
    canModify: boolean;
}

export function ItemsReceiveHelper({ items, onReceiveClick, canModify }: ItemsReceiveHelperProps) {
    const { t } = useTranslation();

    return (
        <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>{t('Part')}</Table.Th>
                    <Table.Th>{t('Quantity')}</Table.Th>
                    <Table.Th>{t('UM')}</Table.Th>
                    <Table.Th>{t('Reference')}</Table.Th>
                    <Table.Th style={{ width: '120px' }}>{t('Actions')}</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {items.map((item) => {
                    const received = item.received || 0;
                    const total = item.quantity;
                    const isFullyReceived = received >= total;
                    const um = item.part_detail?.manufacturer_um || item.part_detail?.um || '-';
                    const ipn = item.part_detail?.ipn || item.part_detail?.IPN || '-';

                    return (
                        <Table.Tr key={item._id}>
                            <Table.Td>
                                <Text size="sm" fw={500}>
                                    {item.part_detail?.name || `Part ${item.part_id}`}
                                </Text>
                            </Table.Td>
                            <Table.Td>
                                <Text size="sm">
                                    {received.toFixed(2)} / {total.toFixed(2)}
                                    {isFullyReceived && (
                                        <Badge color="green" size="sm" ml="xs">
                                            {t('Complete')}
                                        </Badge>
                                    )}
                                    {!isFullyReceived && received > 0 && (
                                        <Badge color="yellow" size="sm" ml="xs">
                                            {t('Partial')}
                                        </Badge>
                                    )}
                                    {received === 0 && (
                                        <Badge color="gray" size="sm" ml="xs">
                                            {t('Pending')}
                                        </Badge>
                                    )}
                                </Text>
                            </Table.Td>
                            <Table.Td>
                                <Text size="sm">{um}</Text>
                            </Table.Td>
                            <Table.Td>
                                <Text size="sm">{ipn}</Text>
                            </Table.Td>
                            <Table.Td>
                                {canModify && !isFullyReceived && (
                                    <Button
                                        size="xs"
                                        variant="light"
                                        leftSection={<IconPlus size={14} />}
                                        onClick={() => onReceiveClick(item._id)}
                                    >
                                        {t('Receive')}
                                    </Button>
                                )}
                                {isFullyReceived && (
                                    <Text size="xs" c="dimmed">
                                        {t('Fully received')}
                                    </Text>
                                )}
                            </Table.Td>
                        </Table.Tr>
                    );
                })}
            </Table.Tbody>
        </Table>
    );
}
