import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Select,
  NumberInput,
  Checkbox,
  Textarea,
  Button,
  Group,
  Divider,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { IconDeviceFloppy } from '@tabler/icons-react';
import api from '../../services/api';

interface Part {
  id: number;
  name: string;
  IPN: string;
}

interface RecipeItem {
  type: number;
  id?: number;
  q?: number;
  start?: string;
  fin?: string;
  mandatory: boolean;
  notes?: string;
}

interface EditIngredientModalProps {
  opened: boolean;
  onClose: () => void;
  recipeId: string;
  item: RecipeItem;
  itemIndex: number;
  onSuccess: () => void;
}

export function EditIngredientModal({
  opened,
  onClose,
  recipeId,
  item,
  itemIndex,
  onSuccess,
}: EditIngredientModalProps) {
  const { t } = useTranslation();
  const [parts, setParts] = useState<Part[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedPart, setSelectedPart] = useState<string | null>(
    item.id ? String(item.id) : null
  );
  const [quantity, setQuantity] = useState<number>(item.q || 1);
  const [startDate, setStartDate] = useState<Date | null>(
    item.start ? new Date(item.start) : new Date()
  );
  const [endDate, setEndDate] = useState<Date | null>(
    item.fin ? new Date(item.fin) : null
  );
  const [mandatory, setMandatory] = useState(item.mandatory);
  const [notes, setNotes] = useState(item.notes || '');

  useEffect(() => {
    if (opened && item.type === 1) {
      // Load initial part if exists
      if (item.id) {
        searchParts(String(item.id));
      }
    }
  }, [opened, item]);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: any = {
        type: item.type,
        mandatory,
        notes: notes || undefined,
      };

      if (item.type === 1) {
        updateData.product_id = selectedPart ? parseInt(selectedPart) : item.id;
        updateData.q = quantity;
        updateData.start = startDate?.toISOString();
        if (endDate) {
          updateData.fin = endDate.toISOString();
        }
      }

      await api.put(`/api/recipes/${recipeId}/items/${itemIndex}`, updateData);

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to update item:', error);
      alert(error.response?.data?.detail || t('Failed to update ingredient'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Edit Ingredient')}
      size="lg"
    >
      <Stack gap="md">
        {item.type === 1 && (
          <>
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
          </>
        )}

        <Checkbox
          label={t('Mandatory')}
          checked={mandatory}
          onChange={(e) => setMandatory(e.currentTarget.checked)}
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
          <Button variant="default" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSave}
            loading={saving}
          >
            {t('Save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
