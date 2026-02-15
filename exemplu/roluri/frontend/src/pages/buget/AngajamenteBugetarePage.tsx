/**
 * AngajamenteBugetarePage - Pagină pentru gestionarea angajamentelor bugetare
 * Cu AJAX loading, paginare, căutare și filtre
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Title,
  Paper,
  Table,
  TextInput,
  Button,
  Group,
  Pagination,
  LoadingOverlay,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Modal,
  Stack,
  Select,
  NumberInput,
  Textarea,
  Grid,
  Alert,
  FileInput
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconAlertCircle,
  IconCheck,
  IconDownload,
  IconFileText,
  IconSignature
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { useDebouncedValue } from '@mantine/hooks';
import { useProcurementYears } from '../../hooks/useProcurementYears';
import { PdfSignatureBadge } from '../procurement/components/PdfSignatureBadge';

interface AngajamentBugetar {
  _id: string;
  numar_angajament: string;
  data_angajament: string;
  an_bugetar: number;
  cod_clasificare: string;
  clasificare_id?: string;
  suma_lei: number;
  suma_consumata: number;
  suma_disponibila: number;
  beneficiar?: {
    denumire: string;
    cif: string;
  };
  scop: string;
  stare: string;
  tip_angajament: string;
  cfp_propunere?: {
    numar: string;
    data: string;
  };
  subunitate_id?: string;
  cod_subunitate?: string;
  generated_docs?: GeneratedDocEntry[];
  signed_pdf_hash?: string;
  signed_pdf_filename?: string;
  signed_pdf_uploaded_at?: string;
  aprobat?: boolean;
  aprobat_de?: string;
  aprobat_la?: string;
}

interface OptionItem {
  value: string;
  label: string;
  cod?: string;
  denumire?: string;
}

interface GeneratedDocEntry {
  id: string;
  template_code?: string;
  template_name?: string;
  file_hash: string;
  filename?: string;
  generated_at?: string;
  generated_by?: string;
}

export function AngajamenteBugetarePage() {
  const { t } = useTranslation();
  
  // State pentru listă
  const [items, setItems] = useState<AngajamentBugetar[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  
  // Filtre
  const [anBugetar, setAnBugetar] = useState<string | null>(null);
  const [stareFilter, setStareFilter] = useState<string | null>(null);

  const { years, loading: yearsLoading } = useProcurementYears();
  const latestYear = useMemo(() => {
    if (!years.length) {
      return null;
    }
    return years.reduce((max, year) => (year.year > max ? year.year : max), years[0].year);
  }, [years]);
  const yearOptions = useMemo(() => {
    const options = years.map((year) => ({
      value: year.value,
      label: year.label,
    }));
    if (anBugetar && !options.some((option) => option.value === anBugetar)) {
      options.unshift({ value: anBugetar, label: anBugetar });
    }
    return options;
  }, [years, anBugetar]);
  const defaultYear = useMemo(() => {
    if (anBugetar) {
      const parsed = parseInt(anBugetar, 10);
      return Number.isNaN(parsed) ? new Date().getFullYear() : parsed;
    }
    if (latestYear) {
      return latestYear;
    }
    return new Date().getFullYear();
  }, [anBugetar, latestYear]);
  
  // State pentru modale
  const [modalOpened, setModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<AngajamentBugetar | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadModalOpened, setUploadModalOpened] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<AngajamentBugetar | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingSigned, setUploadingSigned] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  
  // State pentru disponibil buget
  const [disponibilBuget, setDisponibilBuget] = useState<number | null>(null);
  const [loadingDisponibil, setLoadingDisponibil] = useState(false);

  // Nomenclatoare
  const [clasificari, setClasificari] = useState<OptionItem[]>([]);
  const [subunitati, setSubunitati] = useState<OptionItem[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingNextNumber, setLoadingNextNumber] = useState(false);
  
  // Form pentru creare/editare
  const form = useForm({
    initialValues: {
      numar_angajament: '',
      data_angajament: new Date(),
      an_bugetar: new Date().getFullYear(),
      clasificare_id: '',
      subunitate_id: '',
      suma_lei: 0,
      suma_valuta: 0,
      cod_moneda: 'LEI',
      cod_beneficiar: '',
      scop: '',
      este_multianual: false,
      suma_totala: 0,
      cod_compartiment: '',
      cod_program: '',
      delegat: ''
    },
    validate: {
      numar_angajament: (value) => (!value ? 'Numărul angajamentului este obligatoriu' : null),
      clasificare_id: (value) => (!value ? 'Clasificarea bugetară este obligatorie' : null),
      subunitate_id: (value) => (!value ? 'Subunitatea este obligatorie' : null),
      suma_lei: (value) => (value <= 0 ? 'Suma trebuie să fie mai mare ca 0' : null),
      scop: (value) => (!value ? 'Scopul este obligatoriu' : null)
    }
  });
  
  // Încărcare date
  const loadData = useCallback(async () => {
    if (!anBugetar) {
      return;
    }
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: 50,
        sort_by: 'data_angajament',
        sort_order: 'desc'
      };
      
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      
      params.an_bugetar = parseInt(anBugetar);
      
      if (stareFilter) {
        params.stare = stareFilter;
      }
      
      const response = await api.get('/api/angajamente-bugetare', { params });
      
      setItems(response.data.items || []);
      setTotalPages(response.data.pages || 1);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Error loading angajamente:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca datele',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, anBugetar, stareFilter]);

  const loadNomenclatoare = useCallback(async () => {
    if (loadingOptions) {
      return;
    }
    setLoadingOptions(true);
    try {
      const [clasRes, subRes] = await Promise.all([
        api.get('/api/angajamente-bugetare/nomenclatoare/clasificari'),
        api.get('/api/angajamente-bugetare/nomenclatoare/subunitati'),
      ]);
      setClasificari(Array.isArray(clasRes.data) ? clasRes.data : []);
      setSubunitati(Array.isArray(subRes.data) ? subRes.data : []);
    } catch (error) {
      console.error('Error loading nomenclatoare:', error);
      setClasificari([]);
      setSubunitati([]);
    } finally {
      setLoadingOptions(false);
    }
  }, [loadingOptions]);

  const loadNextNumber = useCallback(async (dateValue?: Date) => {
    if (loadingNextNumber) {
      return;
    }
    setLoadingNextNumber(true);
    try {
      const params: any = {};
      if (dateValue) {
        params.data_angajament = dateValue.toISOString().split('T')[0];
      }
      const response = await api.get('/api/angajamente-bugetare/next-number', { params });
      if (response.data?.next_number) {
        form.setFieldValue('numar_angajament', response.data.next_number);
      }
    } catch (error) {
      console.error('Error loading next number:', error);
    } finally {
      setLoadingNextNumber(false);
    }
  }, [form, loadingNextNumber]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (modalOpened) {
      loadNomenclatoare();
    }
  }, [modalOpened, loadNomenclatoare]);

  useEffect(() => {
    if (modalOpened && !editingItem) {
      loadNextNumber(form.values.data_angajament);
    }
  }, [modalOpened, editingItem, form.values.data_angajament, loadNextNumber]);

  useEffect(() => {
    if (!years.length || !latestYear) {
      return;
    }
    setAnBugetar((prev) => {
      if (prev && years.some((year) => year.value === prev)) {
        return prev;
      }
      return latestYear.toString();
    });
  }, [years, latestYear]);
  
  // Reset page când se schimbă filtrele
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [debouncedSearch, anBugetar, stareFilter]);
  
  // Calculare disponibil buget
  const calculeazaDisponibil = async (clasificareId: string, subunitateId: string, anBugetar: number) => {
    if (!clasificareId || !subunitateId || !anBugetar) {
      setDisponibilBuget(null);
      return;
    }
    
    setLoadingDisponibil(true);
    try {
      const response = await api.get('/api/angajamente-bugetare/disponibil/buget', {
        params: {
          clasificare_id: clasificareId,
          subunitate_id: subunitateId,
          an_bugetar: anBugetar
        }
      });
      
      setDisponibilBuget(response.data.disponibil);
    } catch (error) {
      console.error('Error calculating disponibil:', error);
      setDisponibilBuget(null);
    } finally {
      setLoadingDisponibil(false);
    }
  };
  
  // Watch pentru clasificare și subunitate
  useEffect(() => {
    if (form.values.clasificare_id && form.values.subunitate_id && form.values.an_bugetar) {
      calculeazaDisponibil(form.values.clasificare_id, form.values.subunitate_id, form.values.an_bugetar);
    }
  }, [form.values.clasificare_id, form.values.subunitate_id, form.values.an_bugetar]);
  
  // Deschide modal pentru adăugare/editare
  const handleOpenModal = (item?: AngajamentBugetar) => {
    if (item) {
      setEditingItem(item);
      form.setValues({
        numar_angajament: item.numar_angajament,
        data_angajament: new Date(item.data_angajament),
        an_bugetar: item.an_bugetar,
        clasificare_id: item.clasificare_id || '',
        subunitate_id: item.subunitate_id || '',
        suma_lei: item.suma_lei,
        suma_valuta: 0,
        cod_moneda: 'LEI',
        cod_beneficiar: '', // TODO: from item
        scop: item.scop,
        este_multianual: item.tip_angajament === 'MULTIANUAL',
        suma_totala: item.suma_lei,
        cod_compartiment: '',
        cod_program: '',
        delegat: ''
      });
    } else {
      setEditingItem(null);
      form.reset();
      form.setFieldValue('an_bugetar', defaultYear);
    }
    setModalOpened(true);
  };
  
  // Salvare angajament
  const handleSave = async (values: typeof form.values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        an_bugetar: values.data_angajament ? values.data_angajament.getFullYear() : values.an_bugetar
      };
      if (editingItem) {
        await api.put(`/api/angajamente-bugetare/${editingItem._id}`, payload);
        notifications.show({
          title: 'Succes',
          message: 'Angajamentul a fost modificat',
          color: 'green',
          icon: <IconCheck size={16} />
        });
      } else {
        await api.post('/api/angajamente-bugetare', payload);
        notifications.show({
          title: 'Succes',
          message: 'Angajamentul a fost creat',
          color: 'green',
          icon: <IconCheck size={16} />
        });
      }
      
      setModalOpened(false);
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut salva angajamentul',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Deschide modal pentru ștergere
  const handleOpenDeleteModal = (itemId: string) => {
    setDeletingItemId(itemId);
    setDeleteModalOpened(true);
  };
  
  // Ștergere (anulare) angajament
  const handleDelete = async () => {
    if (!deletingItemId) return;
    
    try {
      await api.delete(`/api/angajamente-bugetare/${deletingItemId}`, {
        params: { motiv: 'Anulat de utilizator' }
      });
      
      notifications.show({
        title: 'Succes',
        message: 'Angajamentul a fost anulat',
        color: 'green',
        icon: <IconCheck size={16} />
      });
      
      setDeleteModalOpened(false);
      setDeletingItemId(null);
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut anula angajamentul',
        color: 'red'
      });
    }
  };
  
  // Export Excel
  const handleExport = async () => {
    try {
      const params: any = {};
      
      if (anBugetar) {
        params.an_bugetar = parseInt(anBugetar);
      }
      
      if (stareFilter) {
        params.stare = stareFilter;
      }
      
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      
      const response = await api.get('/api/angajamente-bugetare/export/excel', {
        params,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `angajamente_bugetare_${anBugetar || 'toate'}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      notifications.show({
        title: 'Succes',
        message: 'Fișierul a fost descărcat',
        color: 'green',
        icon: <IconCheck size={16} />
      });
    } catch (error) {
      console.error('Error exporting:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut exporta fișierul',
        color: 'red'
      });
    }
  };

  const getLatestGeneratedDoc = (item: AngajamentBugetar) => {
    const docs = item.generated_docs || [];
    if (!docs.length) {
      return null;
    }
    return docs[docs.length - 1];
  };

  const handleGenerateDocument = async (item: AngajamentBugetar) => {
    if (generatingId) {
      return;
    }
    setGeneratingId(item._id);
    try {
      await api.post(`/api/angajamente-bugetare/${item._id}/documents/generate`, {
        template_code: '6X8DMFTLLM4D',
        template_name: 'Angajament Bugetar'
      });
      notifications.show({
        title: 'Succes',
        message: 'Documentul a fost generat',
        color: 'green'
      });
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut genera documentul',
        color: 'red'
      });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleDownloadGenerated = (item: AngajamentBugetar) => {
    const doc = getLatestGeneratedDoc(item);
    if (!doc) {
      return;
    }
    window.open(`/api/angajamente-bugetare/${item._id}/documents/${doc.id}/download`, '_blank');
  };

  const handleOpenUploadSigned = (item: AngajamentBugetar) => {
    setUploadTarget(item);
    setUploadFile(null);
    setUploadModalOpened(true);
  };

  const handleUploadSigned = async () => {
    if (!uploadTarget || !uploadFile) {
      notifications.show({
        title: 'Eroare',
        message: 'Selectează un fișier PDF înainte de încărcare',
        color: 'red'
      });
      return;
    }
    setUploadingSigned(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', uploadFile);
      await api.post(`/api/angajamente-bugetare/${uploadTarget._id}/signed/upload`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      notifications.show({
        title: 'Succes',
        message: 'Documentul semnat a fost încărcat',
        color: 'green'
      });
      setUploadModalOpened(false);
      setUploadTarget(null);
      setUploadFile(null);
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut încărca documentul semnat',
        color: 'red'
      });
    } finally {
      setUploadingSigned(false);
    }
  };

  const handleDownloadSigned = (item: AngajamentBugetar) => {
    if (!item.signed_pdf_hash) {
      return;
    }
    window.open(`/api/angajamente-bugetare/${item._id}/signed/download`, '_blank');
  };
  
  // Format număr
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };
  
  // Badge pentru stare
  const getStareBadge = (stare: string) => {
    const colors: Record<string, string> = {
      'ACTIV': 'green',
      'CONSUMAT': 'blue',
      'ANULAT': 'red'
    };
    return <Badge color={colors[stare] || 'gray'} size="sm">{stare}</Badge>;
  };
  
  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>Angajamente Bugetare</Title>
        <Group>
          <Button
            variant="outline"
            leftSection={<IconDownload size={16} />}
            onClick={handleExport}
            style={{ backgroundColor: 'white' }}
          >
            Export Excel
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => handleOpenModal()}
          >
            Angajament Nou
          </Button>
        </Group>
      </Group>
      
      <Paper shadow="xs" p="md" mb="md">
        <Grid>
          <Grid.Col span={6}>
            <TextInput
              placeholder="Căutare după număr, scop, beneficiar..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={3}>
            <Select
              placeholder="An bugetar"
              data={yearOptions}
              value={anBugetar}
              onChange={setAnBugetar}
              clearable
              disabled={yearsLoading}
            />
          </Grid.Col>
          <Grid.Col span={3}>
            <Select
              placeholder="Stare"
              data={[
                { value: 'ACTIV', label: 'Activ' },
                { value: 'CONSUMAT', label: 'Consumat' },
                { value: 'ANULAT', label: 'Anulat' }
              ]}
              value={stareFilter}
              onChange={setStareFilter}
              clearable
            />
          </Grid.Col>
        </Grid>
        
        <Group mt="sm">
          <Text size="sm" c="dimmed">
            Total: {total} angajamente
          </Text>
        </Group>
      </Paper>
      
      <Paper shadow="xs" p="md" pos="relative">
        <LoadingOverlay visible={loading} />
        
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nr. Angajament</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th>Cod Clasificare</Table.Th>
              <Table.Th>Beneficiar</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Sumă Lei</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Consumat</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Disponibil</Table.Th>
              <Table.Th>Stare</Table.Th>
              <Table.Th>Documente</Table.Th>
              <Table.Th>Acțiuni</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item._id}>
                <Table.Td>
                  <Text size="sm" fw={500}>{item.numar_angajament}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {new Date(item.data_angajament).toLocaleDateString('ro-RO')}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{item.cod_clasificare}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1}>
                    {item.beneficiar?.denumire || '-'}
                  </Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm" fw={500}>{formatNumber(item.suma_lei)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm">{formatNumber(item.suma_consumata)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm" c="green">{formatNumber(item.suma_disponibila)}</Text>
                </Table.Td>
                <Table.Td>
                  {getStareBadge(item.stare)}
                </Table.Td>
                <Table.Td>
                  <Stack gap={4}>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">Generat</Text>
                      <Tooltip label="Genereaz? document">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => handleGenerateDocument(item)}
                          disabled={generatingId === item._id}
                        >
                          <IconFileText size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Descarc? document generat">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => handleDownloadGenerated(item)}
                          disabled={!getLatestGeneratedDoc(item)}
                        >
                          <IconDownload size={14} />
                        </ActionIcon>
                      </Tooltip>
                      {getLatestGeneratedDoc(item)?.file_hash && (
                        <PdfSignatureBadge endpoint={`/api/data/files/${getLatestGeneratedDoc(item)?.file_hash}/signature`} />
                      )}
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">Semnat</Text>
                      <Tooltip label="?ncarc? document semnat">
                        <ActionIcon
                          variant="subtle"
                          color="green"
                          onClick={() => handleOpenUploadSigned(item)}
                        >
                          <IconSignature size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Descarc? document semnat">
                        <ActionIcon
                          variant="subtle"
                          color="green"
                          onClick={() => handleDownloadSigned(item)}
                          disabled={!item.signed_pdf_hash}
                        >
                          <IconDownload size={14} />
                        </ActionIcon>
                      </Tooltip>
                      {item.signed_pdf_hash && (
                        <PdfSignatureBadge endpoint={`/api/data/files/${item.signed_pdf_hash}/signature`} />
                      )}
                    </Group>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label="Modificare">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => handleOpenModal(item)}
                        disabled={item.stare === 'ANULAT'}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Anulare">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleOpenDeleteModal(item._id)}
                        disabled={item.stare === 'ANULAT'}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !loading && (
              <Table.Tr>
                <Table.Td colSpan={10}>
                  <Text ta="center" c="dimmed" py="xl">
                    Nu există angajamente
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
        
        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination
              value={page}
              onChange={setPage}
              total={totalPages}
            />
          </Group>
        )}
      </Paper>
      
      {/* Modal pentru adăugare/editare */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={<Text fw={600}>{editingItem ? 'Modificare Angajament' : 'Angajament Bugetar Nou'}</Text>}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSave)}>
          <Stack>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Număr Angajament"
                  placeholder="Ex: 001"
                  required
                  {...form.getInputProps('numar_angajament')}
                  disabled
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <DateInput
                  label="Data Angajament"
                  placeholder="Selectează data"
                  required
                  valueFormat="DD.MM.YYYY"
                  {...form.getInputProps('data_angajament')}
                  onChange={(value) => {
                    form.setFieldValue('data_angajament', value || new Date());
                    if (value) {
                      form.setFieldValue('an_bugetar', value.getFullYear());
                    }
                  }}
                />
              </Grid.Col>
            </Grid>

            <Select
              label="Cod Clasificare Bugetară"
              placeholder="Selectează clasificarea"
              required
              searchable
              data={clasificari}
              value={form.values.clasificare_id}
              onChange={(value) => form.setFieldValue('clasificare_id', value || '')}
              disabled={loadingOptions}
            />

            <Select
              label="Cod Subunitate"
              placeholder="Selectează subunitatea"
              required
              searchable
              data={subunitati}
              value={form.values.subunitate_id}
              onChange={(value) => form.setFieldValue('subunitate_id', value || '')}
              disabled={loadingOptions}
            />
            
            {disponibilBuget !== null && (
              <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                Disponibil buget: <strong>{formatNumber(disponibilBuget)} LEI</strong>
              </Alert>
            )}
            
            <NumberInput
              label="Sumă în Lei"
              placeholder="0.00"
              required
              decimalScale={2}
              thousandSeparator=" "
              min={0}
              {...form.getInputProps('suma_lei')}
            />
            
            <TextInput
              label="Cod Beneficiar"
              placeholder="Ex: 0000001"
              {...form.getInputProps('cod_beneficiar')}
            />
            
            <Textarea
              label="Scop"
              placeholder="Descrierea scopului angajamentului"
              required
              minRows={3}
              {...form.getInputProps('scop')}
            />
            
            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={() => setModalOpened(false)}>
                Anulează
              </Button>
              <Button type="submit" loading={saving}>
                Salvează
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      
      {/* Modal pentru confirmare anulare */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Confirmare Anulare"
      >
        <Stack>
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            Sigur doriți să anulați acest angajament bugetar? Această acțiune nu poate fi anulată.
          </Alert>
          
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setDeleteModalOpened(false)}>
              Renunță
            </Button>
            <Button color="red" onClick={handleDelete}>
              Anulează Angajamentul
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal pentru încărcare document semnat */}
      <Modal
        opened={uploadModalOpened}
        onClose={() => setUploadModalOpened(false)}
        title="Încărcare document semnat"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Angajament: {uploadTarget?.numar_angajament || '-'}
          </Text>
          <FileInput
            label="Fișier PDF semnat"
            placeholder="Selectează fișierul"
            value={uploadFile}
            onChange={setUploadFile}
            accept="application/pdf"
            clearable
          />
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setUploadModalOpened(false)}>
              Renunță
            </Button>
            <Button onClick={handleUploadSigned} loading={uploadingSigned}>
              Încarcă
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

export default AngajamenteBugetarePage;
