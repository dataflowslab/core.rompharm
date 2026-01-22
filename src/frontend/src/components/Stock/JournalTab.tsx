import {
  Paper,
  Title,
  Timeline,
  Text,
  Stack,
  Badge,
} from '@mantine/core';
import { 
  IconCirclePlus,
  IconEdit,
  IconClipboardCheck,
  IconTransfer,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../utils/dateFormat';

interface JournalTabProps {
  stockId: string;
  stock: any;
}

export function JournalTab({ stockId, stock }: JournalTabProps) {
  const { t } = useTranslation();

  // Build timeline from stock data
  const timelineItems = [];

  // Created event
  if (stock.created_at) {
    timelineItems.push({
      date: stock.created_at,
      title: t('Stock Created'),
      description: `${t('Created by')} ${stock.created_by || 'system'}`,
      icon: <IconCirclePlus size={16} />,
      color: 'blue',
    });
  }

  // Received event
  if (stock.received_date) {
    timelineItems.push({
      date: stock.received_date,
      title: t('Stock Received'),
      description: `${t('Quantity')}: ${stock.quantity} ${stock.part_detail?.um || ''}`,
      icon: <IconTransfer size={16} />,
      color: 'green',
    });
  }

  // QC events
  if (stock.rompharm_ba_date) {
    timelineItems.push({
      date: stock.rompharm_ba_date,
      title: t('Quality Control Completed'),
      description: `BA No: ${stock.rompharm_ba_no || '-'}`,
      icon: <IconClipboardCheck size={16} />,
      color: 'teal',
    });
  }

  // State changes (if we track them)
  if (stock.status_detail) {
    timelineItems.push({
      date: stock.updated_at,
      title: t('Status Changed'),
      description: `${t('Current status')}: ${stock.status_detail.name}`,
      icon: <IconEdit size={16} />,
      color: stock.status_detail.color || 'gray',
    });
  }

  // Sort by date descending
  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Paper shadow="xs" p="md" withBorder>
      <Title order={4} mb="md">{t('Activity Journal')}</Title>
      
      <Stack gap="md">
        {/* Metadata Section */}
        <Paper p="sm" withBorder bg="gray.0">
          <Text size="sm" fw={500} mb="xs">{t('Metadata')}</Text>
          <Stack gap={4}>
            <Text size="sm">
              <Text span fw={500}>{t('Created At')}:</Text> {formatDateTime(stock.created_at)}
            </Text>
            <Text size="sm">
              <Text span fw={500}>{t('Created By')}:</Text> {stock.created_by || '-'}
            </Text>
            <Text size="sm">
              <Text span fw={500}>{t('Last Updated')}:</Text> {formatDateTime(stock.updated_at)}
            </Text>
            <Text size="sm">
              <Text span fw={500}>{t('Updated By')}:</Text> {stock.updated_by || '-'}
            </Text>
          </Stack>
        </Paper>

        {/* Timeline */}
        <Timeline active={timelineItems.length} bulletSize={24} lineWidth={2}>
          {timelineItems.map((item, index) => (
            <Timeline.Item
              key={index}
              bullet={item.icon}
              title={item.title}
              color={item.color}
            >
              <Text size="sm" c="dimmed" mb={4}>
                {formatDateTime(item.date)}
              </Text>
              <Text size="sm">{item.description}</Text>
            </Timeline.Item>
          ))}
        </Timeline>

        {timelineItems.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            {t('No activity recorded yet')}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
