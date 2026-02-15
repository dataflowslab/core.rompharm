import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Group,
  Table,
  ActionIcon,
  TextInput,
  Paper,
  Modal,
  Text,
  Loader,
  Badge,
} from '@mantine/core';
import { IconPlus, IconSearch, IconEye, IconTrash } from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';

interface PaapListItem {
  id: string;
  nr?: number;
  titlu: string;
  created_at?: string;
  created_by?: string;
  file_count?: number;
  shared_with_names?: string[];
  is_owner?: boolean;
  an?: number;
  rev?: number;
  stare?: string;
  stare_id?: string;
  is_latest_for_year?: boolean;
  is_latest_approved_for_year?: boolean;
  has_approved_for_year?: boolean;
}

export function PaapPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PaapListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PaapListItem | null>(null);

  useEffect(() => {
    loadPaap();
  }, []);

  const loadPaap = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/procurement/paap');
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      console.error('Failed to load PAAP:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut incarca documentele PAAP',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (item: PaapListItem) => {
    setSelectedItem(item);
    setDeleteModalOpened(true);
  };

  const confirmDelete = async () => {
    if (!selectedItem) return;

    try {
      await api.delete(`/api/procurement/paap/${selectedItem.id}`);
      notifications.show({
        title: 'Succes',
        message: 'Documentul PAAP a fost sters',
        color: 'green',
      });
      setDeleteModalOpened(false);
      setSelectedItem(null);
      loadPaap();
    } catch (error: any) {
      console.error('Failed to delete PAAP:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut sterge documentul PAAP',
        color: 'red',
      });
    }
  };

  const filteredItems = items.filter((item) =>
    item.titlu.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.created_by || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.nr ? item.nr.toString().includes(searchQuery) : false)
  );

  const sortedItems = [...filteredItems].sort((a, b) => {
    const yearA = a.an ?? 0;
    const yearB = b.an ?? 0;
    if (yearA !== yearB) {
      return yearB - yearA;
    }
    const revA = a.rev ?? 0;
    const revB = b.rev ?? 0;
    if (revA !== revB) {
      return revB - revA;
    }
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  const getStatusBadge = (status?: string) => {
    const normalized = (status || '').toLowerCase();
    let color = 'gray';
    if (normalized.includes('aprobat') || normalized.includes('semnat')) {
      color = 'green';
    } else if (normalized.includes('asteptare')) {
      color = 'yellow';
    } else if (normalized.includes('anulat')) {
      color = 'gray';
    }

    return (
      <Badge color={color} variant="filled" size="sm">
        {status || '-'}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Container size="xl">
        <Group justify="center" p="xl">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>PAAP</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/procurement/paap/new')}
        >
          PAAP nou
        </Button>
      </Group>

      <Paper withBorder p="md" mb="md">
        <TextInput
          placeholder="Cauta dupa titlu, numar sau creator..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
        />
      </Paper>

      <Paper withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nr</Table.Th>
              <Table.Th>An</Table.Th>
              <Table.Th>Rev</Table.Th>
              <Table.Th>Titlu</Table.Th>
              <Table.Th>Creat de</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th>Stare</Table.Th>
              <Table.Th>Fisiere</Table.Th>
              <Table.Th>Share</Table.Th>
              <Table.Th>Optiuni</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedItems.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={10} style={{ textAlign: 'center' }}>
                  <Text c="dimmed">Nu exista documente PAAP</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              sortedItems.map((item) => {
                const isStale = item.has_approved_for_year && !item.is_latest_approved_for_year;
                const isValid = item.is_latest_approved_for_year;
                const canDelete = item.is_owner && item.is_latest_for_year && (item.stare || '').toLowerCase().includes('asteptare');
                return (
                <Table.Tr
                  key={item.id}
                  style={{
                    color: isStale ? '#868e96' : undefined,
                    fontWeight: isValid ? 600 : undefined,
                    backgroundColor: isStale ? '#f8f9fa' : undefined,
                  }}
                >
                  <Table.Td>{item.nr || '-'}</Table.Td>
                  <Table.Td>{item.an || '-'}</Table.Td>
                  <Table.Td>{item.rev || '-'}</Table.Td>
                  <Table.Td>{item.titlu}</Table.Td>
                  <Table.Td>{item.created_by || '-'}</Table.Td>
                  <Table.Td>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString('ro-RO') : '-'}
                  </Table.Td>
                  <Table.Td>{getStatusBadge(item.stare)}</Table.Td>
                  <Table.Td>{item.file_count ?? 0}</Table.Td>
                  <Table.Td>{(item.shared_with_names || []).join(', ') || '-'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => navigate(`/procurement/paap/${item.id}`)}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      {canDelete && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDelete(item)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              )})
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Confirmare stergere"
        centered
      >
        <Text size="sm" mb="md">
          Esti sigur ca vrei sa stergi documentul <strong>{selectedItem?.titlu}</strong>?
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setDeleteModalOpened(false)}>
            Anuleaza
          </Button>
          <Button color="red" onClick={confirmDelete}>
            Sterge
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
