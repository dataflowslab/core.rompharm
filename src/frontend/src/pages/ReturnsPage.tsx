import { useState, useEffect, useMemo } from 'react';
import { Container, Group, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { returnsApi, ReturnOrder } from '../services/returns';
import { notifications } from '@mantine/notifications';

import { ReturnsFilters } from '../components/Returns/ReturnsPage/ReturnsFilters';
import { ReturnOrderTable } from '../components/Returns/ReturnsPage/ReturnOrderTable';

export function ReturnsPage() {
  const { t } = useTranslation();

  const [orders, setOrders] = useState<ReturnOrder[]>([]);
  const [orderStates, setOrderStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<keyof ReturnOrder | 'customer_detail' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadReturnOrders();
    loadOrderStates();
  }, []);

  useEffect(() => {
    loadReturnOrders();
  }, [searchQuery, statusFilter, dateFrom, dateTo]);

  const loadReturnOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('state_id', statusFilter);
      if (dateFrom) params.append('date_from', dateFrom.toISOString().split('T')[0]);
      if (dateTo) params.append('date_to', dateTo.toISOString().split('T')[0]);

      const url = `${returnsApi.getReturnOrders()}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await api.get(url);
      setOrders(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load return orders:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load return orders'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadOrderStates = async () => {
    try {
      const response = await api.get(returnsApi.getOrderStatuses());
      setOrderStates(response.data.statuses || []);
    } catch (error) {
      console.error('Failed to load order states:', error);
    }
  };

  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...orders];

    if (sortField) {
      filtered.sort((a, b) => {
        let aVal: any = (a as any)[sortField];
        let bVal: any = (b as any)[sortField];

        if (sortField === 'customer_detail') {
          aVal = a.customer_detail?.name || '';
          bVal = b.customer_detail?.name || '';
        }

        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
        if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [orders, sortField, sortDirection]);

  const handleSort = (field: keyof ReturnOrder | 'customer_detail') => {
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
        <Title order={2}>{t('Return Orders')}</Title>
      </Group>

      <ReturnsFilters
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

      <ReturnOrderTable
        orders={filteredAndSortedOrders}
        loading={loading}
        searchQuery={searchQuery}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    </Container>
  );
}
