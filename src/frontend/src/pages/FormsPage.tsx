import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Paper,
  Table,
  Button,
  Group,
  Modal,
  TextInput,
  Textarea,
  Stack,
  ActionIcon,
  Badge,
  Loader,
  Alert,
  Text,
  Anchor,
  Checkbox,
  ScrollArea,
  Divider,
  Select,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconEye,
  IconAlertCircle,
  IconEdit,
  IconExternalLink,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/Common/ConfirmModal';
import { useIsMobile } from '../hooks/useMediaQuery';
import { TemplateSelector } from '../components/Forms/TemplateSelector';
import { SubmissionsStats } from '../components/Dashboard/SubmissionsStats';

interface Form {
  id: string;
  slug: string;
  title: string;
  description?: string;
  active: boolean;
  is_public: boolean;
  created_at: string;
  json_schema: any;
  ui_schema: any;
  template_codes?: string[];
}

export function FormsPage() {
  const { isStaff } = useAuth();
  const { t } = useTranslation();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [jsonModalOpened, setJsonModalOpened] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [notificationEmails, setNotificationEmails] = useState('');
  const [notificationTemplate, setNotificationTemplate] = useState('default');
  const [mailTemplates, setMailTemplates] = useState<{value: string; label: string}[]>([]);
  const [templateCodes, setTemplateCodes] = useState<string[]>([]);
  const [jsonSchema, setJsonSchema] = useState('');
  const [uiSchema, setUiSchema] = useState('');
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [formToDelete, setFormToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const loadForms = async () => {
    console.log('Loading forms...');
    try {
      const response = await api.get('/api/forms/');
      console.log('Forms loaded successfully:', response.data);
      setForms(response.data);
    } catch (error: any) {
      console.error('Failed to load forms:', error);
      if (error.response?.status === 403) {
        notifications.show({
          title: t('Error'),
          message: t('Administrator access required'),
          color: 'red',
        });
      } else {
        notifications.show({
          title: t('Error'),
          message: error.response?.data?.detail || t('Failed to load forms'),
          color: 'red',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('DashboardPage mounted, isStaff:', isStaff);
    if (isStaff) {
      loadForms();
    } else {
      setLoading(false);
    }
  }, [isStaff]);

  const loadMailTemplates = async () => {
    try {
      const response = await api.get('/api/forms/mail-templates/list');
      setMailTemplates(response.data);
    } catch (error) {
      console.error('Failed to load mail templates:', error);
    }
  };

  const openCreateModal = async () => {
    setEditingForm(null);
    setFormTitle('');
    setFormDescription('');
    setIsPublic(true);
    setNotificationEmails('');
    setNotificationTemplate('default');
    setTemplateCodes([]);
    setJsonSchema('{\n  "type": "object",\n  "properties": {}\n}');
    setUiSchema('{}');
    await loadMailTemplates();
    setModalOpened(true);
  };

  const openEditModal = async (form: any) => {
    setEditingForm(form);
    setFormTitle(form.title);
    setFormDescription(form.description || '');
    setIsPublic(form.is_public);
    setNotificationEmails(form.notification_emails ? form.notification_emails.join(', ') : '');
    setNotificationTemplate(form.notification_template || 'default');
    setTemplateCodes(form.template_codes || []);
    setJsonSchema(JSON.stringify(form.json_schema, null, 2));
    setUiSchema(JSON.stringify(form.ui_schema, null, 2));
    await loadMailTemplates();
    setModalOpened(true);
  };

  const handleCreateForm = () => {
    setModalOpened(false);
    setJsonModalOpened(true);
  };

  const handleSaveForm = async () => {
    try {
      const jsonSchemaObj = JSON.parse(jsonSchema);
      const uiSchemaObj = JSON.parse(uiSchema);

      // Parse notification emails
      const emailsList = notificationEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      if (editingForm) {
        await api.put(`/api/forms/${editingForm.id}`, {
          title: formTitle,
          description: formDescription,
          json_schema: jsonSchemaObj,
          ui_schema: uiSchemaObj,
          is_public: isPublic,
          notification_emails: emailsList.length > 0 ? emailsList : null,
          notification_template: notificationTemplate,
          template_codes: templateCodes,
        });

        notifications.show({
          title: t('Success'),
          message: t('Form updated successfully'),
          color: 'green',
        });
      } else {
        await api.post('/api/forms/', {
          title: formTitle,
          description: formDescription,
          json_schema: jsonSchemaObj,
          ui_schema: uiSchemaObj,
          is_public: isPublic,
          notification_emails: emailsList.length > 0 ? emailsList : null,
          notification_template: notificationTemplate,
          template_codes: templateCodes,
        });

        notifications.show({
          title: t('Success'),
          message: t('Form created successfully'),
          color: 'green',
        });
      }

      setJsonModalOpened(false);
      loadForms();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t(editingForm ? 'Failed to update form' : 'Failed to create form'),
        color: 'red',
      });
    }
  };

  const openDeleteModal = (formId: string) => {
    setFormToDelete(formId);
    setDeleteModalOpened(true);
  };

  const handleDeleteForm = async () => {
    if (!formToDelete) return;

    setDeleting(true);
    try {
      await api.delete(`/api/forms/${formToDelete}`);
      notifications.show({
        title: t('Success'),
        message: t('Form deleted successfully'),
        color: 'green',
      });
      setDeleteModalOpened(false);
      setFormToDelete(null);
      loadForms();
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to delete form'),
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  };

  const viewFormData = (formId: string) => {
    navigate(`/data/${formId}`);
  };

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading forms...')}</Text>
        </Stack>
      </Container>
    );
  }

  if (!isStaff) {
    return (
      <Container size="md" mt={50}>
        <Alert icon={<IconAlertCircle size={16} />} title={t('Access Denied')} color="red">
          {t('Administrator access required to view this page.')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" mt={isMobile ? 10 : 30} px={isMobile ? 'xs' : 'md'}>
      <Stack gap="xl">
        {/* Submissions Statistics */}
        <Stack>
          <Title order={isMobile ? 3 : 2}>{t('Recent Submissions')}</Title>
          <SubmissionsStats />
        </Stack>

        <Divider />

        {/* Forms Management */}
        <Stack>
        <Group justify="space-between">
          <Title order={isMobile ? 3 : 2}>{t('Forms Management')}</Title>
          <Button 
            leftSection={<IconPlus size={16} />} 
            onClick={openCreateModal}
            size={isMobile ? 'sm' : 'md'}
          >
            {isMobile ? t('Create') : t('Create Form')}
          </Button>
        </Group>

        {forms.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No forms yet')}>
            {t('Create your first form to get started.')}
          </Alert>
        ) : (
          <Paper shadow="sm" p={isMobile ? 'xs' : 'md'} radius="md" withBorder>
            <ScrollArea>
              <Table striped highlightOnHover style={{ minWidth: isMobile ? 600 : 'auto' }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('Title')}</Table.Th>
                    <Table.Th>{t('Slug')}</Table.Th>
                    {!isMobile && <Table.Th>{t('Description')}</Table.Th>}
                    <Table.Th>{t('Type')}</Table.Th>
                    <Table.Th>{t('Status')}</Table.Th>
                    <Table.Th>{t('Actions')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {forms.map((form) => (
                    <Table.Tr key={form.id}>
                      <Table.Td>{form.title}</Table.Td>
                      <Table.Td>
                        <Button
                          component="a"
                          href={`/web/forms/${form.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="subtle"
                          size="xs"
                          leftSection={<IconExternalLink size={14} />}
                        >
                          /{form.slug}
                        </Button>
                      </Table.Td>
                      {!isMobile && <Table.Td>{form.description || '-'}</Table.Td>}
                      <Table.Td>
                        <Badge color={form.is_public ? 'blue' : 'orange'} size="sm">
                          {form.is_public ? t('Public') : t('Protected')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={form.active ? 'green' : 'gray'} size="sm">
                          {form.active ? t('Active') : t('Inactive')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => viewFormData(form.id)}
                            title={t('View submissions')}
                            size={isMobile ? 'lg' : 'md'}
                          >
                            <IconEye size={isMobile ? 20 : 16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="cyan"
                            onClick={() => openEditModal(form)}
                            title={t('Edit form')}
                            size={isMobile ? 'lg' : 'md'}
                          >
                            <IconEdit size={isMobile ? 20 : 16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => openDeleteModal(form.id)}
                            title={t('Delete form')}
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
      </Stack>

      {/* Basic Info Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingForm ? t('Edit Form') : t('Create New Form')}
        size="lg"
        fullScreen={isMobile}
      >
        <Stack>
          <TextInput
            label={t('Form Title')}
            placeholder={t('Contact Form')}
            value={formTitle}
            onChange={(e) => setFormTitle(e.currentTarget.value)}
            required
          />
          {editingForm && (
            <Alert color="blue" icon={<IconAlertCircle size={16} />}>
              {t('Slug')}: <Text component="span" fw={700}>{editingForm.slug}</Text>
            </Alert>
          )}
          <Textarea
            label={t('Description')}
            placeholder={t('Form description...')}
            value={formDescription}
            onChange={(e) => setFormDescription(e.currentTarget.value)}
            rows={3}
          />
          <Checkbox
            label={t('Public Form')}
            description={t('Public forms can be filled by anyone. Protected forms require authentication.')}
            checked={isPublic}
            onChange={(e) => setIsPublic(e.currentTarget.checked)}
          />

          <TextInput
            label={t('Notification Emails')}
            placeholder="email1@example.com, email2@example.com"
            value={notificationEmails}
            onChange={(e) => setNotificationEmails(e.currentTarget.value)}
            description={t('Comma-separated email addresses to notify when a new submission is received')}
          />

          <Select
            label={t('Notification Template')}
            placeholder={t('Select email template')}
            data={mailTemplates}
            value={notificationTemplate}
            onChange={(value) => setNotificationTemplate(value || 'default')}
            description={t('Email template to use for notifications')}
          />
          
          <TemplateSelector
            value={templateCodes}
            onChange={setTemplateCodes}
          />
          
          <Button onClick={handleCreateForm} fullWidth={isMobile}>
            {editingForm ? t('Next: Update JSON Schema') : t('Next: Add JSON Schema')}
          </Button>
        </Stack>
      </Modal>

      {/* JSON Schema Modal */}
      <Modal
        opened={jsonModalOpened}
        onClose={() => setJsonModalOpened(false)}
        title={editingForm ? t('Update Form Schema') : t('Form Schema')}
        size="xl"
        fullScreen={isMobile}
      >
        <Stack>
          <Alert color="blue" title={t('JSON Forms Documentation')}>
            <Group gap="xs">
              <Text size="sm">
                {t('Need help with JSON Schema or UI Schema?')}
              </Text>
              <Anchor
                href="https://jsonforms.io/docs/uischema"
                target="_blank"
                size="sm"
              >
                {t('View Documentation')} <IconExternalLink size={14} style={{ verticalAlign: 'middle' }} />
              </Anchor>
            </Group>
          </Alert>

          <Textarea
            label={t('JSON Schema')}
            placeholder='{"type": "object", "properties": {...}}'
            value={jsonSchema}
            onChange={(e) => setJsonSchema(e.currentTarget.value)}
            rows={10}
            required
            styles={{ input: { fontFamily: 'monospace', fontSize: '12px' } }}
          />
          <Textarea
            label={t('UI Schema (optional)')}
            placeholder='{}'
            value={uiSchema}
            onChange={(e) => setUiSchema(e.currentTarget.value)}
            rows={6}
            styles={{ input: { fontFamily: 'monospace', fontSize: '12px' } }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setJsonModalOpened(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSaveForm}>
              {editingForm ? t('Create Form') : t('Create Form')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setFormToDelete(null);
        }}
        onConfirm={handleDeleteForm}
        title={t('Delete Form')}
        message={t('Are you sure you want to delete this form? This action cannot be undone.')}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        confirmColor="red"
        loading={deleting}
      />
    </Container>
  );
}
