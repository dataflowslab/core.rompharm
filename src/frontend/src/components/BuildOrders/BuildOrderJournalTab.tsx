import { Paper, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export function BuildOrderJournalTab() {
  const { t } = useTranslation();

  return (
    <Paper p="md">
      <Text size="sm" c="dimmed">
        {t('No journal entries')}
      </Text>
    </Paper>
  );
}
