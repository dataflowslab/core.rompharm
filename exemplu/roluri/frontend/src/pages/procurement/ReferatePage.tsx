import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Group,
  Table,
  Badge,
  ActionIcon,
  TextInput,
  Paper,
  Modal,
  Text,
  Loader,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconEye,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { ReferatForm } from './ReferatForm';

interface Referat {
  id: string;
  nr: number;
  data_intocmirii: string;
  departament: string;
  titlu: string;
  initiator: string;
  stare: string;
  created_at: string;
}

export function ReferatePage() {
  const navigate = useNavigate();
  const [referate, setReferate] = useState<Referat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [selectedReferat, setSelectedReferat] = useState<Referat | null>(null);

  useEffect(() => {
    loadReferate();
  }, []);

  const loadReferate = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/procurement/referate');
      setReferate(response.data);
    } catch (error: any) {
      console.error('Failed to load referate:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca referatele',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    try {
      const response = await api.post('/api/procurement/referate', data);
      notifications.show({
        title: 'Succes',
        message: 'Referatul a fost creat cu succes',
        color: 'green',
      });
      setCreateModalOpened(false);
      loadReferate();
      navigate(`/procurement/referate/${response.data.id}`);
    } catch (error: any) {
      console.error('Failed to create referat:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut crea referatul',
        color: 'red',
      });
    }
  };

  const handleDelete = (referat: Referat) => {
    if (referat.stare !== 'În lucru') {
      notifications.show({
        title: 'Atenție',
        message: 'Referatul nu poate fi șters în această stare',
        color: 'orange',
      });
      return;
    }
    setSelectedReferat(referat);
    setDeleteModalOpened(true);
  };

  const confirmDelete = async () => {
    if (!selectedReferat) return;

    try {
      await api.delete(`/api/procurement/referate/${selectedReferat.id}`);
      notifications.show({
        title: 'Succes',
        message: 'Referatul a fost șters',
        color: 'green',
      });
      setDeleteModalOpened(false);
      setSelectedReferat(null);
      loadReferate();
    } catch (error: any) {
      console.error('Failed to delete referat:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut șterge referatul',
        color: 'red',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string }> = {
      'În lucru': { color: 'blue' },
      'Trimis spre aprobare': { color: 'cyan' },
      'Aprobat': { color: 'green' },
      'Respins': { color: 'red' },
      'Anulat': { color: 'gray' },
    };

    const config = statusConfig[status] || { color: 'gray' };

    return (
      <Badge color={config.color} variant="filled">
        {status}
      </Badge>
    );
  };

  const formatDateOnly = (dateString?: string) => {
    if (!dateString) {
      return '-';
    }
    return new Date(dateString).toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const filteredReferate = referate.filter((ref) =>
    ref.titlu.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ref.departament.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ref.initiator.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ref.nr.toString().includes(searchQuery)
  );

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
        <Title order={2}>Referate</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpened(true)}
        >
          Referat nou
        </Button>
      </Group>

      <Paper withBorder p="md" mb="md">
        <TextInput
          placeholder="Caută după număr, titlu, departament sau inițiator..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </Paper>

      <Paper withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nr.</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th>Departament</Table.Th>
              <Table.Th>Titlu</Table.Th>
              <Table.Th>Inițiator</Table.Th>
              <Table.Th>Stare</Table.Th>
              <Table.Th>Unelte</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredReferate.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                  <Text c="dimmed">Nu există referate</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredReferate.map((referat) => (
                <Table.Tr key={referat.id}>
                  <Table.Td>{referat.nr}</Table.Td>
                  <Table.Td>{formatDateOnly(referat.data_intocmirii)}</Table.Td>
                  <Table.Td>{referat.departament}</Table.Td>
                  <Table.Td>{referat.titlu}</Table.Td>
                  <Table.Td>{referat.initiator}</Table.Td>
                  <Table.Td>{getStatusBadge(referat.stare)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => navigate(`/procurement/referate/${referat.id}`)}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      {referat.stare === 'În lucru' && (
                        <>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => navigate(`/procurement/referate/${referat.id}`)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDelete(referat)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Create Modal */}
      <Modal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        title="Referat nou"
        size="90%"
        styles={{ content: { maxWidth: '90%' } }}
      >
        <ReferatForm
          onSubmit={handleCreate}
          onCancel={() => setCreateModalOpened(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Confirmare ștergere"
        centered
      >
        <Text size="sm" mb="md">
          Ești sigur că vrei să ștergi referatul <strong>{selectedReferat?.titlu}</strong>?
          Această acțiune nu poate fi anulată.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setDeleteModalOpened(false)}>
            Anulează
          </Button>
          <Button color="red" onClick={confirmDelete}>
            Șterge
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
