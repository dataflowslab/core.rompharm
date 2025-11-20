import { useState } from 'react';
import { Button, Container, Group, Modal, Table, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface RequestItem {
  id: string;
  articleCode: string;
  description: string;
  series: string;
  type: string;
  locationFrom: string;
  locationTo: string;
  state: string;
  date: string;
  approvedOn: string;
  costCenter: string;
  extDocument: string;
  operator: string;
}

export function RequestsPage() {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [items] = useState<RequestItem[]>([]);

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Requests')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
          {t('New request')}
        </Button>
      </Group>

      <Table striped withTableBorder withColumnBorders highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>{t('Article code')}</Table.Th>
            <Table.Th>{t('Description')}</Table.Th>
            <Table.Th>{t('Series')}</Table.Th>
            <Table.Th>{t('Type')}</Table.Th>
            <Table.Th>{t('Location from')}</Table.Th>
            <Table.Th>{t('Location to')}</Table.Th>
            <Table.Th>{t('State')}</Table.Th>
            <Table.Th>{t('Date')}</Table.Th>
            <Table.Th>{t('Approved on')}</Table.Th>
            <Table.Th>{t('Cost Center')}</Table.Th>
            <Table.Th>{t('Ext. document')}</Table.Th>
            <Table.Th>{t('Operator')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={13}>{t('No data')}</Table.Td>
            </Table.Tr>
          ) : (
            items.map((it) => (
              <Table.Tr key={it.id}>
                <Table.Td>{it.id}</Table.Td>
                <Table.Td>{it.articleCode}</Table.Td>
                <Table.Td>{it.description}</Table.Td>
                <Table.Td>{it.series}</Table.Td>
                <Table.Td>{it.type}</Table.Td>
                <Table.Td>{it.locationFrom}</Table.Td>
                <Table.Td>{it.locationTo}</Table.Td>
                <Table.Td>{it.state}</Table.Td>
                <Table.Td>{it.date}</Table.Td>
                <Table.Td>{it.approvedOn}</Table.Td>
                <Table.Td>{it.costCenter}</Table.Td>
                <Table.Td>{it.extDocument}</Table.Td>
                <Table.Td>{it.operator}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={() => setOpened(false)} title={t('New request')} centered>
        {/* Placeholder for Request form; will be provided later */}
      </Modal>
    </Container>
  );
}
