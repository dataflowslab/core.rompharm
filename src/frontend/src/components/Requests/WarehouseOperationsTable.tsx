import { Paper, Title, Table, Button, Group, NumberInput, ActionIcon, Text } from '@mantine/core';
import { IconPlus, IconDeviceFloppy, IconTrash, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';

interface ItemWithBatch {
  part: string;  // MongoDB ObjectId
  part_name?: string;
  quantity: number;
  init_q: number;
  batch_code: string;
  added_in_operations?: boolean;
}

interface WarehouseOperationsTableProps {
  items: ItemWithBatch[];
  isReadonly: boolean;
  onQuantityChange: (index: number, value: number) => void;
  onDeleteItem: (index: number) => void;
  onSave: () => void;
  onAddItem: () => void;
  saving: boolean;
}

export function WarehouseOperationsTable({
  items,
  isReadonly,
  onQuantityChange,
  onDeleteItem,
  onSave,
  onAddItem,
  saving
}: WarehouseOperationsTableProps) {
  const { t } = useTranslation();

  // Group items by part and calculate totals
  const getGroupedItems = () => {
    const grouped = items.reduce((acc, item) => {
      const key = item.part_name || String(item.part);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {} as Record<string, ItemWithBatch[]>);

    const sortedKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

    const nonZeroGroups: Array<{ key: string; items: ItemWithBatch[] }> = [];
    const zeroGroups: Array<{ key: string; items: ItemWithBatch[] }> = [];

    sortedKeys.forEach(key => {
      const groupItems = grouped[key];
      const hasNonZero = groupItems.some(item => item.quantity > 0);
      
      if (hasNonZero) {
        nonZeroGroups.push({ key, items: groupItems });
      } else {
        zeroGroups.push({ key, items: groupItems });
      }
    });

    return [...nonZeroGroups, ...zeroGroups];
  };

  const isGroupComplete = (groupItems: ItemWithBatch[]) => {
    const originalItem = groupItems.find(item => !item.added_in_operations);
    if (!originalItem) return false;

    const totalWithBatch = groupItems
      .filter(item => item.batch_code && item.batch_code.trim() !== '')
      .reduce((sum, item) => sum + item.quantity, 0);

    return totalWithBatch === originalItem.init_q;
  };

  const areAllGroupsComplete = () => {
    const groups = getGroupedItems();
    const nonZeroGroups = groups.filter(group => 
      group.items.some(item => item.quantity > 0)
    );
    
    return nonZeroGroups.every(group => isGroupComplete(group.items));
  };

  const handleDelete = (index: number) => {
    const item = items[index];
    
    if (!item.added_in_operations) {
      return;
    }

    modals.openConfirmModal({
      title: t('Delete Item'),
      children: <Text size="sm">{t('Are you sure you want to delete this item?')}</Text>,
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => onDeleteItem(index)
    });
  };

  return (
    <Paper withBorder p="md" mb="md">
      <Group justify="space-between" mb="md">
        <Group>
          <Title order={5}>{t('Warehouse Operations')}</Title>
          {areAllGroupsComplete() ? (
            <IconCheck size={20} color="green" />
          ) : (
            <IconAlertTriangle size={20} color="orange" />
          )}
        </Group>
        <Group>
          {!isReadonly && (
            <>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={onAddItem}
                size="sm"
                variant="outline"
              >
                {t('Add Item')}
              </Button>
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={onSave}
                loading={saving}
                size="sm"
                variant="light"
              >
                {t('Save')}
              </Button>
            </>
          )}
        </Group>
      </Group>

      <Table striped withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Part')}</Table.Th>
            <Table.Th style={{ width: '120px' }}>{t('Requested')}</Table.Th>
            <Table.Th style={{ width: '120px' }}>{t('Qty')}</Table.Th>
            <Table.Th>{t('Batch Code')}</Table.Th>
            {!isReadonly && <Table.Th style={{ width: '60px' }}></Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {getGroupedItems().map((group, groupIndex) => {
            const groupComplete = isGroupComplete(group.items);
            
            return group.items.map((item, itemIndex) => {
              const isZeroQuantity = item.quantity === 0;
              const isOriginalItem = !item.added_in_operations;
              const flatIndex = items.findIndex(i => 
                i.part === item.part && 
                i.batch_code === item.batch_code && 
                i.added_in_operations === item.added_in_operations
              );
              
              return (
                <Table.Tr key={`${groupIndex}-${itemIndex}`} style={{ opacity: isZeroQuantity ? 0.5 : 1 }}>
                  <Table.Td style={{ color: isZeroQuantity ? '#868e96' : 'inherit' }}>
                    {item.part_name}
                  </Table.Td>
                  <Table.Td>
                    {isOriginalItem ? (
                      <Text 
                        size="sm" 
                        fw={groupComplete ? 700 : 400}
                        c={groupComplete ? 'green' : 'dimmed'}
                      >
                        {item.init_q}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {isOriginalItem && !item.batch_code ? (
                      // Original item without batch code - will be satisfied by other lots
                      <Text size="sm" c="dimmed">-</Text>
                    ) : (
                      <NumberInput
                        value={item.quantity}
                        onChange={(value) => onQuantityChange(flatIndex, Number(value) || 0)}
                        disabled={isReadonly}
                        min={0}
                        size="xs"
                      />
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: isZeroQuantity ? '#868e96' : 'inherit' }}>
                      {item.batch_code || '-'}
                    </Text>
                  </Table.Td>
                  {!isReadonly && (
                    <Table.Td>
                      {item.added_in_operations && (
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          size="sm"
                          onClick={() => handleDelete(flatIndex)}
                          title={t('Delete')}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Table.Td>
                  )}
                </Table.Tr>
              );
            });
          })}
        </Table.Tbody>
      </Table>

      {isReadonly && (
        <Text size="sm" c="orange" mt="md">
          {t('This form is read-only because it has been signed.')}
        </Text>
      )}

      {!isReadonly && (
        <Text size="sm" c="dimmed" mt="md">
          {t('Note: Set quantity to 0 for items not available. Use Add Item to add materials with batch codes from source location.')}
        </Text>
      )}
    </Paper>
  );
}
