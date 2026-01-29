/**
 * ReceiveStockForm Component
 * 
 * Reusable form for receiving stock with full details including:
 * - Batch codes, expiry/reset dates
 * - Container information
 * - Supplier BA details
 * - Transport conditions
 * 
 * Used in:
 * - Procurement > Receive Stock tab
 * - Inventory > Parts > Add Stock
 */

import { useState, useEffect } from 'react';
import { Grid, Select, NumberInput, TextInput, Textarea, Checkbox, Divider, Button, Table, ActionIcon, Alert } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconPlus, IconTrash, IconAlertTriangle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface ContainerRow {
  id: string;
  num_containers: number;
  products_per_container: number;
  unit: string;
  value: number;
  is_damaged: boolean;
  is_unsealed: boolean;
  is_mislabeled: boolean;
}

export interface ReceiveStockFormData {
  line_item?: string;
  part_id?: string;
  quantity: number;
  location: string;
  batch_code: string;
  supplier_batch_code: string;
  serial_numbers: string;
  packaging: string;
  transferable: boolean;  // Replaces status - determines if stock is transferable while in quarantine
  supplier_id: string;
  supplier_um_id: string;
  notes: string;
  manufacturing_date: Date | null;
  expected_quantity: number;
  expiry_date: Date | null;
  reset_date: Date | null;
  use_expiry: boolean;
  containers: ContainerRow[];
  containers_cleaned: boolean;
  supplier_ba_no: string;
  supplier_ba_date: Date | null;
  accord_ba: boolean;
  is_list_supplier: boolean;
  clean_transport: boolean;
  temperature_control: boolean;
  temperature_conditions_met: boolean;
}

interface ReceiveStockFormProps {
  formData: ReceiveStockFormData;
  onChange: (data: ReceiveStockFormData) => void;
  
  // Optional: for procurement context (line items)
  lineItems?: Array<{ value: string; label: string }>;
  onLineItemChange?: (value: string | null) => void;
  maxQuantity?: number;
  
  // Optional: for inventory context (fixed article)
  fixedArticle?: {
    id: string;
    name: string;
    ipn: string;
  };
  
  // Required: locations and statuses
  locations: Array<{ value: string; label: string }>;
  stockStatuses: Array<{ value: string; label: string }>;
  systemUms: Array<{ value: string; label: string }>;
  suppliers: Array<{ value: string; label: string }>;
  
  // Supplier context
  fixedSupplier?: {
    id: string;
    name: string;
  };
  
  // Article Manufacturer UM (read-only, shown in Received Quantity label)
  manufacturerUm?: string;
  
  // Article lotallexp flag - if false or missing, stock goes directly to OK state
  // and Transferable checkbox is hidden
  articleLotallexp?: boolean;
}

