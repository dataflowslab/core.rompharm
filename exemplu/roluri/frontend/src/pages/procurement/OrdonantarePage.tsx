/**
 * OrdonantarePage - List of ordonanțare documents
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Table,
  Group,
  Badge,
  ActionIcon,
  Text,
  Paper,
  LoadingOverlay,
  Modal,
  ScrollArea,
} from '@mantine/core';
import { IconPlus, IconEye, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../services/api';
import { OrdonantareForm } from './OrdonantareForm';

interface Ordonantare {
  id?: string;
  _id?: string;
  nr_ordonant_pl: string;
  data_ordont_pl: string;
  fundamentare_nr_inreg: string;
  beneficiar: string;
  stare: string;
  created_at: string;
  created_by: string;
}

export function OrdonantarePage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Ordonantare[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/procurement/ordonantare');
      setDocuments(response.data.documents || []);
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-au putut încărca documentele',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sigur doriți să ștergeți acest document?')) return;

    try {
      await api.delete(`/api/procurement/ordonantare/${id}`);
      notifications.show({
        title: 'Succes',
        message: 'Document șters',
        color: 'green',
      });
      loadDocuments();
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut șterge documentul',
        color: 'red',
      });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Nouă': 'blue',
      'Compilare': 'yellow',
      'Finalizat': 'green',
      'Eroare': 'red',
      'Anulat': 'gray',
    };
    return colors[status] || 'gray';
  };

  return (
    <Container size="xl" py="xl">
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="lg">
          <Title order={2}>Ordonanțări de Plată</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpened(true)}
          >
            Document Nou
          </Button>
        </Group>

        <LoadingOverlay visible={loading} />

        {documents.length === 0 && !loading ? (
          <Text c="dimmed" ta="center" py="xl">
            Nu există documente. Creați primul document.
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nr. Ordonanță</Table.Th>
                <Table.Th>Data</Table.Th>
                <Table.Th>Fundamentare</Table.Th>
                <Table.Th>Beneficiar</Table.Th>
                <Table.Th>Stare</Table.Th>
                <Table.Th>Creat de</Table.Th>
                <Table.Th>Acțiuni</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {documents.map((doc) => {
                const docId = doc.id || doc._id || '';
                return (
                <Table.Tr key={docId || doc.nr_ordonant_pl}>
                  <Table.Td>{doc.nr_ordonant_pl}</Table.Td>
                  <Table.Td>
                    {new Date(doc.data_ordont_pl).toLocaleDateString('ro-RO')}
                  </Table.Td>
                  <Table.Td>{doc.fundamentare_nr_inreg}</Table.Td>
                  <Table.Td>{doc.beneficiar}</Table.Td>
                  <Table.Td>
                    <Badge color={getStatusColor(doc.stare)}>{doc.stare}</Badge>
                  </Table.Td>
                  <Table.Td>{doc.created_by}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => navigate(`/procurement/ordonantare/${docId}`)}
                        disabled={!docId}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => handleDelete(docId)}
                        disabled={!docId}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              )})}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Create Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Ordonanțare Nouă"
        size="xl"
      >
        <OrdonantareForm
          onSuccess={(docId) => {
            setModalOpened(false);
            loadDocuments();
            navigate(`/procurement/ordonantare/${docId}`);
          }}
          onCancel={() => setModalOpened(false)}
        />
      </Modal>
    </Container>
  );
}
