import { Paper, Title, Timeline, Text, Group, Badge } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ReactNode, useMemo } from 'react';

type JournalEntry = {
  title: string;
  description?: string;
  timestamp?: string;
  user?: string;
  color?: string;
  icon?: ReactNode;
};

interface JournalTabProps {
  entityId?: string;
  entityType?: string;
  entries?: JournalEntry[];
}

/**
 * Lightweight, backend-agnostic journal timeline.
 * Designed to work even if a dedicated journal endpoint is not available yet.
 */
export function JournalTab({ entityId, entityType, entries = [] }: JournalTabProps) {
  const { t } = useTranslation();

  const timelineItems = useMemo(() => {
    // If no entries are provided, render a single placeholder node so the UI remains informative.
    if (!entries.length) {
      return [
        {
          title: t('No activity recorded yet'),
          description: entityId
            ? t('Tracking for {{entityType}} {{entityId}} will appear here once events are recorded.', {
                entityType: entityType || t('entity'),
                entityId,
              })
            : t('This section will populate as actions are recorded.'),
          timestamp: undefined,
          color: 'gray',
          icon: <IconInfoCircle size={16} />,
        },
      ];
    }
    return entries;
  }, [entries, entityId, entityType, t]);

  return (
    <Paper p="md" withBorder>
      <Title order={4} mb="md">
        {t('Activity Journal')}
      </Title>

      <Timeline active={timelineItems.length} bulletSize={24} lineWidth={2}>
        {timelineItems.map((item, idx) => (
          <Timeline.Item
            key={idx}
            title={item.title}
            bullet={item.icon || <IconInfoCircle size={16} />}
            color={item.color || 'blue'}
          >
            {item.timestamp && (
              <Text size="xs" c="dimmed" mb={4}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
            )}
            {item.user && (
              <Group gap="xs" mb={4}>
                <Badge size="xs" variant="light">
                  {item.user}
                </Badge>
              </Group>
            )}
            {item.description && (
              <Text size="sm" c="dimmed">
                {item.description}
              </Text>
            )}
          </Timeline.Item>
        ))}
      </Timeline>
    </Paper>
  );
}
