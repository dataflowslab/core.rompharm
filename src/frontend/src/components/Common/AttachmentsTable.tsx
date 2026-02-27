import { Paper, Table, Text, Group, ActionIcon, Anchor, Badge } from '@mantine/core';
import { IconDownload, IconTrash, IconPaperclip } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type Attachment = {
  _id?: string;
  id?: string;
  filename?: string;
  attachment?: string;
  path?: string;
  comment?: string;
  upload_date?: string;
  uploaded_at?: string;
  uploaded_by?: string;
  uploadedBy?: string;
};

interface AttachmentsTableProps {
  attachments: Attachment[];
  onDownload?: (attachment: Attachment) => void;
  onDelete?: (attachment: Attachment) => void;
}

// Convert relative paths to absolute URLs when possible.
const buildAttachmentUrl = (attachment: Attachment) => {
  const rawPath = attachment.attachment || attachment.path;
  if (!rawPath) return null;
  if (rawPath.startsWith('http')) return rawPath;
  const base = window.location.origin;
  return `${base}${rawPath.startsWith('/') ? '' : '/'}${rawPath}`;
};

export function AttachmentsTable({ attachments, onDownload, onDelete }: AttachmentsTableProps) {
  const { t } = useTranslation();

  const rows = useMemo(() => {
    return attachments.map((att, index) => {
      const key = att._id || att.id || `${att.filename || 'attachment'}-${index}`;
      const url = buildAttachmentUrl(att);
      const uploadedAt = att.upload_date || att.uploaded_at;
      const uploadedBy = att.uploaded_by || att.uploadedBy;

      return (
        <Table.Tr key={key}>
          <Table.Td>
            <Group gap="xs">
              <IconPaperclip size={16} />
              {url ? (
                <Anchor href={url} target="_blank" size="sm">
                  {att.filename || att.attachment || t('Attachment')}
                </Anchor>
              ) : (
                <Text size="sm">{att.filename || t('Attachment')}</Text>
              )}
            </Group>
            {att.comment && (
              <Text size="xs" c="dimmed" mt={2}>
                {att.comment}
              </Text>
            )}
          </Table.Td>
          <Table.Td>
            <Group gap="xs">
              {uploadedAt && <Badge variant="light">{uploadedAt}</Badge>}
              {uploadedBy && (
                <Text size="xs" c="dimmed">
                  {uploadedBy}
                </Text>
              )}
            </Group>
          </Table.Td>
          <Table.Td>
            <Group gap="xs">
              {onDownload && (
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  aria-label={t('Download')}
                  onClick={() => onDownload(att)}
                >
                  <IconDownload size={16} />
                </ActionIcon>
              )}
              {onDelete && (
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={t('Delete')}
                  onClick={() => onDelete(att)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              )}
            </Group>
          </Table.Td>
        </Table.Tr>
      );
    });
  }, [attachments, onDelete, onDownload, t]);

  return (
    <Paper p="md" withBorder>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('File')}</Table.Th>
            <Table.Th>{t('Uploaded')}</Table.Th>
            <Table.Th style={{ width: 80 }}>{t('Actions')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {attachments.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={3}>
                <Text size="sm" c="dimmed">
                  {t('No attachments')}
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
