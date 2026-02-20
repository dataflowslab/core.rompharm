import { Table, Checkbox, NumberInput, Badge, Text, Box } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface BatchCodeItem {
  batch_code: string;
  quantity: number;
  location_name: string;
  location_id: string;
  state_name: string;
  state_id: string;
  state_color?: string;
  expiry_date?: string;
  is_transferable?: boolean;
  is_requestable?: boolean;
}

interface BatchSelection {
  batch_code: string;
  location_id: string;
  requested_quantity: number;
}

interface BatchCodesTableProps {
  batchCodes: BatchCodeItem[];
  selections: BatchSelection[];
  onSelectionChange: (selections: BatchSelection[]) => void;
  disabled?: boolean;
}

export function BatchCodesTable({
  batchCodes,
  selections,
  onSelectionChange,
  disabled = false
}: BatchCodesTableProps) {
  const { t } = useTranslation();

  const getStateColor = (stateName: string): string => {
    const lowerName = stateName.toLowerCase();
    if (lowerName.includes('disponibil') || lowerName.includes('available')) return 'green';
    if (lowerName.includes('rezervat') || lowerName.includes('reserved')) return 'blue';
    if (lowerName.includes('blocat') || lowerName.includes('blocked')) return 'red';
    return 'gray';
  };

  const isSelected = (batchCode: string, locationId: string): boolean => {
    return selections.some(
      s => s.batch_code === batchCode && s.location_id === locationId
    );
  };

  const getRequestedQuantity = (batchCode: string, locationId: string): number => {
    const selection = selections.find(
      s => s.batch_code === batchCode && s.location_id === locationId
    );
    return selection?.requested_quantity || 0;
  };

  const handleCheckboxChange = (batch: BatchCodeItem, checked: boolean) => {
    if (checked) {
      // Add selection with quantity 0
      onSelectionChange([
        ...selections,
        {
          batch_code: batch.batch_code,
          location_id: batch.location_id,
          requested_quantity: 0
        }
      ]);
    } else {
      // Remove selection
      onSelectionChange(
        selections.filter(
          s => !(s.batch_code === batch.batch_code && s.location_id === batch.location_id)
        )
      );
    }
  };

  const handleQuantityChange = (batch: BatchCodeItem, value: number | string) => {
    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    const clampedValue = Math.max(0, Math.min(numValue, batch.quantity));

    const newSelections = selections.map(s => {
      if (s.batch_code === batch.batch_code && s.location_id === batch.location_id) {
        return { ...s, requested_quantity: clampedValue };
      }
      return s;
    });

    onSelectionChange(newSelections);
  };

  if (batchCodes.length === 0) {
    return (
      <Box p="md" style={{ textAlign: 'center', color: '#868e96' }}>
        <Text size="sm">{t('No batch codes available')}</Text>
      </Box>
    );
  }

  return (
    <Table striped highlightOnHover withTableBorder withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th style={{ width: '50px', textAlign: 'center' }}>#</Table.Th>
          <Table.Th>{t('Batch')}</Table.Th>
          <Table.Th style={{ width: '120px' }}>{t('Status')}</Table.Th>
          <Table.Th style={{ width: '100px', textAlign: 'right' }}>{t('Available')}</Table.Th>
          <Table.Th style={{ width: '120px' }}>{t('Quantity')}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {batchCodes.map((batch, index) => {
          const selected = isSelected(batch.batch_code, batch.location_id);
          const requestedQty = getRequestedQuantity(batch.batch_code, batch.location_id);

          return (
            <Table.Tr key={`${batch.batch_code}_${batch.location_id}`}>
              <Table.Td style={{ textAlign: 'center' }}>
                <Checkbox
                  checked={selected}
                  onChange={(e) => handleCheckboxChange(batch, e.currentTarget.checked)}
                  disabled={disabled}
                />
              </Table.Td>
              <Table.Td>
                <Box>
                  <Text fw={700} size="sm">
                    {batch.batch_code}
                  </Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    {batch.location_name}
                    {batch.expiry_date && ` • Exp: ${batch.expiry_date}`}
                  </Text>
                </Box>
              </Table.Td>
              <Table.Td>
                <Badge
                  size="sm"
                  color={batch.state_color || getStateColor(batch.state_name)}
                  variant="filled"
                >
                  {batch.state_name}
                </Badge>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text fw={500} size="sm">
                  {batch.quantity}
                </Text>
              </Table.Td>
              <Table.Td>
                <NumberInput
                  value={requestedQty}
                  onChange={(value) => handleQuantityChange(batch, value)}
                  min={0}
                  max={batch.quantity}
                  step={1}
                  disabled={!selected || disabled}
                  placeholder="0"
                  size="sm"
                  styles={{
                    input: {
                      textAlign: 'right'
                    }
                  }}
                />
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
