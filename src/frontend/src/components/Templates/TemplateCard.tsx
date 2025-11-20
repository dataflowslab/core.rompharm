import { Card, Stack, Group, Text, Badge, Paper, Button } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface Template {
  code: string;
  name: string;
  description?: string;
  parts: number;
  types: string[];
  created_at?: string;
  updated_at?: string;
}

interface TemplateCardProps {
  template: Template;
  onEdit: (code: string, type: string) => void;
  onDelete: (code: string, type: string) => void;
  getBadgeColor: (type: string) => string;
}

export function TemplateCard({ template, onEdit, onDelete, getBadgeColor }: TemplateCardProps) {
  const { t } = useTranslation();

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <div>
            <Text size="lg" fw={700}>{template.name}</Text>
            <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
              {template.code}
            </Text>
            {template.description && (
              <Text size="sm" c="dimmed" mt={4}>
                {template.description}
              </Text>
            )}
          </div>
          <Badge size="lg" variant="light">
            {template.parts} {template.parts === 1 ? 'part' : 'parts'}
          </Badge>
        </Group>

        <Paper p="sm" withBorder>
          <Text size="sm" fw={500} mb="xs">{t('Template Parts')}:</Text>
          <Group gap="xs">
            {template.types.map((type) => (
              <Group key={type} gap={4}>
                <Badge 
                  color={getBadgeColor(type)}
                  variant="filled"
                  style={{ cursor: 'pointer' }}
                >
                  {type}
                </Badge>
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<IconEdit size={14} />}
                  onClick={() => onEdit(template.code, type)}
                >
                  {t('Edit')}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => onDelete(template.code, type)}
                >
                  {t('Delete')}
                </Button>
              </Group>
            ))}
          </Group>
        </Paper>

        {template.updated_at && (
          <Text size="xs" c="dimmed">
            {t('Last updated')}: {new Date(template.updated_at).toLocaleString('ro-RO')}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
