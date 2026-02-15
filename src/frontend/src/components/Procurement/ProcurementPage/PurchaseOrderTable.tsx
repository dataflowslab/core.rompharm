import { Table, Group, Text, Progress, Badge } from '@mantine/core';
import { IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PurchaseOrder } from '../../../types/procurement';
import { formatDate } from '../../../utils/dateFormat';

interface PurchaseOrderTableProps {
    orders: PurchaseOrder[];
    loading: boolean;
    searchQuery: string;
    sortField: keyof PurchaseOrder | null;
    sortDirection: 'asc' | 'desc';
    onSort: (field: keyof PurchaseOrder) => void;
}

export function PurchaseOrderTable({
    orders,
    loading,
    searchQuery,
    sortField,
    sortDirection,
    onSort,
}: PurchaseOrderTableProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const getSortIcon = (field: keyof PurchaseOrder) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
    };

    return (
        <Table striped withTableBorder withColumnBorders highlightOnHover>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th style={{ cursor: 'pointer' }} onClick={() => onSort('reference')}>
                        <Group gap="xs">
                            {t('Reference')}
                            {getSortIcon('reference')}
                        </Group>
                    </Table.Th>
                    <Table.Th style={{ cursor: 'pointer' }} onClick={() => onSort('supplier_detail')}>
                        <Group gap="xs">
                            {t('Supplier')}
                            {getSortIcon('supplier_detail')}
                        </Group>
                    </Table.Th>
                    <Table.Th style={{ cursor: 'pointer' }} onClick={() => onSort('description')}>
                        <Group gap="xs">
                            {t('Description')}
                            {getSortIcon('description')}
                        </Group>
                    </Table.Th>
                    <Table.Th>{t('Line Items')}</Table.Th>
                    <Table.Th style={{ cursor: 'pointer' }} onClick={() => onSort('status_text')}>
                        <Group gap="xs">
                            {t('Status')}
                            {getSortIcon('status_text')}
                        </Group>
                    </Table.Th>
                    <Table.Th style={{ cursor: 'pointer' }} onClick={() => onSort('issue_date')}>
                        <Group gap="xs">
                            {t('Issue Date')}
                            {getSortIcon('issue_date')}
                        </Group>
                    </Table.Th>
                    <Table.Th style={{ cursor: 'pointer' }} onClick={() => onSort('target_date')}>
                        <Group gap="xs">
                            {t('Target Date')}
                            {getSortIcon('target_date')}
                        </Group>
                    </Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {loading ? (
                    <Table.Tr>
                        <Table.Td colSpan={7}>{t('Loading...')}</Table.Td>
                    </Table.Tr>
                ) : orders.length === 0 ? (
                    <Table.Tr>
                        <Table.Td colSpan={7}>{searchQuery ? t('No results found') : t('No data')}</Table.Td>
                    </Table.Tr>
                ) : (
                    orders.map((order) => {
                        const total = order.lines || 0;
                        const received = order.line_items || 0;
                        const percentage = total > 0 ? (received / total) * 100 : 0;

                        return (
                            <Table.Tr
                                key={order.pk || order._id}
                                style={{ cursor: 'pointer' }}
                                onClick={() => navigate(`/procurement/${order._id}`)}
                            >
                                <Table.Td>{order.reference}</Table.Td>
                                <Table.Td>{order.supplier_detail?.name || '-'}</Table.Td>
                                <Table.Td>{order.description || '-'}</Table.Td>
                                <Table.Td>
                                    <div style={{ minWidth: '120px' }}>
                                        <Group gap="xs" mb={4}>
                                            <Text size="sm">{received} / {total}</Text>
                                        </Group>
                                        <Progress
                                            value={percentage}
                                            size="sm"
                                            color={percentage === 100 ? 'green' : percentage > 0 ? 'blue' : 'gray'}
                                        />
                                    </div>
                                </Table.Td>
                                <Table.Td>
                                    {order.state_detail ? (
                                        <Badge
                                            style={{
                                                backgroundColor: order.state_detail.color || 'gray',
                                                color: '#fff',
                                            }}
                                        >
                                            {order.state_detail.name}
                                        </Badge>
                                    ) : (
                                        <Badge color="gray">{order.status_text || '-'}</Badge>
                                    )}
                                </Table.Td>
                                <Table.Td>{formatDate(order.issue_date)}</Table.Td>
                                <Table.Td>{formatDate(order.target_date)}</Table.Td>
                            </Table.Tr>
                        );
                    })
                )}
            </Table.Tbody>
        </Table>
    );
}
