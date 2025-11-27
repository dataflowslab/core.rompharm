import { Modal, Stack, TextInput, Select, Text, Textarea, Group, Button, Alert, Loader } from '@mantine/core';
import { IconPlus, IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';

interface CreateTemplateModalProps {
  opened: boolean;
  onClose: () => void;
  templateName: string;
  setTemplateName: (name: string) => void;
  templateType: string;
  setTemplateType: (type: string) => void;
  templateContent: string;
  setTemplateContent: (content: string) => void;
  onSubmit: () => void;
  loading: boolean;
  getDefaultContent: (type: string) => string;
  getLanguageForPartType: (type: string) => string;
}

interface TemplateListItem {
  code: string;
  name: string;
  types?: string[];
}

export function CreateTemplateModal({
  opened,
  onClose,
  templateName,
  setTemplateName,
  templateType,
  setTemplateType,
  templateContent,
  setTemplateContent,
  onSubmit,
  loading,
  getDefaultContent,
  getLanguageForPartType,
}: CreateTemplateModalProps) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [selectedBaseCode, setSelectedBaseCode] = useState<string | null>(null);
  const showBaseSelect = useMemo(() => templateType !== 'base', [templateType]);

  useEffect(() => {
    if (opened) {
      setSelectedBaseCode(null);
      if (showBaseSelect) {
        void loadTemplates();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, showBaseSelect]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    setTemplatesError('');
    try {
      const response = await api.get('/api/templates');
      setTemplates(response.data as TemplateListItem[]);
    } catch (err: any) {
      console.error('Failed to load templates:', err);
      setTemplatesError(t('Failed to load templates'));
    } finally {
      setLoadingTemplates(false);
    }
  };

  const baseTemplateOptions = useMemo(() => {
    return templates
      .filter(tpl => Array.isArray(tpl.types) ? tpl.types.includes('base') : true)
      .map(tpl => ({ value: tpl.code, label: `${tpl.name} (${tpl.code})` }));
  }, [templates]);

  const fetchBaseRaw = async (code: string) => {
    try {
      const res = await api.get(`/api/templates/${code}/base/raw`);
      if (typeof res.data === 'string') {
        setTemplateContent(res.data);
      } else if (res.data && typeof res.data.content === 'string') {
        setTemplateContent(res.data.content);
      }
    } catch (e) {
      console.error('Failed to load template content', e);
    }
  };

  useEffect(() => {
    if (templateType === 'base') {
      setSelectedBaseCode(null);
      setTemplateContent(getDefaultContent('base'));
    } else {
      setTemplateContent(getDefaultContent(templateType));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateType]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Create New Template')}
      size="xl"
    >
      <Stack>
        <TextInput
          label={t('Template Name')}
          placeholder={t('My Template')}
          value={templateName}
          onChange={(e) => setTemplateName(e.currentTarget.value)}
          required
        />

        <Select
          label={t('Part Type')}
          description={t('Select the type of template part to create')}
          value={templateType}
          onChange={(value) => {
            setTemplateType(value || 'base');
          }}
          data={[
            { value: 'base', label: 'Base (Main Content)' },
            { value: 'header', label: 'Header (Running Header)' },
            { value: 'footer', label: 'Footer (Running Footer)' },
            { value: 'css', label: 'CSS (Stylesheet)' },
            { value: 'code', label: 'Code (JavaScript)' },
          ]}
          required
        />

        {templateType !== 'base' && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>{t('Base template to copy content from')}</Text>
            {loadingTemplates ? (
              <Group gap="xs">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">{t('Loading templates...')}</Text>
              </Group>
            ) : templatesError ? (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {templatesError}
              </Alert>
            ) : baseTemplateOptions.length === 0 ? (
              <Alert icon={<IconAlertCircle size={16} />} color="gray" variant="light">
                {t('No templates available')}
              </Alert>
            ) : (
              <Select
                placeholder={t('Select templates')}
                data={baseTemplateOptions}
                value={selectedBaseCode}
                onChange={(val) => {
                  setSelectedBaseCode(val);
                  if (val) void fetchBaseRaw(val);
                }}
                searchable
                clearable
                nothingFoundMessage={t('No templates found')}
              />
            )}
          </Stack>
        )}

        <div>
          <Text size="sm" fw={500} mb={4}>
            {t('Content')} ({getLanguageForPartType(templateType)})
          </Text>
          <Text size="xs" c="dimmed" mb={8}>
            {templateType === 'base' || templateType === 'header' || templateType === 'footer' 
              ? t('Use Jinja2 syntax: {{variable}}, {% for %}, {% if %}')
              : templateType === 'css'
              ? t('Standard CSS syntax')
              : t('JavaScript code')}
          </Text>
          <Textarea
            value={templateContent}
            onChange={(e) => setTemplateContent(e.currentTarget.value)}
            rows={15}
            required
            styles={{
              input: {
                fontFamily: 'monospace',
                fontSize: '13px',
                lineHeight: '1.5',
              },
            }}
          />
        </div>

        <Group justify="flex-end">
          <Button 
            variant="subtle" 
            onClick={onClose}
            disabled={loading}
          >
            {t('Cancel')}
          </Button>
          <Button 
            onClick={onSubmit}
            loading={loading}
            leftSection={<IconPlus size={16} />}
          >
            {t('Create Template')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
