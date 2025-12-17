import { useState, useEffect } from 'react';
import {
  Modal,
  Select,
  TextInput,
  NumberInput,
  Textarea,
  Button,
  Group,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';

interface AddStockModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  fixedArticleId?: string;
  fixedArticleName?: string;
  fixedArticleIpn?: string;
}

export function AddStockModal({
  opened,
  onClose,
  onSuccess,
  fixedArticleId,
  fixedArticleName,
  fixedArticleIpn,
}: AddStockModalProps) {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stockStatuses, setStockStatuses] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    supplier_id: '',
    part_id: fixedArticleId || '',
    quantity: 0,
    batch_code: '',
    supplier_batch_code: '',
    batch_date: null as Date | null,
    expiry_date: null as Date | null,
    status: '',
    purchase_price: 0,
    currency_id: '',
    notes: '',
  });

  useEffect(() => {
    if (opened) {
      fetchSuppliers();
      fetchStockStatuses();
      fetchCurrencies();
      if (!fixedArticleId) {
        fetchArticles();
      }
      
      // Reset form when modal opens
      setFormData({
        supplier_id: '',
        part_id: fixedArticleId || '',
        quantity: 0,
        batch_code: '',
        supplier_batch_code: '',
        batch_date: null,
        expiry_date: null,
        status: '',
        purchase_price: 0,
        currency_id: '',
        notes: '',
      });
    }
  }, [opened, fixedArticleId]);

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/modules/inventory/api/companies?is_supplier=true');
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const fetchStockStatuses = async () => {
    try {
      const response = await api.get('/api/depo_stocks_states');
      setStockStatuses(response.data || []);
    } catch (error) {
      console.error('Failed to fetch stock statuses:', error);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await api.get('/api/currencies');
      setCurrencies(response.data || []);
    } catch (error) {
      console.error('Failed to fetch currencies:', error);
    }
  };

  const fetchArticles = async () => {
    try {
      const response = await api.get('/modules/inventory/api/articles');
      setArticles(response.data.results || []);
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.part_id || !formData.quantity || !formData.batch_code) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      await api.post('/modules/inventory/api/stocks', {
        ...formData,
        batch_date: formData.batch_date?.toISOString(),
        expiry_date: formData.expiry_date?.toISOString(),
      });
      
      notifications.show({
        title: 'Success',
        message: 'Stock added successfully',
        color: 'green',
      });
      
      onSuccess();
      onClose();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to add stock',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add Stock"
      size="lg"
    >
      <Select
        label="Supplier"
        placeholder="Select supplier"
        data={suppliers.map((sup) => ({ value: sup._id, label: sup.name }))}
        value={formData.supplier_id}
        onChange={(value) => setFormData({ ...formData, supplier_id: value || '' })}
        searchable
        mb="sm"
      />

      {fixedArticleId ? (
        <TextInput
          label="Article"
          value={`${fixedArticleName} (${fixedArticleIpn})`}
          disabled
          mb="sm"
        />
      ) : (
        <Select
          label="Article"
          placeholder="Select article"
          data={articles.map((art) => ({ value: art._id, label: `${art.name} (${art.ipn})` }))}
          value={formData.part_id}
          onChange={(value) => setFormData({ ...formData, part_id: value || '' })}
          searchable
          required
          mb="sm"
        />
      )}

      <NumberInput
        label="Quantity"
        placeholder="0"
        required
        value={formData.quantity}
        onChange={(value) => setFormData({ ...formData, quantity: Number(value) || 0 })}
        mb="sm"
      />

      <TextInput
        label="Batch Code"
        placeholder="Batch code"
        required
        value={formData.batch_code}
        onChange={(e) => setFormData({ ...formData, batch_code: e.currentTarget.value })}
        mb="sm"
      />

      <TextInput
        label="Supplier Batch Code"
        placeholder="Supplier batch code"
        value={formData.supplier_batch_code}
        onChange={(e) => setFormData({ ...formData, supplier_batch_code: e.currentTarget.value })}
        mb="sm"
      />

      <DatePickerInput
        label="Batch Date"
        placeholder="Select date"
        value={formData.batch_date}
        onChange={(value) => setFormData({ ...formData, batch_date: value })}
        mb="sm"
      />

      <DatePickerInput
        label="Expiry Date"
        placeholder="Select date"
        value={formData.expiry_date}
        onChange={(value) => setFormData({ ...formData, expiry_date: value })}
        mb="sm"
      />

      <Select
        label="Status"
        placeholder="Select status"
        data={stockStatuses.map((status) => ({ value: status.value, label: status.name }))}
        value={formData.status}
        onChange={(value) => setFormData({ ...formData, status: value || '' })}
        mb="sm"
      />

      <NumberInput
        label="Purchase Price"
        placeholder="0.00"
        value={formData.purchase_price}
        onChange={(value) => setFormData({ ...formData, purchase_price: Number(value) || 0 })}
        decimalScale={2}
        mb="sm"
      />

      <Select
        label="Currency"
        placeholder="Select currency"
        data={currencies.map((curr) => ({ value: curr._id, label: curr.name }))}
        value={formData.currency_id}
        onChange={(value) => setFormData({ ...formData, currency_id: value || '' })}
        searchable
        mb="sm"
      />

      <Textarea
        label="Notes"
        placeholder="Additional notes"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.currentTarget.value })}
        rows={3}
        mb="md"
      />

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          Add Stock
        </Button>
      </Group>
    </Modal>
  );
}
