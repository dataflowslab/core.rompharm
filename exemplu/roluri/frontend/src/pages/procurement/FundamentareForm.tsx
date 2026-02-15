import { useState, useEffect } from 'react';
import { Stack, Button, Group, Divider, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { FormHeader } from './components/FormHeader';
import { FormSectionA } from './components/FormSectionA';
import { FormSectionTables } from './components/FormSectionTables';
import { FormSectionB } from './components/FormSectionB';

interface TableRow {
  id: string;
  [key: string]: string | number;
}

interface UploadedFile {
  file_hash: string;
  filename: string;
  original_filename: string;
  size: number;
  mime_type: string;
  uploaded_at: string;
}

interface FundamentareFormData {
  referat_id?: string;
  titluDocument: string;
  nrUnicInreg: string;
  revizia: number;
  dataReviziei: Date | null;
  checkboxObligatiiLegale: boolean;
  compartiment: string;
  descriereScurta: string;
  descriereDetaliata: string;
  atasamente: UploadedFile[];
  valorificareTip: 'stabilita' | 'ramane' | '';
  tabel1: TableRow[];
  showRemainingSum: boolean;
  remainingSum: string;
  angajamenteLegale: 'niciun' | 'anulCurent' | '';
  seStingAnulCurent: boolean;
  nuSeEfectueazaPlati: boolean;
  seEfectueazaPlatiMultiAn: boolean;
  tabel2: TableRow[];
  angajamenteAnulUrmator: boolean;
  // Secțiunea B
  checkboxPropuneriInregistrate?: boolean;
  tabel3?: TableRow[];
  capturaImagini?: UploadedFile[];
  checkboxNuSauRezervat?: boolean;
  creditAngajament?: number;
  creditBugetar?: number;
  checkboxCrediteleInsuficiente?: boolean;
  checkboxIntrucat?: boolean;
  intrucatMotiv?: string;
}

export function FundamentareForm({ 
  onSubmit, 
  onCancel, 
  initialData,
  showSectionB = true
}: { 
  onSubmit: (data: FundamentareFormData) => void; 
  onCancel: () => void;
  initialData?: FundamentareFormData;
  showSectionB?: boolean;
}) {
  const { t } = useTranslation();
  const [departmentOptions, setDepartmentOptions] = useState<{value: string; label: string}[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [capturaImaginiFiles, setCapturaImaginiFiles] = useState<Array<{ name: string; url: string }>>([]);
  
  const [formData, setFormData] = useState<FundamentareFormData>(() => {
    if (initialData) {
      // Convert dataReviziei string to Date object if it exists
      const processedData = { ...initialData };
      if (processedData.dataReviziei && typeof processedData.dataReviziei === 'string') {
        processedData.dataReviziei = new Date(processedData.dataReviziei);
      }
      return processedData;
    }
    
    return {
      titluDocument: '',
      nrUnicInreg: '',
      revizia: 0,
      dataReviziei: new Date(),
      checkboxObligatiiLegale: false,
      compartiment: '',
      descriereScurta: '',
      descriereDetaliata: '',
      atasamente: [],
      valorificareTip: '',
      tabel1: [],
      showRemainingSum: false,
      remainingSum: '',
      angajamenteLegale: '',
      seStingAnulCurent: false,
      nuSeEfectueazaPlati: false,
      seEfectueazaPlatiMultiAn: false,
      tabel2: [],
      angajamenteAnulUrmator: false,
    };
  });

  useEffect(() => {
    if (!initialData) {
      loadNextRegistrationNumber();
    }
    loadDepartments();
  }, []);

  const loadNextRegistrationNumber = async () => {
    try {
      const response = await api.get('/api/procurement/fundamentare/next-number');
      handleChange('nrUnicInreg', response.data.next_number);
    } catch (error) {
      console.error('Failed to load next registration number:', error);
    }
  };

  const loadDepartments = async () => {
    setLoadingDepartments(true);
    try {
      const response = await api.get('/api/procurement/departamente');
      if (response.data && Array.isArray(response.data)) {
        setDepartmentOptions(response.data.map((d: any) => ({
          value: d.nume || d.value,
          label: d.nume || d.label
        })));
      } else {
        setDepartmentOptions([]);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
      setDepartmentOptions([]);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Tabel 1 functions
  const addTabel1Row = () => {
    const newRow: TableRow = {
      id: Date.now().toString(),
      col1: '', 
      col2: '', 
      col3: null,  // SSI object, not string
      col4: '', 
      col5: '0',   // Initialize with '0' instead of empty string
      col6: '0',   // Initialize with '0' instead of empty string
      col7: '0',   // Initialize with '0' instead of empty string
    };
    setFormData({ ...formData, tabel1: [...formData.tabel1, newRow] });
  };

  const removeTabel1Row = (id: string) => {
    setFormData({ ...formData, tabel1: formData.tabel1.filter(row => row.id !== id) });
  };

  const updateTabel1Cell = (id: string, column: string, value: string) => {
    setFormData({
      ...formData,
      tabel1: formData.tabel1.map(row =>
        row.id === id ? { ...row, [column]: value } : row
      ),
    });
  };

  // Tabel 2 functions
  const addTabel2Row = () => {
    const newRow: TableRow = {
      id: Date.now().toString(),
      col1: '', col2: '', col3: '', col4: '', col5: '', col6: '', col7: '', col8: '',
    };
    setFormData({ ...formData, tabel2: [...formData.tabel2, newRow] });
  };

  const removeTabel2Row = (id: string) => {
    setFormData({ ...formData, tabel2: formData.tabel2.filter(row => row.id !== id) });
  };

  const updateTabel2Cell = (id: string, column: string, value: string) => {
    setFormData({
      ...formData,
      tabel2: formData.tabel2.map(row =>
        row.id === id ? { ...row, [column]: value } : row
      ),
    });
  };

  const normalizeSsiValue = (value: any) => {
    if (!value) return null;
    if (typeof value === 'object' && value.sb && value.sf && value.ssi) {
      return value;
    }
    if (typeof value === 'string') {
      const digits = value.replace(/\D/g, '');
      if (digits.length >= 12) {
        return {
          sb: digits.slice(0, 2),
          sf: digits.slice(2, 3),
          ssi: digits.slice(3, 12),
          code: digits,
        };
      }
    }
    return null;
  };

  // Copy from Tabel 1 to Tabel 2
  const copyFromTabel1 = () => {
    if (formData.tabel1.length === 0) {
      notifications.show({
        title: 'Atenție',
        message: 'Tabelul 1 este gol. Nu există date de copiat.',
        color: 'orange',
      });
      return;
    }

    // Map Tabel1 rows to Tabel2 format
    // Tabel1: col1=Element, col2=Program, col3=SSI, col4=Parametrii, col5=Valoare precedentă, col6=Influențe, col7=Valoare actualizată
    // Tabel2: col1=Program, col2=SSI, col3=Plăți precedenți, col4-8=Plăți estimate
    const newTabel2Rows = formData.tabel1.map((row1) => ({
      id: Date.now().toString() + Math.random(),
      col1: row1.col2 || '', // Program
      col2: normalizeSsiValue(row1.col3), // SSI (object)
      col3: row1.col5 || '0', // Valoare totală revizie precedentă → Plăți ani precedenți
      col4: row1.col7 || '0', // Plăți estimate an curent (preluat din total actualizat)
      col5: '0', // Plăți estimate an n+1
      col6: '0', // Plăți estimate an n+2
      col7: '0', // Plăți estimate an n+3
      col8: '0', // Plăți estimate anii următori
      total_updated: row1.col7 || '0',
    }));

    setFormData({ ...formData, tabel2: newTabel2Rows });

    notifications.show({
      title: 'Succes',
      message: `${newTabel2Rows.length} rând(uri) copiat(e) din Tabelul 1`,
      color: 'green',
    });
  };

  // Secțiunea B - File upload functions
  const handleSectionBFileUpload = async (files: File[]) => {
    try {
      const uploadedFiles: Array<{ name: string; url: string }> = [];
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await api.post('/api/library/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        
        uploadedFiles.push({
          name: file.name,
          url: response.data.file_path || response.data.url,
        });
      }
      
      setCapturaImaginiFiles([...capturaImaginiFiles, ...uploadedFiles]);
      
      notifications.show({
        title: 'Succes',
        message: `${files.length} fișier(e) încărcat(e)`,
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to upload files:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Eroare la încărcarea fișierelor',
        color: 'red',
      });
    }
  };

  const handleSectionBFileDelete = (index: number) => {
    setCapturaImaginiFiles(capturaImaginiFiles.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    if (!formData.titluDocument || formData.titluDocument.trim() === '') {
      notifications.show({
        title: 'Eroare validare',
        message: 'Titlul documentului de fundamentare este obligatoriu',
        color: 'red',
      });
      return false;
    }

    if (formData.revizia === undefined || formData.revizia === null || formData.revizia < 0) {
      notifications.show({
        title: 'Eroare validare',
        message: 'Reviziea este obligatorie și trebuie să fie cel puțin 0',
        color: 'red',
      });
      return false;
    }

    if (!formData.dataReviziei) {
      notifications.show({
        title: 'Eroare validare',
        message: 'Data reviziii este obligatorie',
        color: 'red',
      });
      return false;
    }

    // Check if date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.dataReviziei);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      notifications.show({
        title: 'Eroare validare',
        message: 'Data reviziii nu poate fi în trecut',
        color: 'red',
      });
      return false;
    }

    if (!formData.compartiment) {
      notifications.show({
        title: 'Eroare validare',
        message: 'Compartimentul de specialitate este obligatoriu',
        color: 'red',
      });
      return false;
    }

    if (!formData.descriereScurta || formData.descriereScurta.trim() === '') {
      notifications.show({
        title: 'Eroare validare',
        message: 'Descrierea pe scurt este obligatorie',
        color: 'red',
      });
      return false;
    }

    if (!formData.descriereDetaliata || formData.descriereDetaliata.trim() === '') {
      notifications.show({
        title: 'Eroare validare',
        message: 'Descrierea pe larg a stării de fapt și de drept este obligatorie',
        color: 'red',
      });
      return false;
    }

    if (!formData.valorificareTip) {
      notifications.show({
        title: 'Eroare validare',
        message: 'Trebuie să selectezi o opțiune pentru valoarea angajamentelor legale',
        color: 'red',
      });
      return false;
    }

    if (formData.valorificareTip === 'stabilita' && formData.tabel1.length === 0) {
      notifications.show({
        title: 'Eroare validare',
        message: 'Trebuie să adaugi cel puțin un rând în Tabelul 1',
        color: 'red',
      });
      return false;
    }

    if (!formData.angajamenteLegale) {
      notifications.show({
        title: 'Eroare validare',
        message: 'Trebuie să selectezi o opțiune pentru angajamentele legale',
        color: 'red',
      });
      return false;
    }

    if (formData.seEfectueazaPlatiMultiAn && formData.tabel2.length === 0) {
      notifications.show({
        title: 'Eroare validare',
        message: 'Trebuie să adaugi cel puțin un rând în Tabelul 2',
        color: 'red',
      });
      return false;
    }

    return true;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <Stack gap="lg" style={{ overflow: 'visible' }}>
      <FormHeader formData={formData} onChange={handleChange} />

      <Divider />

      <Title order={3}>Secțiunea A: Obiectul documentului de fundamentare</Title>

      <FormSectionA
        formData={formData}
        departmentOptions={departmentOptions}
        loadingDepartments={loadingDepartments}
        onChange={handleChange}
      />

      <Divider />

      <FormSectionTables
        formData={formData}
        onChange={handleChange}
        onAddTabel1Row={addTabel1Row}
        onRemoveTabel1Row={removeTabel1Row}
        onUpdateTabel1Cell={updateTabel1Cell}
        onAddTabel2Row={addTabel2Row}
        onRemoveTabel2Row={removeTabel2Row}
        onUpdateTabel2Cell={updateTabel2Cell}
        onCopyFromTabel1={copyFromTabel1}
      />

      {showSectionB && (
        <>
          <Divider />

          <Title order={3}>Secțiunea B: Situația evidențiată în sistemul de control al angajamentelor</Title>

          <FormSectionB
            formData={formData}
            onChange={handleChange}
            onFileUpload={handleSectionBFileUpload}
            uploadedFiles={capturaImaginiFiles}
            onFileDelete={handleSectionBFileDelete}
          />
        </>
      )}

      <Group justify="flex-end" mt="xl">
        <Button variant="subtle" onClick={onCancel}>
          Anulează
        </Button>
        <Button onClick={handleSubmit}>
          Salvează
        </Button>
      </Group>
    </Stack>
  );
}
