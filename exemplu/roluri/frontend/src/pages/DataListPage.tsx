import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Title,
  Paper,
  Table,
  Button,
  Group,
  Modal,
  Stack,
  ActionIcon,
  Loader,
  Alert,
  Text,
  Code,
  Badge,
  ScrollArea,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconTrash,
  IconEye,
  IconAlertCircle,
  IconFileDownload,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/Common/ConfirmModal';
import { useIsMobile } from '../hooks/useMediaQuery';

interface Submission {
  id: string;
  form_id: string;
  data: any;
  submitted_at: string;
  submitted_by?: string;
}

interface Template {
  code: string;
  name: string;
}

export function DataListPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewModalOpened, setViewModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const loadSubmissions = async () => {
    if (!formId) return;

    try {
      const response = await api.get(`/api/data/${formId}`);
      setSubmissions(response.data);
      
      // Load templates for this form
      const templatesResponse = await api.get(`/api/documents/form/${formId}/templates`);
      setTemplates(templatesResponse.data);
    } catch (error: any) {
      if (error.response?.status === 403) {
        notifications.show({
          title: t('Error'),
          message: t('Administrator access required'),
          color: 'red',
        });
      } else {
        notifications.show({
          title: t('Error'),
          message: t('Failed to load submissions'),
          color: 'red',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadSubmissions();
    } else {
      setLoading(false);
    }
  }, [formId, isAdmin]);

  const handleViewSubmission = (submission: Submission) => {
    setSelectedSubmission(submission);
    setViewModalOpened(true);
  };

  const openDeleteModal = (submissionId: string) => {
    setSubmissionToDelete(submissionId);
    setDeleteModalOpened(true);
  };

  const handleDeleteSubmission = async () => {
    if (!submissionToDelete) return;

    setDeleting(true);
    try {
      await api.delete(`/api/data/submission/${submissionToDelete}`);
      notifications.show({
        title: t('Success'),
        message: t('Submission deleted successfully'),
        color: 'green',
      });
      setDeleteModalOpened(false);
      setSubmissionToDelete(null);
      loadSubmissions();
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to delete submission'),
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleGenerateDocument = async (submissionId: string, templateCode: string, templateName: string) => {
    setGeneratingDoc(`${submissionId}-${templateCode}`);
    
    try {
      const response = await api.post(
        '/api/documents/generate',
        {
          submission_id: submissionId,
          template_code: templateCode,
          template_name: templateName,
        },
        {
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `document-${submissionId.substring(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      notifications.show({
        title: t('Success'),
        message: t('Document generated successfully!'),
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to generate document'),
        color: 'red',
      });
    } finally {
      setGeneratingDoc(null);
    }
  };

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading submissions...')}</Text>
        </Stack>
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container size="md" mt={50}>
        <Alert icon={<IconAlertCircle size={16} />} title={t('Access Denied')} color="red">
          {t('Administrator access required to view submissions.')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" mt={isMobile ? 10 : 30} px={isMobile ? 'xs' : 'md'}>
      <Stack>
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/dashboard')}
            size={isMobile ? 'sm' : 'md'}
          >
            {isMobile ? t('Back') : t('Back to Dashboard')}
          </Button>
        </Group>

        <Title order={isMobile ? 3 : 2}>{t('Form Submissions')}</Title>

        {submissions.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No submissions yet')}>
            {t("This form hasn't received any submissions yet.")}
          </Alert>
        ) : (
          <Paper shadow="sm" p={isMobile ? 'xs' : 'md'} radius="md" withBorder>
            <ScrollArea>
              <Table striped highlightOnHover style={{ minWidth: isMobile ? 600 : 'auto' }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('Submitted At')}</Table.Th>
                    <Table.Th>{t('Submitted By')}</Table.Th>
                    {!isMobile && <Table.Th>{t('Preview')}</Table.Th>}
                    <Table.Th>{t('Actions')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {submissions.map((submission) => (
                    <Table.Tr key={submission.id}>
                      <Table.Td>
                        <Text size="sm">{formatDate(submission.submitted_at)}</Text>
                      </Table.Td>
                      <Table.Td>
                        {submission.submitted_by ? (
                          <Badge size="sm">{submission.submitted_by}</Badge>
                        ) : (
                          <Text c="dimmed" size="sm">
                            {t('Anonymous')}
                          </Text>
                        )}
                      </Table.Td>
                      {!isMobile && (
                        <Table.Td>
                          <Text size="sm" lineClamp={1} c="dimmed">
                            {JSON.stringify(submission.data).substring(0, 50)}...
                          </Text>
                        </Table.Td>
                      )}
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => handleViewSubmission(submission)}
                            title={t('View details')}
                            size={isMobile ? 'lg' : 'md'}
                          >
                            <IconEye size={isMobile ? 20 : 16} />
                          </ActionIcon>
                          
                          {templates.map((template) => (
                            <ActionIcon
                              key={template.code}
                              variant="subtle"
                              color="green"
                              onClick={() => handleGenerateDocument(submission.id, template.code, template.name)}
                              title={`${t('Generate Document')}: ${template.name}`}
                              loading={generatingDoc === `${submission.id}-${template.code}`}
                              size={isMobile ? 'lg' : 'md'}
                            >
                              <IconFileDownload size={isMobile ? 20 : 16} />
                            </ActionIcon>
                          ))}
                          
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => openDeleteModal(submission.id)}
                            title={t('Delete submission')}
                            size={isMobile ? 'lg' : 'md'}
                          >
                            <IconTrash size={isMobile ? 20 : 16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        )}
      </Stack>

      {/* View Submission Modal */}
      <Modal
        opened={viewModalOpened}
        onClose={() => setViewModalOpened(false)}
        title={t('Submission Details')}
        size="lg"
        fullScreen={isMobile}
      >
        {selectedSubmission && (
          <Stack>
            <div>
              <Text size="sm" fw={500} mb="xs">
                {t('Submitted At')}:
              </Text>
              <Text size="sm" c="dimmed">
                {formatDate(selectedSubmission.submitted_at)}
              </Text>
            </div>

            {selectedSubmission.submitted_by && (
              <div>
                <Text size="sm" fw={500} mb="xs">
                  {t('Submitted By')}:
                </Text>
                <Badge>{selectedSubmission.submitted_by}</Badge>
              </div>
            )}

            <div>
              <Text size="sm" fw={500} mb="xs">
                {t('Data')}:
              </Text>
              <Code block>{JSON.stringify(selectedSubmission.data, null, 2)}</Code>
            </div>
          </Stack>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setSubmissionToDelete(null);
        }}
        onConfirm={handleDeleteSubmission}
        title={t('Delete Submission')}
        message={t('Are you sure you want to delete this submission? This action cannot be undone.')}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        confirmColor="red"
        loading={deleting}
      />
    </Container>
  );
}
