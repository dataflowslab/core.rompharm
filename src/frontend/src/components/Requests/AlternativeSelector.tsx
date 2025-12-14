import { Radio, Stack, Text, Paper, Group, Badge } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface Alternative {
  id: number;
  name: string;
  quantity: number;
}

interface AlternativeSelectorProps {
  alternatives: Alternative[];
  selectedId: number | null;
  onChange: (id: number) => void;
}

export function AlternativeSelector({ alternatives, selectedId, onChange }: AlternativeSelectorProps) {
  const { t } = useTranslation();

  if (!alternatives || alternatives.length === 0) {
    return null;
  }

  return (
    <Paper p="sm" withBorder>
      <Text size="sm" fw={500} mb="xs">
        {t('Select Alternative')}:
      </Text>
      <Radio.Group value={selectedId ? String(selectedId) : ''} onChange={(value) => onChange(parseInt(value))}>
        <Stack gap="xs">
          {alternatives.map((alt) => (
            <Radio
              key={alt.id}
              value={String(alt.id)}
              label={
                <Group gap="xs">
                  <Text size="sm">{alt.name}</Text>
                  <Badge size="sm" variant="light">
                    {t('Qty')}: {alt.quantity}
                  </Badge>
                </Group>
              }
            />
          ))}
        </Stack>
      </Radio.Group>
    </Paper>
  );
}
