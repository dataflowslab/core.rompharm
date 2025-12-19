import { Modal, Select, TextInput, Group, NumberInput, Textarea, Button } from '@mantine/core';

interface UnitOfMeasure {
  _id: string;
  name: string;
  symbol?: string;
  abrev: string;
}

interface Company {
  _id: string;
  name: string;
}

interface SupplierModalProps {
  opened: boolean;
  onClose: () => void;
  editingSupplier: any;
  supplierFormData: {
    supplier_id: string;
    supplier_code: string;
    um: string;
    notes: string;
    price: number;
    currency: string;
  };
  setSupplierFormData: (data: any) => void;
  suppliers: Company[];
  systemUMs: UnitOfMeasure[];
  loading: boolean;
  onSave: () => void;
}

export function SupplierModal({
  opened,
  onClose,
  editingSupplier,
  supplierFormData,
  setSupplierFormData,
  suppliers,
  systemUMs,
  loading,
  onSave,
}: SupplierModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
      size="lg"
    >
      <Select
        label="Supplier"
        placeholder="Select supplier"
        data={suppliers.map((sup) => ({ value: sup._id, label: sup.name }))}
        value={supplierFormData.supplier_id}
        onChange={(value) => setSupplierFormData({ ...supplierFormData, supplier_id: value || '' })}
        searchable
        required
        mb="sm"
        disabled={!!editingSupplier}
      />

      <TextInput
        label="Supplier Code"
        placeholder="Supplier's part number"
        value={supplierFormData.supplier_code}
        onChange={(e) => setSupplierFormData({ ...supplierFormData, supplier_code: e.target.value })}
        mb="sm"
      />

      <Select
        label="U.M."
        placeholder="Select unit of measure"
        data={systemUMs.map((um) => ({ 
          value: um.abrev, 
          label: `${um.name} (${um.abrev})` 
        }))}
        value={supplierFormData.um}
        onChange={(value) => setSupplierFormData({ ...supplierFormData, um: value || '' })}
        searchable
        clearable
        mb="sm"
      />

      <Group grow mb="sm">
        <NumberInput
          label="Price"
          placeholder="0.00"
          value={supplierFormData.price}
          onChange={(value) => setSupplierFormData({ ...supplierFormData, price: Number(value) || 0 })}
          decimalScale={2}
          fixedDecimalScale
        />
        <Select
          label="Currency"
          data={[
            { value: 'EUR', label: 'EUR' },
            { value: 'USD', label: 'USD' },
            { value: 'RON', label: 'RON' },
            { value: 'GBP', label: 'GBP' },
          ]}
          value={supplierFormData.currency}
          onChange={(value) => setSupplierFormData({ ...supplierFormData, currency: value || 'EUR' })}
        />
      </Group>

      <Textarea
        label="Notes"
        placeholder="Additional notes"
        value={supplierFormData.notes}
        onChange={(e) => setSupplierFormData({ ...supplierFormData, notes: e.target.value })}
        minRows={3}
        mb="md"
      />

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onSave} loading={loading}>
          {editingSupplier ? 'Update' : 'Add'}
        </Button>
      </Group>
    </Modal>
  );
}
