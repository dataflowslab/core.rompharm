import { useState, useEffect } from 'react';
import { Table, TextInput, Select, ActionIcon, NumberInput, Stack } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { SSISelector } from './components/SSISelector';
import { prepareSelectOptions } from '../../utils/selectHelpers';

interface Tabel1RowProps {
  row: any;
  onUpdate: (id: string, column: string, value: string | number | any) => void;
  onRemove: (id: string) => void;
}

interface ProgramOption {
  value: string;
  label: string;
}

export function Tabel1Row({ row, onUpdate, onRemove }: Tabel1RowProps) {
  const [programOptions, setProgramOptions] = useState<ProgramOption[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  // Load filtered programs on mount
  useEffect(() => {
    loadPrograms();
  }, []);

  // Auto-calculate col7 when col5 or col6 changes
  useEffect(() => {
    const val5 = parseFloat(row.col5 as string) || 0;
    const val6 = parseFloat(row.col6 as string) || 0;
    const calculated = val5 + val6;
    
    if (calculated.toString() !== row.col7) {
      onUpdate(row.id, 'col7', calculated.toString());
    }
  }, [row.col5, row.col6]);

  const loadPrograms = async () => {
    setLoadingPrograms(true);
    try {
      const response = await api.get('/api/procurement/nomenclatoare/programe/filtered');
      if (response.data && Array.isArray(response.data)) {
        const rawOptions = response.data.map((p: any) => ({
          value: String(p.cod || ''),  // Ensure value is string
          label: p.label || p.cod || ''
        }));
        
        // Use helper to remove duplicates and add placeholder
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
    onUpdate(row.id, 'col2', validValue);
  };

  const handleSSIChange = (value: { sb: string; sf: string; ssi: string; code: string } | null) => {
    // Store the entire SSI object in col3
    onUpdate(row.id, 'col3', value);
  };

  // Get current SSI value (handle both old string format and new object format)
  const getCurrentSSIValue = () => {
    if (!row.col3) return null;
    if (typeof row.col3 === 'object') return row.col3;
    // If it's a string (old format), return null to force re-selection
    return null;
  };

  return (
    <Table.Tr>
      {/* Col1 + Col2 - Element de fundamentare + Program (stacked) */}
      <Table.Td style={{ width: '12%', padding: '4px' }}>
        <Stack gap={2}>
          <TextInput
            value={row.col1 as string}
            onChange={(e) => onUpdate(row.id, 'col1', e.target.value)}
            size="xs"
            placeholder="Element fundamentare"
            styles={{ input: { minHeight: '28px', fontSize: '0.75rem' } }}
          />
          <Select
            value={row.col2 as string}
            onChange={handleProgramChange}
            data={programOptions}
            searchable
            clearable
            size="xs"
            placeholder="Program"
            disabled={loadingPrograms}
            styles={{ input: { minHeight: '28px', fontSize: '0.75rem' } }}
          />
        </Stack>
      </Table.Td>

      {/* Col3 - Cod SSI (SSISelector component) */}
      <Table.Td style={{ padding: '4px' }}>
        <SSISelector
          value={getCurrentSSIValue()}
          onChange={handleSSIChange}
          size="xs"
        />
      </Table.Td>

      {/* Col4 - Parametrii de fundamentare */}
      <Table.Td style={{ width: '11%', padding: '4px' }}>
        <TextInput
          value={row.col4 as string}
          onChange={(e) => onUpdate(row.id, 'col4', e.target.value)}
          size="xs"
          styles={{ input: { minHeight: '28px', fontSize: '0.75rem' } }}
        />
      </Table.Td>

      {/* Col5 - Valoare totală revizie precedentă */}
      <Table.Td style={{ width: '11%', padding: '4px' }}>
        <NumberInput
          value={parseFloat(row.col5 as string) || 0}
          onChange={(val) => onUpdate(row.id, 'col5', (val || 0).toString())}
          size="xs"
          hideControls
          decimalScale={2}
          styles={{ input: { minHeight: '28px', fontSize: '0.75rem' } }}
        />
      </Table.Td>

      {/* Col6 - Influențe +/- */}
      <Table.Td style={{ width: '11%', padding: '4px' }}>
        <NumberInput
          value={parseFloat(row.col6 as string) || 0}
          onChange={(val) => onUpdate(row.id, 'col6', (val || 0).toString())}
          size="xs"
          hideControls
          decimalScale={2}
          styles={{ input: { minHeight: '28px', fontSize: '0.75rem' } }}
        />
      </Table.Td>

      {/* Col7 - Valoarea totală actualizată (auto-calculated) */}
      <Table.Td style={{ width: '11%', padding: '4px' }}>
        <NumberInput
          value={parseFloat(row.col7 as string) || 0}
          size="xs"
          hideControls
          decimalScale={2}
          readOnly
          styles={{ input: { minHeight: '28px', fontSize: '0.75rem', backgroundColor: '#f1f3f5' } }}
        />
      </Table.Td>

      {/* Actions */}
      <Table.Td style={{ width: '40px', maxWidth: '40px', padding: '4px', textAlign: 'center' }}>
        <ActionIcon color="red" variant="subtle" onClick={() => onRemove(row.id)} size="sm">
          <IconTrash size={14} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  );
}
