import { useState, useEffect, useMemo } from 'react';
import { Button, Container, Group, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { procurementApi } from '../services/procurement';
import { notifications } from '@mantine/notifications';
import { PurchaseOrder, Supplier, StockLocation, OrderState } from '../types/procurement';

// Components
import { ProcurementFilters } from '../components/Procurement/ProcurementPage/ProcurementFilters';
import { PurchaseOrderTable } from '../components/Procurement/ProcurementPage/PurchaseOrderTable';
import { NewPurchaseOrderModal } from '../components/Procurement/ProcurementPage/NewPurchaseOrderModal';
import { NewSupplierModal } from '../components/Procurement/ProcurementPage/NewSupplierModal';

export function ProcurementPage() {
  const { t } = useTranslation();

  // Data state
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [orderStates, setOrderStates] = useState<OrderState[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [opened, setOpened] = useState(false);
  const [newSupplierOpened, setNewSupplierOpened] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<keyof PurchaseOrder | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadPurchaseOrders();
    loadSuppliers();
    loadStockLocations();
    loadOrderStates();
  }, []);

  useEffect(() => {
    loadPurchaseOrders();
  }, [searchQuery, statusFilter, dateFrom, dateTo]);

  const loadPurchaseOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('state_id', statusFilter);
      if (dateFrom) params.append('date_from', dateFrom.toISOString().split('T')[0]);
      if (dateTo) params.append('date_to', dateTo.toISOString().split('T')[0]);

      const url = `${procurementApi.getPurchaseOrders()}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await api.get(url);
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

  const loadOrderStates = async () => {
    try {
      const response = await api.get(procurementApi.getOrderStatuses());
      setOrderStates(response.data.statuses || []);
    } catch (error) {
      console.error('Failed to load order states:', error);
    }
  };

  // Filter and sort orders
  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...orders];

    // Search is handled by API mostly, but client side refinement if necessary
    // Keeping client side search logic for immediate feedback if API doesn't filter text
    if (searchQuery) {
      // API handles search usually, but if we wanted client side:
      // const query = searchQuery.toLowerCase();
      // filtered = filtered.filter(...)
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

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Procurement')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
          {t('New item')}
        </Button>
      </Group>

      <ProcurementFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        orderStates={orderStates}
      />

      <PurchaseOrderTable
        orders={filteredAndSortedOrders}
        loading={loading}
        searchQuery={searchQuery}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
      />

      <NewPurchaseOrderModal
        opened={opened}
        onClose={() => setOpened(false)}
        suppliers={suppliers}
        stockLocations={stockLocations}
        onOpenNewSupplier={() => setNewSupplierOpened(true)}
      />

      <NewSupplierModal
        opened={newSupplierOpened}
        onClose={() => setNewSupplierOpened(false)}
        onSuccess={(newSupplier) => {
          setSuppliers([...suppliers, newSupplier]);
        }}
      />
    </Container>
  );
}
