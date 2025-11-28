import { Grid, TextInput, Textarea, Select, Paper } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';

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
  onUpdate?: (data: any) => void;
}

export function DetailsTab({ order, suppliers, stockLocations, canEdit, onUpdate }: DetailsTabProps) {
  const { t } = useTranslation();

  // Parse dates
  const issueDate = order.issue_date ? new Date(order.issue_date) : null;
  const targetDate = order.target_date ? new Date(order.target_date) : null;

  return (
    <Paper p="md" withBorder>
      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label={t('Order Reference')}
            value={order.reference}
            readOnly={!canEdit}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label={t('Supplier Reference')}
            value={order.supplier_reference || ''}
            readOnly={!canEdit}
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <TextInput
            label={t('Description')}
            value={order.description || ''}
            readOnly={!canEdit}
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
            readOnly
            disabled
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <Select
            label={t('Destination')}
            value={order.destination ? String(order.destination) : ''}
            data={stockLocations.map(loc => ({ value: String(loc.pk), label: loc.name }))}
            readOnly
            disabled
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <Textarea
            label={t('Notes')}
            value={order.notes || ''}
            readOnly
            minRows={4}
          />
        </Grid.Col>
      </Grid>
    </Paper>
  );
}
