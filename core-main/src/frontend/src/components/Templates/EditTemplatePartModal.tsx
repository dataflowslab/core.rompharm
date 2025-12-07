import { Modal, Stack, Text, Textarea, Group, Button } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface EditTemplatePartModalProps {
  opened: boolean;
  onClose: () => void;
  editingType: string;
  partContent: string;
  setPartContent: (content: string) => void;
  onSubmit: () => void;
  loading: boolean;
  loadingContent: boolean;
  getLanguageForPartType: (type: string) => string;
}

export function EditTemplatePartModal({
  opened,
  onClose,
  editingType,
  partContent,
  setPartContent,
  onSubmit,
  loading,
  loadingContent,
  getLanguageForPartType,
}: EditTemplatePartModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`${t('Edit')} ${editingType} ${t('part')}`}
      size="xl"
    >
      <Stack>
        <div>
          <Text size="sm" fw={500} mb={4}>
            {t('Content')} ({getLanguageForPartType(editingType)})
          </Text>
          <Text size="xs" c="dimmed" mb={8}>
            {editingType === 'base' || editingType === 'header' || editingType === 'footer' 
              ? t('Use Jinja2 syntax: {{variable}}, {% for %}, {% if %}')
              : editingType === 'css'
              ? t('Standard CSS syntax')
              : t('JavaScript code')}
          </Text>
          <Textarea
            value={partContent}
            onChange={(e) => setPartContent(e.currentTarget.value)}
            rows={20}
            required
            disabled={loadingContent}
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
          >
            {t('Save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
