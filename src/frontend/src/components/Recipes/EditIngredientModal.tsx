import { useState } from 'react';
import {
  Modal,
  Stack,
  NumberInput,
  Checkbox,
  Textarea,
  Button,
  Group,
  Divider,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { IconDeviceFloppy } from '@tabler/icons-react';
import api from '../../services/api';

interface RecipeItem {
  type: number;
  id?: number;
  q?: number;
  start?: string;
  fin?: string;
  mandatory: boolean;
  notes?: string;
  part_detail?: {
    name: string;
    IPN: string;
  };
}

interface EditIngredientModalProps {
  opened: boolean;
  onClose: () => void;
  recipeId: string;
  item: RecipeItem;
  itemIndex: number;
  altIndex?: number; // Optional: if editing an alternative
  onSuccess: () => void;
}

export function EditIngredientModal({
  opened,
  onClose,
  recipeId,
  item,
  itemIndex,
  altIndex,
  onSuccess,
}: EditIngredientModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  // Form state
  const [quantity, setQuantity] = useState<number>(item.q || 1);
  const [startDate, setStartDate] = useState<Date | null>(
    item.start ? new Date(item.start) : new Date()
  );
  const [endDate, setEndDate] = useState<Date | null>(
    item.fin ? new Date(item.fin) : null
  );
  const [mandatory, setMandatory] = useState(item.mandatory);
  const [notes, setNotes] = useState(item.notes || '');

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: any = {
        type: item.type,
        notes: notes || undefined,
      };

      if (item.type === 1) {
        updateData.product_id = item.id; // Product cannot be changed
        updateData.q = quantity;
        updateData.start = startDate?.toISOString();
        if (endDate) {
          updateData.fin = endDate.toISOString();
        }
      }

      // If altIndex is provided, we're editing an alternative
      if (altIndex !== undefined) {
        await api.put(
          `/api/recipes/${recipeId}/items/${itemIndex}/alternatives/${altIndex}`,
          updateData
        );
      } else {
        // Otherwise, editing a regular item
        updateData.mandatory = mandatory;
        await api.put(`/api/recipes/${recipeId}/items/${itemIndex}`, updateData);
      }

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
            <TextInput
              label={t('Product')}
              value={item.part_detail ? `${item.part_detail.name} (${item.part_detail.IPN})` : `Product ${item.id}`}
              disabled
              description={t('Product cannot be changed. To change product, delete this ingredient and add a new one.')}
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
