import { useState, useEffect } from 'react';
import { Table, Select, ActionIcon, NumberInput, Tooltip, Checkbox } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { api } from '../../services/api';
import { SSISelector } from './components/SSISelector';
import { prepareSelectOptions } from '../../utils/selectHelpers';

interface Tabel2RowProps {
  row: any;
  onUpdate: (id: string, column: string, value: string | number | any) => void;
  onRemove: (id: string) => void;
}

interface ProgramOption {
  value: string;
  label: string;
}

export function Tabel2Row({ row, onUpdate, onRemove }: Tabel2RowProps) {
  const [programOptions, setProgramOptions] = useState<ProgramOption[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const toNumber = (value: any) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const totalUpdated =
    row.total_updated === undefined || row.total_updated === null ? null : toNumber(row.total_updated);
  const plannedSum = ['col3', 'col4', 'col5', 'col6', 'col7', 'col8']
    .reduce((sum, col) => sum + toNumber(row[col]), 0);
  const isCoherent = totalUpdated !== null && Math.abs(plannedSum - totalUpdated) < 0.01;

  // Load filtered programs on mount
  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    setLoadingPrograms(true);
    try {
      const response = await api.get('/api/procurement/nomenclatoare/programe/filtered');
      if (response.data && Array.isArray(response.data)) {
        const rawOptions = response.data.map((p: any) => ({
          value: String(p.cod || ''),
          label: p.label || p.cod || ''
        }));
        
        const uniqueOptions = prepareSelectOptions(rawOptions, '-- Selectează --');
        setProgramOptions(uniqueOptions);
      } else {
        setProgramOptions([{ value: '', label: '-- Selectează --' }]);
      }
    } catch (error) {
      console.error('Failed to load programs:', error);
      setProgramOptions([{ value: '', label: '-- Selectează --' }]);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const handleProgramChange = (value: string | null) => {
    const validValue = value || '';
    onUpdate(row.id, 'col1', validValue);
  };

  const handleSSIChange = (value: { sb: string; sf: string; ssi: string; code: string } | null) => {
    // Store the entire SSI object in col2
    onUpdate(row.id, 'col2', value);
  };

  // Get current SSI value (handle both old string format and new object format)
  const getCurrentSSIValue = () => {
    if (!row.col2) return null;
    if (typeof row.col2 === 'object') return row.col2;
    // If it's a string (old format), return null to force re-selection
    return null;
  };

  return (
    <Table.Tr>
      {/* Col1 - Program (Select with filtered data) */}
      <Table.Td>
        <Select
          value={row.col1 as string}
          onChange={handleProgramChange}
          data={programOptions}
          searchable
          clearable
          size="xs"
          placeholder="Selectează program"
          disabled={loadingPrograms}
          styles={{ input: { minHeight: '32px' } }}
        />
      </Table.Td>

      {/* Col2 - Cod SSI (SSISelector component) */}
      <Table.Td>
        <SSISelector
          value={getCurrentSSIValue()}
          onChange={handleSSIChange}
          size="xs"
        />
      </Table.Td>

      {/* Col3-8 - Numeric inputs */}
      {['col3', 'col4', 'col5', 'col6', 'col7', 'col8'].map((col) => (
        <Table.Td key={col}>
          <NumberInput
            value={parseFloat(row[col] as string) || 0}
            onChange={(val) => onUpdate(row.id, col, (val || 0).toString())}
            size="xs"
            hideControls
            decimalScale={2}
            styles={{ input: { minHeight: '32px' } }}
          />
        </Table.Td>
      ))}

      {/* Coherence indicator */}
      <Table.Td>
        <Tooltip label="Calcul valoric coerent" withArrow>
          <Checkbox checked={isCoherent} readOnly />
        </Tooltip>
      </Table.Td>

      {/* Actions */}
      <Table.Td>
        <ActionIcon color="red" variant="subtle" onClick={() => onRemove(row.id)}>
          <IconTrash size={16} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  );
}
