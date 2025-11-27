import { useState, useEffect } from 'react';
import { Stack, MultiSelect, Text, Alert, Loader } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';

interface TemplateSelectorProps {
  value: string[];
  onChange: (templates: string[]) => void;
}

interface Template {
  code: string;
  name: string;
  description?: string;
}

export function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await api.get('/api/templates');
      setTemplates(response.data);
      setError('');
    } catch (err: any) {
      console.error('Failed to load templates:', err);
      setError(t('Failed to load templates'));
    } finally {
      setLoading(false);
    }
  };

  const templateOptions = templates.map((template) => ({
    value: template.code,
    label: `${template.name} (${template.code})`,
  }));

  if (loading) {
    return (
      <Stack gap="sm" align="center">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">{t('Loading templates...')}</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
        {error}
      </Alert>
    );
  }

  return (
    <Stack gap="sm">
      <div>
        <Text size="sm" fw={500} mb="xs">
          {t('Document Templates')}
        </Text>
        <Text size="xs" c="dimmed" mb="xs">
          {t('Select templates for document generation')}
        </Text>
      </div>

      {templates.length === 0 ? (
        <Alert icon={<IconAlertCircle size={16} />} color="gray" variant="light">
          {t('No templates available')}
        </Alert>
      ) : (
        <MultiSelect
          data={templateOptions}
          value={value}
          onChange={onChange}
          placeholder={t('Select templates')}
          searchable
          clearable
          nothingFoundMessage={t('No templates found')}
          maxDropdownHeight={200}
        />
      )}
    </Stack>
  );
}
