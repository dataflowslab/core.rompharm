import { useEffect, useState } from 'react';
import { Container, Title, Alert, Loader, Text, Stack, Group, Button } from '@mantine/core';
import { IconAlertCircle, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import {
  CreateTemplateModal,
  EditTemplatePartModal,
  EditTemplateNameModal,
  DeleteTemplatePartModal,
  TemplateCard,
} from '../components/Templates';

interface Template {
  code: string;
  name: string;
  description?: string;
  parts: number;
  types: string[];
  created_at?: string;
  updated_at?: string;
}

export function TemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [depoConfigured, setDepoConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Edit modal state
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [editingCode, setEditingCode] = useState<string>('');
  const [editingType, setEditingType] = useState<string>('');
  const [partContent, setPartContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);

  // Delete modal state
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string>('');
  const [deletingType, setDeletingType] = useState<string>('');
  const [deleting, setDeleting] = useState(false);

  // Create modal state
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateType, setNewTemplateType] = useState('base');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit name modal state
  const [editNameModalOpened, setEditNameModalOpened] = useState(false);
  const [editingNameCode, setEditingNameCode] = useState<string>('');
  const [editingTemplateName, setEditingTemplateName] = useState('');
  const [editingTemplateDescription, setEditingTemplateDescription] = useState('');
  const [savingName, setSavingName] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const statusResponse = await api.get('/api/system/status');
      const configured = statusResponse.data.dataflows_docu?.configured || false;
      setDepoConfigured(configured);

      if (!configured) {
        setLoading(false);
        return;
      }

      const templatesResponse = await api.get('/api/templates');
      const templateList = templatesResponse.data || [];
      setTemplates(templateList);
    } catch (error: any) {
      console.error('Error loading templates:', error);
      setError(error.response?.data?.detail || error.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const openEditModal = async (code: string, type: string) => {
    setEditingCode(code);
    setEditingType(type);
    setEditModalOpened(true);
    setLoadingContent(true);
    setPartContent('');
    
    try {
      const response = await api.get(`/api/templates/${code}/${type}/raw`, {
        timeout: 60000
      });
      setPartContent(response.data.content);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || t('Failed to load part content');
      
      notifications.show({
        title: t('Error'),
        message: `${t('Failed to load template content')}: ${errorMsg}. ${t('The DataFlows Docu server may be experiencing issues with the /raw endpoint.')}`,
        color: 'red',
        autoClose: 10000,
      });
      
      setPartContent(`<!-- Error loading content -->\n<!-- ${errorMsg} -->\n\n${t('Unable to load template content. Please try again later or contact support.')}`);
    } finally {
      setLoadingContent(false);
    }
  };

  const openCreateModal = () => {
    setNewTemplateName('');
    setNewTemplateType('base');
    setNewTemplateContent('<html>\n<body>\n  <h1>{{title}}</h1>\n  <p>{{content}}</p>\n</body>\n</html>');
    setCreateModalOpened(true);
  };

  const openEditNameModal = (code: string) => {
    const template = templates.find(t => t.code === code);
    if (template) {
      setEditingNameCode(code);
      setEditingTemplateName(template.name);
      setEditingTemplateDescription(template.description || '');
      setEditNameModalOpened(true);
    }
  };

  const openDeleteModal = (code: string, type: string) => {
    setDeletingCode(code);
    setDeletingType(type);
    setDeleteModalOpened(true);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      notifications.show({
        title: t('Error'),
        message: t('Template name is required'),
        color: 'red',
      });
      return;
    }

    if (!newTemplateContent.trim()) {
      notifications.show({
        title: t('Error'),
        message: t('Content is required'),
        color: 'red',
      });
      return;
    }

    setCreating(true);
    try {
      await api.post('/api/templates', {
        name: newTemplateName,
        description: '',
        part_data: {
          type: newTemplateType,
          content: newTemplateContent,
          name: newTemplateName,
        },
      });

      notifications.show({
        title: t('Success'),
        message: t('Template created successfully'),
        color: 'green',
      });

      setCreateModalOpened(false);
      loadTemplates();
    } catch (error: any) {
      console.error('Error creating template:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to create template'),
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSavePart = async () => {
    if (!partContent.trim()) {
      notifications.show({
        title: t('Error'),
        message: t('Content is required'),
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      await api.put(`/api/templates/${editingCode}/${editingType}`, {
        content: partContent,
      });

      notifications.show({
        title: t('Success'),
        message: t('Part updated successfully'),
        color: 'green',
      });

      setEditModalOpened(false);
      loadTemplates();
    } catch (error: any) {
      console.error('Error saving part:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save part'),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplateName = async () => {
    if (!editingTemplateName.trim()) {
      notifications.show({
        title: t('Error'),
        message: t('Template name is required'),
        color: 'red',
      });
      return;
    }

    setSavingName(true);
    try {
      await api.put(`/api/templates/${editingNameCode}`, {
        name: editingTemplateName,
        description: editingTemplateDescription,
      });

      notifications.show({
        title: t('Success'),
        message: t('Template updated successfully'),
        color: 'green',
      });

      setEditNameModalOpened(false);
      loadTemplates();
    } catch (error: any) {
      console.error('Error updating template name:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update template'),
        color: 'red',
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleDeletePart = async () => {
    setDeleting(true);
    try {
      const template = templates.find(t => t.code === deletingCode);
      
      if (template && template.types.length === 1) {
        await api.delete(`/api/templates/${deletingCode}`);
      } else {
        await api.delete(`/api/templates/${deletingCode}/${deletingType}`);
      }

      notifications.show({
        title: t('Success'),
        message: t('Part deleted successfully'),
        color: 'green',
      });

      setDeleteModalOpened(false);
      loadTemplates();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete part'),
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  };

  const getDefaultContent = (type: string): string => {
    switch (type) {
      case 'base':
        return '<html>\n<body>\n  <h1>{{title}}</h1>\n  <p>{{content}}</p>\n</body>\n</html>';
      case 'header':
        return '<div style="text-align: center; font-weight: bold;">\n  {{company_name}}\n</div>';
      case 'footer':
        return '<div style="text-align: center; font-size: 10px;">\n  Page {{page}} of {{total_pages}}\n</div>';
      case 'css':
        return 'body {\n  font-family: Arial, sans-serif;\n  margin: 2cm;\n}\n\nh1 {\n  color: #333;\n}';
      case 'code':
        return '// JavaScript code\nconsole.log("Template loaded");';
      default:
        return '';
    }
  };

  const getLanguageForPartType = (type: string): string => {
    switch (type) {
      case 'css':
        return 'CSS';
      case 'code':
        return 'JavaScript';
      case 'base':
      case 'header':
      case 'footer':
      default:
        return 'HTML';
    }
  };

  const getBadgeColor = (type: string): string => {
    switch (type) {
      case 'base':
        return 'blue';
      case 'header':
        return 'green';
      case 'footer':
        return 'orange';
      case 'css':
        return 'violet';
      case 'code':
        return 'gray';
      default:
        return 'gray';
    }
  };

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading templates...')}</Text>
        </Stack>
      </Container>
    );
  }

  if (!depoConfigured) {
    return (
      <Container size="md" mt={50}>
        <Alert icon={<IconAlertCircle size={16} />} title={t('DataFlows Docu is not configured')} color="yellow">
          {t('DataFlows Docu is not configured. Please configure it in config.yaml to use document templates.')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={2}>{t('Templates')}</Title>
          <Button 
            leftSection={<IconPlus size={16} />}
            onClick={openCreateModal}
          >
            {t('New Template')}
          </Button>
        </Group>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title={t('Error')} color="red">
            {error}
          </Alert>
        )}

        {templates.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No templates found')}>
            {t('No templates available in DataFlows Docu')}
          </Alert>
        ) : (
          <Stack gap="md">
            {templates.map((template) => (
              <TemplateCard
                key={template.code}
                template={template}
                onEdit={openEditModal}
                onDelete={openDeleteModal}
                onEditName={openEditNameModal}
                getBadgeColor={getBadgeColor}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <EditTemplatePartModal
        opened={editModalOpened}
        onClose={() => setEditModalOpened(false)}
        editingType={editingType}
        partContent={partContent}
        setPartContent={setPartContent}
        onSubmit={handleSavePart}
        loading={saving}
        loadingContent={loadingContent}
        getLanguageForPartType={getLanguageForPartType}
      />

      <DeleteTemplatePartModal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        deletingType={deletingType}
        deletingCode={deletingCode}
        onConfirm={handleDeletePart}
        loading={deleting}
      />

      <EditTemplateNameModal
        opened={editNameModalOpened}
        onClose={() => setEditNameModalOpened(false)}
        templateName={editingTemplateName}
        setTemplateName={setEditingTemplateName}
        templateDescription={editingTemplateDescription}
        setTemplateDescription={setEditingTemplateDescription}
        onSubmit={handleSaveTemplateName}
        loading={savingName}
      />

      <CreateTemplateModal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        templateName={newTemplateName}
        setTemplateName={setNewTemplateName}
        templateType={newTemplateType}
        setTemplateType={setNewTemplateType}
        templateContent={newTemplateContent}
        setTemplateContent={setNewTemplateContent}
        onSubmit={handleCreateTemplate}
        loading={creating}
        getDefaultContent={getDefaultContent}
        getLanguageForPartType={getLanguageForPartType}
      />
    </Container>
  );
}
