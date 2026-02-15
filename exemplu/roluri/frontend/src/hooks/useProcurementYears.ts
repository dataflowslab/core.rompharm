import { useEffect, useState } from 'react';
import { api } from '../services/api';

export interface ProcurementYearOption {
  value: string;
  label: string;
  year: number;
}

export function useProcurementYears() {
  const [years, setYears] = useState<ProcurementYearOption[]>([]);
  const [loading, setLoading] = useState(false);

  const loadYears = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/system/years');
      const items = Array.isArray(response.data) ? response.data : [];
      setYears(items);
    } catch (error) {
      console.error('Failed to load procurement years:', error);
      setYears([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadYears();
  }, []);

  return { years, loading, reload: loadYears };
}
