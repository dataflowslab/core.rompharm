import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Table,
  Group,
  Modal,
  TextInput,
  Select,
  Textarea,
  ActionIcon,
  Loader,
  Text,
  Paper,
  Stack,
  Grid,
  Tabs,
  Badge,
  Divider,
} from '@mantine/core';
import { IconPlus, IconTrash, IconEdit, IconArrowLeft, IconSearch, IconEye } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';

interface Companie {
  _id: string;
  denumire: string;
  cif: string;
  regcom?: string;
  adresa?: {
    tara_id?: string;
    localitate?: string;
    judet_id?: string;
    adresa?: string;
    observatii?: string;
  };
  reprezentant_legal?: {
    nume?: string;
    functie?: string;
    telefon?: string;
    email?: string;
  };
  persoana_contact?: {
    nume?: string;
    functie?: string;
    telefon?: string;
    email?: string;
  };
  tara_name?: string;
  judet_name?: string;
}

interface Contract {
  _id: string;
  serie_numar: string;
  data_contract: string;
  valoare: number;
  moneda: string;
  obiect: string;
  status: string;
}

export function CompaniiPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [companii, setCompanii] = useState<Companie[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [detailsModalOpened, setDetailsModalOpened] = useState(false);
  const [editingCompanie, setEditingCompanie] = useState<Companie | null>(null);
  const [deletingCompanieId, setDeletingCompanieId] = useState<string | null>(null);
  const [viewingCompanie, setViewingCompanie] = useState<Companie | null>(null);
  const [contracte, setContracte] = useState<Contract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(100);

  // Form state
  const [formData, setFormData] = useState({
    denumire: '',
    cif: '',
    regcom: '',
    adresa: {
      tara_id: '',
      localitate: '',
      judet_id: '',
      adresa: '',
      observatii: '',
    },
    reprezentant_legal: {
      nume: '',
      functie: '',
      telefon: '',
      email: '',
    },
    persoana_contact: {
      nume: '',
      functie: '',
      telefon: '',
      email: '',
    },
  });

  // Options for selects
  const [tari, setTari] = useState<any[]>([]);
  const [judete, setJudete] = useState<any[]>([]);
  const [loadingAnaf, setLoadingAnaf] = useState(false);

  const ROMANIA_OID = '696a034439b2b58a52334d88';

  useEffect(() => {
    loadCompanii();
    loadTari();
    loadJudete();
  }, [skip, searchTerm]);

  const loadCompanii = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/procurement/companii/list', {
        params: { skip, limit, search: searchTerm || undefined },
      });
      setCompanii(response.data.items);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Failed to load companii:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load companii'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTari = async () => {
    try {
      const response = await api.get('/api/procurement/nomenclatoare/countries');
      setTari(response.data.map((t: any) => ({ value: t.value, label: t.label })));
    } catch (error) {
      console.error('Failed to load countries:', error);
    }
  };

  const loadJudete = async () => {
    try {
      const response = await api.get('/api/procurement/nomenclatoare/judete');
      setJudete(response.data.map((j: any) => ({ value: j.value, label: j.label })));
    } catch (error) {
      console.error('Failed to load judete:', error);
    }
  };

  const handleVerifyAnaf = async () => {
    if (!formData.cif) {
      notifications.show({
        title: t('Error'),
        message: 'Introduceți CIF-ul înainte de verificare',
        color: 'red',
      });
      return;
    }

    try {
      setLoadingAnaf(true);
      const response = await api.get(`/api/procurement/companii/anaf/verify/${formData.cif}`);
      
      if (response.data.found) {
        const anafData = response.data.data;
        setFormData({
          ...formData,
          denumire: anafData.denumire || formData.denumire,
          adresa: {
            ...formData.adresa,
            adresa: anafData.adresa || formData.adresa.adresa,
          },
        });
        notifications.show({
          title: t('Success'),
          message: 'Date preluate cu succes din ANAF',
          color: 'green',
        });
      } else {
        notifications.show({
          title: t('Info'),
          message: response.data.message,
          color: 'yellow',
        });
      }
    } catch (error: any) {
      console.error('Failed to verify CIF:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || 'Eroare la verificarea CIF',
        color: 'red',
      });
    } finally {
      setLoadingAnaf(false);
    }
  };

  const handleOpenModal = (companie?: Companie) => {
    if (companie) {
      setEditingCompanie(companie);
      setFormData({
        denumire: companie.denumire || '',
        cif: companie.cif || '',
        regcom: companie.regcom || '',
        adresa: {
          tara_id: companie.adresa?.tara_id || '',
          localitate: companie.adresa?.localitate || '',
          judet_id: companie.adresa?.judet_id || '',
          adresa: companie.adresa?.adresa || '',
          observatii: companie.adresa?.observatii || '',
        },
        reprezentant_legal: {
          nume: companie.reprezentant_legal?.nume || '',
          functie: companie.reprezentant_legal?.functie || '',
          telefon: companie.reprezentant_legal?.telefon || '',
          email: companie.reprezentant_legal?.email || '',
        },
        persoana_contact: {
          nume: companie.persoana_contact?.nume || '',
          functie: companie.persoana_contact?.functie || '',
          telefon: companie.persoana_contact?.telefon || '',
          email: companie.persoana_contact?.email || '',
        },
      });
    } else {
      setEditingCompanie(null);
      setFormData({
        denumire: '',
        cif: '',
        regcom: '',
        adresa: {
          tara_id: '',
          localitate: '',
          judet_id: '',
          adresa: '',
          observatii: '',
        },
        reprezentant_legal: {
          nume: '',
          functie: '',
          telefon: '',
          email: '',
        },
        persoana_contact: {
          nume: '',
          functie: '',
          telefon: '',
          email: '',
        },
      });
    }
    setModalOpened(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that either reprezentant_legal or persoana_contact has nume
    const hasReprezentant = formData.reprezentant_legal.nume?.trim();
    const hasContact = formData.persoana_contact.nume?.trim();

    if (!hasReprezentant && !hasContact) {
      notifications.show({
        title: t('Error'),
        message: 'Fie reprezentant legal fie persoana de contact trebuie să aibă nume completat',
        color: 'red',
      });
      return;
    }

    try {
      if (editingCompanie) {
        await api.put(`/api/procurement/companii/${editingCompanie._id}`, formData);
        notifications.show({
          title: t('Success'),
          message: 'Companie actualizat�� cu succes',
          color: 'green',
        });
      } else {
        await api.post('/api/procurement/companii/create', formData);
        notifications.show({
          title: t('Success'),
          message: 'Companie creată cu succes',
          color: 'green',
        });
      }
      setModalOpened(false);
      loadCompanii();
    } catch (error: any) {
      console.error('Failed to save companie:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || 'Eroare la salvarea companiei',
        color: 'red',
      });
    }
  };

  const handleOpenDeleteModal = (id: string) => {
    setDeletingCompanieId(id);
    setDeleteModalOpened(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCompanieId) return;

    try {
      await api.delete(`/api/procurement/companii/${deletingCompanieId}`);
      notifications.show({
        title: t('Success'),
        message: 'Companie ștearsă cu succes',
        color: 'green',
      });
      setDeleteModalOpened(false);
      setDeletingCompanieId(null);
      loadCompanii();
    } catch (error: any) {
      console.error('Failed to delete companie:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || 'Eroare la ștergerea companiei',
        color: 'red',
      });
    }
  };

  const handleViewDetails = async (companie: Companie) => {
    setViewingCompanie(companie);
    setDetailsModalOpened(true);
    
    // Load contracts for this companie
    try {
      const response = await api.get(`/api/procurement/companii/${companie._id}/contracte`);
      setContracte(response.data);
    } catch (error) {
      console.error('Failed to load contracts:', error);
      setContracte([]);
    }
  };

  const isRomania = formData.adresa.tara_id === ROMANIA_OID;

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate('/procurement/nomenclatoare')}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={2}>Companii</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpenModal()}>
          Companie nouă
        </Button>
      </Group>

      <Paper withBorder shadow="sm" p="md" mb="md">
        <TextInput
          placeholder="Caută după denumire, CIF sau Reg. Com."
          leftSection={<IconSearch size={16} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Paper>

      {loading ? (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      ) : companii.length === 0 ? (
        <Paper withBorder shadow="sm" p="xl">
          <Text c="dimmed" ta="center">
            Nu au fost găsite companii
          </Text>
        </Paper>
      ) : (
        <Paper withBorder shadow="sm" p="md">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Denumire</Table.Th>
                <Table.Th>CIF</Table.Th>
                <Table.Th>Reg. Com.</Table.Th>
                <Table.Th>Localitate</Table.Th>
                <Table.Th>Județ</Table.Th>
                <Table.Th>Acțiuni</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {companii.map((companie, index) => (
                <Table.Tr key={companie._id}>
                  <Table.Td>{skip + index + 1}</Table.Td>
                  <Table.Td>{companie.denumire}</Table.Td>
                  <Table.Td>{companie.cif}</Table.Td>
                  <Table.Td>{companie.regcom || '-'}</Table.Td>
                  <Table.Td>{companie.adresa?.localitate || '-'}</Table.Td>
                  <Table.Td>{companie.judet_name || '-'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon variant="subtle" color="blue" onClick={() => handleViewDetails(companie)}>
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="blue" onClick={() => handleOpenModal(companie)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleOpenDeleteModal(companie._id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group justify="space-between" mt="md">
            <Text size="sm" c="dimmed">
              Total: {total} companii
            </Text>
          </Group>
        </Paper>
      )}

      {/* Create/Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingCompanie ? 'Editare companie' : 'Companie nouă'}
        size="xl"
        padding="md"
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="xs">
            <Grid>
              <Grid.Col span={8}>
                <TextInput
                  label="Denumire"
                  required
                  value={formData.denumire}
                  onChange={(e) => setFormData({ ...formData, denumire: e.target.value })}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Group gap="xs">
                  <TextInput
                    label="CIF"
                    required
                    value={formData.cif}
                    onChange={(e) => setFormData({ ...formData, cif: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <Button
                    mt={24}
                    onClick={handleVerifyAnaf}
                    loading={loadingAnaf}
                    variant="light"
                  >
                    Verifică ANAF
                  </Button>
                </Group>
              </Grid.Col>
            </Grid>

            <TextInput
              label="Nr. Înreg. Reg. Com."
              value={formData.regcom}
              onChange={(e) => setFormData({ ...formData, regcom: e.target.value })}
            />

            <Divider label="Adresă" />

            <Grid>
              <Grid.Col span={6}>
                <Select
                  label="Țară"
                  data={tari}
                  value={formData.adresa.tara_id}
                  onChange={(value) => setFormData({
                    ...formData,
                    adresa: { ...formData.adresa, tara_id: value || '' },
                  })}
                  searchable
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Localitate"
                  value={formData.adresa.localitate}
                  onChange={(e) => setFormData({
                    ...formData,
                    adresa: { ...formData.adresa, localitate: e.target.value },
                  })}
                />
              </Grid.Col>
            </Grid>

            {isRomania && (
              <Select
                label="Județ"
                data={judete}
                value={formData.adresa.judet_id}
                onChange={(value) => setFormData({
                  ...formData,
                  adresa: { ...formData.adresa, judet_id: value || '' },
                })}
                searchable
              />
            )}

            <TextInput
              label="Adresă"
              value={formData.adresa.adresa}
              onChange={(e) => setFormData({
                ...formData,
                adresa: { ...formData.adresa, adresa: e.target.value },
              })}
            />

            <Textarea
              label="Observații"
              value={formData.adresa.observatii}
              onChange={(e) => setFormData({
                ...formData,
                adresa: { ...formData.adresa, observatii: e.target.value },
              })}
              rows={1}
            />

            <Divider label="Reprezentant legal" />

            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Nume"
                  value={formData.reprezentant_legal.nume}
                  onChange={(e) => setFormData({
                    ...formData,
                    reprezentant_legal: { ...formData.reprezentant_legal, nume: e.target.value },
                  })}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Funcție"
                  value={formData.reprezentant_legal.functie}
                  onChange={(e) => setFormData({
                    ...formData,
                    reprezentant_legal: { ...formData.reprezentant_legal, functie: e.target.value },
                  })}
                />
              </Grid.Col>
            </Grid>

            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Telefon"
                  value={formData.reprezentant_legal.telefon}
                  onChange={(e) => setFormData({
                    ...formData,
                    reprezentant_legal: { ...formData.reprezentant_legal, telefon: e.target.value },
                  })}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="E-mail"
                  type="email"
                  value={formData.reprezentant_legal.email}
                  onChange={(e) => setFormData({
                    ...formData,
                    reprezentant_legal: { ...formData.reprezentant_legal, email: e.target.value },
                  })}
                />
              </Grid.Col>
            </Grid>

            <Divider label="Persoană de contact" />

            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Nume"
                  value={formData.persoana_contact.nume}
                  onChange={(e) => setFormData({
                    ...formData,
                    persoana_contact: { ...formData.persoana_contact, nume: e.target.value },
                  })}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Funcție"
                  value={formData.persoana_contact.functie}
                  onChange={(e) => setFormData({
                    ...formData,
                    persoana_contact: { ...formData.persoana_contact, functie: e.target.value },
                  })}
                />
              </Grid.Col>
            </Grid>

            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Telefon"
                  value={formData.persoana_contact.telefon}
                  onChange={(e) => setFormData({
                    ...formData,
                    persoana_contact: { ...formData.persoana_contact, telefon: e.target.value },
                  })}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="E-mail"
                  type="email"
                  value={formData.persoana_contact.email}
                  onChange={(e) => setFormData({
                    ...formData,
                    persoana_contact: { ...formData.persoana_contact, email: e.target.value },
                  })}
                />
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setModalOpened(false)}>
                Anulează
              </Button>
              <Button type="submit">Salvează</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal
        opened={detailsModalOpened}
        onClose={() => setDetailsModalOpened(false)}
        title="Detalii companie"
        size="xl"
      >
        {viewingCompanie && (
          <Tabs defaultValue="info">
            <Tabs.List>
              <Tabs.Tab value="info">Informații</Tabs.Tab>
              <Tabs.Tab value="contracte">Contracte</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="info" pt="md">
              <Stack gap="md">
                <div>
                  <Text size="sm" c="dimmed">Denumire</Text>
                  <Text fw={500}>{viewingCompanie.denumire}</Text>
                </div>
                <Grid>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">CIF</Text>
                    <Text fw={500}>{viewingCompanie.cif}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Reg. Com.</Text>
                    <Text fw={500}>{viewingCompanie.regcom || '-'}</Text>
                  </Grid.Col>
                </Grid>

                <Divider label="Adresă" />

                <div>
                  <Text size="sm" c="dimmed">Țară</Text>
                  <Text fw={500}>{viewingCompanie.tara_name || '-'}</Text>
                </div>
                <Grid>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Localitate</Text>
                    <Text fw={500}>{viewingCompanie.adresa?.localitate || '-'}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Județ</Text>
                    <Text fw={500}>{viewingCompanie.judet_name || '-'}</Text>
                  </Grid.Col>
                </Grid>
                <div>
                  <Text size="sm" c="dimmed">Adresă</Text>
                  <Text fw={500}>{viewingCompanie.adresa?.adresa || '-'}</Text>
                </div>
                {viewingCompanie.adresa?.observatii && (
                  <div>
                    <Text size="sm" c="dimmed">Observații</Text>
                    <Text fw={500}>{viewingCompanie.adresa.observatii}</Text>
                  </div>
                )}

                {viewingCompanie.reprezentant_legal?.nume && (
                  <>
                    <Divider label="Reprezentant legal" />
                    <Grid>
                      <Grid.Col span={6}>
                        <Text size="sm" c="dimmed">Nume</Text>
                        <Text fw={500}>{viewingCompanie.reprezentant_legal.nume}</Text>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Text size="sm" c="dimmed">Funcție</Text>
                        <Text fw={500}>{viewingCompanie.reprezentant_legal.functie || '-'}</Text>
                      </Grid.Col>
                    </Grid>
                    <Grid>
                      <Grid.Col span={6}>
                        <Text size="sm" c="dimmed">Telefon</Text>
                        <Text fw={500}>{viewingCompanie.reprezentant_legal.telefon || '-'}</Text>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Text size="sm" c="dimmed">E-mail</Text>
                        <Text fw={500}>{viewingCompanie.reprezentant_legal.email || '-'}</Text>
                      </Grid.Col>
                    </Grid>
                  </>
                )}

                {viewingCompanie.persoana_contact?.nume && (
                  <>
                    <Divider label="Persoană de contact" />
                    <Grid>
                      <Grid.Col span={6}>
                        <Text size="sm" c="dimmed">Nume</Text>
                        <Text fw={500}>{viewingCompanie.persoana_contact.nume}</Text>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Text size="sm" c="dimmed">Funcție</Text>
                        <Text fw={500}>{viewingCompanie.persoana_contact.functie || '-'}</Text>
                      </Grid.Col>
                    </Grid>
                    <Grid>
                      <Grid.Col span={6}>
                        <Text size="sm" c="dimmed">Telefon</Text>
                        <Text fw={500}>{viewingCompanie.persoana_contact.telefon || '-'}</Text>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Text size="sm" c="dimmed">E-mail</Text>
                        <Text fw={500}>{viewingCompanie.persoana_contact.email || '-'}</Text>
                      </Grid.Col>
                    </Grid>
                  </>
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="contracte" pt="md">
              {contracte.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  Nu există contracte pentru această companie
                </Text>
              ) : (
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Serie/Număr</Table.Th>
                      <Table.Th>Data</Table.Th>
                      <Table.Th>Valoare</Table.Th>
                      <Table.Th>Obiect</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {contracte.map((contract) => (
                      <Table.Tr key={contract._id}>
                        <Table.Td>{contract.serie_numar}</Table.Td>
                        <Table.Td>{new Date(contract.data_contract).toLocaleDateString('ro-RO')}</Table.Td>
                        <Table.Td>{contract.valoare.toLocaleString('ro-RO')} {contract.moneda}</Table.Td>
                        <Table.Td>{contract.obiect}</Table.Td>
                        <Table.Td>
                          <Badge color={contract.status === 'activ' ? 'green' : 'gray'}>
                            {contract.status}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Tabs.Panel>
          </Tabs>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Confirmare ștergere"
        size="sm"
      >
        <Stack gap="md">
          <Text>Sigur doriți să ștergeți această companie?</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setDeleteModalOpened(false)}>
              Anulează
            </Button>
            <Button color="red" onClick={handleConfirmDelete}>
              Șterge
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
