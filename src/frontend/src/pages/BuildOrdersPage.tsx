import { useState } from 'react';
import { Button, Container, Group, Modal, Table, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface BuildOrderItem {
  id: string;
  articleNo: string;
  description: string;
  series: string;
  expiryDate: string;
  plannedQuantity: string;
  mu: string;
  state: string;
  operator: string;
}

export function BuildOrdersPage() {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [items] = useState<BuildOrderItem[]>([]);

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Build orders')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
          {t('New item')}
        </Button>
      </Group>

      <Table striped withTableBorder withColumnBorders highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>{t('Article No')}</Table.Th>
            <Table.Th>{t('Description')}</Table.Th>
            <Table.Th>{t('Series')}</Table.Th>
            <Table.Th>{t('Expiry date')}</Table.Th>
            <Table.Th>{t('Planned quant.')}</Table.Th>
            <Table.Th>{t('MU')}</Table.Th>
            <Table.Th>{t('State')}</Table.Th>
            <Table.Th>{t('Operator')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={9}>{t('No data')}</Table.Td>
            </Table.Tr>
          ) : (
            items.map((it) => (
              <Table.Tr key={it.id}>
                <Table.Td>{it.id}</Table.Td>
                <Table.Td>{it.articleNo}</Table.Td>
                <Table.Td>{it.description}</Table.Td>
                <Table.Td>{it.series}</Table.Td>
                <Table.Td>{it.expiryDate}</Table.Td>
                <Table.Td>{it.plannedQuantity}</Table.Td>
                <Table.Td>{it.mu}</Table.Td>
                <Table.Td>{it.state}</Table.Td>
                <Table.Td>{it.operator}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={() => setOpened(false)} title={t('New item')} centered>
        {/* Placeholder for Build Order form; will be provided later */}
      </Modal>
    </Container>
  );
}
