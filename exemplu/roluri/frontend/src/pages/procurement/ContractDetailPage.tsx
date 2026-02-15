import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Group,
  Paper,
  Stack,
  Grid,
  Text,
  Badge,
  Tabs,
  Table,
  ActionIcon,
  Modal,
  TextInput,
  NumberInput,
  Divider,
  Loader,
  Box,
  Anchor,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconTrash,
  IconPlus,
  IconFileText,
} from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { WorkflowSidebarGeneric } from './components/WorkflowSidebarGeneric';

interface Contract {
  _id: string;
  furnizor_info?: {
    _id: string;
    denumire: string;
    cif: string;
  };
  tip_document_info?: {
    _id: string;
    name: string;
    content: string;
  };
  contract_parinte_info?: {
    _id: string;
    nr_document: string;
    data_document: string;
  };
  stare_info?: {
    _id: string;
    name: string;
    color: string;
  };
  nr_document: string;
  data_document: string;
  conditii_livrare?: string;
  conditii_plata?: string;
  observatii?: string;
  documente: Array<{
    file_id: string;
    filename: string;
    uploaded_at: string;
  }>;
  servicii_produse: Array<{
    _id: string;
    denumire: string;
    um: string;
    cantitate: number;
    cost_unitar: number;
    valoare_totala: number;
  }>;
  related_documents: Array<{
    _id: string;
    tip_document: string;
    nr_document: string;
    data_document: string;
  }>;
  same_furnizor_contracts: Array<{
    _id: string;
    tip_document: string;
    tip_document_content: string;
    nr_document: string;
    data_document: string;
    stare: string;
  }>;
}

