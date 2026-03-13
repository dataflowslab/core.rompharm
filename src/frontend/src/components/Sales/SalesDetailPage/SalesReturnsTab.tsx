import { useMemo, useState, useEffect } from 'react';
import { Paper, Group, Title, Button, Table, Text, Modal, Stack, NumberInput, TextInput, Badge } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { salesService, SalesOrderItem, ReturnOrder } from '../../../services/sales';
import { useNavigate } from 'react-router-dom';

interface SalesReturnsTabProps {
  orderId: string;
  items: SalesOrderItem[];
  returns: ReturnOrder[];
  onRefresh?: () => void;
}

export function SalesReturnsTab({ orderId, items, returns, onRefresh }: SalesReturnsTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const returnedByItem = useMemo(() => {
    const map: Record<string, number> = {};
    returns.forEach((ret) => {
      (ret.items || []).forEach((item) => {
        const key = item.order_item_id;
        if (!key) return;
        map[key] = (map[key] || 0) + Number(item.quantity || 0);
      });
    });
    return map;
  }, [returns]);

  const availableItems = useMemo(() => {
    return items
      .map((item) => {
        const available = Number(item.quantity || 0) - Number(returnedByItem[item._id] || 0);
        return { item, available: Math.max(0, available) };
      })
      .filter((entry) => entry.available > 0);
  }, [items, returnedByItem]);

  useEffect(() => {
    if (!modalOpen) return;
    const initial: Record<string, number> = {};
    availableItems.forEach(({ item }) => {
      initial[item._id] = 0;
    });
    setQuantities(initial);
    setNotes('');
  }, [modalOpen, availableItems]);

  const handleSave = async () => {
    const payloadItems = availableItems
      .map(({ item, available }) => ({
        item,
        available,
        qty: Number(quantities[item._id] || 0)
      }))
      .filter((row) => row.qty > 0);

    if (payloadItems.length === 0) {
      notifications.show({
        title: t('Warning'),
        message: t('Please select a product'),
        color: 'orange'
      });
      return;
    }

    for (const row of payloadItems) {
      if (row.qty > row.available + 1e-6) {
        notifications.show({
          title: t('Error'),
          message: `${row.item.part_detail?.name || row.item.part}: ${t('Available')}: ${row.available}`,
          color: 'red'
        });
        return;
      }
    }

    setSaving(true);
    try {
      await salesService.createReturnOrder(orderId, {
        notes,
        items: payloadItems.map((row) => ({
          order_item_id: row.item._id,
          part_id: row.item.part,
          quantity: row.qty
        }))
      });

      notifications.show({
        title: t('Success'),
        message: t('Return order created successfully'),
        color: 'green'
      });
      setModalOpen(false);
      onRefresh?.();
    } catch (err: any) {
      console.error(err);
      notifications.show({
        title: t('Error'),
        message: err.response?.data?.detail || t('Failed to create return order'),
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={5}>{t('Returns')}</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          size="sm"
          onClick={() => setModalOpen(true)}
          disabled={availableItems.length === 0}
        >
          {t('New Return')}
        </Button>
      </Group>

      {returns.length === 0 ? (
        <Text size="sm" c="dimmed">{t('No return orders yet')}</Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Reference')}</Table.Th>
              <Table.Th>{t('Date')}</Table.Th>
              <Table.Th>{t('Items')}</Table.Th>
              <Table.Th>{t('Notes')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {returns.map((ret) => (
              <Table.Tr
                key={ret._id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/returns/${ret._id}`)}
              >
                <Table.Td>
                  <Text fw={600}>{ret.reference}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{ret.issue_date || (ret.created_at ? new Date(ret.created_at).toLocaleDateString() : '-')}</Text>
                </Table.Td>
                <Table.Td>
                  <Stack gap={4}>
                    {(ret.items || []).map((item) => (
                      <Group key={item._id} gap="xs">
                        <Badge size="xs" color="blue">{item.quantity}</Badge>
                        <Text size="sm">{item.part_detail?.name || item.part_id}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{ret.notes || '-'}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('New Return')}
        size="lg"
        centered
      >
        {availableItems.length === 0 ? (
          <Text size="sm" c="dimmed">{t('No products found')}</Text>
        ) : (
          <Stack gap="md">
            <Table withTableBorder striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Product')}</Table.Th>
                  <Table.Th>{t('Available Qty')}</Table.Th>
                  <Table.Th>{t('Return Qty')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {availableItems.map(({ item, available }) => (
                  <Table.Tr key={item._id}>
                    <Table.Td>
                      <Text fw={500}>{item.part_detail?.name || item.part}</Text>
                      <Text size="xs" c="dimmed">IPN: {item.part_detail?.IPN || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>{available}</Text>
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={quantities[item._id] ?? 0}
                        onChange={(value) => setQuantities(prev => ({
                          ...prev,
                          [item._id]: Number(value || 0)
                        }))}
                        min={0}
                        max={available}
                        step={1}
                        clampBehavior="strict"
                        size="sm"
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <TextInput
              label={t('Notes')}
              placeholder={t('Add notes...')}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setModalOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {t('Save')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Paper>
  );
}
