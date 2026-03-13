import { Table, Group, Text, Progress, Badge } from '@mantine/core';
import { IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReturnOrder } from '../../../services/returns';
import { formatDate } from '../../../utils/dateFormat';

interface ReturnOrderTableProps {
  orders: ReturnOrder[];
  loading: boolean;
  searchQuery: string;
  sortField: keyof ReturnOrder | 'customer_detail' | null;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof ReturnOrder | 'customer_detail') => void;
}

export function ReturnOrderTable({
  orders,
  loading,
  searchQuery,
  sortField,
  sortDirection,
  onSort,
}: ReturnOrderTableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const getSortIcon = (field: keyof ReturnOrder | 'customer_detail') => {
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
          <Table.Th style={{ cursor: 'pointer' }} onClick={() => onSort('customer_detail')}>
            <Group gap="xs">
              {t('Customer')}
              {getSortIcon('customer_detail')}
            </Group>
          </Table.Th>
          <Table.Th style={{ cursor: 'pointer' }} onClick={() => onSort('sales_order_reference')}>
            <Group gap="xs">
              {t('Sales Order')}
              {getSortIcon('sales_order_reference')}
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
          <Table.Th style={{ cursor: 'pointer' }} onClick={() => onSort('notes')}>
            <Group gap="xs">
              {t('Notes')}
              {getSortIcon('notes')}
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
                key={order._id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/returns/${order._id}`)}
              >
                <Table.Td>{order.reference}</Table.Td>
                <Table.Td>{order.customer_detail?.name || '-'}</Table.Td>
                <Table.Td>{order.sales_order_reference || order.sales_order_id || '-'}</Table.Td>
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
                <Table.Td>{order.notes || '-'}</Table.Td>
              </Table.Tr>
            );
          })
        )}
      </Table.Tbody>
    </Table>
  );
}
