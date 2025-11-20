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
  Card,
} from '@mantine/core';
import { IconArrowLeft, IconAlertCircle, IconFileText } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';

interface Submission {
  id: string;
  form_id: string;
  form_slug?: string;
  data: any;
  submitted_by?: string;
  submitted_at: string;
  state: string;
  state_updated_at?: string;
  state_updated_by?: string;
  notes?: string;
}

interface FormTemplate {
  code: string;
  name: string;
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

  useEffect(() => {
    if (submissionId) {
      loadSubmission();
      loadHistory();
    }
  }, [submissionId]);

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
      const formResponse = await api.get(`/api/forms/${slug}`);
      const templateCodes = formResponse.data.template_codes || [];
      
      if (templateCodes.length > 0) {
        // Load template details
        const templatesResponse = await api.get('/api/templates');
        const allTemplates = templatesResponse.data;
        
        const formTemplates = allTemplates.filter((t: any) => 
          templateCodes.includes(t.code)
        );
        
        setTemplates(formTemplates);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
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
                      <Text fw={500} size="sm" mb={4}>{key}</Text>
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {renderValue(value)}
                      </Text>
                    </div>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 3 }}>
            <Stack>
              {/* State Management */}
              <Card shadow="sm" padding="md" radius="md" withBorder>
                <Stack>
                  <Title order={5}>{t('State')}</Title>
                  
                  <Badge 
                    color={STATE_COLORS[submission.state] || 'gray'} 
                    size="lg"
                    fullWidth
                  >
                    {STATE_LABELS[submission.state] || submission.state}
                  </Badge>

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
              </Card>

              {/* Generate Documents */}
              {templates.length > 0 && (
                <Card shadow="sm" padding="md" radius="md" withBorder>
                  <Stack>
                    <Title order={5}>{t('Generate Documents')}</Title>
                    
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
                </Card>
              )}

              {/* History */}
              <Card shadow="sm" padding="md" radius="md" withBorder>
                <Stack>
                  <Title order={5}>{t('History')}</Title>
                  
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
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
