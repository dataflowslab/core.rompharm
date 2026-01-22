import { Paper, Title, Text, Timeline, Group, Badge } from '@mantine/core';
import { IconSignature, IconTruck, IconCheck, IconFileText } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface JournalEntry {
  type: 'signature' | 'state_change' | 'stock_received' | 'qc_result';
  timestamp: string;
  user?: string;
  description: string;
  details?: any;
}

interface JournalTabProps {
  orderId: string;
  approvalFlow?: {
    signatures: Array<{
      user_id: string;
      username: string;
      signed_at: string;
    }>;
  };
}

export function JournalTab({ orderId, approvalFlow }: JournalTabProps) {
  const { t } = useTranslation();

  // Build journal entries from available data
  const journalEntries: JournalEntry[] = [];

  // Add signatures to journal
  if (approvalFlow?.signatures) {
    approvalFlow.signatures.forEach(sig => {
      journalEntries.push({
        type: 'signature',
        timestamp: sig.signed_at,
        user: sig.username,
        description: `Order signed by ${sig.username}`,
      });
    });
  }

  // Sort by timestamp (newest first)
  journalEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getIcon = (type: string) => {
    switch (type) {
      case 'signature': return <IconSignature size={16} />;
      case 'state_change': return <IconFileText size={16} />;
      case 'stock_received': return <IconTruck size={16} />;
      case 'qc_result': return <IconCheck size={16} />;
      default: return <IconFileText size={16} />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'signature': return 'blue';
      case 'state_change': return 'cyan';
      case 'stock_received': return 'green';
      case 'qc_result': return 'teal';
      default: return 'gray';
    }
  };

  return (
    <Paper p="md" withBorder>
      <Title order={4} mb="md">{t('Activity Journal')}</Title>
      
      {journalEntries.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('No activity recorded yet')}
        </Text>
      ) : (
        <Timeline active={journalEntries.length} bulletSize={24} lineWidth={2}>
          {journalEntries.map((entry, index) => (
            <Timeline.Item
              key={index}
              bullet={getIcon(entry.type)}
              title={
                <Group gap="xs">
                  <Text size="sm" fw={500}>{entry.description}</Text>
                  <Badge size="xs" color={getColor(entry.type)}>
                    {entry.type.replace('_', ' ')}
                  </Badge>
                </Group>
              }
            >
              <Text size="xs" c="dimmed" mt={4}>
                {new Date(entry.timestamp).toLocaleString()}
              </Text>
              {entry.user && (
                <Text size="xs" c="dimmed">
                  {t('By')}: {entry.user}
                </Text>
              )}
            </Timeline.Item>
          ))}
        </Timeline>
      )}

      <Text size="xs" c="dimmed" mt="xl">
        <strong>{t('Note')}:</strong> {t('Quality Control tab functionality is pending deletion. QC results will be shown here in the future.')}
      </Text>
    </Paper>
  );
}
