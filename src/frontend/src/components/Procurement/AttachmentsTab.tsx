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
  Modal,
  Button,
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
  _id: string;
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
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<Attachment | null>(null);

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

  const openDeleteModal = (attachment: Attachment) => {
    setAttachmentToDelete(attachment);
    setDeleteModalOpened(true);
  };

  const confirmDelete = async () => {
    if (!attachmentToDelete) return;

    try {
      await api.delete(procurementApi.deleteAttachment(orderId, attachmentToDelete._id));
      notifications.show({
        title: t('Success'),
        message: t('Attachment deleted successfully'),
        color: 'green'
      });
      setDeleteModalOpened(false);
      setAttachmentToDelete(null);
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

  // Helper function to get full attachment URL
  const getAttachmentUrl = (attachment: Attachment) => {
    // Debug logging
    console.log('[AttachmentURL] Processing attachment:', {
      _id: attachment._id,
      filename: attachment.filename,
      attachment: attachment.attachment,
      fullAttachment: attachment
    });

    // Safety check
    if (!attachment.attachment) {
      console.warn('[AttachmentURL] No attachment path found, returning #');
      return '#';
    }
    
    // If attachment path starts with http, return as is
    if (attachment.attachment.startsWith('http')) {
      console.log('[AttachmentURL] Full URL detected:', attachment.attachment);
      return attachment.attachment;
    }
    
    // Otherwise, prepend base URL
    const baseUrl = window.location.origin;
    const fullUrl = `${baseUrl}${attachment.attachment.startsWith('/') ? '' : '/'}${attachment.attachment}`;
    console.log('[AttachmentURL] Constructed URL:', fullUrl);
    return fullUrl;
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
              {attachments.map((attachment) => {
                const attachmentUrl = getAttachmentUrl(attachment);
                return (
                  <Paper key={attachment._id} p="sm" withBorder>
                    <Group justify="space-between">
                      <Group>
                        <IconFile size={20} />
                        <div>
                          <Anchor 
                            href={attachmentUrl} 
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
                          href={attachmentUrl}
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
                            onClick={() => openDeleteModal(attachment)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Grid.Col>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title={t('Delete Attachment')}
        centered
      >
        <Text size="sm" mb="md">
          {t('Are you sure you want to delete this attachment?')}
        </Text>
        {attachmentToDelete && (
          <Text size="sm" fw={500} mb="lg">
            {attachmentToDelete.filename}
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteModalOpened(false)}>
            {t('Cancel')}
          </Button>
          <Button color="red" onClick={confirmDelete}>
            {t('Delete')}
          </Button>
        </Group>
      </Modal>
    </Grid>
  );
}
