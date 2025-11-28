import { useState } from 'react';
import {
  Title,
  Table,
  Button,
  Group,
  Text,
  Paper,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface QualityControlTabProps {
  orderId: string;
  canEdit: boolean;
}

export function QualityControlTab({ orderId, canEdit }: QualityControlTabProps) {
  const { t } = useTranslation();
  const [qcRecords] = useState<any[]>([]);

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>{t('Quality Control')}</Title>
        {canEdit && (
          <Button 
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              // TODO: Implement QC record creation
              alert('Quality Control functionality coming soon');
            }}
          >
            {t('New QC Record')}
          </Button>
        )}
      </Group>

      <Table striped withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Part')}</Table.Th>
            <Table.Th>{t('Batch')}</Table.Th>
            <Table.Th>{t('Quantity')}</Table.Th>
            <Table.Th>{t('Status')}</Table.Th>
            <Table.Th>{t('Inspector')}</Table.Th>
            <Table.Th>{t('Date')}</Table.Th>
            <Table.Th>{t('Notes')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {qcRecords.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                <Text c="dimmed">{t('No quality control records')}</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            qcRecords.map((record: any) => (
              <Table.Tr key={record.pk}>
                <Table.Td>{record.part_name}</Table.Td>
                <Table.Td>{record.batch}</Table.Td>
                <Table.Td>{record.quantity}</Table.Td>
                <Table.Td>{record.status}</Table.Td>
                <Table.Td>{record.inspector}</Table.Td>
                <Table.Td>{record.date}</Table.Td>
                <Table.Td>{record.notes}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
