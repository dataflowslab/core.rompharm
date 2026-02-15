import { Modal, Stack, Alert, Text, Group, Button } from '@mantine/core';
import { IconAlertCircle, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface DeleteTemplatePartModalProps {
  opened: boolean;
  onClose: () => void;
  deletingType: string;
  deletingCode: string;
  onConfirm: () => void;
  loading: boolean;
}

export function DeleteTemplatePartModal({
  opened,
  onClose,
  deletingType,
  deletingCode,
  onConfirm,
  loading,
}: DeleteTemplatePartModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Delete Part')}
      size="md"
    >
      <Stack>
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          <Text size="sm" fw={500}>
            {t('Are you sure you want to delete this part?')}
          </Text>
          <Text size="sm" mt={4}>
            {deletingType} ({deletingCode})
          </Text>
        </Alert>

        <Text size="sm" c="dimmed">
          {t('This action cannot be undone.')}
        </Text>

        <Group justify="flex-end">
          <Button
            variant="subtle"
            onClick={onClose}
            disabled={loading}
          >
            {t('Cancel')}
          </Button>
          <Button
            color="red"
            onClick={onConfirm}
            loading={loading}
            leftSection={<IconTrash size={16} />}
          >
            {t('Delete')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
