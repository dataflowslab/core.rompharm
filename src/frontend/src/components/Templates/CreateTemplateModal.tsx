import { Modal, Stack, TextInput, Select, Text, Textarea, Group, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

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
            setTemplateContent(getDefaultContent(value || 'base'));
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
