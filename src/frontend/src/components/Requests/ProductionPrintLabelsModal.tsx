import { useEffect, useState } from 'react';
import { Modal, Button, NumberInput, Stack, Group, Text, Table } from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface Serie {
  batch_code: string;
  produced_qty?: number;
}

interface ProductionPrintLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  series: Serie[];
  onPrint: (quantities: Record<string, number>) => void;
  printing: boolean;
}

export function ProductionPrintLabelsModal({
  isOpen,
  onClose,
  series,
  onPrint,
  printing
}: ProductionPrintLabelsModalProps) {
  const { t } = useTranslation();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, number> = {};
      series.forEach((serie) => {
        initial[serie.batch_code] = 0;
      });
      setQuantities(initial);
    }
  }, [isOpen, series]);

  const handleQuantityChange = (batchCode: string, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [batchCode]: value
    }));
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={<Group gap="xs"><IconPrinter size={20} /><Text fw={700}>{t('Print labels')}</Text></Group>}
      size="lg"
      withCloseButton={!printing}
      closeOnEscape={!printing}
      closeOnClickOutside={!printing}
    >
      <Stack gap="md">
        <Text size="sm" fw={500}>{t('Batches')}</Text>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Batch')}</Table.Th>
              <Table.Th style={{ width: 120 }}>{t('Quantity')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {series.map((serie) => (
              <Table.Tr key={serie.batch_code}>
                <Table.Td>
                  <Text size="sm">{serie.batch_code}</Text>
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    value={quantities[serie.batch_code] || 0}
                    onChange={(val) => handleQuantityChange(serie.batch_code, Number(val) || 0)}
                    min={0}
                    size="xs"
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={printing}>
            {t('Cancel')}
          </Button>
          <Button
            leftSection={<IconPrinter size={16} />}
            onClick={() => onPrint(quantities)}
            loading={printing}
            disabled={series.length === 0}
          >
            {t('Generate PDF')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
