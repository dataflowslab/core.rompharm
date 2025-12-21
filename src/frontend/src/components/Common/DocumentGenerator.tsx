import { useState, useEffect } from 'react';
import { Button, Group, Stack, Badge, Text, ActionIcon } from '@mantine/core';
import { IconFileTypePdf, IconDownload, IconRefresh, IconCheck, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import api from '../../services/api';

interface DocumentJob {
  job_id: string;
  template_code: string;
  template_name: string;
  status: string;
  filename?: string;
  last_checked?: string;
  error?: string;
}

interface DocumentGeneratorProps {
  objectId: string;
  templateCodes: string[];  // Array of template codes to show as buttons
  templateNames?: Record<string, string>;  // Optional mapping of code -> name
  onDocumentsChange?: (documents: Record<string, DocumentJob>) => void;
}

export function DocumentGenerator({ objectId, templateCodes, templateNames, onDocumentsChange }: DocumentGeneratorProps) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Record<string, DocumentJob>>({});
  const [templates, setTemplates] = useState<Record<string, { code: string; name: string }>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (templateCodes.length > 0) {
      loadTemplates();
      loadDocuments();
    }
  }, [objectId, templateCodes]);

  const loadTemplates = async () => {
    // If templateNames provided, use them directly
    if (templateNames) {
      console.log('[DocumentGenerator] Using provided template names:', templateNames);
      const templatesMap: Record<string, { code: string; name: string }> = {};
      templateCodes.forEach(code => {
        templatesMap[code] = {
          code: code,
          name: templateNames[code] || code
        };
      });
      setTemplates(templatesMap);
      return;
    }

    // Otherwise, try to load from API
    try {
      const response = await api.get('/api/documents/templates');
      console.log('[DocumentGenerator] Templates from API:', response.data);
      
      const templatesMap: Record<string, { code: string; name: string }> = {};
      
      response.data.forEach((template: any) => {
        if (templateCodes.includes(template.code)) {
          templatesMap[template.code] = {
            code: template.code,
            name: template.name
          };
        }
      });
      
      console.log('[DocumentGenerator] Filtered templates:', templatesMap);
      console.log('[DocumentGenerator] Requested codes:', templateCodes);
      
      // Fallback: if template not found in API, use code as name
      templateCodes.forEach(code => {
        if (!templatesMap[code]) {
          console.warn(`[DocumentGenerator] Template ${code} not found in API, using fallback`);
          templatesMap[code] = {
            code: code,
            name: code
          };
        }
      });
      
      setTemplates(templatesMap);
    } catch (error) {
      console.error('[DocumentGenerator] Failed to load templates:', error);
      
      // Fallback: use template codes as names
      const fallbackMap: Record<string, { code: string; name: string }> = {};
      templateCodes.forEach(code => {
        fallbackMap[code] = { code, name: code };
      });
      setTemplates(fallbackMap);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await api.get(`/api/documents/for/${objectId}`);
      const docs = response.data || [];
      
      const docsMap: Record<string, DocumentJob> = {};
      docs.forEach((doc: any) => {
        if (templateCodes.includes(doc.template_code)) {
          docsMap[doc.template_code] = {
            job_id: doc.job_id,
            template_code: doc.template_code,
            template_name: doc.template_name,
            status: doc.status,
            filename: doc.filename,
            last_checked: doc.updated_at,
            error: doc.error
          };
        }
      });
      
      setDocuments(docsMap);
      
      if (onDocumentsChange) {
        onDocumentsChange(docsMap);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const generateDocument = async (templateCode: string) => {
    setGenerating(prev => ({ ...prev, [templateCode]: true }));
    
    try {
      const template = templates[templateCode];
      if (!template) {
        throw new Error('Template not found');
      }

      const response = await api.post('/api/documents/generate', {
        object_id: objectId,
        template_code: templateCode,
        template_name: template.name
      });

      const newDoc: DocumentJob = {
        job_id: response.data.job_id,
        template_code: templateCode,
        template_name: template.name,
        status: response.data.status || 'queued',
        filename: response.data.filename,
        last_checked: new Date().toISOString()
      };

      setDocuments(prev => {
        const updated = { ...prev, [templateCode]: newDoc };
        if (onDocumentsChange) {
          onDocumentsChange(updated);
        }
        return updated;
      });

      notifications.show({
        title: t('Success'),
        message: t('Document generation started'),
        color: 'green'
      });

      // Auto-check after 2 seconds
      setTimeout(() => checkStatus(templateCode, response.data.job_id), 2000);
    } catch (error: any) {
      console.error('Failed to generate document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to generate document'),
        color: 'red'
      });
    } finally {
      setGenerating(prev => ({ ...prev, [templateCode]: false }));
    }
  };

  const checkStatus = async (templateCode: string, jobId: string) => {
    setChecking(prev => ({ ...prev, [templateCode]: true }));
    
    try {
      const response = await api.get(`/api/documents/job/${jobId}/status`);
      const status = response.data;

      setDocuments(prev => {
        const updated = {
          ...prev,
          [templateCode]: {
            ...prev[templateCode],
            status: status.status,
            error: status.error,
            last_checked: new Date().toISOString()
          }
        };
        
        if (onDocumentsChange) {
          onDocumentsChange(updated);
        }
        
        return updated;
      });

      // If still processing, check again after 3 seconds
      if (status.status === 'processing' || status.status === 'queued') {
        setTimeout(() => checkStatus(templateCode, jobId), 3000);
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    } finally {
      setChecking(prev => ({ ...prev, [templateCode]: false }));
    }
  };

  const downloadDocument = async (templateCode: string) => {
    const doc = documents[templateCode];
    if (!doc) return;

    try {
      const response = await api.get(`/api/documents/${doc.job_id}/download`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.filename || 'document.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      notifications.show({
        title: t('Success'),
        message: t('Document downloaded'),
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

  const deleteDocument = async (templateCode: string) => {
    const doc = documents[templateCode];
    if (!doc) return;

    try {
      await api.delete(`/api/documents/${doc.job_id}`);

      setDocuments(prev => {
        const updated = { ...prev };
        delete updated[templateCode];
        
        if (onDocumentsChange) {
          onDocumentsChange(updated);
        }
        
        return updated;
      });

      notifications.show({
        title: t('Success'),
        message: t('Document deleted'),
        color: 'green'
      });
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete document'),
        color: 'red'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      done: 'green',
      completed: 'green',
      processing: 'blue',
      queued: 'gray',
      failed: 'red'
    };

    return (
      <Badge size="xs" color={colors[status] || 'gray'}>
        {status}
      </Badge>
    );
  };

  return (
    <Stack gap="xs">
      {templateCodes.map(templateCode => {
        const template = templates[templateCode];
        const doc = documents[templateCode];
        const isGenerating = generating[templateCode];
        const isChecking = checking[templateCode];

        if (!template) {
          return null;
        }

        return (
          <Stack key={templateCode} gap={4}>
            {/* Generate Button - Always visible */}
            <Button
              size="xs"
              variant="light"
              leftSection={<IconFileTypePdf size={14} />}
              onClick={() => generateDocument(templateCode)}
              loading={isGenerating}
              fullWidth
            >
              {template.name}
            </Button>

            {/* Document Status and Actions - Only when document exists */}
            {doc && (
              <Group gap="xs" wrap="nowrap">
                <Group gap="xs" style={{ flex: 1 }} wrap="nowrap">
                  <Text size="xs" c="dimmed">Status:</Text>
                  {getStatusBadge(doc.status)}
                </Group>

                <Group gap={4} wrap="nowrap">
                  {/* Check Status Button */}
                  {doc.status !== 'done' && doc.status !== 'completed' && doc.status !== 'failed' && (
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => checkStatus(templateCode, doc.job_id)}
                      loading={isChecking}
                      title={t('Check status')}
                    >
                      <IconRefresh size={14} />
                    </ActionIcon>
                  )}

                  {/* Download Button */}
                  {(doc.status === 'done' || doc.status === 'completed') && (
                    <ActionIcon
                      size="sm"
                      variant="filled"
                      color="green"
                      onClick={() => downloadDocument(templateCode)}
                      title={t('Download')}
                    >
                      <IconDownload size={14} />
                    </ActionIcon>
                  )}

                  {/* Delete Button */}
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={() => deleteDocument(templateCode)}
                    title={t('Delete')}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              </Group>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}
