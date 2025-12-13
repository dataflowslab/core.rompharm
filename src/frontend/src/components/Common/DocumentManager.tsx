import { useState, useEffect } from 'react';
import { Paper, Stack, Group, Title, Text, Button, Badge, Loader, ActionIcon } from '@mantine/core';
import { IconFileTypePdf, IconDownload, IconRefresh, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import api from '../../services/api';

interface GeneratedDocument {
  _id: string;
  job_id: string;
  template_code: string;
  template_name: string;
  status: string;
  filename: string;
  version: number;
  created_at: string;
  created_by: string;
  error?: string;
  has_document?: boolean;
}

interface DocumentTemplate {
  code: string;
  name: string;
  label: string;
  disabled?: boolean;
  disabledMessage?: string;
}

interface DocumentManagerProps {
  entityId: string | number;
  entityType: 'procurement-order' | 'stock-request';
  templates: DocumentTemplate[];
  onDocumentGenerated?: () => void;
}

export function DocumentManager({ entityId, entityType, templates, onDocumentGenerated }: DocumentManagerProps) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [entityId]);

  const loadDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const response = await api.get(`/api/documents/${entityType}/${entityId}`);
      const docs = response.data || [];
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleGenerateDocument = async (template: DocumentTemplate) => {
    setGeneratingDoc(template.code);
    try {
      await api.post(`/api/documents/${entityType}/generate`, {
        [entityType === 'procurement-order' ? 'order_id' : 'request_id']: entityId,
        template_code: template.code,
        template_name: template.name,
      });
      
      notifications.show({
        title: t('Success'),
        message: t('Document generation started'),
        color: 'green',
      });
      
      // Reload documents after a short delay
      setTimeout(() => {
        loadDocuments();
        if (onDocumentGenerated) {
          onDocumentGenerated();
        }
      }, 1500);
    } catch (error: any) {
      console.error('Failed to generate document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to generate document'),
        color: 'red',
      });
    } finally {
      setGeneratingDoc(null);
    }
  };

  const handleDeleteDocument = async (doc: GeneratedDocument) => {
    if (!confirm(t('Are you sure you want to delete this document?'))) {
      return;
    }

    try {
      await api.delete(`/api/documents/${entityType}/${entityId}/job/${doc.job_id}`);
      
      notifications.show({
        title: t('Success'),
        message: t('Document deleted'),
        color: 'green',
      });
      
      loadDocuments();
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete document'),
        color: 'red',
      });
    }
  };

  const handleDownloadDocument = async (doc: GeneratedDocument) => {
    try {
      const response = await api.get(
        `/api/documents/${entityType}/${entityId}/job/${doc.job_id}/download`,
        { responseType: 'blob' }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Failed to download document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to download document'),
        color: 'red',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
      case 'completed':
        return 'green';
      case 'processing':
        return 'blue';
      case 'queued':
        return 'gray';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Paper p="md" withBorder style={{ height: '100%' }}>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={5}>{t('Documents')}</Title>
          <ActionIcon
            variant="subtle"
            onClick={loadDocuments}
            loading={loadingDocuments}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>

        {/* Generate Document Buttons */}
        <div>
          <Text size="sm" fw={500} mb="xs">{t('Generate Document')}</Text>
          <Stack gap="xs">
            {templates.map((template) => (
              <Button
                key={template.code}
                variant="light"
                size="sm"
                fullWidth
                onClick={() => handleGenerateDocument(template)}
                loading={generatingDoc === template.code}
                leftSection={<IconFileTypePdf size={16} />}
                disabled={template.disabled}
              >
                {template.label}
              </Button>
            ))}
            {templates.some(t => t.disabled && t.disabledMessage) && (
              <Text size="xs" c="dimmed">
                {templates.find(t => t.disabled)?.disabledMessage}
              </Text>
            )}
          </Stack>
        </div>

        {/* Generated Documents */}
        <div>
          <Text size="sm" fw={500} mb="xs">{t('Generated')}</Text>
          {loadingDocuments ? (
            <Loader size="sm" />
          ) : documents.length === 0 ? (
            <Text size="xs" c="dimmed">{t('No documents generated')}</Text>
          ) : (
            <Stack gap="sm">
              {documents.map((doc) => (
                <Paper key={doc._id} p="sm" withBorder>
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>
                      {doc.template_name}
                    </Text>
                    {doc.has_document ? (
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          fullWidth
                          leftSection={<IconDownload size={14} />}
                          onClick={() => handleDownloadDocument(doc)}
                        >
                          {t('Download')}
                        </Button>
                        <ActionIcon
                          size="lg"
                          variant="light"
                          color="red"
                          onClick={() => handleDeleteDocument(doc)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    ) : doc.status === 'failed' ? (
                      <Badge size="sm" color="red" fullWidth>
                        {t('Failed')}
                      </Badge>
                    ) : (
                      <Badge size="sm" color={getStatusColor(doc.status)} fullWidth>
                        {doc.status === 'processing' ? t('Processing...') : t('Queued')}
                      </Badge>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </div>
      </Stack>
    </Paper>
  );
}
