import { useMemo, useState } from 'react';
import { Title, Table, Group, TextInput, Text } from '@mantine/core';
import { IconSearch, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ReturnOrderItem } from '../../services/returns';

interface ItemsTabProps {
  items: ReturnOrderItem[];
  orderCurrency: string;
}

export function ItemsTab({ items, orderCurrency }: ItemsTabProps) {
  const { t } = useTranslation();
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSortField, setItemSortField] = useState<keyof ReturnOrderItem | 'part_detail' | null>(null);
  const [itemSortDirection, setItemSortDirection] = useState<'asc' | 'desc'>('asc');

  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...items];

    if (itemSearchQuery) {
      const query = itemSearchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.part_detail?.name?.toLowerCase().includes(query) ||
        item.part_detail?.IPN?.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query)
      );
    }

    if (itemSortField) {
      filtered.sort((a, b) => {
        let aVal: any = (a as any)[itemSortField];
        let bVal: any = (b as any)[itemSortField];

        if (itemSortField === 'part_detail') {
          aVal = a.part_detail?.name || '';
          bVal = b.part_detail?.name || '';
        }

        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';

        if (itemSortField === 'quantity' || itemSortField === 'received' || itemSortField === 'sale_price') {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
          return itemSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (aStr < bStr) return itemSortDirection === 'asc' ? -1 : 1;
        if (aStr > bStr) return itemSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [items, itemSearchQuery, itemSortField, itemSortDirection]);

  const handleItemSort = (field: keyof ReturnOrderItem | 'part_detail') => {
    if (itemSortField === field) {
      setItemSortDirection(itemSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setItemSortField(field);
      setItemSortDirection('asc');
    }
  };

  const getItemSortIcon = (field: keyof ReturnOrderItem | 'part_detail') => {
    if (itemSortField !== field) return null;
    return itemSortDirection === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>{t('Order Items')}</Title>
      </Group>

      <TextInput
        placeholder={t('Search items...')}
        leftSection={<IconSearch size={16} />}
        value={itemSearchQuery}
        onChange={(e) => setItemSearchQuery(e.target.value)}
        mb="md"
      />

      <Table striped withTableBorder withColumnBorders highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('part_detail')}>
              <Group gap="xs">
                {t('Part')}
                {getItemSortIcon('part_detail')}
              </Group>
            </Table.Th>
            <Table.Th>{t('U.M.')}</Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('quantity')}>
              <Group gap="xs">
                {t('Quantity')}
                {getItemSortIcon('quantity')}
              </Group>
            </Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('received')}>
              <Group gap="xs">
                {t('Received')}
                {getItemSortIcon('received')}
              </Group>
            </Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('sale_price')}>
              <Group gap="xs">
                {t('Unit Price')}
                {getItemSortIcon('sale_price')}
              </Group>
            </Table.Th>
            <Table.Th>{t('Notes')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filteredAndSortedItems.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                {itemSearchQuery ? t('No results found') : t('No items')}
              </Table.Td>
            </Table.Tr>
          ) : (
            filteredAndSortedItems.map((item) => (
              <Table.Tr key={item._id}>
                <Table.Td>
                  <div>
                    <Text size="sm" fw={500}>{item.part_detail?.name || item.part_id}</Text>
                    {item.part_detail?.IPN && (
                      <Text size="xs" c="dimmed">{item.part_detail.IPN}</Text>
                    )}
                  </div>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{item.part_detail?.um || '-'}</Text>
                </Table.Td>
                <Table.Td>{item.quantity}</Table.Td>
                <Table.Td>{item.received || 0}</Table.Td>
                <Table.Td>
                  {typeof item.sale_price === 'number'
                    ? `${item.sale_price.toFixed(2)} ${item.sale_price_currency || orderCurrency}`
                    : `${Number(item.sale_price || 0).toFixed(2)} ${item.sale_price_currency || orderCurrency}`}
                </Table.Td>
                <Table.Td>{item.notes || '-'}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </>
  );
}
