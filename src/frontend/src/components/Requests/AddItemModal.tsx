import { Modal, Grid, NumberInput, Button, Group, Text, Box, Divider } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { SafeSelect } from '../Common/SafeSelect';
import { BatchCodesTable } from './BatchCodesTable';

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
  location_name?: string;
  location_id?: string;
  state_name?: string;
  state_id?: string;
  is_transferable?: boolean;
  is_requestable?: boolean;
}

interface BatchSelection {
  batch_code: string;
  location_id: string;
  requested_quantity: number;
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
  batchSelections: BatchSelection[];
  onPartSearchChange: (query: string) => void;
  onPartSelect: (partId: string | null) => void;
  onBatchCodeChange: (value: string | null) => void;
  onQuantityChange: (value: number) => void;
  onBatchSelectionsChange: (selections: BatchSelection[]) => void;
  onAdd: () => void;
}

export function AddItemModal({
  opened,
  onClose,
  parts,
  selectedPartData,
  batchOptions,
  newItem,
  batchSelections,
  onPartSearchChange,
  onPartSelect,
  onBatchCodeChange,
  onQuantityChange,
  onBatchSelectionsChange,
  onAdd
}: AddItemModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Add Item')}
      size="xl"
    >
      <Grid>
        <Grid.Col span={12}>
          <SafeSelect
            label={t('Part')}
            placeholder={t('Search for part...')}
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
          <NumberInput
            label={t('Quantity (General)')}
            placeholder="0"
            description={t('Leave at 0 to specify quantities per batch below')}
            value={newItem.quantity}
            onChange={(value) => onQuantityChange(Number(value) || 0)}
            min={0}
            step={1}
          />
        </Grid.Col>

        {newItem.part && (
          <>
            <Grid.Col span={12}>
              <Divider my="sm" label={t('Select Batch Codes')} labelPosition="center" />
            </Grid.Col>

            <Grid.Col span={12}>
              <BatchCodesTable
                batchCodes={batchOptions.map(opt => ({
                  batch_code: opt.value,
                  quantity: opt.quantity || 0,
                  location_name: opt.location_name || '',
                  location_id: opt.location_id || '',
                  state_name: opt.state_name || '',
                  state_id: opt.state_id || '',
                  expiry_date: opt.expiry_date,
                  is_transferable: opt.is_transferable,
                  is_requestable: opt.is_requestable
                }))}
                selections={batchSelections}
                onSelectionChange={onBatchSelectionsChange}
              />
            </Grid.Col>
          </>
        )}
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
