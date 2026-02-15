import { Paper, Stack, TextInput, NumberInput, Checkbox, Group } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { SafeSelect } from './SafeSelect';

interface FormHeaderProps {
  formData: {
    titluDocument: string;
    nrUnicInreg: string;
    revizia: number;
    dataReviziei: Date | null;
    checkboxObligatiiLegale: boolean;
    referat_id?: string;
  };
  onChange: (field: string, value: any) => void;
}

export function FormHeader({ formData, onChange }: FormHeaderProps) {
  const [referateOptions, setReferateOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingReferate, setLoadingReferate] = useState(false);

  useEffect(() => {
    loadApprovedReferate();
  }, []);

  const loadApprovedReferate = async () => {
    setLoadingReferate(true);
    try {
      const response = await api.get('/api/procurement/referate/approved/list');
      setReferateOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load approved referate:', error);
      setReferateOptions([]);
    } finally {
      setLoadingReferate(false);
    }
  };
  return (
    <Paper withBorder p="md" bg="gray.0">
      <Stack gap="md">
        <SafeSelect
          label="Referat (opțional)"
          placeholder="Selectează un referat aprobat"
          data={referateOptions}
          value={formData.referat_id || null}
          onChange={(value) => onChange('referat_id', value)}
          searchable
          clearable
          disabled={loadingReferate}
          description="Poți asocia un referat aprobat cu acest document de fundamentare"
          nothingFoundMessage="Nu există referate aprobate"
        />

        <TextInput
          label="Titlu document de fundamentare"
          value={formData.titluDocument}
          onChange={(e) => onChange('titluDocument', e.target.value)}
          required
        />
        
        <TextInput
          label="Număr unic de înregistrare"
          value={formData.nrUnicInreg}
          readOnly
          styles={{ input: { backgroundColor: '#f1f3f5' } }}
        />
        
        <Group grow>
          <NumberInput
            label="Revizia"
            value={formData.revizia}
            onChange={(val) => onChange('revizia', val)}
            min={0}
            required
            readOnly
            styles={{ input: { backgroundColor: '#f1f3f5' } }}
            description="Prima revizie"
          />
          
          <DateInput
            label="Data reviziei"
            value={formData.dataReviziei}
            onChange={(val) => onChange('dataReviziei', val)}
            valueFormat="DD.MM.YYYY"
            required
            minDate={new Date()}
            error={!formData.dataReviziei ? 'Data reviziii este obligatorie' : undefined}
          />
        </Group>
        
        <Checkbox
          label="Se referă la angajamente legale care se emit ca urmare a unei obligații legale sau de către un terț"
          checked={formData.checkboxObligatiiLegale}
          onChange={(e) => onChange('checkboxObligatiiLegale', e.target.checked)}
        />
      </Stack>
    </Paper>
  );
}
