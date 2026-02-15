import { useState, useEffect } from 'react';
import { api } from '../../../services/api';

export interface DocumentState {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  description: string;
}

interface UseDocumentStatesReturn {
  states: DocumentState[];
  loading: boolean;
  error: string | null;
  getStateColor: (stateName: string) => string;
  getStateIcon: (stateName: string) => string;
  refreshStates: () => Promise<void>;
}

export function useDocumentStates(): UseDocumentStatesReturn {
  const [states, setStates] = useState<DocumentState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/procurement/states/fundamentare');
      setStates(response.data);
    } catch (err: any) {
      console.error('Failed to load document states:', err);
      setError(err.message || 'Failed to load states');
      // Set default states as fallback
      setStates([
        { id: '1', name: 'Nouă', color: 'gray', icon: 'IconClock', order: 1, description: '' },
        { id: '2', name: 'Draft', color: 'gray', icon: 'IconClock', order: 2, description: '' },
        { id: '3', name: 'Compilare', color: 'blue', icon: 'IconClock', order: 3, description: '' },
        { id: '4', name: 'Finalizat', color: 'green', icon: 'IconCheck', order: 4, description: '' },
        { id: '5', name: 'Eroare', color: 'red', icon: 'IconX', order: 5, description: '' },
        { id: '6', name: 'Anulat', color: 'orange', icon: 'IconX', order: 6, description: '' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStates();
  }, []);

  const getStateColor = (stateName: string): string => {
    const state = states.find(s => s.name === stateName);
    return state?.color || 'gray';
  };

  const getStateIcon = (stateName: string): string => {
    const state = states.find(s => s.name === stateName);
    return state?.icon || 'IconClock';
  };

  const refreshStates = async () => {
    await loadStates();
  };

  return {
    states,
    loading,
    error,
    getStateColor,
    getStateIcon,
    refreshStates,
  };
}
