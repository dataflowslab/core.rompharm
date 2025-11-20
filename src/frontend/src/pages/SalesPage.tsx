import { useState } from 'react';
import { Button, Container, Group, Modal, Table, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface SalesItem {
  id: string;
  clientCode: string;
  clientName: string;
  requestedDate: string;
  promisedDate: string;
  operator: string;
  final: string;
  state: string;
  approvedOn: string;
  campaignNo: string;
}

export function SalesPage() {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [items] = useState<SalesItem[]>([]);

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Sales')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
          {t('New item')}
        </Button>
      </Group>

      <Table striped withTableBorder withColumnBorders highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>{t('Client code')}</Table.Th>
            <Table.Th>{t('Client name')}</Table.Th>
            <Table.Th>{t('Reested date')}</Table.Th>
            <Table.Th>{t('Promised date')}</Table.Th>
            <Table.Th>{t('Operator')}</Table.Th>
            <Table.Th>{t('Final')}</Table.Th>
            <Table.Th>{t('State')}</Table.Th>
            <Table.Th>{t('Approved on')}</Table.Th>
            <Table.Th>{t('Campaign No')}</Table.Th>
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
                <Table.Td>{it.clientCode}</Table.Td>
                <Table.Td>{it.clientName}</Table.Td>
                <Table.Td>{it.requestedDate}</Table.Td>
                <Table.Td>{it.promisedDate}</Table.Td>
                <Table.Td>{it.operator}</Table.Td>
                <Table.Td>{it.final}</Table.Td>
                <Table.Td>{it.state}</Table.Td>
                <Table.Td>{it.approvedOn}</Table.Td>
                <Table.Td>{it.campaignNo}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={() => setOpened(false)} title={t('New item')} centered>
        {/* Placeholder for Sales form; will be provided later */}
      </Modal>
    </Container>
  );
}
