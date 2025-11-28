import { useState } from 'react';
import { Grid, TextInput, Textarea, Select, Paper, Button, Group } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy } from '@tabler/icons-react';

interface Supplier {
  pk: number;
  name: string;
}

interface StockLocation {
  pk: number;
  name: string;
}

interface PurchaseOrder {
  pk: number;
  reference: string;
  description: string;
  supplier: number;
  supplier_detail?: {
    name: string;
    pk: number;
  };
  supplier_reference: string;
  order_currency: string;
  issue_date: string;
  target_date: string;
  destination?: number;
  destination_detail?: {
    name: string;
  };
  notes: string;
  status: number;
  status_text: string;
}

interface DetailsTabProps {
  order: PurchaseOrder;
  suppliers: Supplier[];
  stockLocations: StockLocation[];
  canEdit: boolean;
  onUpdate?: (data: any) => Promise<void>;
}

export function DetailsTab({ order, stockLocations, canEdit, onUpdate }: DetailsTabProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  
  // Editable state
  const [formData, setFormData] = useState({
    reference: order.reference || '',
    supplier_reference: order.supplier_reference || '',
    description: order.description || '',
    target_date: order.target_date || '',
    destination: order.destination ? String(order.destination) : '',
    notes: order.notes || '',
  });

  // Parse dates
  const issueDate = order.issue_date ? new Date(order.issue_date) : null;
  const targetDate = formData.target_date ? new Date(formData.target_date) : null;

  const handleSave = async () => {
    if (!onUpdate) return;

    setSaving(true);
    try {
      const updateData: any = {
        reference: formData.reference,
        supplier_reference: formData.supplier_reference,
        description: formData.description,
        target_date: formData.target_date,
        notes: formData.notes,
      };

      if (formData.destination) {
        updateData.destination = parseInt(formData.destination);
      }

      await onUpdate(updateData);
      
      notifications.show({
        title: t('Success'),
        message: t('Order updated successfully'),
        color: 'green',
      });
    } catch (error: any) {
      console.error('Failed to update order:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update order'),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    return (
      formData.reference !== (order.reference || '') ||
      formData.supplier_reference !== (order.supplier_reference || '') ||
      formData.description !== (order.description || '') ||
      formData.target_date !== (order.target_date || '') ||
      formData.destination !== (order.destination ? String(order.destination) : '') ||
      formData.notes !== (order.notes || '')
    );
  };

  return (
    <Paper p="md" withBorder>
      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label={t('Order Reference')}
            value={formData.reference}
            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            readOnly={!canEdit}
            disabled={!canEdit}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label={t('Supplier Reference')}
            value={formData.supplier_reference}
            onChange={(e) => setFormData({ ...formData, supplier_reference: e.target.value })}
            readOnly={!canEdit}
            disabled={!canEdit}
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <TextInput
            label={t('Description')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            readOnly={!canEdit}
            disabled={!canEdit}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label={t('Supplier')}
            value={order.supplier_detail?.name || `Supplier ${order.supplier}`}
            readOnly
            disabled
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label={t('Currency')}
            value={order.order_currency || 'EUR'}
            readOnly
            disabled
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <DatePickerInput
            label={t('Issue Date')}
            value={issueDate}
            readOnly
            disabled
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <DatePickerInput
            label={t('Target Date')}
            value={targetDate}
            onChange={(date) => {
              if (date) {
                setFormData({ ...formData, target_date: date.toISOString().split('T')[0] });
              }
            }}
            readOnly={!canEdit}
            disabled={!canEdit}
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <Select
            label={t('Destination')}
            value={formData.destination}
            onChange={(value) => setFormData({ ...formData, destination: value || '' })}
            data={stockLocations.map(loc => ({ value: String(loc.pk), label: loc.name }))}
            readOnly={!canEdit}
            disabled={!canEdit}
            searchable
            clearable
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <Textarea
            label={t('Notes')}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            readOnly={!canEdit}
            disabled={!canEdit}
            minRows={4}
          />
        </Grid.Col>

        {canEdit && (
          <Grid.Col span={12}>
            <Group justify="flex-end">
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSave}
                loading={saving}
                disabled={!hasChanges()}
              >
                {t('Save Changes')}
              </Button>
            </Group>
          </Grid.Col>
        )}
      </Grid>
    </Paper>
  );
}
