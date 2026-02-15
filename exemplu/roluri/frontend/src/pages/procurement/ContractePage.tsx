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
  ScrollArea,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconEye,
  IconTrash,
} from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { ContractForm } from './ContractForm';

interface Contract {
  _id: string;
  furnizor: string;
  furnizor_id: string;
  tip_document: string;
  tip_document_content: string;
  nr_document: string;
  data_document: string;
  stare: string;
  stare_color: string;
  created_at: string;
  documente_count: number;
}

export function ContractePage() {
  const navigate = useNavigate();
  const [contracte, setContracte] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [createModalOpened, setCreateModalOpened] = useState(false);

  useEffect(() => {
    loadContracte();
  }, []);

  const loadContracte = async () => {
    try {
      setLoading(true);
      // Load only contracts (type = contract)
      const response = await api.get('/api/procurement/contracte/list', {
        params: { tip: 'contract' }
      });
      setContracte(response.data);
    } catch (error: any) {
      console.error('Failed to load contracte:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca contractele',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (contract: Contract) => {
    setSelectedContract(contract);
    setDeleteModalOpened(true);
  };

  const confirmDelete = async () => {
    if (!selectedContract) return;

    try {
      await api.delete(`/api/procurement/contracte/${selectedContract._id}`);
      notifications.show({
        title: 'Succes',
        message: 'Contractul a fost șters',
        color: 'green',
      });
      setDeleteModalOpened(false);
      setSelectedContract(null);
      loadContracte();
    } catch (error: any) {
      console.error('Failed to delete contract:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut șterge contractul',
        color: 'red',
      });
    }
  };

  const filteredContracte = contracte.filter((contract) =>
    contract.nr_document.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contract.furnizor.toLowerCase().includes(searchQuery.toLowerCase())
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
        <Title order={2}>Contracte</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpened(true)}
        >
          Contract nou
        </Button>
      </Group>

      <Paper withBorder p="md" mb="md">
        <TextInput
          placeholder="Caută după număr document sau furnizor..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </Paper>

      <Paper withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Furnizor</Table.Th>
              <Table.Th>Nr. și data</Table.Th>
              <Table.Th>Data adăugării</Table.Th>
              <Table.Th>Stare</Table.Th>
              <Table.Th>Acțiuni</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredContracte.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                  <Text c="dimmed">Nu există contracte</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredContracte.map((contract) => (
                <Table.Tr key={contract._id}>
                  <Table.Td>{contract.furnizor}</Table.Td>
                  <Table.Td>
                    {contract.nr_document}
                    {contract.data_document && (
                      <Text size="xs" c="dimmed">
                        {new Date(contract.data_document).toLocaleDateString('ro-RO')}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {contract.created_at ? new Date(contract.created_at).toLocaleDateString('ro-RO') : '-'}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={contract.stare_color} variant="filled">
                      {contract.stare}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => navigate(`/procurement/contracte/${contract._id}`)}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(contract)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Create Contract Modal */}
      <Modal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        title="Contract nou"
        size="xl"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <ContractForm
          onSuccess={(contractId) => {
            setCreateModalOpened(false);
            loadContracte();
            navigate(`/procurement/contracte/${contractId}`);
          }}
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
          Ești sigur că vrei să ștergi contractul <strong>{selectedContract?.nr_document}</strong>?
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
