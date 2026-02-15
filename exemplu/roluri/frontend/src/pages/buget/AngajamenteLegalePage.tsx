/**
 * AngajamenteLegalePage - Pagină pentru gestionarea angajamentelor legale
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
  IconTrash,
  IconAlertCircle,
  IconCheck,
  IconDownload,
  IconFileInvoice,
  IconFileText,
  IconSignature
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { useDebouncedValue } from '@mantine/hooks';
import { useProcurementYears } from '../../hooks/useProcurementYears';
import { PdfSignatureBadge } from '../procurement/components/PdfSignatureBadge';

interface AngajamentLegal {
  _id: string;
  numar_angajament: string;
  data_angajament: string;
  an_bugetar: number;
  cod_clasificare: string;
  suma_lei: number;
  suma_ordonantata: number;
  suma_disponibila: number;
  beneficiar?: {
    denumire: string;
    cif: string;
  };
  contract?: {
    numar: string;
    data: string;
  };
  scop: string;
  stare: string;
  angajament_bugetar_id?: string;
  angajament_bugetar_numar?: string;
  referat_info?: {
    referat_id?: string;
    nr?: number;
    titlu?: string;
    departament?: string;
    valoare_estimata?: number;
    an_bugetar?: number;
  };
  generated_docs?: GeneratedDocEntry[];
  signed_pdf_hash?: string;
  signed_pdf_filename?: string;
  signed_pdf_uploaded_at?: string;
}

interface AngajamentBugetar {
  _id: string;
  numar_angajament: string;
  suma_disponibila: number;
  cod_beneficiar: string;
  beneficiar?: {
    denumire: string;
  };
}

interface ContractOption {
  value: string;
  label: string;
  numar_contract?: string;
  data_contract?: string;
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

export function AngajamenteLegalePage() {
  const { t } = useTranslation();
  
  // State pentru listă
  const [items, setItems] = useState<AngajamentLegal[]>([]);
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
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadModalOpened, setUploadModalOpened] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<AngajamentLegal | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingSigned, setUploadingSigned] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  
  // State pentru angajamente bugetare
  const [angajamenteBugetare, setAngajamenteBugetare] = useState<AngajamentBugetar[]>([]);
  const [loadingAngBugetare, setLoadingAngBugetare] = useState(false);
  const [selectedAngBugetar, setSelectedAngBugetar] = useState<AngajamentBugetar | null>(null);
  const [contracte, setContracte] = useState<ContractOption[]>([]);
  const [loadingContracte, setLoadingContracte] = useState(false);
  const [loadingNextNumber, setLoadingNextNumber] = useState(false);
  const [referateOptions, setReferateOptions] = useState<Array<{ value: string; label: string; nr?: number; titlu?: string }>>([]);
  const [loadingReferate, setLoadingReferate] = useState(false);
  const [referatDetails, setReferatDetails] = useState<any>(null);
  
  // Form pentru creare
  const form = useForm({
    initialValues: {
      referat_id: '',
      angajament_bugetar_id: '',
      contract_id: '',
      numar_angajament: '',
      data_angajament: new Date(),
      suma_lei: 0,
      suma_valuta: 0,
      cod_moneda: 'LEI',
      scop: '',
      numar_contract: '',
      data_contract: null as Date | null,
      contract_explicatie: '',
      cod_compartiment: '',
      cod_program: '',
      cont_contabil: ''
    },
    validate: {
      angajament_bugetar_id: (value) => (!value ? 'Angajamentul bugetar este obligatoriu' : null),
      numar_angajament: (value) => (!value ? 'Numărul angajamentului este obligatoriu' : null),
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
      
      const response = await api.get('/api/angajamente-legale', { params });
      
      setItems(response.data.items || []);
      setTotalPages(response.data.pages || 1);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Error loading angajamente legale:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca datele',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, anBugetar, stareFilter]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);

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
  
  // Încărcare angajamente bugetare pentru select
  const loadAngajamenteBugetare = async () => {
    setLoadingAngBugetare(true);
    try {
      const response = await api.get('/api/angajamente-bugetare', {
        params: {
          page: 1,
          limit: 500,
          an_bugetar: defaultYear,
          stare: 'ACTIV'
        }
      });
      
      setAngajamenteBugetare(response.data.items || []);
    } catch (error) {
      console.error('Error loading angajamente bugetare:', error);
    } finally {
      setLoadingAngBugetare(false);
    }
  };

  const loadContracte = async () => {
    if (loadingContracte) {
      return;
    }
    setLoadingContracte(true);
    try {
      const response = await api.get('/api/angajamente-legale/contracte');
      setContracte(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading contracte:', error);
      setContracte([]);
    } finally {
      setLoadingContracte(false);
    }
  };

  const loadReferate = async () => {
    if (loadingReferate) {
      return;
    }
    setLoadingReferate(true);
    try {
      const response = await api.get('/api/angajamente-legale/referate/approved');
      const options = Array.isArray(response.data) ? response.data : [];
      setReferateOptions(options);
    } catch (error) {
      console.error('Error loading referate:', error);
      setReferateOptions([]);
    } finally {
      setLoadingReferate(false);
    }
  };

  const handleSelectReferat = async (value: string | null) => {
    form.setFieldValue('referat_id', value || '');
    setReferatDetails(null);
    if (!value) {
      return;
    }
    try {
      const response = await api.get(`/api/angajamente-legale/referate/${value}`);
      const referat = response.data;
      setReferatDetails(referat);
      if (referat?.valoare_estimata && (!form.values.suma_lei || form.values.suma_lei <= 0)) {
        form.setFieldValue('suma_lei', referat.valoare_estimata);
      }
      if (!form.values.scop && (referat?.titlu || referat?.justificare)) {
        form.setFieldValue('scop', referat.titlu || referat.justificare || '');
      }
    } catch (error) {
      console.error('Error loading referat details:', error);
      setReferatDetails(null);
    }
  };

  const loadNextNumber = async (dateValue?: Date) => {
    if (loadingNextNumber) {
      return;
    }
    setLoadingNextNumber(true);
    try {
      const params: any = {};
      if (dateValue) {
        params.an_bugetar = dateValue.getFullYear();
      }
      const response = await api.get('/api/angajamente-legale/next-number', { params });
      if (response.data?.next_number) {
        form.setFieldValue('numar_angajament', response.data.next_number);
      }
    } catch (error) {
      console.error('Error loading next number:', error);
    } finally {
      setLoadingNextNumber(false);
    }
  };
  
  // Deschide modal pentru adăugare
  const handleOpenModal = () => {
    form.reset();
    setSelectedAngBugetar(null);
    setReferatDetails(null);
    loadAngajamenteBugetare();
    loadContracte();
    loadReferate();
    loadNextNumber(form.values.data_angajament);
    setModalOpened(true);
  };
  
  // Watch pentru angajament bugetar selectat
  useEffect(() => {
    if (form.values.angajament_bugetar_id) {
      const selected = angajamenteBugetare.find(a => a._id === form.values.angajament_bugetar_id);
      setSelectedAngBugetar(selected || null);
    } else {
      setSelectedAngBugetar(null);
    }
  }, [form.values.angajament_bugetar_id, angajamenteBugetare]);
  
  // Salvare angajament legal
  const handleSave = async (values: typeof form.values) => {
    setSaving(true);
    try {
      await api.post('/api/angajamente-legale', values);
      notifications.show({
        title: 'Succes',
        message: 'Angajamentul legal a fost creat',
        color: 'green',
        icon: <IconCheck size={16} />
      });
      
      setModalOpened(false);
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut salva angajamentul legal',
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
  
  // Ștergere (anulare) angajament legal
  const handleDelete = async () => {
    if (!deletingItemId) return;
    
    try {
      await api.delete(`/api/angajamente-legale/${deletingItemId}`, {
        params: { motiv: 'Anulat de utilizator' }
      });
      
      notifications.show({
        title: 'Succes',
        message: 'Angajamentul legal a fost anulat',
        color: 'green',
        icon: <IconCheck size={16} />
      });
      
      setDeleteModalOpened(false);
      setDeletingItemId(null);
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut anula angajamentul legal',
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
      
      const response = await api.get('/api/angajamente-legale/export/excel', {
        params,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `angajamente_legale_${anBugetar || 'toate'}_${new Date().toISOString().split('T')[0]}.xlsx`);
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

  const getLatestGeneratedDoc = (item: AngajamentLegal) => {
    const docs = item.generated_docs || [];
    if (!docs.length) {
      return null;
    }
    return docs[docs.length - 1];
  };

  const handleGenerateDocument = async (item: AngajamentLegal) => {
    if (generatingId) {
      return;
    }
    setGeneratingId(item._id);
    try {
      await api.post(`/api/angajamente-legale/${item._id}/documents/generate`, {
        template_code: 'P3C6R2ENXSIC',
        template_name: 'Angajament Legal'
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

  const handleDownloadGenerated = (item: AngajamentLegal) => {
    const doc = getLatestGeneratedDoc(item);
    if (!doc) {
      return;
    }
    window.open(`/api/angajamente-legale/${item._id}/documents/${doc.id}/download`, '_blank');
  };

  const handleOpenUploadSigned = (item: AngajamentLegal) => {
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
      await api.post(`/api/angajamente-legale/${uploadTarget._id}/signed/upload`, formDataUpload, {
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

  const handleDownloadSigned = (item: AngajamentLegal) => {
    if (!item.signed_pdf_hash) {
      return;
    }
    window.open(`/api/angajamente-legale/${item._id}/signed/download`, '_blank');
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
      'ORDONANTAT_PARTIAL': 'yellow',
      'ORDONANTAT_TOTAL': 'blue',
      'ANULAT': 'red'
    };
    const labels: Record<string, string> = {
      'ACTIV': 'Activ',
      'ORDONANTAT_PARTIAL': 'Parțial',
      'ORDONANTAT_TOTAL': 'Ordonanțat',
      'ANULAT': 'Anulat'
    };
    return <Badge color={colors[stare] || 'gray'} size="sm">{labels[stare] || stare}</Badge>;
  };
  
  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>Angajamente Legale</Title>
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
            onClick={handleOpenModal}
          >
            Angajament Legal Nou
          </Button>
        </Group>
      </Group>
      
      <Paper shadow="xs" p="md" mb="md">
        <Grid>
          <Grid.Col span={6}>
            <TextInput
              placeholder="Căutare după număr, scop, beneficiar, contract..."
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
                { value: 'ORDONANTAT_PARTIAL', label: 'Ordonanțat Parțial' },
                { value: 'ORDONANTAT_TOTAL', label: 'Ordonanțat Total' },
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
            Total: {total} angajamente legale
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
              <Table.Th>Beneficiar</Table.Th>
              <Table.Th>Contract</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Sumă Lei</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Ordonanțat</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Disponibil</Table.Th>
              <Table.Th>Stare</Table.Th>
              <Table.Th>Ang. Bugetar</Table.Th>
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
                  <Text size="sm" lineClamp={1}>
                    {item.beneficiar?.denumire || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{item.contract?.numar || '-'}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm" fw={500}>{formatNumber(item.suma_lei)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm">{formatNumber(item.suma_ordonantata)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm" c="green">{formatNumber(item.suma_disponibila)}</Text>
                </Table.Td>
                <Table.Td>
                  {getStareBadge(item.stare)}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">{item.angajament_bugetar_numar || '-'}</Text>
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
                  <Tooltip label="Anulare">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleOpenDeleteModal(item._id)}
                      disabled={item.stare === 'ANULAT' || item.suma_ordonantata > 0}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !loading && (
              <Table.Tr>
                <Table.Td colSpan={11}>
                  <Text ta="center" c="dimmed" py="xl">
                    Nu există angajamente legale
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
      
      {/* Modal pentru adăugare */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={<Text fw={600}>Angajament Legal Nou</Text>}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSave)}>
          <Stack>
            <Select
              label="Referat (op?ional)"
              placeholder="Selecteaz? un referat aprobat"
              searchable
              data={referateOptions}
              value={form.values.referat_id}
              onChange={handleSelectReferat}
              disabled={loadingReferate}
              clearable
            />

            {referatDetails && (
              <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                <Text size="sm">
                  <strong>Referat:</strong> #{referatDetails.nr || 'N/A'} - {referatDetails.titlu || ''}
                </Text>
                {referatDetails.valoare_estimata && (
                  <Text size="sm">
                    <strong>Valoare:</strong> {formatNumber(referatDetails.valoare_estimata)} LEI
                  </Text>
                )}
                {referatDetails.departament && (
                  <Text size="sm">
                    <strong>Departament:</strong> {referatDetails.departament}
                  </Text>
                )}
              </Alert>
            )}

            <Select
              label="Angajament Bugetar"
              placeholder="Selectează angajamentul bugetar"
              required
              searchable
              data={angajamenteBugetare.map(a => ({
                value: a._id,
                label: `${a.numar_angajament} - ${a.beneficiar?.denumire || 'N/A'} (Disponibil: ${formatNumber(a.suma_disponibila)} LEI)`
              }))}
              {...form.getInputProps('angajament_bugetar_id')}
              disabled={loadingAngBugetare}
              leftSection={<IconFileInvoice size={16} />}
            />
            
            {selectedAngBugetar && (
              <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                <Text size="sm">
                  <strong>Disponibil în angajament bugetar:</strong> {formatNumber(selectedAngBugetar.suma_disponibila)} LEI
                </Text>
                <Text size="sm">
                  <strong>Beneficiar:</strong> {selectedAngBugetar.beneficiar?.denumire || 'N/A'}
                </Text>
              </Alert>
            )}
            
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Număr Angajament Legal"
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
                      loadNextNumber(value);
                    }
                  }}
                />
              </Grid.Col>
            </Grid>
            
            <NumberInput
              label="Sumă în Lei"
              placeholder="0.00"
              required
              decimalScale={2}
              thousandSeparator=" "
              min={0}
              max={selectedAngBugetar?.suma_disponibila}
              {...form.getInputProps('suma_lei')}
            />
            
            <Grid>
              <Grid.Col span={4}>
                <Select
                  label="Alege contract"
                  placeholder="Selectează contract"
                  searchable
                  data={contracte}
                  value={form.values.contract_id}
                  onChange={(value) => {
                    form.setFieldValue('contract_id', value || '');
                    const selected = contracte.find((c) => c.value === value);
                    if (selected) {
                      if (selected.numar_contract) {
                        form.setFieldValue('numar_contract', selected.numar_contract);
                      }
                      if (selected.data_contract) {
                        form.setFieldValue('data_contract', new Date(selected.data_contract));
                      }
                    } else {
                      form.setFieldValue('numar_contract', '');
                      form.setFieldValue('data_contract', null);
                    }
                  }}
                  disabled={loadingContracte}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Număr Contract"
                  placeholder="Ex: 123/2025"
                  {...form.getInputProps('numar_contract')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <DateInput
                  label="Data Contract"
                  placeholder="Data"
                  valueFormat="DD.MM.YYYY"
                  {...form.getInputProps('data_contract')}
                />
              </Grid.Col>
            </Grid>
            
            <Textarea
              label="Scop"
              placeholder="Descrierea scopului angajamentului legal"
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
            Sigur doriți să anulați acest angajament legal? Suma va fi eliberată în angajamentul bugetar.
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

export default AngajamenteLegalePage;
