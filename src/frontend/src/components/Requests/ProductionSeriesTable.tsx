import { Table, NumberInput, Button, Group, Text, ActionIcon } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Material {
  part: string;
  part_name: string;
  batch: string;
  received_qty: number;
  used_qty: number;
}

interface Serie {
  batch_code: string;
  materials: Material[];
}

interface ProductionSeriesTableProps {
  series: Serie[];
  onSeriesChange: (series: Serie[]) => void;
  onSave: () => void;
  saving: boolean;
  isReadonly: boolean;
}

export function ProductionSeriesTable({
  series,
  onSeriesChange,
  onSave,
  saving,
  isReadonly
}: ProductionSeriesTableProps) {
  const { t } = useTranslation();
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());

  const toggleSerie = (batchCode: string) => {
    const newExpanded = new Set(expandedSeries);
    if (newExpanded.has(batchCode)) {
      newExpanded.delete(batchCode);
    } else {
      newExpanded.add(batchCode);
    }
    setExpandedSeries(newExpanded);
  };

  const handleUsedQtyChange = (serieIndex: number, materialIndex: number, value: number) => {
    const newSeries = [...series];
    newSeries[serieIndex].materials[materialIndex].used_qty = value;
    onSeriesChange(newSeries);
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="lg" fw={600}>{t('Production Series')}</Text>
        <Button onClick={onSave} loading={saving} disabled={isReadonly}>
          {t('Save')}
        </Button>
      </Group>

      <Table striped withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: '40px' }}></Table.Th>
            <Table.Th>{t('Material / Serie')}</Table.Th>
            <Table.Th>{t('Batch')}</Table.Th>
            <Table.Th style={{ width: '120px' }}>{t('Received Qty')}</Table.Th>
            <Table.Th style={{ width: '120px' }}>{t('Used Qty')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {series.map((serie, serieIndex) => {
            const isExpanded = expandedSeries.has(serie.batch_code);
            
            return (
              <>
                {/* Serie Row */}
                <Table.Tr key={`serie-${serieIndex}`} style={{ backgroundColor: '#f8f9fa', fontWeight: 600 }}>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      onClick={() => toggleSerie(serie.batch_code)}
                      size="sm"
                    >
                      {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                    </ActionIcon>
                  </Table.Td>
                  <Table.Td colSpan={4}>
                    {t('Serie')}: {serie.batch_code}
                  </Table.Td>
                </Table.Tr>

                {/* Material Rows (only if expanded) */}
                {isExpanded && serie.materials.map((material, materialIndex) => (
                  <Table.Tr key={`material-${serieIndex}-${materialIndex}`}>
                    <Table.Td></Table.Td>
                    <Table.Td style={{ paddingLeft: '2rem' }}>
                      {material.part_name || material.part}
                    </Table.Td>
                    <Table.Td>{material.batch}</Table.Td>
                    <Table.Td>{material.received_qty}</Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={material.used_qty}
                        onChange={(value) => handleUsedQtyChange(serieIndex, materialIndex, value as number)}
                        min={0}
                        max={material.received_qty}
                        disabled={isReadonly}
                        size="sm"
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </>
            );
          })}
        </Table.Tbody>
      </Table>
    </>
  );
}
