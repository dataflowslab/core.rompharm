import { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Title,
  Group,
  TextInput,
  Select,
  Paper,
  Table,
  Loader,
  Pagination,
  Text
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';

interface ExecutieItem {
  cod_clasificare: string;
  denumire: string;
  cod_subunitate: string;
  an_bugetar: number;
  buget_aprobat: number;
  angajamente_bugetare: number;
  angajamente_legale: number;
  ordonantari: number;
  disponibil_buget: number;
  disponibil_angajamente: number;
  disponibil_plati: number;
  tip_operatie?: string;
}

export function ExecutieBugetaraReportPage() {
  const [items, setItems] = useState<ExecutieItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState<string | null>(null);
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const limit = 50;
  const currentYear = new Date().getFullYear();

  const yearOptions = useMemo(() => {
    return [currentYear, currentYear - 1, currentYear - 2].map((value) => ({
      value: String(value),
      label: String(value)
    }));
  }, [currentYear]);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/rapoarte/executie-bugetara', {
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
          an_bugetar: year ? Number(year) : undefined
        }
      });

      setItems(response.data.items || []);
      setTotalPages(response.data.pages || 1);
    } catch (error: any) {
      console.error('Failed to load executie bugetara report:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut încărca raportul de execuție bugetară',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, debouncedSearch, year]);

  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Execuție Bugetară (Raport)</Title>
      </Group>

      <Paper withBorder p="md" mb="md">
        <Group gap="md" align="flex-end">
          <TextInput
            label="Căutare"
            placeholder="Cod clasificare / denumire"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
          />
          <Select
            label="An bugetar"
            placeholder="Toți anii"
            data={yearOptions}
            value={year}
            onChange={(value) => {
              setYear(value);
              setPage(1);
            }}
            clearable
          />
        </Group>
      </Paper>

      <Paper withBorder>
        {loading ? (
          <Group justify="center" p="xl">
            <Loader size="lg" />
          </Group>
        ) : items.length === 0 ? (
          <Group justify="center" p="xl">
            <Text c="dimmed">Nu există date disponibile.</Text>
          </Group>
        ) : (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Cod</Table.Th>
                  <Table.Th>Denumire</Table.Th>
                  <Table.Th>Subunitate</Table.Th>
                  <Table.Th>Buget aprobat</Table.Th>
                  <Table.Th>Angaj. bugetare</Table.Th>
                  <Table.Th>Angaj. legale</Table.Th>
                  <Table.Th>Ordonanțări</Table.Th>
                  <Table.Th>Disponibil buget</Table.Th>
                  <Table.Th>Disponibil angaj.</Table.Th>
                  <Table.Th>Disponibil plăți</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item) => (
                  <Table.Tr key={`${item.cod_clasificare}-${item.cod_subunitate}-${item.an_bugetar}`}>
                    <Table.Td>{item.cod_clasificare}</Table.Td>
                    <Table.Td>{item.denumire}</Table.Td>
                    <Table.Td>{item.cod_subunitate}</Table.Td>
                    <Table.Td>{formatNumber(item.buget_aprobat)}</Table.Td>
                    <Table.Td>{formatNumber(item.angajamente_bugetare)}</Table.Td>
                    <Table.Td>{formatNumber(item.angajamente_legale)}</Table.Td>
                    <Table.Td>{formatNumber(item.ordonantari)}</Table.Td>
                    <Table.Td>{formatNumber(item.disponibil_buget)}</Table.Td>
                    <Table.Td>{formatNumber(item.disponibil_angajamente)}</Table.Td>
                    <Table.Td>{formatNumber(item.disponibil_plati)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="center" p="md">
              <Pagination total={totalPages} value={page} onChange={setPage} />
            </Group>
          </>
        )}
      </Paper>
    </Container>
  );
}
