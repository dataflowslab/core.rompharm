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

interface DocTehnic {
  id: string;
  nr: number;
  data: string;
  compartiment: string;
  responsabil: string;
  titlu: string;
  stare: string;
  created_at: string;
}

export function DocTehnicePage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocTehnic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocTehnic | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/procurement/achizitii');
      setDocuments(response.data);
    } catch (error: any) {
      console.error('Failed to load documents:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca documentele tehnice',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (doc: DocTehnic) => {
    if (doc.stare !== 'În lucru') {
      notifications.show({
        title: 'Atenție',
        message: 'Documentul nu poate fi șters în această stare',
        color: 'orange',
      });
      return;
    }
    setSelectedDoc(doc);
    setDeleteModalOpened(true);
  };

  const confirmDelete = async () => {
    if (!selectedDoc) return;

    try {
      await api.delete(`/api/procurement/achizitii/${selectedDoc.id}`);
      notifications.show({
        title: 'Succes',
        message: 'Documentul a fost șters',
        color: 'green',
      });
      setDeleteModalOpened(false);
      setSelectedDoc(null);
      loadDocuments();
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut șterge documentul',
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

  const filteredDocuments = documents.filter((doc) =>
    doc.titlu.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.compartiment.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.responsabil.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.nr.toString().includes(searchQuery)
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
        <Title order={2}>Achizitii</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/procurement/achizitii/new')}
        >
          Achizitie noua
        </Button>
      </Group>

      <Paper withBorder p="md" mb="md">
        <TextInput
          placeholder="Caută după număr, titlu, compartiment sau responsabil..."
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
              <Table.Th>Compartiment</Table.Th>
              <Table.Th>Responsabil</Table.Th>
              <Table.Th>Titlu</Table.Th>
              <Table.Th>Stare</Table.Th>
              <Table.Th>Opțiuni</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredDocuments.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                  <Text c="dimmed">Nu există Achizitii</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredDocuments.map((doc) => (
                <Table.Tr key={doc.id}>
                  <Table.Td>{doc.nr}</Table.Td>
                  <Table.Td>{new Date(doc.data).toLocaleDateString('ro-RO')}</Table.Td>
                  <Table.Td>{doc.compartiment}</Table.Td>
                  <Table.Td>{doc.responsabil}</Table.Td>
                  <Table.Td>{doc.titlu}</Table.Td>
                  <Table.Td>{getStatusBadge(doc.stare)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => navigate(`/procurement/achizitii/${doc.id}`)}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      {doc.stare === 'În lucru' && (
                        <>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => navigate(`/procurement/achizitii/${doc.id}/edit`)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDelete(doc)}
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

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Confirmare ștergere"
        centered
      >
        <Text size="sm" mb="md">
          Ești sigur că vrei să ștergi achizi?ia <strong>{selectedDoc?.titlu}</strong>?
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




