import { useState } from 'react';
import { Button, Container, Group, Modal, Table, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface ProcurementItem {
  id: string;
  supplierCode: string;
  supplierName: string;
  date: string;
  offer: string;
  purchaser: string;
  confirmed: string;
  plannedReceptionOn: string;
  estimatedReceptionOn: string;
  state: string;
}

export function ProcurementPage() {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [items] = useState<ProcurementItem[]>([]);

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Procurement')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
          {t('New item')}
        </Button>
      </Group>

      <Table striped withTableBorder withColumnBorders highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>{t('Supplier code')}</Table.Th>
            <Table.Th>{t('Supplier name')}</Table.Th>
            <Table.Th>{t('Date')}</Table.Th>
            <Table.Th>{t('Offer')}</Table.Th>
            <Table.Th>{t('Purchaser')}</Table.Th>
            <Table.Th>{t('Confirmed')}</Table.Th>
            <Table.Th>{t('Planned reception on')}</Table.Th>
            <Table.Th>{t('Est. reception on')}</Table.Th>
            <Table.Th>{t('State')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={10}>{t('No data')}</Table.Td>
            </Table.Tr>
          ) : (
            items.map((it) => (
              <Table.Tr key={it.id}>
                <Table.Td>{it.id}</Table.Td>
                <Table.Td>{it.supplierCode}</Table.Td>
                <Table.Td>{it.supplierName}</Table.Td>
                <Table.Td>{it.date}</Table.Td>
                <Table.Td>{it.offer}</Table.Td>
                <Table.Td>{it.purchaser}</Table.Td>
                <Table.Td>{it.confirmed}</Table.Td>
                <Table.Td>{it.plannedReceptionOn}</Table.Td>
                <Table.Td>{it.estimatedReceptionOn}</Table.Td>
                <Table.Td>{it.state}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={() => setOpened(false)} title={t('New item')} centered>
        {/* Placeholder for Procurement form; will be provided later */}
      </Modal>
    </Container>
  );
}
