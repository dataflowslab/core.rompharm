import { useState } from 'react';
import {
  Title,
  Paper,
  Group,
  Text,
  Stack,
  ActionIcon,
  Anchor,
  Grid,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import {
  IconUpload,
  IconFile,
  IconExternalLink,
  IconTrash,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import api from '../../services/api';
import { procurementApi } from '../../services/procurement';

interface Attachment {
  pk: number;
  attachment: string;
  filename: string;
  comment: string;
  upload_date: string;
}

interface AttachmentsTabProps {
  orderId: string;
  attachments: Attachment[];
  onReload: () => void;
  canEdit: boolean;
}

export function AttachmentsTab({ orderId, attachments, onReload, canEdit }: AttachmentsTabProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    const file = files[0];

    try {
      const formData = new FormData();
      formData.append('file', file);

      await api.post(procurementApi.uploadAttachment(orderId), formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      notifications.show({
        title: t('Success'),
        message: t('File uploaded successfully'),
        color: 'green'
      });

      onReload();
    } catch (error: any) {
      console.error('Failed to upload file:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to upload file'),
        color: 'red'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm(t('Are you sure you want to delete this attachment?'))) return;

    try {
      await api.delete(procurementApi.deleteAttachment(orderId, attachmentId));
      notifications.show({
        title: t('Success'),
        message: t('Attachment deleted successfully'),
        color: 'green'
      });
      onReload();
    } catch (error: any) {
      console.error('Failed to delete attachment:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete attachment'),
        color: 'red'
      });
    }
  };

  return (
    <Grid>
      {canEdit && (
        <Grid.Col span={4}>
          <Paper p="md" withBorder>
            <Title order={5} mb="md">{t('Upload File')}</Title>
            <Dropzone
              onDrop={handleFileUpload}
              loading={uploading}
              maxSize={10 * 1024 * 1024}
            >
              <Group justify="center" gap="xl" style={{ minHeight: 120, pointerEvents: 'none' }}>
                <div style={{ textAlign: 'center' }}>
                  <IconUpload size={50} stroke={1.5} />
                  <Text size="sm" mt="xs">
                    {t('Drag files here or click to select')}
                  </Text>
                  <Text size="xs" c="dimmed" mt={7}>
                    {t('Max file size: 10MB')}
                  </Text>
                </div>
              </Group>
            </Dropzone>
          </Paper>
        </Grid.Col>
      )}

      <Grid.Col span={canEdit ? 8 : 12}>
        <Paper p="md" withBorder>
          <Title order={5} mb="md">{t('Attachments')}</Title>
          {attachments.length === 0 ? (
            <Text size="sm" c="dimmed">{t('No attachments')}</Text>
          ) : (
            <Stack gap="xs">
              {attachments.map((attachment) => (
                <Paper key={attachment.pk} p="sm" withBorder>
                  <Group justify="space-between">
                    <Group>
                      <IconFile size={20} />
                      <div>
                        <Anchor 
                          href={attachment.attachment} 
                          target="_blank"
                          size="sm"
                        >
                          {attachment.filename}
                        </Anchor>
                        {attachment.comment && (
                          <Text size="xs" c="dimmed">{attachment.comment}</Text>
                        )}
                      </div>
                    </Group>
                    <Group gap="xs">
                      <ActionIcon
                        component="a"
                        href={attachment.attachment}
                        target="_blank"
                        variant="subtle"
                        color="blue"
                      >
                        <IconExternalLink size={16} />
                      </ActionIcon>
                      {canEdit && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteAttachment(attachment.pk)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Grid.Col>
    </Grid>
  );
}
