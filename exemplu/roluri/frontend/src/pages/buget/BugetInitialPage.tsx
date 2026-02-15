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
  Alert,
  Stack,
  Select,
  FileInput
} from '@mantine/core';
import { IconSearch, IconDownload, IconAlertCircle, IconUpload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDebouncedValue } from '@mantine/hooks';
import { api } from '../../services/api';
import { useProcurementYears } from '../../hooks/useProcurementYears';

interface BugetInitialItem {
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
  cod_subunitate: string;
  cod_program: string;
  an_bugetar: number;
}

export function BugetInitialPage() {
  const { years } = useProcurementYears();
  const [items, setItems] = useState<BugetInitialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const [anBugetar, setAnBugetar] = useState<string | null>(null);
  const [existsForYear, setExistsForYear] = useState(false);
  const [checkingYear, setCheckingYear] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const yearOptions = useMemo(() => {
    const options = years.map((year) => ({ value: year.value, label: year.label }));
    if (anBugetar && !options.some((option) => option.value === anBugetar)) {
      options.unshift({ value: anBugetar, label: anBugetar });
    }
    return options;
  }, [years, anBugetar]);

  useEffect(() => {
    if (!anBugetar && years.length > 0) {
      const latest = years.reduce((max, year) => (year.year > max ? year.year : max), years[0].year);
      setAnBugetar(latest.toString());
    }
  }, [years, anBugetar]);

  const loadData = useCallback(async () => {
    if (!anBugetar) {
      return;
    }
    setLoading(true);
    try {
      const response = await api.get('/api/buget/initial', {
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
      console.error('Error loading buget initial:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca datele',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, anBugetar]);

  const checkExists = useCallback(async () => {
    if (!anBugetar) {
      return;
    }
    setCheckingYear(true);
    try {
      const response = await api.get('/api/buget/initial/exists', {
        params: { an_bugetar: parseInt(anBugetar, 10) }
      });
      setExistsForYear(Boolean(response.data?.exists));
    } catch (error) {
      console.error('Error checking buget initial:', error);
      setExistsForYear(false);
    } finally {
      setCheckingYear(false);
    }
  }, [anBugetar]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    checkExists();
  }, [checkExists]);

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [debouncedSearch, anBugetar]);

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/api/buget/initial/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `buget_initial_template_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut descărca modelul',
        color: 'red'
      });
    }
  };

  const handleUpload = async () => {
    if (!file || !anBugetar) {
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/api/buget/initial/upload', formData, {
        params: { an_bugetar: parseInt(anBugetar, 10) },
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      notifications.show({
        title: 'Succes',
        message: `Încărcat ${response.data?.count || 0} poziții`,
        color: 'green'
      });
      setFile(null);
      checkExists();
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut încărca fișierul',
        color: 'red'
      });
    } finally {
      setUploading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num || 0);
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>Buget Inițial</Title>
        <Group>
          <Button variant="outline" leftSection={<IconDownload size={16} />} onClick={handleDownloadTemplate}>
            Descarcă model
          </Button>
        </Group>
      </Group>

      <Paper shadow="xs" p="md" mb="md">
        <Stack gap="md">
          <Group align="end">
            <Select
              label="An bugetar"
              placeholder="Selectează anul"
              data={yearOptions}
              value={anBugetar}
              onChange={setAnBugetar}
              disabled={checkingYear}
              style={{ minWidth: 200 }}
            />
            <FileInput
              label="Fișier buget inițial"
              placeholder="Selectează fișier .xlsx"
              accept=".xlsx"
              value={file}
              onChange={setFile}
              disabled={existsForYear}
            />
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={handleUpload}
              disabled={!file || existsForYear}
              loading={uploading}
            >
              Încarcă
            </Button>
          </Group>

          {existsForYear && (
            <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
              Bugetul ini?ial pentru anul selectat este deja încarcat. Încarcărea este permisa o singura data pe an.
            </Alert>
          )}
        </Stack>
      </Paper>

      <Paper shadow="xs" p="md" pos="relative">
        <LoadingOverlay visible={loading} />

        <Group mb="md">
          <TextInput
            placeholder="Căutare după cod sau denumire..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Text size="sm" c="dimmed">
            Total: {total} înregistrări
          </Text>
        </Group>

        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Cod Clasificare</Table.Th>
              <Table.Th>Denumire</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Suma inițială</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>T1</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>T2</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>T3</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>T4</Table.Th>
              <Table.Th>Subunitate</Table.Th>
              <Table.Th>Program</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item._id}>
                <Table.Td><Text size="sm" fw={500}>{item.cod_clasificare}</Text></Table.Td>
                <Table.Td><Text size="sm" lineClamp={1}>{item.denumire}</Text></Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatNumber(item.suma_initiala)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatNumber(item.trimestre.t1)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatNumber(item.trimestre.t2)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatNumber(item.trimestre.t3)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatNumber(item.trimestre.t4)}</Table.Td>
                <Table.Td>{item.cod_subunitate || '-'}</Table.Td>
                <Table.Td>{item.cod_program || '-'}</Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !loading && (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text ta="center" c="dimmed" py="xl">Nu există înregistrări</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={totalPages} />
          </Group>
        )}
      </Paper>
    </Container>
  );
}

export default BugetInitialPage;
