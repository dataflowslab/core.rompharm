import { Table, Text, NumberInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface UnusedMaterial {
  part: string;
  part_name: string;
  total_received: number;
  total_used: number;
  unused: number;
  return_qty: number;
  loss: number;
}

interface UnusedMaterialsTableProps {
  unusedMaterials: UnusedMaterial[];
  onReturnQuantityChange: (part: string, value: number, max: number) => void;
  isReadonly: boolean;
}

export function UnusedMaterialsTable({
  unusedMaterials,
  onReturnQuantityChange,
  isReadonly
}: UnusedMaterialsTableProps) {
  const { t } = useTranslation();

  return (
    <>
      <Text size="lg" fw={600} mb="md">{t('Unused Materials')}</Text>
      
      <Table striped withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Material')}</Table.Th>
            <Table.Th style={{ width: '120px' }}>{t('Total Received')}</Table.Th>
            <Table.Th style={{ width: '120px' }}>{t('Total Used')}</Table.Th>
            <Table.Th style={{ width: '120px' }}>{t('Unused')}</Table.Th>
            <Table.Th style={{ width: '140px' }}>{t('Return Quantity')}</Table.Th>
            <Table.Th style={{ width: '120px' }}>{t('Loss')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {unusedMaterials.map((material, index) => (
            <Table.Tr key={index}>
              <Table.Td>{material.part_name || material.part}</Table.Td>
              <Table.Td>{material.total_received}</Table.Td>
              <Table.Td>{material.total_used}</Table.Td>
              <Table.Td>
                <Text c={material.unused < 0 ? 'red' : undefined} fw={material.unused < 0 ? 600 : undefined}>
                  {material.unused}
                </Text>
              </Table.Td>
              <Table.Td>
                <NumberInput
                  value={material.return_qty}
                  onChange={(value) => onReturnQuantityChange(material.part, Number(value) || 0, Math.max(0, material.unused))}
                  min={0}
                  max={Math.max(0, material.unused)}
                  size="xs"
                  disabled={isReadonly}
                />
              </Table.Td>
              <Table.Td>
                <Text c={material.loss > 0 ? 'red' : undefined} fw={material.loss > 0 ? 600 : undefined}>
                  {material.loss}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}
