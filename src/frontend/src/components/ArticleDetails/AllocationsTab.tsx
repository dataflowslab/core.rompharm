import { LoadingOverlay, Table, Text, Badge, Group, Paper, Checkbox } from '@mantine/core';

interface AllocationsTabProps {
  allocations: any[];
  loadingAllocations: boolean;
  stockCalculations: any;
  articleUm: string;
  showSales: boolean;
  showPurchase: boolean;
  onToggleSales: () => void;
  onTogglePurchase: () => void;
}

export function AllocationsTab({
  allocations,
  loadingAllocations,
  stockCalculations,
  articleUm,
  showSales,
  showPurchase,
  onToggleSales,
  onTogglePurchase,
}: AllocationsTabProps) {
  return (
    <>
      {/* Stock Calculations Cards */}
      {stockCalculations && (
        <Group mb="md" grow>
          <Paper p="sm" withBorder>
            <Text size="xs" c="dimmed">Total Stock</Text>
            <Text size="xl" fw={700}>{stockCalculations.total_stock}</Text>
          </Paper>
          <Paper p="sm" withBorder style={{ cursor: 'pointer' }} onClick={onToggleSales}>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed">Sales Stock</Text>
                <Text size="xl" fw={700}>{stockCalculations.sales_stock}</Text>
              </div>
              <Checkbox checked={showSales} onChange={() => {}} />
            </Group>
          </Paper>
          <Paper p="sm" withBorder style={{ cursor: 'pointer' }} onClick={onTogglePurchase}>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed">Future Stock</Text>
                <Text size="xl" fw={700}>{stockCalculations.future_stock}</Text>
              </div>
              <Checkbox checked={showPurchase} onChange={() => {}} />
            </Group>
          </Paper>
          <Paper p="sm" withBorder>
            <Text size="xs" c="dimmed">Quarantined</Text>
            <Text size="xl" fw={700}>{stockCalculations.quarantined_stock}</Text>
          </Paper>
          <Paper p="sm" withBorder>
            <Text size="xs" c="dimmed">Available</Text>
            <Text size="xl" fw={700} c="green">{stockCalculations.available_stock}</Text>
          </Paper>
        </Group>
      )}

      {loadingAllocations && <LoadingOverlay visible />}

      {allocations.length === 0 && !loadingAllocations && (
        <Text c="dimmed">No allocations found for this article.</Text>
      )}

      {allocations.length > 0 && !loadingAllocations && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Order Ref</Table.Th>
              <Table.Th>Customer/Supplier</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Notes</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {allocations.map((allocation: any) => (
              <Table.Tr key={`${allocation.type}-${allocation._id}`}>
                <Table.Td>
                  <Badge color={allocation.type === 'sales' ? 'blue' : 'green'}>
                    {allocation.type === 'sales' ? 'Sales' : 'Purchase'}
                  </Badge>
                </Table.Td>
                <Table.Td>{allocation.order_ref || '-'}</Table.Td>
                <Table.Td>{allocation.customer || allocation.supplier || '-'}</Table.Td>
                <Table.Td>{allocation.quantity || 0} {articleUm}</Table.Td>
                <Table.Td>
                  <Badge color="blue">{allocation.status || 'Pending'}</Badge>
                </Table.Td>
                <Table.Td>
                  {allocation.date ? new Date(allocation.date).toLocaleDateString() : '-'}
                </Table.Td>
                <Table.Td>{allocation.notes || '-'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