interface ServiciuProdus {
  denumire: string;
  um: string;
  cantitate: number;
  cost_unitar: number;
}

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviciuModalOpened, setServiciuModalOpened] = useState(false);
  const [editingServiciuId, setEditingServiciuId] = useState<string | null>(null);
  const [serviciuData, setServiciuData] = useState<ServiciuProdus>({
    denumire: '',
    um: '',
    cantitate: 0,
    cost_unitar: 0,
  });

  useEffect(() => {
    if (id) {
      loadContract();
    }
  }, [id]);

  const loadContract = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/procurement/contracte/${id}`);
      setContract(response.data);
    } catch (error: any) {
      console.error('Failed to load contract:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut încărca contractul',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddServiciuProdus = () => {
    setEditingServiciuId(null);
    setServiciuData({
      denumire: '',
      um: '',
      cantitate: 0,
      cost_unitar: 0,
    });
    setServiciuModalOpened(true);
  };

  const handleEditServiciuProdus = (serviciu: any) => {
    setEditingServiciuId(serviciu._id);
    setServiciuData({
      denumire: serviciu.denumire,
      um: serviciu.um,
      cantitate: serviciu.cantitate,
      cost_unitar: serviciu.cost_unitar,
    });
    setServiciuModalOpened(true);
  };

  const handleSaveServiciuProdus = async () => {
    if (!serviciuData.denumire || !serviciuData.um || serviciuData.cantitate <= 0 || serviciuData.cost_unitar <= 0) {
      notifications.show({
        title: 'Eroare',
        message: 'Completeaz�� toate câmpurile',
        color: 'red',
      });
      return;
    }

    try {
      if (editingServiciuId) {
        // Update
        await api.put(`/api/procurement/contracte/${id}/servicii-produse/${editingServiciuId}`, serviciuData);
        notifications.show({
          title: 'Succes',
          message: 'Serviciu/produs actualizat',
          color: 'green',
        });
      } else {
        // Create
        await api.post(`/api/procurement/contracte/${id}/servicii-produse`, serviciuData);
        notifications.show({
          title: 'Succes',
          message: 'Serviciu/produs adăugat',
          color: 'green',
        });
      }
      setServiciuModalOpened(false);
      loadContract();
    } catch (error: any) {
      console.error('Failed to save serviciu/produs:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut salva',
        color: 'red',
      });
    }
  };

  const handleDeleteServiciuProdus = async (serviciuId: string) => {
    if (!confirm('Sigur vrei să ștergi acest serviciu/produs?')) return;

    try {
      await api.delete(`/api/procurement/contracte/${id}/servicii-produse/${serviciuId}`);
      notifications.show({
        title: 'Succes',
        message: 'Serviciu/produs șters',
        color: 'green',
      });
      loadContract();
    } catch (error: any) {
      console.error('Failed to delete serviciu/produs:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut șterge',
        color: 'red',
      });
    }
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

  if (!contract) {
    return (
      <Container size="xl">
        <Text>Contract not found</Text>
      </Container>
    );
  }

  const totalValoare = contract.servicii_produse.reduce((sum, item) => sum + item.valoare_totala, 0);

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/procurement/contracte')}
          >
            Înapoi
          </Button>
          <Title order={2}>Contract {contract.nr_document}</Title>
        </Group>
      </Group>

      <Grid>
        <Grid.Col span={9}>
          <Stack gap="md">
            {/* Main Info */}
            <Paper withBorder p="md">
              <Title order={4} mb="md">Informații generale</Title>
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Furnizor</Text>
                  <Text fw={500}>{contract.furnizor_info?.denumire || 'N/A'}</Text>
                  <Text size="xs" c="dimmed">CIF: {contract.furnizor_info?.cif || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Tip document</Text>
                  <Text fw={500}>{contract.tip_document_info?.name || 'N/A'}</Text>
                </Grid.Col>
              </Grid>

              {contract.contract_parinte_info && (
                <Box mt="md">
                  <Text size="sm" c="dimmed">Act adițional la contractul</Text>
                  <Anchor onClick={() => navigate(`/procurement/contracte/${contract.contract_parinte_info?._id}`)}>
                    {contract.contract_parinte_info.nr_document} - {new Date(contract.contract_parinte_info.data_document).toLocaleDateString('ro-RO')}
                  </Anchor>
                </Box>
              )}

              <Grid mt="md">
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Nr. document</Text>
                  <Text fw={500}>{contract.nr_document}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Data document</Text>
                  <Text fw={500}>{new Date(contract.data_document).toLocaleDateString('ro-RO')}</Text>
                </Grid.Col>
              </Grid>

              <Box mt="md">
                <Text size="sm" c="dimmed">Stare</Text>
                <Badge color={contract.stare_info?.color || 'gray'} variant="filled">
                  {contract.stare_info?.name || 'N/A'}
                </Badge>
              </Box>

              {contract.conditii_livrare && (
                <Box mt="md">
                  <Text size="sm" c="dimmed">Condiții de livrare</Text>
                  <Text>{contract.conditii_livrare}</Text>
                </Box>
              )}

              {contract.conditii_plata && (
                <Box mt="md">
                  <Text size="sm" c="dimmed">Condiții de plată</Text>
                  <Text>{contract.conditii_plata}</Text>
                </Box>
              )}

              {contract.observatii && (
                <Box mt="md">
                  <Text size="sm" c="dimmed">Observații</Text>
                  <Text>{contract.observatii}</Text>
                </Box>
              )}
            </Paper>

            {/* Tabs */}
            <Paper withBorder p="md">
              <Tabs defaultValue="furnizor">
                <Tabs.List>
                  <Tabs.Tab value="furnizor">Același furnizor</Tabs.Tab>
                  <Tabs.Tab value="servicii">Servicii/Produse</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="furnizor" pt="md">
                  {contract.same_furnizor_contracts.length === 0 ? (
                    <Text c="dimmed" ta="center" py="xl">
                      Nu există alte contracte de la acest furnizor
                    </Text>
                  ) : (
                    <Table striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Tip</Table.Th>
                          <Table.Th>Nr. document</Table.Th>
                          <Table.Th>Data</Table.Th>
                          <Table.Th>Stare</Table.Th>
                          <Table.Th>Acțiuni</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {contract.same_furnizor_contracts.map((c) => (
                          <Table.Tr key={c._id}>
                            <Table.Td>{c.tip_document}</Table.Td>
                            <Table.Td>{c.nr_document}</Table.Td>
                            <Table.Td>{new Date(c.data_document).toLocaleDateString('ro-RO')}</Table.Td>
                            <Table.Td>{c.stare}</Table.Td>
                            <Table.Td>
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => navigate(`/procurement/contracte/${c._id}`)}
                              >
                                <IconFileText size={16} />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="servicii" pt="md">
                  <Group justify="space-between" mb="md">
                    <Title order={5}>Servicii/Produse</Title>
                    <Button
                      size="sm"
                      leftSection={<IconPlus size={16} />}
                      onClick={handleAddServiciuProdus}
                    >
                      Adaugă
                    </Button>
                  </Group>

                  {contract.servicii_produse.length === 0 ? (
                    <Text c="dimmed" ta="center" py="xl">
                      Nu există servicii/produse adăugate
                    </Text>
                  ) : (
                    <>
                      <Table striped>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Denumire</Table.Th>
                            <Table.Th>UM</Table.Th>
                            <Table.Th>Cantitate</Table.Th>
                            <Table.Th>Cost unitar</Table.Th>
                            <Table.Th>Valoare totală</Table.Th>
                            <Table.Th>Acțiuni</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {contract.servicii_produse.map((item) => (
                            <Table.Tr key={item._id}>
                              <Table.Td>{item.denumire}</Table.Td>
                              <Table.Td>{item.um}</Table.Td>
                              <Table.Td>{item.cantitate.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Table.Td>
                              <Table.Td>{item.cost_unitar.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON</Table.Td>
                              <Table.Td>{item.valoare_totala.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON</Table.Td>
                              <Table.Td>
                                <Group gap="xs">
                                  <ActionIcon
                                    variant="subtle"
                                    color="blue"
                                    onClick={() => handleEditServiciuProdus(item)}
                                  >
                                    <IconEdit size={16} />
                                  </ActionIcon>
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    onClick={() => handleDeleteServiciuProdus(item._id)}
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                          <Table.Tr>
                            <Table.Td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                              Total:
                            </Table.Td>
                            <Table.Td style={{ fontWeight: 'bold' }}>
                              {totalValoare.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                            </Table.Td>
                            <Table.Td></Table.Td>
                          </Table.Tr>
                        </Table.Tbody>
                      </Table>
                    </>
                  )}
                </Tabs.Panel>
              </Tabs>
            </Paper>
          </Stack>
        </Grid.Col>
        {/* Sidebar - Related Documents */}
        <Grid.Col span={3}>
          <Stack gap="md" style={{ position: 'sticky', top: 20 }}>
            <WorkflowSidebarGeneric
              document={contract}
              docType="contracte"
              onRefresh={loadContract}
            />

            <Paper withBorder p="md">
              <Title order={5} mb="md">Documente asociate</Title>
              <Stack gap="xs">
                {/* Current contract */}
                <Box
                  p="xs"
                  style={{
                    backgroundColor: '#f0f0f0',
                    borderRadius: 4,
                    fontWeight: 'bold',
                  }}
                >
                  <Text size="sm">Contract</Text>
                  <Text size="xs">{contract.nr_document}</Text>
                </Box>

                {/* Related documents */}
                {contract.related_documents.map((doc) => (
                  <Anchor
                    key={doc._id}
                    onClick={() => navigate(`/procurement/contracte/${doc._id}`)}
                    style={{ display: 'block' }}
                  >
                    <Box
                      p="xs"
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <Text size="sm">{doc.tip_document}</Text>
                      <Text size="xs" c="dimmed">{doc.nr_document}</Text>
                    </Box>
                  </Anchor>
                ))}

                {contract.related_documents.length === 0 && (
                  <Text size="sm" c="dimmed">
                    Nu exista anexe sau acte aditionale
                  </Text>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>

      {/* Modal for Serviciu/Produs */}
      <Modal
        opened={serviciuModalOpened}
        onClose={() => setServiciuModalOpened(false)}
        title={editingServiciuId ? 'Editare serviciu/produs' : 'Adaugă serviciu/produs'}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Denumire"
            placeholder="Denumire serviciu/produs"
            value={serviciuData.denumire}
            onChange={(e) => setServiciuData({ ...serviciuData, denumire: e.target.value })}
            required
          />
          <TextInput
            label="UM (Unitate de măsură)"
            placeholder="Ex: buc, kg, m"
            value={serviciuData.um}
            onChange={(e) => setServiciuData({ ...serviciuData, um: e.target.value })}
            required
          />
          <NumberInput
            label="Cantitate"
            placeholder="Cantitate"
            value={serviciuData.cantitate}
            onChange={(val) => setServiciuData({ ...serviciuData, cantitate: val as number })}
            min={0}
            decimalScale={2}
            required
          />
          <NumberInput
            label="Cost unitar (RON)"
            placeholder="Cost unitar"
            value={serviciuData.cost_unitar}
            onChange={(val) => setServiciuData({ ...serviciuData, cost_unitar: val as number })}
            min={0}
            decimalScale={2}
            required
          />
          <Divider />
          <Box>
            <Text size="sm" c="dimmed">Valoare totală</Text>
            <Text fw={500} size="lg">
              {(serviciuData.cantitate * serviciuData.cost_unitar).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
            </Text>
          </Box>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setServiciuModalOpened(false)}>
              Anulează
            </Button>
            <Button onClick={handleSaveServiciuProdus}>
              Salvează
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}


