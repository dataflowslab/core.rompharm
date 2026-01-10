import { Modal, Grid, NumberInput, Button, Group, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { SafeSelect } from '../Common/SafeSelect';

interface Part {
  _id: string;
  name: string;
  IPN: string;
}

interface BatchOption {
  value: string;
  label: string;
  expiry_date?: string;
  quantity?: number;
  state_name?: string;
  is_transferable?: boolean;
  is_requestable?: boolean;
}

interface AddItemModalProps {
  opened: boolean;
  onClose: () => void;
  parts: Part[];
  selectedPartData?: Part | null;
  batchOptions: BatchOption[];
  newItem: {
    part: string;
    batch_code: string;
    quantity: number;
  };
  onPartSearchChange: (query: string) => void;
  onPartSelect: (partId: string | null) => void;
  onBatchCodeChange: (value: string | null) => void;
  onQuantityChange: (value: number) => void;
  onAdd: () => void;
}

export function AddItemModal({
  opened,
  onClose,
  parts,
  selectedPartData,
  batchOptions,
  newItem,
  onPartSearchChange,
  onPartSelect,
  onBatchCodeChange,
  onQuantityChange,
  onAdd
}: AddItemModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Add Item')}
      size="md"
    >
      <Grid>
        <Grid.Col span={12}>
          <SafeSelect
            label={t('Article')}
            placeholder={t('Search for article...')}
            data={parts.map(part => ({
              _id: part._id,
              value: part._id,
              label: `${part.name} (${part.IPN})`,
              name: part.name,
              IPN: part.IPN
            }))}
            value={newItem.part}
            onChange={onPartSelect}
            onSearchChange={onPartSearchChange}
            searchable
            clearable
            required
            debug={true}
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <SafeSelect
            label={t('Batch Code')}
            placeholder={t('Select batch code...')}
            data={batchOptions}
            value={newItem.batch_code}
            onChange={onBatchCodeChange}
            disabled={!newItem.part}
            searchable
            required
            debug={true}
          />
          {newItem.batch_code && (() => {
            const selectedBatch = batchOptions.find(b => b.value === newItem.batch_code);
            if (selectedBatch && selectedBatch.is_requestable && !selectedBatch.is_transferable) {
              return (
                <Group gap="xs" mt="xs">
                  <IconAlertTriangle size={16} color="red" />
                  <Text size="sm" c="red">
                    {t('Warning')}: {selectedBatch.state_name} - {t('Not transferable')}
                  </Text>
                </Group>
              );
            }
            return null;
          })()}
        </Grid.Col>

        <Grid.Col span={12}>
          <NumberInput
            label={t('Quantity')}
            placeholder="1"
            value={newItem.quantity}
            onChange={(value) => onQuantityChange(Number(value) || 1)}
            min={1}
            step={1}
            required
          />
        </Grid.Col>
      </Grid>

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          {t('Cancel')}
        </Button>
        <Button onClick={onAdd}>
          {t('Add')}
        </Button>
      </Group>
    </Modal>
  );
}