export function ReceiveStockForm({
  formData,
  onChange,
  lineItems,
  onLineItemChange,
  maxQuantity,
  fixedArticle,
  locations,
  stockStatuses,
  systemUms,
  suppliers,
  fixedSupplier,
  manufacturerUm,
  articleLotallexp,
}: ReceiveStockFormProps) {
  const { t } = useTranslation();
  const [isFirstContainer, setIsFirstContainer] = useState(true);
  const [hasSetExpectedQuantity, setHasSetExpectedQuantity] = useState(false);

  // Reset flags when form is reset (containers become empty and quantity is 0)
  useEffect(() => {
    if (formData.containers.length === 0 && formData.quantity === 0) {
      setIsFirstContainer(true);
      setHasSetExpectedQuantity(false);
    }
  }, [formData.containers.length, formData.quantity]);

  const updateField = (field: keyof ReceiveStockFormData, value: any) => {
    onChange({ ...formData, [field]: value });
  };

  const handleQuantityChange = (value: number) => {
    console.log('[ReceiveStockForm] handleQuantityChange called:', {
      value,
      hasSetExpectedQuantity,
      currentExpectedQuantity: formData.expected_quantity
    });
    
    // Auto-fill Expected Quantity: copy value to expected_quantity while it's still 0
    // This happens for every keystroke until user manually changes expected_quantity
    if (formData.expected_quantity === 0 && value > 0) {
      console.log('[ReceiveStockForm] Auto-filling expected_quantity with:', value);
      // Update both fields at once
      onChange({ 
        ...formData, 
        quantity: value,
        expected_quantity: value 
      });
    } else {
      // Just update quantity (user has manually set expected_quantity)
      updateField('quantity', value);
    }
  };

  const addContainerRow = () => {
    const newContainer: ContainerRow = {
      id: Date.now().toString(),
      num_containers: 1,
      // Set products_per_container to received quantity only for first container
      products_per_container: isFirstContainer && formData.quantity > 0 ? formData.quantity : 1,
      unit: 'pcs',
      value: 0,
      is_damaged: false,
      is_unsealed: false,
      is_mislabeled: false,
    };
    onChange({ ...formData, containers: [...formData.containers, newContainer] });
    
    // Mark that first container has been added
    if (isFirstContainer) {
      setIsFirstContainer(false);
    }
  };

  const removeContainerRow = (id: string) => {
    onChange({ ...formData, containers: formData.containers.filter(c => c.id !== id) });
  };

  const updateContainerRow = (id: string, field: keyof ContainerRow, value: any) => {
    onChange({
      ...formData,
      containers: formData.containers.map(c => 
        c.id === id ? { ...c, [field]: value } : c
      )
    });
  };

  return (
    <Grid>
      {/* Line Item Selection (Procurement) OR Fixed Article (Inventory) */}
      {fixedArticle ? (
        <Grid.Col span={12}>
          <TextInput
            label={t('Article')}
            value={`${fixedArticle.name} (${fixedArticle.ipn})`}
            disabled
          />
        </Grid.Col>
      ) : lineItems && (
        <Grid.Col span={12}>
          <Select
            label={t('Line Item')}
            placeholder={t('Select item to receive')}
            data={lineItems}
            value={formData.line_item}
            onChange={onLineItemChange}
            searchable
            required
          />
        </Grid.Col>
      )}

      {/* Supplier Field - readonly if from procurement, selectable if from inventory - MOVED TO TOP */}
      <Grid.Col span={12}>
        {fixedSupplier ? (
          <TextInput
            label={t('Supplier')}
            value={fixedSupplier.name}
            disabled
          />
        ) : (
          <Select
            label={t('Supplier')}
            placeholder={t('Select supplier')}
            data={suppliers}
            value={formData.supplier_id || null}
            onChange={(value) => updateField('supplier_id', value || '')}
            searchable
            clearable
          />
        )}
      </Grid.Col>

      {/* Row 1: Received Quantity (with Manufacturer UM in label), Expected Quantity (2 columns) */}
      <Grid.Col span={6}>
        <NumberInput
          label={manufacturerUm ? `${t('Received Quantity')} (${manufacturerUm})` : t('Received Quantity')}
          placeholder="0"
          value={formData.quantity}
          onChange={(value) => handleQuantityChange(Number(value) || 0)}
          min={0.01}
          step={1}
          required
        />
      </Grid.Col>

      <Grid.Col span={6}>
        <NumberInput
          label={manufacturerUm ? `${t('Expected Quantity')} (${manufacturerUm})` : t('Expected Quantity')}
          placeholder="0"
          value={formData.expected_quantity}
          onChange={(value) => updateField('expected_quantity', Number(value) || 0)}
          min={0}
          step={1}
        />
      </Grid.Col>

      {/* Warning when received > expected */}
      {formData.quantity > 0 && formData.expected_quantity > 0 && formData.quantity > formData.expected_quantity && (
        <Grid.Col span={12}>
          <Alert 
            icon={<IconAlertTriangle size={16} />} 
            title={t('Quantity Exceeds Expected')} 
            color="yellow"
            variant="light"
          >
            {t('Received quantity')} ({formData.quantity}) {t('is greater than expected quantity')} ({formData.expected_quantity}). 
            {' '}{t('You can still save this stock entry.')}
          </Alert>
        </Grid.Col>
      )}

      {/* Row 2: Batch Code, Supplier Batch Code, Manufacturing Date (3 columns) */}
      <Grid.Col span={4}>
        <TextInput
          label={t('Batch Code')}
          placeholder={t('Enter batch code')}
          value={formData.batch_code}
          onChange={(e) => updateField('batch_code', e.target.value)}
        />
      </Grid.Col>

      <Grid.Col span={4}>
        <TextInput
          label={t('Supplier Batch Code')}
          placeholder={t('Enter supplier batch code')}
          value={formData.supplier_batch_code}
          onChange={(e) => updateField('supplier_batch_code', e.target.value)}
        />
      </Grid.Col>

      <Grid.Col span={4}>
        <DateInput
          label={t('Manufacturing Date')}
          placeholder={t('Select date')}
          value={formData.manufacturing_date}
          onChange={(value) => updateField('manufacturing_date', value)}
          clearable
        />
      </Grid.Col>

      {/* Row 3: Use Expiry checkbox + Expiry/Reset Date (1/2 + 1/2) */}
      <Grid.Col span={6}>
        <Checkbox
          label={t('Use Expiry Date (uncheck for Reset Date)')}
          checked={formData.use_expiry}
          onChange={(e) => updateField('use_expiry', e.currentTarget.checked)}
          mt="md"
        />
      </Grid.Col>

      <Grid.Col span={6}>
        {formData.use_expiry ? (
          <DateInput
            label={t('Expiry Date')}
            placeholder={t('Select expiry date')}
            value={formData.expiry_date}
            onChange={(value) => updateField('expiry_date', value)}
            clearable
          />
        ) : (
          <DateInput
            label={t('Reset Date')}
            placeholder={t('Select reset date')}
            value={formData.reset_date}
            onChange={(value) => updateField('reset_date', value)}
            clearable
          />
        )}
      </Grid.Col>

      {/* Row 4: Location + Transferable (only shown if articleLotallexp is true) */}
      <Grid.Col span={articleLotallexp ? 8 : 12}>
        <Select
          label={t('Location')}
          placeholder={t('Select location')}
          data={locations}
          value={formData.location}
          onChange={(value) => updateField('location', value || '')}
          searchable
          required
        />
      </Grid.Col>

      {/* Transferable checkbox - only shown if article has lotallexp=true (goes to quarantine) */}
      {articleLotallexp && (
        <Grid.Col span={4}>
          <Checkbox
            label={t('Transferable')}
            description={t('Stock can be transferred while in quarantine')}
            checked={formData.transferable}
            onChange={(e) => updateField('transferable', e.currentTarget.checked)}
            mt="md"
          />
        </Grid.Col>
      )}

      {/* Containers Section */}
      <Grid.Col span={12}>
        <Divider my="md" label={t('Containers')} labelPosition="center" />
      </Grid.Col>

      <Grid.Col span={12}>
        <Button 
          size="xs" 
          variant="light" 
          leftSection={<IconPlus size={14} />}
          onClick={addContainerRow}
        >
          {t('Add Container Row')}
        </Button>
      </Grid.Col>

      {formData.containers.length > 0 && (
        <Grid.Col span={12}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Num')}</Table.Th>
                <Table.Th>{t('Products/Container')}</Table.Th>
                <Table.Th>{t('Damaged')}</Table.Th>
                <Table.Th>{t('Unsealed')}</Table.Th>
                <Table.Th>{t('Mislabeled')}</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {formData.containers.map((container) => (
                <Table.Tr key={container.id}>
                  <Table.Td>
                    <NumberInput
                      value={container.num_containers}
                      onChange={(val) => updateContainerRow(container.id, 'num_containers', Number(val) || 1)}
                      min={1}
                      size="xs"
                      styles={{ input: { width: '60px' } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      value={container.products_per_container}
                      onChange={(val) => updateContainerRow(container.id, 'products_per_container', Number(val) || 1)}
                      min={1}
                      size="xs"
                      styles={{ input: { width: '60px' } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Checkbox
                      checked={container.is_damaged}
                      onChange={(e) => updateContainerRow(container.id, 'is_damaged', e.currentTarget.checked)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Checkbox
                      checked={container.is_unsealed}
                      onChange={(e) => updateContainerRow(container.id, 'is_unsealed', e.currentTarget.checked)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Checkbox
                      checked={container.is_mislabeled}
                      onChange={(e) => updateContainerRow(container.id, 'is_mislabeled', e.currentTarget.checked)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      size="xs"
                      color="red"
                      variant="subtle"
                      onClick={() => removeContainerRow(container.id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Grid.Col>
      )}

      <Grid.Col span={12}>
        <Checkbox
          label={t('Containers Cleaned')}
          checked={formData.containers_cleaned}
          onChange={(e) => updateField('containers_cleaned', e.currentTarget.checked)}
        />
      </Grid.Col>

      {/* Supplier BA Section */}
      <Grid.Col span={12}>
        <Divider my="md" />
      </Grid.Col>

      <Grid.Col span={6}>
        <TextInput
          label={t('Supplier BA No')}
          placeholder={t('Enter BA number')}
          value={formData.supplier_ba_no}
          onChange={(e) => updateField('supplier_ba_no', e.target.value)}
        />
      </Grid.Col>

      <Grid.Col span={6}>
        <DateInput
          label={t('Supplier BA Date')}
          placeholder={t('Select date')}
          value={formData.supplier_ba_date}
          onChange={(value) => updateField('supplier_ba_date', value)}
          clearable
        />
      </Grid.Col>

      <Grid.Col span={6}>
        <Checkbox
          label={t('In Accordance with Supplier BA')}
          checked={formData.accord_ba}
          onChange={(e) => updateField('accord_ba', e.currentTarget.checked)}
        />
      </Grid.Col>

      <Grid.Col span={6}>
        <Checkbox
          label={t('Supplier in List')}
          checked={formData.is_list_supplier}
          onChange={(e) => updateField('is_list_supplier', e.currentTarget.checked)}
        />
      </Grid.Col>

      {/* Transport Section */}
      <Grid.Col span={12}>
        <Divider my="md" label={t('Transport')} labelPosition="center" />
      </Grid.Col>

      <Grid.Col span={6}>
        <Checkbox
          label={t('Clean Transport')}
          checked={formData.clean_transport}
          onChange={(e) => updateField('clean_transport', e.currentTarget.checked)}
        />
      </Grid.Col>

      <Grid.Col span={6}>
        <Checkbox
          label={t('Temperature Control Transport')}
          checked={formData.temperature_control}
          onChange={(e) => updateField('temperature_control', e.currentTarget.checked)}
        />
      </Grid.Col>

      {formData.temperature_control && (
        <Grid.Col span={12}>
          <Checkbox
            label={t('Temperature Conditions Met')}
            checked={formData.temperature_conditions_met}
            onChange={(e) => updateField('temperature_conditions_met', e.currentTarget.checked)}
          />
        </Grid.Col>
      )}

      {/* Notes */}
      <Grid.Col span={12}>
        <Divider my="md" />
      </Grid.Col>

      <Grid.Col span={12}>
        <Textarea
          label={t('Notes')}
          placeholder={t('Additional notes')}
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          minRows={3}
        />
      </Grid.Col>
    </Grid>
  );
}
