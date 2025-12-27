import { Table, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface UnusedMaterial {
  part: string;
  part_name: string;
  total_received: number;
  total_used: number;
  unused: number;
}

interface UnusedMaterialsTableProps {
  unusedMaterials: UnusedMaterial[];
}

export function UnusedMaterialsTable({ unusedMaterials }: UnusedMaterialsTableProps) {
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
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}
