import { Paper, Group, Text, Button, Stack, SimpleGrid } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';

export interface GeneratedDocumentEntry {
  id: string;
  template_code: string;
  template_name: string;
  file_hash?: string;
  filename?: string;
  generated_at?: string;
}

interface DocumentGenerationWidgetProps {
  documents: GeneratedDocumentEntry[];
  onGenerate: (templateCode: string) => void;
  onDownload: (doc: GeneratedDocumentEntry) => void;
  generating?: string | null;
  title?: string;
}

export function DocumentGenerationWidget({
  documents,
  onGenerate,
  onDownload,
  generating,
  title = 'Generare documente',
}: DocumentGenerationWidgetProps) {
  const formatDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ro-RO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!documents || documents.length === 0) {
    return null;
  }

  return (
    <Stack gap="sm">
      <Text fw={700}>{title}</Text>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        {documents.map((doc) => {
          const hasFile = Boolean(doc.file_hash);
          const isGenerating = generating === doc.template_code;
          return (
            <Paper key={doc.id || doc.template_code} withBorder p="md">
              <Stack gap="sm">
                <Group gap="xs">
                  <IconDownload size={16} />
                  <Text fw={600}>{doc.template_name || doc.template_code}</Text>
                </Group>

                <Button
                  variant="light"
                  size="sm"
                  onClick={() => onGenerate(doc.template_code)}
                  loading={isGenerating}
                >
                  Genereaza
                </Button>

                {hasFile ? (
                  <Stack gap={4}>
                    <Button
                      size="sm"
                      leftSection={<IconDownload size={16} />}
                      onClick={() => onDownload(doc)}
                    >
                      Descarca
                    </Button>
                    {doc.generated_at && (
                      <Text size="xs" c="dimmed">
                        Generat la {formatDate(doc.generated_at)}
                      </Text>
                    )}
                  </Stack>
                ) : (
                  <Text size="xs" c="dimmed">
                    Document negenerat
                  </Text>
                )}
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
