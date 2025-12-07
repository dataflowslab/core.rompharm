import { useState, useEffect, useMemo } from 'react';
import { Button, Container, Group, Table, Title, Modal, Select, TextInput, Textarea, Grid, Checkbox, Progress, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus, IconSearch, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { procurementApi } from '../services/procurement';
import { notifications } from '@mantine/notifications';

interface PurchaseOrder {
  pk: number;
  reference: string;
  description: string;
  supplier: number;
  supplier_detail?: {
    name: string;
    pk: number;
  };
  status: number;
  status_text: string;
  issue_date: string;
  target_date: string;
  creation_date: string;
  line_items: number;
  lines: number;
}

interface Supplier {
  pk: number;
  name: string;
  currency?: string;
}

interface StockLocation {
  pk: number;
  name: string;
  description?: string;
}

export function ProcurementPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [newSupplierOpened, setNewSupplierOpened] = useState(false);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof PurchaseOrder | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Form state for new purchase order
  const [formData, setFormData] = useState({
    supplier: '',
    reference: '',
    description: '',
    supplier_reference: '',
    currency: 'EUR',
    issue_date: new Date(),
    target_date: null as Date | null,
    destination: '',
    notes: ''
  });

  // Form state for new supplier
  const [newSupplierData, setNewSupplierData] = useState({
    name: '',
    currency: 'EUR',
    tax_id: '',
    is_supplier: true,
    is_manufacturer: false,
    cod: '',
    reg_code: '',
    address: '',
    country: '',
    city: ''
  });

  useEffect(() => {
    loadPurchaseOrders();
    loadSuppliers();
    loadStockLocations();
  }, []);

  const loadPurchaseOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get(procurementApi.getPurchaseOrders());
      setOrders(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load purchase orders:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load purchase orders'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await api.get(procurementApi.getSuppliers());
      setSuppliers(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  };

  const loadStockLocations = async () => {
    try {
      const response = await api.get(procurementApi.getStockLocations());
      setStockLocations(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load stock locations:', error);
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierData.name) {
      notifications.show({
        title: t('Error'),
        message: t('Company name is required'),
        color: 'red'
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(procurementApi.createSupplier(), newSupplierData);
      const newSupplier = response.data;
      
      notifications.show({
        title: t('Success'),
        message: t('Supplier created successfully'),
        color: 'green'
      });

      // Add to suppliers list and select it
      setSuppliers([...suppliers, newSupplier]);
      setFormData({ ...formData, supplier: String(newSupplier.pk || newSupplier.id) });
      
      // Reset form and close modal
      setNewSupplierData({
        name: '',
        currency: 'EUR',
        tax_id: '',
        is_supplier: true,
        is_manufacturer: false,
        cod: '',
        reg_code: '',
        address: '',
        country: '',
        city: ''
      });
      setNewSupplierOpened(false);
    } catch (error: any) {
      console.error('Failed to create supplier:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to create supplier'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.supplier) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a supplier'),
        color: 'red'
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplier: parseInt(formData.supplier),
        reference: formData.reference || undefined,
        description: formData.description || undefined,
        supplier_reference: formData.supplier_reference || undefined,
        currency: formData.currency || undefined,
        issue_date: formData.issue_date ? formData.issue_date.toISOString().split('T')[0] : undefined,
        target_date: formData.target_date ? formData.target_date.toISOString().split('T')[0] : undefined,
        destination: formData.destination ? parseInt(formData.destination) : undefined,
        notes: formData.notes || undefined
      };

      const response = await api.post(procurementApi.createPurchaseOrder(), payload);
      const newOrder = response.data;

      notifications.show({
        title: t('Success'),
        message: t('Purchase order created successfully'),
        color: 'green'
      });

      // Reset form and close modal
      setFormData({
        supplier: '',
        reference: '',
        description: '',
        supplier_reference: '',
        currency: 'EUR',
        issue_date: new Date(),
        target_date: null,
        destination: '',
        notes: ''
      });
      setOpened(false);

      // Navigate to the new purchase order detail page
      navigate(`/procurement/${newOrder.pk || newOrder.id}`);
    } catch (error: any) {
      console.error('Failed to create purchase order:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to create purchase order'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSupplierChange = (value: string | null) => {
    setFormData({ ...formData, supplier: value || '' });
    
    // Update currency based on supplier
    if (value) {
      const supplier = suppliers.find(s => String(s.pk) === value);
      if (supplier?.currency) {
        setFormData(prev => ({ ...prev, currency: supplier.currency || 'EUR' }));
      }
    }
  };

  const supplierOptions = [
    ...suppliers.map(s => ({ value: String(s.pk), label: s.name })),
    { value: '__new__', label: `➕ ${t('New supplier')}` }
  ];

  // Filter and sort orders
  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...orders];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.reference?.toLowerCase().includes(query) ||
        order.supplier_detail?.name?.toLowerCase().includes(query) ||
        order.description?.toLowerCase().includes(query) ||
        order.status_text?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let aVal: any = a[sortField];
        let bVal: any = b[sortField];

        // Handle nested supplier name
        if (sortField === 'supplier_detail') {
          aVal = a.supplier_detail?.name || '';
          bVal = b.supplier_detail?.name || '';
        }

        // Handle null/undefined values
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';

        // Convert to string for comparison
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
        if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [orders, searchQuery, sortField, sortDirection]);

  const handleSort = (field: keyof PurchaseOrder) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof PurchaseOrder) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Procurement')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
          {t('New item')}
        </Button>
      </Group>

      <TextInput
        placeholder={t('Search by reference, supplier, description, or status...')}
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        mb="md"
      />

      <Table striped withTableBorder withColumnBorders highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('reference')}>
              <Group gap="xs">
                {t('Reference')}
                {getSortIcon('reference')}
              </Group>
            </Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('supplier_detail')}>
              <Group gap="xs">
                {t('Supplier')}
                {getSortIcon('supplier_detail')}
              </Group>
            </Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('description')}>
              <Group gap="xs">
                {t('Description')}
                {getSortIcon('description')}
              </Group>
            </Table.Th>
            <Table.Th>{t('Line Items')}</Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('status_text')}>
              <Group gap="xs">
                {t('Status')}
                {getSortIcon('status_text')}
              </Group>
            </Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('issue_date')}>
              <Group gap="xs">
                {t('Issue Date')}
                {getSortIcon('issue_date')}
              </Group>
            </Table.Th>
            <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('target_date')}>
              <Group gap="xs">
                {t('Target Date')}
                {getSortIcon('target_date')}
              </Group>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading ? (
            <Table.Tr>
              <Table.Td colSpan={7}>{t('Loading...')}</Table.Td>
            </Table.Tr>
          ) : filteredAndSortedOrders.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7}>{searchQuery ? t('No results found') : t('No data')}</Table.Td>
            </Table.Tr>
          ) : (
            filteredAndSortedOrders.map((order) => {
              const received = order.line_items || 0;
              const total = order.lines || 0;
              const percentage = total > 0 ? (received / total) * 100 : 0;
              
              return (
                <Table.Tr 
                  key={order.pk} 
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/procurement/${order.pk}`)}
                >
                  <Table.Td>{order.reference}</Table.Td>
                  <Table.Td>{order.supplier_detail?.name || '-'}</Table.Td>
                  <Table.Td>{order.description || '-'}</Table.Td>
                  <Table.Td>
                    <div style={{ minWidth: '120px' }}>
                      <Group gap="xs" mb={4}>
                        <Text size="sm">{received} / {total}</Text>
                      </Group>
                      <Progress 
                        value={percentage} 
                        size="sm" 
                        color={percentage === 100 ? 'green' : percentage > 0 ? 'blue' : 'gray'}
                      />
                    </div>
                  </Table.Td>
                  <Table.Td>{order.status_text || '-'}</Table.Td>
                  <Table.Td>{order.issue_date || '-'}</Table.Td>
                  <Table.Td>{order.target_date || '-'}</Table.Td>
                </Table.Tr>
              );
            })
          )}
        </Table.Tbody>
      </Table>

      {/* New Purchase Order Modal */}
      <Modal 
        opened={opened} 
        onClose={() => setOpened(false)} 
        title={t('New Purchase Order')} 
        size="lg"
        centered
      >
        <Grid>
          <Grid.Col span={12}>
            <Select
              label={t('Supplier')}
              placeholder={t('Select supplier')}
              data={supplierOptions}
              value={formData.supplier}
              onChange={(value) => {
                if (value === '__new__') {
                  setNewSupplierOpened(true);
                } else {
                  handleSupplierChange(value);
                }
              }}
              searchable
              required
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <TextInput
              label={t('Supplier Reference')}
              placeholder={t('Supplier order number')}
              value={formData.supplier_reference}
              onChange={(e) => setFormData({ ...formData, supplier_reference: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <TextInput
              label={t('Description')}
              placeholder={t('Order description')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Select
              label={t('Currency')}
              data={['EUR', 'USD', 'RON', 'GBP']}
              value={formData.currency}
              onChange={(value) => setFormData({ ...formData, currency: value || 'EUR' })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Select
              label={t('Destination')}
              placeholder={t('Select stock location')}
              data={stockLocations.map(loc => ({ value: String(loc.pk), label: loc.name }))}
              value={formData.destination}
              onChange={(value) => setFormData({ ...formData, destination: value || '' })}
              searchable
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <DatePickerInput
              label={t('Start Date')}
              placeholder={t('Select date')}
              value={formData.issue_date}
              onChange={(value) => setFormData({ ...formData, issue_date: value || new Date() })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <DatePickerInput
              label={t('Target Date')}
              placeholder={t('Select date')}
              value={formData.target_date}
              onChange={(value) => setFormData({ ...formData, target_date: value })}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Textarea
              label={t('Notes')}
              placeholder={t('Additional notes')}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              minRows={3}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setOpened(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {t('Create')}
          </Button>
        </Group>
      </Modal>

      {/* New Supplier Modal */}
      <Modal
        opened={newSupplierOpened}
        onClose={() => setNewSupplierOpened(false)}
        title={t('New Supplier')}
        size="lg"
        centered
      >
        <Grid>
          <Grid.Col span={12}>
            <TextInput
              label={t('Company Name')}
              placeholder={t('Enter company name')}
              value={newSupplierData.name}
              onChange={(e) => setNewSupplierData({ ...newSupplierData, name: e.target.value })}
              required
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Select
              label={t('Currency')}
              data={['EUR', 'USD', 'RON', 'GBP']}
              value={newSupplierData.currency}
              onChange={(value) => setNewSupplierData({ ...newSupplierData, currency: value || 'EUR' })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput
              label={t('Tax ID')}
              placeholder={t('Tax identification number')}
              value={newSupplierData.tax_id}
              onChange={(e) => setNewSupplierData({ ...newSupplierData, tax_id: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput
              label={t('Cod')}
              placeholder={t('F001')}
              value={newSupplierData.cod}
              onChange={(e) => setNewSupplierData({ ...newSupplierData, cod: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput
              label={t('Registration No.')}
              placeholder={t('J40/12345/2020')}
              value={newSupplierData.reg_code}
              onChange={(e) => setNewSupplierData({ ...newSupplierData, reg_code: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <TextInput
              label={t('Address')}
              placeholder={t('Street address')}
              value={newSupplierData.address}
              onChange={(e) => setNewSupplierData({ ...newSupplierData, address: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput
              label={t('Country')}
              placeholder={t('Country')}
              value={newSupplierData.country}
              onChange={(e) => setNewSupplierData({ ...newSupplierData, country: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <TextInput
              label={t('City')}
              placeholder={t('City')}
              value={newSupplierData.city}
              onChange={(e) => setNewSupplierData({ ...newSupplierData, city: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Checkbox
              label={t('Is Supplier')}
              checked={newSupplierData.is_supplier}
              onChange={(e) => setNewSupplierData({ ...newSupplierData, is_supplier: e.currentTarget.checked })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Checkbox
              label={t('Is Manufacturer')}
              checked={newSupplierData.is_manufacturer}
              onChange={(e) => setNewSupplierData({ ...newSupplierData, is_manufacturer: e.currentTarget.checked })}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setNewSupplierOpened(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleCreateSupplier} loading={submitting}>
            {t('Create')}
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
