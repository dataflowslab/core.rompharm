import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Group,
  Stack,
  Text,
  Badge,
  Button,
  Select,
  Textarea,
  Checkbox,
  Loader,
  Alert,
  Divider,
  Grid,
  Accordion,
  ActionIcon,
} from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import { IconArrowLeft, IconAlertCircle, IconFileText, IconUpload, IconX, IconTrash, IconExternalLink } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';

interface Submission {
  id: string;
  form_id: string;
  form_slug?: string;
  form_title?: string;
  data: any;
  submitted_by?: string;
  submitted_at: string;
  state: string;
  state_updated_at?: string;
  state_updated_by?: string;
  notes?: string;
}

interface FormSchema {
  properties?: Record<string, { title?: string; type?: string }>;
}

interface FormTemplate {
  code: string;
  name: string;
  parts?: Array<{ type: string; name: string }>;
}

interface UploadedDocument {
  id: string;
  filename: string;
  hash: string;
  size: number;
  uploaded_at: string;
}

interface StateHistory {
  id: string;
  state: string;
  changed_by: string;
  notes: string;
  created_at: string;
}

const STATE_COLORS: Record<string, string> = {
  new: 'blue',
  in_review: 'yellow',
  approved: 'green',
  rejected: 'red',
  cancelled: 'gray'
};

const STATE_LABELS: Record<string, string> = {
  new: 'Nou',
  in_review: 'În analiză',
  approved: 'Aprobat',
  rejected: 'Respins',
  cancelled: 'Anulat'
};

