import { Modal, Stack, TextInput, Textarea, Group, Button } from '@mantine/core';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface EditTemplateNameModalProps {
  opened: boolean;
  onClose: () => void;
  templateName: string;
  setTemplateName: (name: string) => void;
  templateDescription: string;
  setTemplateDescription: (description: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function EditTemplateNameModal({
  opened,
  onClose,
  templateName,
  setTemplateName,
  templateDescription,
  setTemplateDescription,
  onSubmit,
  loading,
}: EditTemplateNameModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Edit Template')}
      size="md"
    >
      <Stack>
        <TextInput
          label={t('Template Name')}
          placeholder={t('My Template')}
          value={templateName}
          onChange={(e) => setTemplateName(e.currentTarget.value)}
          required
        />

        <Textarea
          label={t('Description')}
          placeholder={t('Template description...')}
          value={templateDescription}
          onChange={(e) => setTemplateDescription(e.currentTarget.value)}
          rows={3}
        />

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
            leftSection={<IconDeviceFloppy size={16} />}
          >
            {t('Save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
