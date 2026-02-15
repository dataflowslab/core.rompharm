/**
 * BugetAprobatPage - Pagina pentru gestionarea bugetului aprobat
 * Include listă cu căutare AJAX, export Excel, modificare și suplimentare/diminuare
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
  NumberInput,
  Select,
  Switch,
  Alert,
  Grid
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconDownload,
  IconEdit,
  IconPlus,
  IconMinus,
  IconAlertCircle,
  IconCheck
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { useDebouncedValue } from '@mantine/hooks';
import { useProcurementYears } from '../../hooks/useProcurementYears';

interface BugetItem {
  _id: string;
  cod_clasificare: string;
  denumire: string;
  suma_initiala: number;
  suma_curenta: number;
  trimestre: {
    t1: number;
    t2: number;
    t3: number;
    t4: number;
  };
  tip_operatie: string;
  numar_document: string;
  data_document: string | null;
  cod_subunitate: string;
  cod_program: string;
  an_bugetar: number;
}

interface NomenclatorItem {
  _id: string;
  cod: string;
  denumire: string;
  label: string;
}

export function BugetAprobatPage() {
  const { t } = useTranslation();
  
  // State pentru listă
  const [items, setItems] = useState<BugetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [anBugetar, setAnBugetar] = useState<string | null>(null);
  const { years, loading: yearsLoading } = useProcurementYears();

  const latestYear = useMemo(() => {
    if (!years.length) {
      return null;
    }
    return years.reduce((max, year) => (year.year > max ? year.year : max), years[0].year);
  }, [years]);

  const yearOptions = useMemo(() => {
    const options = years.map((year) => ({ value: year.value, label: year.label }));
    if (anBugetar && !options.some((option) => option.value === anBugetar)) {
      options.unshift({ value: anBugetar, label: anBugetar });
    }
    return options;
  }, [years, anBugetar]);
  
  // State pentru modale
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [ajustareModalOpen, setAjustareModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BugetItem | null>(null);
  const [saving, setSaving] = useState(false);
  
  // State pentru nomenclatoare
  const [capitole, setCapitole] = useState<NomenclatorItem[]>([]);
  const [subcapitole, setSubcapitole] = useState<NomenclatorItem[]>([]);
  const [aliniate, setAliniate] = useState<NomenclatorItem[]>([]);
  const [programe, setPrograme] = useState<NomenclatorItem[]>([]);
  
  // Form pentru modificare
  const editForm = useForm({
    initialValues: {
      suma_totala: 0,
      trimestru_1: 0,
      trimestru_2: 0,
      trimestru_3: 0,
      trimestru_4: 0,
      numar_document: '',
      data_document: null as Date | null
    },
    validate: {
      numar_document: (value) => (!value ? 'Numărul documentului este obligatoriu' : null),
      data_document: (value) => (!value ? 'Data documentului este obligatorie' : null)
    }
  });
  
  // Form pentru ajustare (suplimentare/diminuare)
  const ajustareForm = useForm({
    initialValues: {
      tip_ajustare: 'SUPLIMENTARE' as 'SUPLIMENTARE' | 'DIMINUARE',
      suma_totala: 0,
      trimestru_1: 0,
      trimestru_2: 0,
      trimestru_3: 0,
      trimestru_4: 0,
      numar_document: '',
      data_document: null as Date | null,
      capitol_id: '',
      subcapitol_id: '',
      alineat_id: '',
      program_id: ''
    },
    validate: {
      numar_document: (value) => (!value ? 'Numărul documentului este obligatoriu' : null),
      data_document: (value) => (!value ? 'Data documentului este obligatorie' : null)
    }
  });
  
  // Încărcare date
  const loadData = useCallback(async () => {
    if (!anBugetar) {
      return;
    }
    setLoading(true);
    try {
      const response = await api.get('/api/buget/aprobat', {
        params: {
          page,
          limit: 50,
          search: debouncedSearch || undefined,
          an_bugetar: parseInt(anBugetar, 10)
        }
      });
      
      setItems(response.data.items || []);
      setTotalPages(response.data.pages || 1);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Error loading buget:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca datele',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, anBugetar]);
  
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

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [debouncedSearch, anBugetar]);
  
  // Încărcare nomenclatoare
  const loadNomenclatoare = async () => {
    try {
      const [capRes, subRes, aliRes, prgRes] = await Promise.all([
        api.get('/api/buget/nomenclatoare/capitole'),
        api.get('/api/buget/nomenclatoare/subcapitole'),
        api.get('/api/buget/nomenclatoare/aliniate'),
        api.get('/api/buget/nomenclatoare/programe')
      ]);
      
      setCapitole(capRes.data || []);
      setSubcapitole(subRes.data || []);
      setAliniate(aliRes.data || []);
      setPrograme(prgRes.data || []);
    } catch (error) {
      console.error('Error loading nomenclatoare:', error);
    }
  };
  
  // Export Excel
  const handleExport = async () => {
    try {
      const response = await api.get('/api/buget/aprobat/export/excel', {
        params: { 
          search: debouncedSearch || undefined,
          an_bugetar: anBugetar ? parseInt(anBugetar, 10) : undefined
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `buget_aprobat_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      notifications.show({
        title: 'Succes',
        message: 'Fișierul a fost descărcat',
        color: 'green'
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
  
  // Deschide modal modificare
  const openEditModal = (item: BugetItem) => {
    setSelectedItem(item);
    editForm.setValues({
      suma_totala: item.suma_curenta,
      trimestru_1: item.trimestre.t1,
      trimestru_2: item.trimestre.t2,
      trimestru_3: item.trimestre.t3,
      trimestru_4: item.trimestre.t4,
      numar_document: item.numar_document || '',
      data_document: item.data_document ? new Date(item.data_document) : null
    });
    setEditModalOpen(true);
  };
  
  // Deschide modal ajustare
  const openAjustareModal = (item: BugetItem) => {
    setSelectedItem(item);
    loadNomenclatoare();
    
    // Precompletare capitol din item selectat
    const parsed = item.cod_clasificare;
    ajustareForm.setValues({
      tip_ajustare: 'SUPLIMENTARE',
      suma_totala: 0,
      trimestru_1: 0,
      trimestru_2: 0,
      trimestru_3: 0,
      trimestru_4: 0,
      numar_document: '',
      data_document: null,
      capitol_id: '',
      subcapitol_id: '',
      alineat_id: '',
      program_id: ''
    });
    setAjustareModalOpen(true);
  };
  
  // Salvare modificare
  const handleSaveEdit = async (values: typeof editForm.values) => {
    if (!selectedItem) return;
    
    setSaving(true);
    try {
      await api.put(`/api/buget/aprobat/${selectedItem._id}`, {
        suma_totala: values.suma_totala,
        trimestru_1: values.trimestru_1,
        trimestru_2: values.trimestru_2,
        trimestru_3: values.trimestru_3,
        trimestru_4: values.trimestru_4,
        numar_document: values.numar_document,
        data_document: values.data_document?.toISOString()
      });
      
      notifications.show({
        title: 'Succes',
        message: 'Modificările au fost salvate',
        color: 'green',
        icon: <IconCheck size={16} />
      });
      
      setEditModalOpen(false);
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-au putut salva modificările',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Salvare ajustare
  const handleSaveAjustare = async (values: typeof ajustareForm.values) => {
    if (!selectedItem) return;
    
    setSaving(true);
    try {
      await api.post(`/api/buget/aprobat/${selectedItem._id}/ajustare`, {
        tip_ajustare: values.tip_ajustare,
        suma_totala: values.suma_totala,
        trimestru_1: values.trimestru_1,
        trimestru_2: values.trimestru_2,
        trimestru_3: values.trimestru_3,
        trimestru_4: values.trimestru_4,
        numar_document: values.numar_document,
        data_document: values.data_document?.toISOString(),
        capitol_id: values.capitol_id || undefined,
        subcapitol_id: values.subcapitol_id || undefined,
        alineat_id: values.alineat_id || undefined,
        program_id: values.program_id || undefined
      });
      
      notifications.show({
        title: 'Succes',
        message: `${values.tip_ajustare === 'SUPLIMENTARE' ? 'Suplimentarea' : 'Diminuarea'} a fost înregistrată`,
        color: 'green',
        icon: <IconCheck size={16} />
      });
      
      setAjustareModalOpen(false);
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut înregistra ajustarea',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Calculare automată sumă totală din trimestre
  const calculeazaSumaTotala = (form: typeof editForm | typeof ajustareForm) => {
    const t1 = form.values.trimestru_1 || 0;
    const t2 = form.values.trimestru_2 || 0;
    const t3 = form.values.trimestru_3 || 0;
    const t4 = form.values.trimestru_4 || 0;
    const suma = t1 + t2 + t3 + t4;
    if (suma > 0) {
      form.setFieldValue('suma_totala', suma);
    }
  };
  
  // Format număr
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };
  
  // Badge pentru tip operație
  const getTipOperatieBadge = (tip: string) => {
    const colors: Record<string, string> = {
      'INITIAL': 'gray',
      'APROBAT': 'blue',
      'SUPLIMENTARE': 'green',
      'DIMINUARE': 'red',
      'MODIFICARE': 'orange'
    };
    return <Badge color={colors[tip] || 'gray'} size="sm">{tip}</Badge>;
  };
  
  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>Buget Aprobat</Title>
        <Button
          leftSection={<IconDownload size={16} />}
          variant="outline"
          onClick={handleExport}
        >
          Export Excel
        </Button>
      </Group>
      
      <Paper shadow="xs" p="md" mb="md">
        <Group>
          <TextInput
            placeholder="Căutare după cod sau denumire..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="An bugetar"
            data={yearOptions}
            value={anBugetar}
            onChange={setAnBugetar}
            clearable
            disabled={yearsLoading}
            style={{ minWidth: 160 }}
          />
          <Text size="sm" c="dimmed">
            Total: {total} înregistrări
          </Text>
        </Group>
      </Paper>
      
      <Paper shadow="xs" p="md" pos="relative">
        <LoadingOverlay visible={loading} />
        
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Cod Clasificare</Table.Th>
              <Table.Th>Denumire</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Sumă Inițială</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Sumă Curentă</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Trimestre</Table.Th>
              <Table.Th>Tip</Table.Th>
              <Table.Th>Nr. Doc</Table.Th>
              <Table.Th>Data Doc</Table.Th>
              <Table.Th>Acțiuni</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item._id}>
                <Table.Td>
                  <Text size="sm" fw={500}>{item.cod_clasificare}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1}>{item.denumire}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm">{formatNumber(item.suma_initiala)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm" fw={500}>{formatNumber(item.suma_curenta)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Stack gap={2}>
                    <Text size="xs">T1: {formatNumber(item.trimestre.t1)}</Text>
                    <Text size="xs">T2: {formatNumber(item.trimestre.t2)}</Text>
                    <Text size="xs">T3: {formatNumber(item.trimestre.t3)}</Text>
                    <Text size="xs">T4: {formatNumber(item.trimestre.t4)}</Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  {getTipOperatieBadge(item.tip_operatie)}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{item.numar_document || '-'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {item.data_document ? new Date(item.data_document).toLocaleDateString('ro-RO') : '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label="Modificare">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => openEditModal(item)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Suplimentare / Diminuare">
                      <ActionIcon
                        variant="subtle"
                        color="green"
                        onClick={() => openAjustareModal(item)}
                      >
                        <IconPlus size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !loading && (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text ta="center" c="dimmed" py="xl">
                    Nu există înregistrări
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
      
      {/* Modal Modificare */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={<Text fw={600}>Modificare Buget</Text>}
        size="lg"
      >
        <form onSubmit={editForm.onSubmit(handleSaveEdit)}>
          <Stack>
            {selectedItem && (
              <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                <Text size="sm">
                  <strong>{selectedItem.cod_clasificare}</strong> - {selectedItem.denumire}
                </Text>
              </Alert>
            )}
            
            <NumberInput
              label="Sumă Totală"
              placeholder="0.00"
              decimalScale={2}
              thousandSeparator=" "
              {...editForm.getInputProps('suma_totala')}
            />
            
            <Grid>
              <Grid.Col span={6}>
                <NumberInput
                  label="Trimestrul 1"
                  placeholder="0.00"
                  decimalScale={2}
                  thousandSeparator=" "
                  {...editForm.getInputProps('trimestru_1')}
                  onChange={(val) => {
                    editForm.setFieldValue('trimestru_1', val as number);
                    setTimeout(() => calculeazaSumaTotala(editForm), 0);
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Trimestrul 2"
                  placeholder="0.00"
                  decimalScale={2}
                  thousandSeparator=" "
                  {...editForm.getInputProps('trimestru_2')}
                  onChange={(val) => {
                    editForm.setFieldValue('trimestru_2', val as number);
                    setTimeout(() => calculeazaSumaTotala(editForm), 0);
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Trimestrul 3"
                  placeholder="0.00"
                  decimalScale={2}
                  thousandSeparator=" "
                  {...editForm.getInputProps('trimestru_3')}
                  onChange={(val) => {
                    editForm.setFieldValue('trimestru_3', val as number);
                    setTimeout(() => calculeazaSumaTotala(editForm), 0);
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Trimestrul 4"
                  placeholder="0.00"
                  decimalScale={2}
                  thousandSeparator=" "
                  {...editForm.getInputProps('trimestru_4')}
                  onChange={(val) => {
                    editForm.setFieldValue('trimestru_4', val as number);
                    setTimeout(() => calculeazaSumaTotala(editForm), 0);
                  }}
                />
              </Grid.Col>
            </Grid>
            
            <TextInput
              label="Nr. Document"
              placeholder="Numărul documentului"
              required
              {...editForm.getInputProps('numar_document')}
            />
            
            <DateInput
              label="Data Document"
              placeholder="Selectează data"
              required
              valueFormat="DD.MM.YYYY"
              {...editForm.getInputProps('data_document')}
            />
            
            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                Anulează
              </Button>
              <Button type="submit" loading={saving}>
                Salvează
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      
      {/* Modal Suplimentare/Diminuare */}
      <Modal
        opened={ajustareModalOpen}
        onClose={() => setAjustareModalOpen(false)}
        title={<Text fw={600}>Suplimentare / Diminuare Buget</Text>}
        size="lg"
      >
        <form onSubmit={ajustareForm.onSubmit(handleSaveAjustare)}>
          <Stack>
            {selectedItem && (
              <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                <Stack gap="xs">
                  <Group gap="md">
                    <Text size="sm">
                      <strong>Cod:</strong> {selectedItem.cod_clasificare}
                    </Text>
                    <Text size="sm">
                      <strong>Sumă curentă:</strong> {formatNumber(selectedItem.suma_curenta)}
                    </Text>
                  </Group>
                  <Text size="sm">
                    <strong>Denumire:</strong> {selectedItem.denumire}
                  </Text>
                </Stack>
              </Alert>
            )}
            
            <Group>
              <Text size="sm" fw={500}>Tip ajustare:</Text>
              <Switch
                checked={ajustareForm.values.tip_ajustare === 'DIMINUARE'}
                onChange={(e) => ajustareForm.setFieldValue(
                  'tip_ajustare',
                  e.currentTarget.checked ? 'DIMINUARE' : 'SUPLIMENTARE'
                )}
                label={ajustareForm.values.tip_ajustare === 'SUPLIMENTARE' ? 'Suplimentare' : 'Diminuare'}
                color={ajustareForm.values.tip_ajustare === 'SUPLIMENTARE' ? 'green' : 'red'}
                thumbIcon={
                  ajustareForm.values.tip_ajustare === 'SUPLIMENTARE'
                    ? <IconPlus size={12} />
                    : <IconMinus size={12} />
                }
              />
            </Group>
            
            {/* Informații clasificare bugetară - Read-only */}
            <Paper p="md" withBorder bg="gray.0">
              <Stack gap="xs">
                <Text size="sm" fw={600} c="dimmed">Clasificare Bugetară</Text>
                <Grid>
                  <Grid.Col span={6}>
                    <Text size="sm">
                      <strong>Capitol:</strong> {selectedItem?.cod_clasificare.substring(0, 4) || '-'}
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm">
                      <strong>Subcapitol:</strong> {selectedItem?.cod_clasificare.substring(4, 8) || '-'}
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm">
                      <strong>Articol:</strong> {selectedItem?.cod_clasificare.substring(8, 10) || '-'}
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm">
                      <strong>Alineat:</strong> {selectedItem?.cod_clasificare.substring(10) || '-'}
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Text size="sm">
                      <strong>Program:</strong> {selectedItem?.cod_program || '-'}
                    </Text>
                  </Grid.Col>
                </Grid>
              </Stack>
            </Paper>
            
            <NumberInput
              label="Sumă Totală"
              placeholder="0.00"
              decimalScale={2}
              thousandSeparator=" "
              {...ajustareForm.getInputProps('suma_totala')}
            />
            
            <Grid>
              <Grid.Col span={6}>
                <NumberInput
                  label="Trimestrul 1"
                  placeholder="0.00"
                  decimalScale={2}
                  thousandSeparator=" "
                  {...ajustareForm.getInputProps('trimestru_1')}
                  onChange={(val) => {
                    ajustareForm.setFieldValue('trimestru_1', val as number);
                    setTimeout(() => calculeazaSumaTotala(ajustareForm), 0);
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Trimestrul 2"
                  placeholder="0.00"
                  decimalScale={2}
                  thousandSeparator=" "
                  {...ajustareForm.getInputProps('trimestru_2')}
                  onChange={(val) => {
                    ajustareForm.setFieldValue('trimestru_2', val as number);
                    setTimeout(() => calculeazaSumaTotala(ajustareForm), 0);
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Trimestrul 3"
                  placeholder="0.00"
                  decimalScale={2}
                  thousandSeparator=" "
                  {...ajustareForm.getInputProps('trimestru_3')}
                  onChange={(val) => {
                    ajustareForm.setFieldValue('trimestru_3', val as number);
                    setTimeout(() => calculeazaSumaTotala(ajustareForm), 0);
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Trimestrul 4"
                  placeholder="0.00"
                  decimalScale={2}
                  thousandSeparator=" "
                  {...ajustareForm.getInputProps('trimestru_4')}
                  onChange={(val) => {
                    ajustareForm.setFieldValue('trimestru_4', val as number);
                    setTimeout(() => calculeazaSumaTotala(ajustareForm), 0);
                  }}
                />
              </Grid.Col>
            </Grid>
            
            <TextInput
              label="Nr. Document"
              placeholder="Numărul documentului"
              required
              {...ajustareForm.getInputProps('numar_document')}
            />
            
            <DateInput
              label="Data Document"
              placeholder="Selectează data"
              required
              valueFormat="DD.MM.YYYY"
              {...ajustareForm.getInputProps('data_document')}
            />
            
            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={() => setAjustareModalOpen(false)}>
                Anulează
              </Button>
              <Button
                type="submit"
                loading={saving}
                color={ajustareForm.values.tip_ajustare === 'SUPLIMENTARE' ? 'green' : 'red'}
                leftSection={
                  ajustareForm.values.tip_ajustare === 'SUPLIMENTARE'
                    ? <IconPlus size={16} />
                    : <IconMinus size={16} />
                }
              >
                {ajustareForm.values.tip_ajustare === 'SUPLIMENTARE' ? 'Suplimentează' : 'Diminuează'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}

export default BugetAprobatPage;


