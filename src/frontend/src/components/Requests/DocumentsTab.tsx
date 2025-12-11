import { useState, useEffect } from 'react';
import { Paper, Title, Text, Button, Group, Badge, Stack } from '@mantine/core';
import { IconFileText, IconDownload, IconRefresh } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';

interface GeneratedDocument {
  _id: string;
  job_id: string;
  template_code: string;
  template_name: string;
  status: string;
  filename: string;
  version: number;
  created_at: string;
  error?: string;
}

interface DocumentsTabProps {
  requestId: string;
}

export function DocumentsTab({ requestId }: DocumentsTabProps) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, [requestId]);

  const loadDocuments = async () => {
    try {
      const response = await api.get(`/api/documents/stock-request/${requestId}`);
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post(`/api/documents/stock-request/generate`, {
        request_id: requestId,
        template_code: '6LL5WVTR8BTY'
      });

      notifications.show({
        title: t('Success'),
        message: t('Document generation started'),
        color: 'green'
      });

      // Reload documents after 2 seconds
      setTimeout(() => {
        loadDocuments();
      }, 2000);
    } catch (error: any) {
      console.error('Failed to generate document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to generate document'),
        color: 'red'
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (jobId: string, filename: string) => {
    try {
      const response = await api.get(
        `/api/documents/stock-request/${requestId}/job/${jobId}/download`,
        { responseType: 'blob' }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      notifications.show({
        title: t('Success'),
        message: t('Document downloaded successfully'),
        color: 'green'
      });
    } catch (error: any) {
      console.error('Failed to download document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to download document'),
        color: 'red'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'processing': return 'blue';
      case 'queued': return 'gray';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return <Paper p="md"><Text>{t('Loading...')}</Text></Paper>;
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>{t('Documents')}</Title>
        <Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="subtle"
            onClick={loadDocuments}
            size="sm"
          >
            {t('Refresh')}
          </Button>
          <Button
            leftSection={<IconFileText size={16} />}
            onClick={handleGenerate}
            loading={generating}
          >
            {t('Generate Document')}
          </Button>
        </Group>
      </Group>

      {documents.length === 0 ? (
        <Text size="sm" c="dimmed">{t('No documents generated yet')}</Text>
      ) : (
        <Stack gap="sm">
          {documents.map((doc) => (
            <Paper key={doc._id} p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Group gap="xs" mb="xs">
                    <Text fw={500}>{doc.template_name || 'Fisa de solicitare'}</Text>
                    <Badge color={getStatusColor(doc.status)}>{doc.status}</Badge>
                    <Text size="xs" c="dimmed">v{doc.version}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {t('Created')}: {formatDate(doc.created_at)}
                  </Text>
                  {doc.error && (
                    <Text size="xs" c="red" mt="xs">
                      {t('Error')}: {doc.error}
                    </Text>
                  )}
                </div>
                {doc.status === 'completed' && (
                  <Button
                    leftSection={<IconDownload size={16} />}
                    onClick={() => handleDownload(doc.job_id, doc.filename)}
                    size="sm"
                  >
                    {t('Download')}
                  </Button>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
