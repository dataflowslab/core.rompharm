import { Textarea, Button, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { SafeSelect } from '../Common/SafeSelect';

interface RequestState {
  _id: string;
  name: string;
  slug: string;
  needs_comment?: boolean;
}

interface DecisionSectionProps {
  status: string;
  reason: string;
  isCompleted: boolean;
  availableStates: RequestState[];
  onStatusChange: (value: string | null) => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function DecisionSection({
  status,
  reason,
  isCompleted,
  availableStates,
  onStatusChange,
  onReasonChange,
  onSubmit,
  submitting
}: DecisionSectionProps) {
  const { t } = useTranslation();

  // Find if selected status needs a comment
  const selectedState = availableStates.find(s => s._id === status);
  const needsComment = selectedState?.needs_comment === true;

  return (
    <>
      <SafeSelect
        label={t('Status')}
        placeholder={t('Select status')}
        data={availableStates}
        valueKey="_id"
        labelKey="name"
        value={status}
        onChange={onStatusChange}
        required
        mb="md"
        disabled={isCompleted}
      />

      {needsComment && (
        <Textarea
          label={t('Comment')}
          placeholder={t('Enter comment')}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          required
          minRows={3}
          mb="md"
          disabled={isCompleted}
        />
      )}

      {status && (
        <Group justify="flex-end" mb="xl">
          <Button
            onClick={onSubmit}
            loading={submitting}
            disabled={isCompleted}
            color={needsComment ? 'red' : 'green'}
          >
            {t('Save Decision')}
          </Button>
        </Group>
      )}
    </>
  );
}
