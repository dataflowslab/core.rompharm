import { useState, useEffect } from 'react';
import { Paper, Stack, Group, Title, Text, Button, Badge, ActionIcon } from '@mantine/core';
import { IconFileTypePdf, IconDownload, IconRefresh } from '@tabler/icons-react';
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
  const [documents, setDocuments] = useState<Record<string, GeneratedDocument>>({});
  const [loadingDocs, setLoadingDocs] = useState<Record<string, boolean>>({});
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadDocuments();
  }, [entityId]);

  const loadDocuments = async () => {
    try {
      const response = await api.get(`/api/documents/${entityType}/${entityId}`);
      const docs = response.data || [];
      
      // Convert array to object keyed by template_code (only keep latest per template)
      const docsMap: Record<string, GeneratedDocument> = {};
      docs.forEach((doc: GeneratedDocument) => {
        if (!docsMap[doc.template_code] || doc.version > docsMap[doc.template_code].version) {
          docsMap[doc.template_code] = doc;
        }
      });
      
      setDocuments(docsMap);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const checkDocumentStatus = async (templateCode: string, jobId: string) => {
    setCheckingStatus(prev => ({ ...prev, [templateCode]: true }));
    try {
      const response = await api.get(`/api/documents/${entityType}/${entityId}/job/${jobId}/status`);
      const status = response.data;
      
      // Update document in state
      setDocuments(prev => ({
        ...prev,
        [templateCode]: { ...prev[templateCode], ...status }
      }));
      
      // If done, try to download automatically
      if (status.status === 'done' || status.has_document) {
        await handleDownloadDocument(templateCode);
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    } finally {
      setCheckingStatus(prev => ({ ...prev, [templateCode]: false }));
    }
  };

  const handleGenerateDocument = async (template: DocumentTemplate) => {
    setGeneratingDoc(template.code);
    
    try {
      // Delete old document if exists
      const existingDoc = documents[template.code];
      if (existingDoc) {
        try {
          await api.delete(`/api/documents/${entityType}/${entityId}/job/${existingDoc.job_id}`);
        } catch (error) {
          console.error('Failed to delete old document:', error);
        }
      }
      
      // Generate new document
      const response = await api.post(`/api/documents/${entityType}/generate`, {
        [entityType === 'procurement-order' ? 'order_id' : 'request_id']: entityId,
        template_code: template.code,
        template_name: template.name,
      });
      
      const jobData = response.data;
      
      notifications.show({
        title: t('Success'),
        message: t('Document generation started'),
        color: 'green',
      });
      
      // Update state with new job
      setDocuments(prev => ({
        ...prev,
        [template.code]: {
          _id: jobData.job_id,
          job_id: jobData.job_id,
          template_code: template.code,
          template_name: template.name,
          status: jobData.status || 'queued',
          filename: jobData.filename || `${template.name}.pdf`,
          version: 1,
          created_at: new Date().toISOString(),
          created_by: '',
          has_document: false
        }
      }));
      
      // Check status immediately after 1 second
      setTimeout(() => {
        checkDocumentStatus(template.code, jobData.job_id);
      }, 1000);
      
      if (onDocumentGenerated) {
        onDocumentGenerated();
      }
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

  const handleDownloadDocument = async (templateCode: string) => {
    const doc = documents[templateCode];
    if (!doc) return;
    
    setLoadingDocs(prev => ({ ...prev, [templateCode]: true }));
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
      
      notifications.show({
        title: t('Success'),
        message: t('Document downloaded'),
        color: 'green',
      });
    } catch (error: any) {
      console.error('Failed to download document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to download document'),
        color: 'red',
      });
    } finally {
      setLoadingDocs(prev => ({ ...prev, [templateCode]: false }));
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
        <Title order={5}>{t('Documents')}</Title>

        {/* Document Templates */}
        <Stack gap="sm">
          {templates.map((template) => {
            const doc = documents[template.code];
            const isGenerating = generatingDoc === template.code;
            const isChecking = checkingStatus[template.code];
            const isDownloading = loadingDocs[template.code];
            
            return (
              <Paper key={template.code} p="sm" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>{template.label}</Text>
                    {doc && !doc.has_document && doc.status !== 'failed' && (
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => checkDocumentStatus(template.code, doc.job_id)}
                        loading={isChecking}
                        title={t('Check status')}
                      >
                        <IconRefresh size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                  
                  {/* Generate button - always visible */}
                  <Button
                    variant="light"
                    size="sm"
                    fullWidth
                    onClick={() => handleGenerateDocument(template)}
                    loading={isGenerating}
                    leftSection={<IconFileTypePdf size={16} />}
                    disabled={template.disabled}
                  >
                    {template.label}
                  </Button>
                  
                  {template.disabled && template.disabledMessage && (
                    <Text size="xs" c="dimmed">{template.disabledMessage}</Text>
                  )}
                  
                  {/* Status and action buttons */}
                  {doc && (
                    <Stack gap="xs">
                      {doc.status === 'failed' ? (
                        <Badge size="sm" color="red" fullWidth>
                          {t('Failed')}: {doc.error || t('Unknown error')}
                        </Badge>
                      ) : !doc.has_document && doc.status !== 'done' ? (
                        <>
                          <Badge size="sm" color={getStatusColor(doc.status)} fullWidth>
                            {doc.status === 'processing' ? t('Processing...') : t('Queued')}
                          </Badge>
                          <Text size="xs" c="dimmed" ta="center">
                            {t('Click refresh icon to check status')}
                          </Text>
                        </>
                      ) : doc.has_document ? (
                        // Document ready - show download and delete buttons
                        <Group gap="xs" grow>
                          <Button
                            size="sm"
                            variant="outline"
                            leftSection={<IconDownload size={14} />}
                            onClick={() => handleDownloadDocument(template.code)}
                            loading={isDownloading}
                          >
                            {t('Download')}
                          </Button>
                        </Group>
                      ) : null}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Stack>
    </Paper>
  );
}
