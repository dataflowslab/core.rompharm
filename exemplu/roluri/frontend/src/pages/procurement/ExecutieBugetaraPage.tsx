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
  Loader,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconEye,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';

interface DocuPlata {
  id: string;
  contract: string;
  facturi: string;
  confirmat: boolean;
  note_receptie: string;
  avizat: boolean;
  created_at: string;
}

export function ExecutieBugetaraPage() {
  const navigate = useNavigate();
  const [documente, setDocumente] = useState<DocuPlata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDocumente();
  }, []);

  const loadDocumente = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/procurement/docuplata');
      setDocumente(response.data);
    } catch (error: any) {
      console.error('Failed to load documente:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca documentele',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredDocumente = documente.filter((doc) =>
    doc.contract.toLowerCase().includes(searchQuery.toLowerCase())
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
        <Title order={2}>Execuție Bugetară</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/procurement/executie-bugetara/new')}
        >
          Înregistrare nouă
        </Button>
      </Group>

      <Paper withBorder p="md" mb="md">
        <TextInput
          placeholder="Caută după contract..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </Paper>

      <Paper withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Contract</Table.Th>
              <Table.Th>Factură</Table.Th>
              <Table.Th>Confirmat</Table.Th>
              <Table.Th>Note de recepție</Table.Th>
              <Table.Th>Avizat</Table.Th>
              <Table.Th>Acțiuni</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredDocumente.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                  Nu există documente
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredDocumente.map((doc) => (
                <Table.Tr key={doc.id}>
                  <Table.Td>{doc.contract}</Table.Td>
                  <Table.Td>{doc.facturi}</Table.Td>
                  <Table.Td>
                    {doc.confirmat ? (
                      <Badge color="green" variant="filled">
                        <IconCheck size={14} />
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="filled">
                        <IconX size={14} />
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{doc.note_receptie}</Table.Td>
                  <Table.Td>
                    {doc.avizat ? (
                      <Badge color="green" variant="filled">
                        <IconCheck size={14} />
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="filled">
                        <IconX size={14} />
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => navigate(`/procurement/executie-bugetara/${doc.id}`)}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Container>
  );
}
