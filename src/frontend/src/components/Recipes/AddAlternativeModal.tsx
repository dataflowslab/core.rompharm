import { useState } from 'react';
import {
  Modal,
  Stack,
  Select,
  NumberInput,
  Textarea,
  Button,
  Group,
  Divider,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { IconPlus } from '@tabler/icons-react';
import api from '../../services/api';

interface Part {
  id: number;
  name: string;
  IPN: string;
}

interface AddAlternativeModalProps {
  opened: boolean;
  onClose: () => void;
  recipeId: string;
  itemIndex: number;
  onSuccess: () => void;
}

export function AddAlternativeModal({
  opened,
  onClose,
  recipeId,
  itemIndex,
  onSuccess,
}: AddAlternativeModalProps) {
  const { t } = useTranslation();
  const [parts, setParts] = useState<Part[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');

  const searchParts = async (query: string) => {
    if (!query || query.length < 2) {
      setParts([]);
      return;
    }

    try {
      const response = await api.get('/api/recipes/parts', {
        params: { search: query },
      });
      setParts(response.data);
    } catch (error) {
      console.error('Failed to search parts:', error);
    }
  };

  const handleAdd = async () => {
    if (!selectedPart) {
      alert(t('Please select a product'));
      return;
    }

    setSaving(true);
    try {
      const alternativeData = {
        product_id: parseInt(selectedPart),
        q: quantity,
        start: startDate.toISOString(),
        fin: endDate?.toISOString(),
        notes: notes || undefined,
      };

      await api.post(
        `/api/recipes/${recipeId}/items/${itemIndex}/alternatives`,
        alternativeData
      );

      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Failed to add alternative:', error);
      alert(error.response?.data?.detail || t('Failed to add alternative'));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedPart(null);
    setQuantity(1);
    setStartDate(new Date());
    setEndDate(null);
    setNotes('');
    setSearchValue('');
    setParts([]);
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        onClose();
        resetForm();
      }}
      title={t('Add Alternative Product')}
      size="lg"
    >
      <Stack gap="md">
        <Select
          label={t('Product')}
          placeholder={t('Search for product...')}
          data={parts.map((part) => ({
            value: String(part.id),
            label: `${part.name} (${part.IPN})`,
          }))}
          value={selectedPart}
          onChange={setSelectedPart}
          onSearchChange={(query) => {
            setSearchValue(query);
            searchParts(query);
          }}
          searchValue={searchValue}
          searchable
          clearable
          nothingFoundMessage={
            searchValue.length < 2
              ? t('Type at least 2 characters')
              : t('No products found')
          }
        />

        <NumberInput
          label={t('Quantity')}
          value={quantity}
          onChange={(value) => setQuantity(Number(value) || 1)}
          min={0}
          step={0.1}
        />

        <DatePickerInput
          label={t('Start Date')}
          value={startDate}
          onChange={(date) => setStartDate(date || new Date())}
        />

        <DatePickerInput
          label={t('End Date')}
          placeholder={t('Optional')}
          value={endDate}
          onChange={setEndDate}
          clearable
        />

        <Textarea
          label={t('Notes')}
          placeholder={t('Optional notes...')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          minRows={3}
        />

        <Divider />

        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={() => {
              onClose();
              resetForm();
            }}
          >
            {t('Cancel')}
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleAdd}
            loading={saving}
          >
            {t('Add')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
