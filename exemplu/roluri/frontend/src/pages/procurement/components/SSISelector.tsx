import { useState, useEffect } from 'react';
import { Stack, Select, Group } from '@mantine/core';
import { api } from '../../../services/api';
import { safeSelectData } from '../../../utils/selectHelpers';

interface SSISelectorProps {
  value?: {
    sb: string;
    sf: string;
    ssi: string;
    code: string;
  } | null;
  onChange: (value: { sb: string; sf: string; ssi: string; code: string } | null) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

interface SBOption {
  value: string;
  label: string;
  code: string;
  name: string;
}

interface SFOption {
  value: string;
  label: string;
  code: string;
  name: string;
}

interface SSIOption {
  value: string;
  label: string;
  code: string;
  name: string;
  indicator9: string;
}

export function SSISelector({ value, onChange, size = 'xs', disabled = false }: SSISelectorProps) {
  const [sbOptions, setSbOptions] = useState<SBOption[]>([]);
  const [sfOptions, setSfOptions] = useState<SFOption[]>([]);
  const [ssiOptions, setSSIOptions] = useState<SSIOption[]>([]);
  
  const [selectedSB, setSelectedSB] = useState<string>(value?.sb || '');
  const [selectedSF, setSelectedSF] = useState<string>(value?.sf || '');
  const [selectedSSI, setSelectedSSI] = useState<string>(value?.ssi || '');

  const [loadingSB, setLoadingSB] = useState(false);
  const [loadingSF, setLoadingSF] = useState(false);
  const [loadingSSI, setLoadingSSI] = useState(false);

  // Load SB (Sector bugetar) on mount
  useEffect(() => {
    loadSB();
  }, []);

  // Load SF (Sursa de finantare) on mount
  useEffect(() => {
    loadSF();
  }, []);

  // Load SSI (Indicator economic) on mount
  useEffect(() => {
    loadSSI();
  }, []);

  // Sync from external value (e.g., copy from Tabel 1)
  useEffect(() => {
    if (!value) return;
    setSelectedSB(value.sb || '');
    setSelectedSF(value.sf || '');
    setSelectedSSI(value.ssi || '');
  }, [value?.sb, value?.sf, value?.ssi]);

  // Update parent when any value changes
  useEffect(() => {
    if (selectedSB && selectedSF && selectedSSI) {
      const sbOption = sbOptions.find(opt => opt.code === selectedSB);
      const sfOption = sfOptions.find(opt => opt.code === selectedSF);
      const ssiOption = ssiOptions.find(opt => opt.indicator9 === selectedSSI);
      
      if (sbOption && sfOption && ssiOption) {
        // Generate 15-character code: SB (2) + SF (1) + SSI (9) + padding zeros (3)
        const code = `${sbOption.code}${sfOption.code}${ssiOption.indicator9}000`;
        
        onChange({
          sb: selectedSB,
          sf: selectedSF,
          ssi: selectedSSI,
          code: code
        });
      }
    } else {
      onChange(null);
    }
  }, [selectedSB, selectedSF, selectedSSI, sbOptions, sfOptions, ssiOptions]);

  const loadSB = async () => {
    setLoadingSB(true);
    try {
      const response = await api.get('/api/procurement/nomenclatoare/get?table=procurement_sb');
      if (response.data && Array.isArray(response.data)) {
        const activeOptions = response.data
          .filter((item: any) => item.activ === true)
          .map((item: any) => ({
            value: String(item.code || ''),
            label: item.code,  // Only code
            code: item.code,
            name: item.name
          }));
        
        const uniqueOptions = safeSelectData(activeOptions, 'SSISelector-SB');
        setSbOptions(uniqueOptions);
      }
    } catch (error) {
      console.error('Failed to load SB:', error);
      setSbOptions([]);
    } finally {
      setLoadingSB(false);
    }
  };

  const loadSF = async () => {
    setLoadingSF(true);
    try {
      const response = await api.get('/api/procurement/nomenclatoare/get?table=procurement_sf');
      if (response.data && Array.isArray(response.data)) {
        const options = response.data.map((item: any) => ({
          value: String(item.code || ''),
          label: item.code,  // Only code
          code: item.code,
          name: item.name
        }));
        
        const uniqueOptions = safeSelectData(options, 'SSISelector-SF');
        setSfOptions(uniqueOptions);
      }
    } catch (error) {
      console.error('Failed to load SF:', error);
      setSfOptions([]);
    } finally {
      setLoadingSF(false);
    }
  };

  const loadSSI = async () => {
    setLoadingSSI(true);
    try {
      const response = await api.get('/api/procurement/nomenclatoare/get?table=procurement_ssi&sort_by=indicator9');
      if (response.data && Array.isArray(response.data)) {
        const options = response.data.map((item: any) => ({
          value: String(item.indicator9 || ''),
          label: `${item.code} - ${item.name}`,
          code: item.code,
          name: item.name,
          indicator9: item.indicator9
        }));
        
        const uniqueOptions = safeSelectData(options, 'SSISelector-SSI');
        setSSIOptions(uniqueOptions);
      }
    } catch (error) {
      console.error('Failed to load SSI:', error);
      setSSIOptions([]);
    } finally {
      setLoadingSSI(false);
    }
  };

  return (
    <Stack gap={0}>
      {/* First row: SB and SF side by side */}
      <Group gap={0} grow>
        <Select
          value={selectedSB}
          onChange={(val) => setSelectedSB(val || '')}
          data={sbOptions}
          placeholder="SB"
          searchable
          size={size}
          disabled={disabled || loadingSB}
          styles={{ 
            input: { 
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottom: 'none',
              borderRight: 'none',
              minHeight: '28px',
              fontSize: '0.75rem'
            } 
          }}
        />
        <Select
          value={selectedSF}
          onChange={(val) => setSelectedSF(val || '')}
          data={sfOptions}
          placeholder="SF"
          searchable
          size={size}
          disabled={disabled || loadingSF}
          styles={{ 
            input: { 
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottom: 'none',
              minHeight: '28px',
              fontSize: '0.75rem'
            } 
          }}
        />
      </Group>
      
      {/* Second row: SSI full width */}
      <Select
        value={selectedSSI}
        onChange={(val) => setSelectedSSI(val || '')}
        data={ssiOptions}
        placeholder="Indicator economic"
        searchable
        size={size}
        disabled={disabled || loadingSSI}
        styles={{ 
          input: { 
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            minHeight: '28px',
            fontSize: '0.75rem'
          } 
        }}
      />
    </Stack>
  );
}