export function SubmissionDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [history, setHistory] = useState<StateHistory[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  
  const [selectedState, setSelectedState] = useState('');
  const [notes, setNotes] = useState('');
  const [notifyAuthor, setNotifyAuthor] = useState(false);
  const [regenerate, setRegenerate] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string | null>('state');
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<any>(null);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (submissionId) {
      loadSubmission();
      loadHistory();
      loadUploadedDocuments();
      loadApprovalStatus();
    }
  }, [submissionId]);

  // Load accordion state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('submission-accordion-state');
    if (stored) {
      try {
        const { value, timestamp } = JSON.parse(stored);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (now - timestamp < twentyFourHours) {
          setAccordionValue(value);
        } else {
          localStorage.removeItem('submission-accordion-state');
        }
      } catch (e) {
        console.error('Failed to parse accordion state:', e);
      }
    }
  }, []);

  // Save accordion state to localStorage
  const handleAccordionChange = (value: string | null) => {
    setAccordionValue(value);
    if (value) {
      localStorage.setItem('submission-accordion-state', JSON.stringify({
        value,
        timestamp: Date.now()
      }));
    }
  };

  const loadSubmission = async () => {
    try {
      const response = await api.get(`/api/data/submission/${submissionId}`);
      setSubmission(response.data);
      setSelectedState(response.data.state);
      setNotes(response.data.notes || '');
      
      // Load form to get template codes
      if (response.data.form_slug) {
        loadFormTemplates(response.data.form_slug);
      }
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to load submission'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFormTemplates = async (slug: string) => {
    try {
      console.log('[TEMPLATES] Loading form templates for slug:', slug);
      const formResponse = await api.get(`/api/forms/${slug}`);
      const templateCodes = formResponse.data.template_codes || [];
      
      console.log('[TEMPLATES] Form template_codes:', templateCodes);
      
      // Store form schema for field labels
      setFormSchema(formResponse.data.json_schema || null);
      
      if (templateCodes.length > 0) {
        // Load each template individually to get full details including parts
        console.log('[TEMPLATES] Loading template details individually...');
        const formTemplates: FormTemplate[] = [];
        
        for (const code of templateCodes) {
          try {
            console.log(`[TEMPLATES] Loading template ${code}...`);
            const templateResponse = await api.get(`/api/templates/${code}`);
            const template = templateResponse.data;
            
            console.log(`[TEMPLATES] Template ${code} response:`, template);
            
            // Find base part to get the template name
            const basePart = template.parts?.find((p: any) => p.type === 'base');
            const templateName = basePart?.name || template.name || code;
            
            console.log(`[TEMPLATES] Template ${code} - base part name: ${templateName}`);
            
            formTemplates.push({
              code: template.code,
              name: templateName,
              parts: template.parts || []
            });
          } catch (error) {
            console.error(`[TEMPLATES] Failed to load template ${code}:`, error);
          }
        }
        
        console.log('[TEMPLATES] Final form templates:', formTemplates);
        setTemplates(formTemplates);
      } else {
        console.log('[TEMPLATES] No template codes found for this form');
      }
    } catch (error) {
      console.error('[TEMPLATES] Failed to load templates:', error);
    }
  };

  const loadUploadedDocuments = async () => {
    try {
      const response = await api.get(`/api/data/submission/${submissionId}/documents`);
      setUploadedDocs(response.data || []);
    } catch (error) {
      console.error('Failed to load uploaded documents:', error);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        await api.post(`/api/data/submission/${submissionId}/upload-document`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      notifications.show({
        title: t('Success'),
        message: t('Documents uploaded successfully'),
        color: 'green'
      });
      
      loadUploadedDocuments();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to upload documents'),
        color: 'red'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await api.delete(`/api/data/submission/${submissionId}/document/${docId}`);
      
      notifications.show({
        title: t('Success'),
        message: t('Document deleted successfully'),
        color: 'green'
      });
      
      loadUploadedDocuments();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete document'),
        color: 'red'
      });
    }
  };

  const handleGenerateDocument = async (templateCode: string, templateName: string) => {
    setGenerating(templateCode);
    try {
      console.log('[GENERATE] Starting document generation...', {
        submissionId,
        templateCode,
        templateName
      });

      // Create job
      const response = await api.post('/api/documents/generate', {
        submission_id: submissionId,
        template_code: templateCode,
        template_name: templateName
      });

      const { job_id, status, filename } = response.data;
      console.log('[GENERATE] Job created:', { job_id, status, filename });

      notifications.show({
        title: t('Processing'),
        message: `Document generation started: ${filename}`,
        color: 'blue'
      });

      // Start polling for job status
      pollJobStatus(job_id, filename);

    } catch (error: any) {
      console.error('[GENERATE] Error:', error);
      
      let errorMessage = t('Failed to generate document');
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      notifications.show({
        title: t('Error'),
        message: errorMessage,
        color: 'red'
      });
      
      setGenerating(null);
    }
  };

  const pollJobStatus = async (jobId: string, filename: string) => {
    const maxAttempts = 60; // 60 attempts = 2 minutes max
    let attempts = 0;

    const checkStatus = async () => {
      try {
        attempts++;
        console.log(`[POLL] Checking job status (attempt ${attempts}/${maxAttempts})...`);

        const response = await api.get(`/api/documents/job/${submissionId}/${jobId}/status`);
        const { status, error } = response.data;

        console.log(`[POLL] Job status: ${status}`);

        if (status === 'done') {
          // Job completed - download document
          console.log('[POLL] Job completed, downloading...');
          
          notifications.show({
            title: t('Success'),
            message: `Document ready: ${filename}`,
            color: 'green'
          });

          // Download document
          const downloadResponse = await api.get(
            `/api/documents/job/${submissionId}/${jobId}/download`,
            { responseType: 'blob' }
          );

          // Create blob and download
          const blob = new Blob([downloadResponse.data], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
          setTimeout(() => window.URL.revokeObjectURL(url), 100);

          setGenerating(null);
          
          // Reload submission to show updated jobs
          loadSubmission();

        } else if (status === 'failed') {
          // Job failed
          console.error('[POLL] Job failed:', error);
          
          notifications.show({
            title: t('Error'),
            message: error || 'Document generation failed',
            color: 'red'
          });

          setGenerating(null);

        } else if (attempts >= maxAttempts) {
          // Timeout
          console.warn('[POLL] Polling timeout');
          
          notifications.show({
            title: t('Warning'),
            message: 'Document generation is taking longer than expected. Please check back later.',
            color: 'yellow'
          });

          setGenerating(null);

        } else {
          // Still processing - poll again in 2 seconds
          setTimeout(checkStatus, 2000);
        }

      } catch (error: any) {
        console.error('[POLL] Error checking status:', error);
        
        if (attempts >= maxAttempts) {
          notifications.show({
            title: t('Error'),
            message: 'Failed to check document status',
            color: 'red'
          });
          setGenerating(null);
        } else {
          // Retry
          setTimeout(checkStatus, 2000);
        }
      }
    };

    // Start polling
    checkStatus();
  };

  const loadApprovalStatus = async () => {
    try {
      const response = await api.get(`/api/data/submission/${submissionId}/approval-status`);
      setApprovalStatus(response.data);
    } catch (error) {
      console.error('Failed to load approval status:', error);
    }
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      await api.post(`/api/data/submission/${submissionId}/sign`);
      
      notifications.show({
        title: t('Success'),
        message: t('Submission signed successfully'),
        color: 'green'
      });
      
      loadApprovalStatus();
      loadSubmission();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to sign submission'),
        color: 'red'
      });
    } finally {
      setSigning(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await api.get(`/api/data/submission/${submissionId}/history`);
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleStateUpdate = async () => {
    if (!selectedState) return;

    setUpdating(true);
    try {
      await api.put(`/api/data/submission/${submissionId}/state`, {
        state: selectedState,
        notes: notes,
        notify_author: notifyAuthor
      });

      notifications.show({
        title: t('Success'),
        message: t('State updated successfully'),
        color: 'green'
      });

      loadSubmission();
      loadHistory();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update state'),
        color: 'red'
      });
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ro-RO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        // Check if it's a file array
        if (value.length > 0 && value[0].hash) {
          return value.map((file, idx) => (
            <div key={idx}>
              <a 
                href={`/api/data/files/${file.hash}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                {file.original_filename || file.filename}
              </a>
              {' '}({(file.size / 1024).toFixed(2)} KB)
            </div>
          ));
        }
        return value.join(', ');
      }
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getFieldLabel = (fieldKey: string): string => {
    // Try to get title from schema
    if (formSchema?.properties?.[fieldKey]?.title) {
      return formSchema.properties[fieldKey].title!;
    }
    // Fallback to field key
    return fieldKey;
  };

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading submission...')}</Text>
        </Stack>
      </Container>
    );
  }

  if (!submission) {
    return (
      <Container size="md" mt={50}>
        <Alert icon={<IconAlertCircle size={16} />} title={t('Not Found')} color="red">
          {t('Submission not found')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/forms')}
          >
            {t('Back')}
          </Button>
        </Group>

        <Grid>
          <Grid.Col span={{ base: 12, md: 9 }}>
            <Paper shadow="sm" p="md" radius="md" withBorder>
              <Stack>
                <Title order={3}>{t('Submission Details')}</Title>
                
                {submission.form_title && (
                  <Text size="sm" c="dark" fw={500}>
                    {t('Form')}: {submission.form_title}
                  </Text>
                )}
                
                <Group>
                  <Text size="sm" c="dimmed">
                    {t('Submitted At')}: {formatDate(submission.submitted_at)}
                  </Text>
                  {submission.submitted_by && (
                    <Text size="sm" c="dimmed">
                      {t('By')}: {submission.submitted_by}
                    </Text>
                  )}
                </Group>

                <Divider />

                <Stack gap="md">
                  {Object.entries(submission.data).map(([key, value]) => (
                    <div key={key}>
                      <Text size="sm" mb={4}>{getFieldLabel(key)}</Text>
                      <Text size="sm" fw={700} style={{ whiteSpace: 'pre-wrap' }}>
                        {renderValue(value)}
                      </Text>
                    </div>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 3 }}>
            <Accordion value={accordionValue} onChange={handleAccordionChange}>
              {/* State Management */}
              <Accordion.Item value="state">
                <Accordion.Control>
                  <Group>
                    <Text fw={500}>{t('State')}</Text>
                    <Badge color={STATE_COLORS[submission.state] || 'gray'} size="sm">
                      {STATE_LABELS[submission.state] || submission.state}
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack>
                    <Select
                      label={t('Change State')}
                      value={selectedState}
                      onChange={(value) => setSelectedState(value || '')}
                      data={[
                        { value: 'new', label: 'Nou' },
                        { value: 'in_review', label: 'În analiză' },
                        { value: 'approved', label: 'Aprobat' },
                        { value: 'rejected', label: 'Respins' },
                        { value: 'cancelled', label: 'Anulat' }
                      ]}
                    />

                    <Textarea
                      label={t('Notes')}
                      placeholder={t('Add notes...')}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />

                    <Checkbox
                      label={t('Notify author')}
                      checked={notifyAuthor}
                      onChange={(e) => setNotifyAuthor(e.target.checked)}
                    />

                    <Button
                      onClick={handleStateUpdate}
                      loading={updating}
                      disabled={selectedState === submission.state}
                      fullWidth
                    >
                      {t('Update State')}
                    </Button>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>

              {/* Generate Documents */}
              <Accordion.Item value="generate">
                <Accordion.Control>{t('Generate Documents')}</Accordion.Control>
                <Accordion.Panel>
                  {templates.length === 0 ? (
                    <Text size="sm" c="dimmed">{t('No templates configured for this form')}</Text>
                  ) : (
                    <Stack>
                      <Checkbox
                        label={t('Regenerate')}
                        description={t('Force regenerate document even if already exists')}
                        checked={regenerate}
                        onChange={(e) => setRegenerate(e.target.checked)}
                      />
                      
                      {templates.map((template) => (
                        <Button
                          key={template.code}
                          leftSection={<IconFileText size={16} />}
                          onClick={() => handleGenerateDocument(template.code, template.name)}
                          loading={generating === template.code}
                          disabled={generating !== null && generating !== template.code}
                          variant="light"
                          fullWidth
                        >
                          {template.name}
                        </Button>
                      ))}
                    </Stack>
                  )}
                </Accordion.Panel>
              </Accordion.Item>

              {/* Uploaded Documents */}
              <Accordion.Item value="uploaded">
                <Accordion.Control>{t('Uploaded Documents')}</Accordion.Control>
                <Accordion.Panel>
                  <Stack>
                    <Dropzone
                      onDrop={handleFileUpload}
                      loading={uploading}
                      accept={[MIME_TYPES.pdf, MIME_TYPES.doc, MIME_TYPES.docx, MIME_TYPES.xls, MIME_TYPES.xlsx, MIME_TYPES.png, MIME_TYPES.jpeg]}
                    >
                      <Group justify="center" gap="xs" style={{ minHeight: 80, pointerEvents: 'none' }}>
                        <Dropzone.Accept>
                          <IconUpload size={32} />
                        </Dropzone.Accept>
                        <Dropzone.Reject>
                          <IconX size={32} />
                        </Dropzone.Reject>
                        <Dropzone.Idle>
                          <IconUpload size={32} />
                        </Dropzone.Idle>
                        <div>
                          <Text size="sm" inline>
                            {t('Drag files here or click to select')}
                          </Text>
                          <Text size="xs" c="dimmed" inline mt={4}>
                            {t('PDF, DOC, DOCX, XLS, XLSX, PNG, JPG')}
                          </Text>
                        </div>
                      </Group>
                    </Dropzone>

                    {uploadedDocs.length === 0 ? (
                      <Text size="sm" c="dimmed">{t('No uploaded documents')}</Text>
                    ) : (
                      <Stack gap="xs">
                        {uploadedDocs.map((doc) => (
                          <Paper key={doc.id} p="xs" withBorder>
                            <Group justify="space-between">
                              <Stack gap={2} style={{ flex: 1 }}>
                                <Group gap="xs">
                                  <ActionIcon
                                    component="a"
                                    href={`/api/data/files/${doc.hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="subtle"
                                    size="sm"
                                  >
                                    <IconExternalLink size={14} />
                                  </ActionIcon>
                                  <Text size="sm" style={{ wordBreak: 'break-word' }}>
                                    {doc.filename}
                                  </Text>
                                </Group>
                                <Text size="xs" c="dimmed">
                                  {(doc.size / 1024).toFixed(2)} KB • {formatDate(doc.uploaded_at)}
                                </Text>
                              </Stack>
                              <ActionIcon
                                color="red"
                                variant="subtle"
                                onClick={() => handleDeleteDocument(doc.id)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>

              {/* Approval */}
              <Accordion.Item value="approval">
                <Accordion.Control>{t('Approval')}</Accordion.Control>
                <Accordion.Panel>
                  {!approvalStatus || !approvalStatus.enabled ? (
                    <Text size="sm" c="dimmed">{t('Approval workflow not enabled for this form')}</Text>
                  ) : (
                    <Stack>
                      {/* Status Badge */}
                      <Group>
                        <Text size="sm" fw={500}>{t('Status')}:</Text>
                        <Badge 
                          color={approvalStatus.status === 'valid' ? 'green' : 'yellow'}
                          size="lg"
                        >
                          {approvalStatus.status === 'valid' ? t('Valid') : t('Waiting')}
                        </Badge>
                      </Group>

                      {/* Min Signatures */}
                      <Paper p="xs" withBorder>
                        <Group justify="space-between">
                          <Text size="sm">{t('Minimum Signatures')}:</Text>
                          <Badge variant="light">
                            {approvalStatus.current_signatures} / {approvalStatus.min_signatures}
                          </Badge>
                        </Group>
                      </Paper>

                      {/* Must Sign Users */}
                      {approvalStatus.must_sign && approvalStatus.must_sign.length > 0 && (
                        <Stack gap="xs">
                          <Text size="sm" fw={500} c="red">{t('Must Sign')}:</Text>
                          {approvalStatus.must_sign.map((user: any) => {
                            const hasSigned = approvalStatus.signatures?.some(
                              (sig: any) => sig.user_id === user.user_id
                            );
                            return (
                              <Paper key={user.user_id} p="xs" withBorder>
                                <Group justify="space-between">
                                  <Text size="sm">{user.username}</Text>
                                  {hasSigned ? (
                                    <Badge color="green" size="sm">✓ {t('Signed')}</Badge>
                                  ) : (
                                    <Badge color="gray" size="sm">{t('Pending')}</Badge>
                                  )}
                                </Group>
                              </Paper>
                            );
                          })}
                        </Stack>
                      )}

                      {/* Can Sign Users */}
                      {approvalStatus.can_sign && approvalStatus.can_sign.length > 0 && (
                        <Stack gap="xs">
                          <Text size="sm" fw={500} c="blue">{t('Can Sign')}:</Text>
                          {approvalStatus.can_sign.map((user: any) => {
                            const hasSigned = approvalStatus.signatures?.some(
                              (sig: any) => sig.user_id === user.user_id
                            );
                            return (
                              <Paper key={user.user_id} p="xs" withBorder>
                                <Group justify="space-between">
                                  <Text size="sm">{user.username}</Text>
                                  {hasSigned ? (
                                    <Badge color="green" size="sm">✓ {t('Signed')}</Badge>
                                  ) : (
                                    <Badge color="gray" size="sm">{t('Pending')}</Badge>
                                  )}
                                </Group>
                              </Paper>
                            );
                          })}
                        </Stack>
                      )}

                      {/* Signatures */}
                      {approvalStatus.signatures && approvalStatus.signatures.length > 0 && (
                        <Stack gap="xs">
                          <Divider label={t('Signatures')} labelPosition="center" />
                          {approvalStatus.signatures.map((sig: any, idx: number) => (
                            <Paper key={idx} p="xs" withBorder>
                              <Stack gap={4}>
                                <Group justify="space-between">
                                  <Text size="sm" fw={500}>{sig.username}</Text>
                                  <Badge color="green" size="sm">✓</Badge>
                                </Group>
                                <Text size="xs" c="dimmed">
                                  {formatDate(sig.signed_at)}
                                </Text>
                                <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                                  {sig.signature.substring(0, 16)}...
                                </Text>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      )}

                      {/* Sign Now Button */}
                      {approvalStatus.can_user_sign && !approvalStatus.has_user_signed && (
                        <Button
                          onClick={handleSign}
                          loading={signing}
                          color="green"
                          fullWidth
                        >
                          {t('Sign Now')}
                        </Button>
                      )}

                      {/* Already Signed Message */}
                      {approvalStatus.has_user_signed && (
                        <Alert color="green">
                          <Text size="sm">{t('You have already signed this submission')}</Text>
                        </Alert>
                      )}

                      {/* Cannot Sign Message */}
                      {!approvalStatus.can_user_sign && !approvalStatus.has_user_signed && (
                        <Alert color="gray">
                          <Text size="sm">{t('You are not authorized to sign this submission')}</Text>
                        </Alert>
                      )}
                    </Stack>
                  )}
                </Accordion.Panel>
              </Accordion.Item>

              {/* History */}
              <Accordion.Item value="history">
                <Accordion.Control>{t('History')}</Accordion.Control>
                <Accordion.Panel>
                  {history.length === 0 ? (
                    <Text size="sm" c="dimmed">{t('No history')}</Text>
                  ) : (
                    <Stack gap="xs">
                      {history.map((record) => (
                        <Paper key={record.id} p="xs" withBorder>
                          <Stack gap={4}>
                            <Badge 
                              color={STATE_COLORS[record.state] || 'gray'} 
                              size="sm"
                            >
                              {STATE_LABELS[record.state] || record.state}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {record.changed_by}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatDate(record.created_at)}
                            </Text>
                            {record.notes && (
                              <Text size="xs">{record.notes}</Text>
                            )}
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
