import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Group,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import { ReceiveStockForm, ReceiveStockFormData } from './Common/ReceiveStockForm';

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
  const [stockStatuses, setStockStatuses] = useState<Array<{ value: string; label: string }>>([]);
  const [locations, setLocations] = useState<Array<{ value: string; label: string }>>([]);
  
  const [formData, setFormData] = useState<ReceiveStockFormData>({
    part_id: fixedArticleId || '',
    quantity: 0,
    location: '',
    batch_code: '',
    supplier_batch_code: '',
    serial_numbers: '',
    packaging: '',
    status: '65', // Quarantine by default
    notes: '',
    manufacturing_date: null,
    expected_quantity: 0,
    expiry_date: null,
    reset_date: null,
    use_expiry: true,
    containers: [],
    containers_cleaned: false,
    supplier_ba_no: '',
    supplier_ba_date: null,
    accord_ba: false,
    is_list_supplier: false,
    clean_transport: false,
    temperature_control: false,
    temperature_conditions_met: false,
  });

  useEffect(() => {
    if (opened) {
      fetchStockStatuses();
      fetchLocations();
      
      // Reset form when modal opens
      setFormData({
        part_id: fixedArticleId || '',
        quantity: 0,
        location: '',
        batch_code: '',
        supplier_batch_code: '',
        serial_numbers: '',
        packaging: '',
        status: '65',
        notes: '',
        manufacturing_date: null,
        expected_quantity: 0,
        expiry_date: null,
        reset_date: null,
        use_expiry: true,
        containers: [],
        containers_cleaned: false,
        supplier_ba_no: '',
        supplier_ba_date: null,
        accord_ba: false,
        is_list_supplier: false,
        clean_transport: false,
        temperature_control: false,
        temperature_conditions_met: false,
      });
    }
  }, [opened, fixedArticleId]);

  const fetchStockStatuses = async () => {
    try {
      const response = await api.get('/modules/depo_procurement/api/stock-statuses');
      const statuses = response.data.statuses || response.data || [];
      setStockStatuses(statuses.map((s: any) => ({ 
        value: String(s.value), 
        label: s.name || s.label 
      })));
    } catch (error) {
      console.error('Failed to fetch stock statuses:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await api.get('/modules/inventory/api/locations');
      const locs = response.data || [];
      setLocations(locs.map((loc: any) => ({ 
        value: loc._id, 
        label: loc.name 
      })));
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.part_id || !formData.quantity || !formData.location) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required fields (Article, Quantity, Location)',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      // Create stock item
      const stockPayload = {
        part_id: formData.part_id,
        quantity: formData.quantity,
        location_id: formData.location,
        batch_code: formData.batch_code || undefined,
        supplier_batch_code: formData.supplier_batch_code || undefined,
        status: parseInt(formData.status),
        notes: formData.notes || undefined,
      };

      const stockResponse = await api.post('/modules/inventory/api/stocks', stockPayload);
      const stockItemId = stockResponse.data?._id || stockResponse.data?.id;

      // Save extra data if stock item was created
      if (stockItemId) {
        const extraDataPayload = {
          stock_item_id: stockItemId,
          supplier_batch_code: formData.supplier_batch_code || null,
          manufacturing_date: formData.manufacturing_date ? formData.manufacturing_date.toISOString().split('T')[0] : null,
          expected_quantity: formData.expected_quantity || null,
          expiry_date: formData.use_expiry && formData.expiry_date ? formData.expiry_date.toISOString().split('T')[0] : null,
          reset_date: !formData.use_expiry && formData.reset_date ? formData.reset_date.toISOString().split('T')[0] : null,
          containers: formData.containers.length > 0 ? formData.containers : null,
          containers_cleaned: formData.containers_cleaned,
          supplier_ba_no: formData.supplier_ba_no || null,
          supplier_ba_date: formData.supplier_ba_date ? formData.supplier_ba_date.toISOString().split('T')[0] : null,
          accord_ba: formData.accord_ba,
          is_list_supplier: formData.is_list_supplier,
          clean_transport: formData.clean_transport,
          temperature_control: formData.temperature_control,
          temperature_conditions_met: formData.temperature_control ? formData.temperature_conditions_met : null,
        };

        await api.post('/modules/depo_procurement/api/stock-extra-data', extraDataPayload);
      }
      
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
      size="xl"
      centered
      styles={{ body: { maxHeight: '80vh', overflowY: 'auto' } }}
    >
      <ReceiveStockForm
        formData={formData}
        onChange={setFormData}
        fixedArticle={fixedArticleId ? {
          id: fixedArticleId,
          name: fixedArticleName || '',
          ipn: fixedArticleIpn || '',
        } : undefined}
        locations={locations}
        stockStatuses={stockStatuses}
      />

      <Group justify="flex-end" mt="md">
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
