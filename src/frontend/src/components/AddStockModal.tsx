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
  const [systemUms, setSystemUms] = useState<Array<{ value: string; label: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ value: string; label: string }>>([]);
  
  const [formData, setFormData] = useState<ReceiveStockFormData>({
    part_id: fixedArticleId || '',
    quantity: 0,
    location: '',
    batch_code: '',
    supplier_batch_code: '',
    serial_numbers: '',
    packaging: '',
    status: '', // Will be set to Quarantined after loading statuses
    supplier_id: '',
    supplier_um_id: '694813b6297c9dde6d7065b7', // Default supplier UM
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
      fetchSystemUms();
      if (fixedArticleId) {
        fetchArticleSuppliers(fixedArticleId);
      }
      
      // Reset form when modal opens - status will be set after loading statuses
      setFormData({
        part_id: fixedArticleId || '',
        quantity: 0,
        location: '',
        batch_code: '',
        supplier_batch_code: '',
        serial_numbers: '',
        packaging: '',
        status: '',
        supplier_id: '',
        supplier_um_id: '694813b6297c9dde6d7065b7',
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
      console.log('Fetching stock statuses...');
      const response = await api.get('/modules/depo_procurement/api/stock-statuses');
      console.log('Stock statuses response:', response.data);
      
      const statuses = response.data.statuses || response.data || [];
      console.log('Parsed statuses:', statuses);
      
      const mappedStatuses = statuses.map((s: any) => ({ 
        value: String(s.value), 
        label: s.name || s.label 
      }));
      console.log('Mapped statuses for Select:', mappedStatuses);
      
      setStockStatuses(mappedStatuses);
      
      // Set default status to "Quarantined" if available - always set when modal opens
      const quarantinedStatus = mappedStatuses.find((s: any) => 
        s.label.toLowerCase().includes('quarantin')
      );
      
      if (quarantinedStatus) {
        console.log('Setting default status to Quarantined:', quarantinedStatus.value);
        setFormData(prev => ({ ...prev, status: quarantinedStatus.value }));
      } else {
        // Fallback to first status if Quarantined not found
        if (mappedStatuses.length > 0) {
          console.log('Quarantined not found, using first status:', mappedStatuses[0].value);
          setFormData(prev => ({ ...prev, status: mappedStatuses[0].value }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch stock statuses:', error);
      notifications.show({
        title: 'Warning',
        message: 'Failed to load stock statuses',
        color: 'yellow',
      });
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

  const fetchSystemUms = async () => {
    try {
      const response = await api.get('/modules/inventory/api/system-ums');
      const ums = response.data || [];
      setSystemUms(ums.map((um: any) => ({ 
        value: um._id, 
        label: `${um.name} (${um.abrev})` 
      })));
    } catch (error) {
      console.error('Failed to fetch system UMs:', error);
    }
  };

  const fetchArticleSuppliers = async (articleId: string) => {
    try {
      const response = await api.get(`/modules/inventory/api/articles/${articleId}/suppliers`);
      const suppliersList = response.data || [];
      
      // Map suppliers to select format
      const mappedSuppliers = suppliersList.map((s: any) => ({
        value: s.supplier_id,
        label: s.supplier_detail?.name || 'Unknown Supplier'
      }));
      
      setSuppliers(mappedSuppliers);
    } catch (error) {
      console.error('Failed to fetch article suppliers:', error);
      // If no suppliers found, set empty array
      setSuppliers([]);
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
      console.log('[AddStockModal] formData.supplier_id:', formData.supplier_id);
      console.log('[AddStockModal] formData.supplier_id type:', typeof formData.supplier_id);
      console.log('[AddStockModal] formData.supplier_id length:', formData.supplier_id?.length);
      
      // Create stock item with all data
      const stockPayload = {
        part_id: formData.part_id,
        quantity: formData.quantity,
        location_id: formData.location,
        batch_code: formData.batch_code || undefined,
        supplier_batch_code: formData.supplier_batch_code || undefined,
        status: parseInt(formData.status),
        supplier_id: (formData.supplier_id && formData.supplier_id.trim() !== '') ? formData.supplier_id : undefined,
        supplier_um_id: formData.supplier_um_id || undefined,
        notes: formData.notes || undefined,
        manufacturing_date: formData.manufacturing_date ? formData.manufacturing_date.toISOString().split('T')[0] : undefined,
        expected_quantity: formData.expected_quantity || undefined,
        expiry_date: formData.use_expiry && formData.expiry_date ? formData.expiry_date.toISOString().split('T')[0] : undefined,
        reset_date: !formData.use_expiry && formData.reset_date ? formData.reset_date.toISOString().split('T')[0] : undefined,
        containers: formData.containers.length > 0 ? formData.containers : undefined,
        containers_cleaned: formData.containers_cleaned,
        supplier_ba_no: formData.supplier_ba_no || undefined,
        supplier_ba_date: formData.supplier_ba_date ? formData.supplier_ba_date.toISOString().split('T')[0] : undefined,
        accord_ba: formData.accord_ba,
        is_list_supplier: formData.is_list_supplier,
        clean_transport: formData.clean_transport,
        temperature_control: formData.temperature_control,
        temperature_conditions_met: formData.temperature_control ? formData.temperature_conditions_met : undefined,
      };

      await api.post('/modules/inventory/api/stocks', stockPayload);
      
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
        systemUms={systemUms}
        suppliers={suppliers}
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
