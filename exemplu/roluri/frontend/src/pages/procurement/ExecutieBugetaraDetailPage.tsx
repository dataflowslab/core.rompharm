import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Group,
  Loader,
  Paper,
  Text,
  Stack,
  Badge,
  Divider,
  Grid,
  Alert,
  Switch,
  Modal,
  Select,
  Textarea,
  TextInput,
  Table,
  ActionIcon,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { Dropzone } from '@mantine/dropzone';
import {
  IconArrowLeft,
  IconAlertCircle,
  IconPlus,
  IconFileText,
  IconTrash,
  IconUpload,
  IconFile,
  IconX,
} from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../context/AuthContext';

interface DocuPlataData {
  _id: string;
  contract_id: string;
  facturi: string[];
  note_receptie: string[];
  confirmat: boolean;
  avizat: boolean;
  documente: any[];
  avize: any[];
  created_at: string;
  created_by: string;
  contract_info?: any;
  achizitie_info?: any;
}

export function ExecutieBugetaraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [document, setDocument] = useState<DocuPlataData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [avizModalOpened, setAvizModalOpened] = useState(false);
  const [docModalOpened, setDocModalOpened] = useState(false);
  
  // Aviz form
  const [avizForm, setAvizForm] = useState({
    status: '',
    comment: '',
  });
  
  // Document form
  const [docForm, setDocForm] = useState({
    denumire: '',
    serie_numar: '',
    data_document: new Date(),
    fisiere: [] as string[],
  });
  
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (id) {
      loadDocument();
    }
  }, [id]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/procurement/docuplata/${id}`);
      setDocument(response.data);
    } catch (error: any) {
      console.error('Failed to load document:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut încărca documentul',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };



  const handleConfirmatToggle = async (checked: boolean) => {
    try {
      await api.post(`/api/procurement/docuplata/${id}/confirmare`, {
        confirmat: checked,
      });
      notifications.show({
        title: 'Succes',
        message: 'Status confirmare actualizat',
        color: 'green',
      });
      loadDocument();
    } catch (error: any) {
      console.error('Failed to toggle confirmat:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut actualiza statusul',
        color: 'red',
      });
    }
  };

  const handleAddAviz = async () => {
    if (!avizForm.status) {
      notifications.show({
        title: 'Eroare',
        message: 'Selectează statusul avizului',
        color: 'red',
      });
      return;
    }

    try {
      await api.post(`/api/procurement/docuplata/${id}/avize`, avizForm);
      notifications.show({
        title: 'Succes',
        message: 'Aviz adăugat cu succes',
        color: 'green',
      });
      setAvizModalOpened(false);
      setAvizForm({ status: '', comment: '' });
      loadDocument();
    } catch (error: any) {
      console.error('Failed to add aviz:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut adăuga avizul',
        color: 'red',
      });
    }
  };

  const handleFileUpload = async (files: File[]) => {
    try {
      setUploading(true);
      const uploadedHashes: string[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name);
        formData.append('main', 'false');

        const response = await api.post('/api/library/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        uploadedHashes.push(response.data.hash);
      }

      setDocForm({
        ...docForm,
        fisiere: [...docForm.fisiere, ...uploadedHashes],
      });

      notifications.show({
        title: 'Succes',
        message: `${files.length} fișier(e) încărcat(e)`,
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to upload files:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca fișierele',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAddDocument = async () => {
    if (!docForm.denumire || !docForm.serie_numar) {
      notifications.show({
        title: 'Eroare',
        message: 'Completează toate câmpurile obligatorii',
        color: 'red',
      });
      return;
    }

    try {
      await api.post(`/api/procurement/docuplata/${id}/documente`, {
        ...docForm,
        data_document: docForm.data_document.toISOString().split('T')[0],
      });
      notifications.show({
        title: 'Succes',
        message: 'Document adăugat cu succes',
        color: 'green',
      });
      setDocModalOpened(false);
      setDocForm({
        denumire: '',
        serie_numar: '',
        data_document: new Date(),
        fisiere: [],
      });
      loadDocument();
    } catch (error: any) {
      console.error('Failed to add document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut adăuga documentul',
        color: 'red',
      });
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi acest document?')) return;

    try {
      await api.delete(`/api/procurement/docuplata/${id}/documente/${docId}`);
      notifications.show({
        title: 'Succes',
        message: 'Document șters cu succes',
        color: 'green',
      });
      loadDocument();
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut șterge documentul',
        color: 'red',
      });
    }
  };

  const handleGenerateReferat = async () => {
    if (!document) return;

    try {
      const documentData = {
        nr_document: `DOC-${document._id.substring(0, 8)}`,
        data_document: new Date().toLocaleDateString('ro-RO'),
        contract_serie_numar: document.contract_info?.serie_numar || 'N/A',
        contract_data: document.contract_info?.data_contract || 'N/A',
        contract_obiect: document.achizitie_info?.titlu || 'N/A',
        furnizor: 'N/A',
        valoare_contract: '0.00',
        nr_facturi: document.facturi.length,
        facturi: [],
        nr_note_receptie: document.note_receptie.length,
        note_receptie: [],
        valoare_confirmata: '0.00',
        status_confirmare: document.confirmat ? 'Confirmat' : 'Neconfirmat',
        observatii: '',
        avize: document.avize || [],
        intocmit_de: document.created_by,
        data_intocmire: new Date(document.created_at).toLocaleDateString('ro-RO'),
      };

      const response = await api.post('/api/forms/generate-document', {
        form_slug: 'FDDUX7RJXPAW',
        submission_data: documentData,
      });

      if (response.data.file_path) {
        window.open(response.data.file_path, '_blank');
        notifications.show({
          title: 'Succes',
          message: 'Referatul de confirmare a fost generat',
          color: 'green',
        });
      }
    } catch (error: any) {
      console.error('Failed to generate document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut genera documentul',
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

  if (!document) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Eroare" color="red">
          Documentul nu a fost găsit
        </Alert>
        <Button mt="md" onClick={() => navigate('/procurement/executie-bugetara')}>
          Înapoi la listă
        </Button>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/procurement/executie-bugetara')}
          >
            Înapoi
          </Button>
          <Title order={2}>Document de Plată</Title>
        </Group>
        <Group>
          <Badge color={document.confirmat ? 'green' : 'gray'} size="lg">
            {document.confirmat ? 'Confirmat' : 'Neconfirmat'}
          </Badge>
          <Badge color={document.avizat ? 'green' : 'gray'} size="lg">
            {document.avizat ? 'Avizat' : 'Neavizat'}
          </Badge>
        </Group>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            {/* Informații document */}
            <Paper withBorder p="md">
              <Stack gap="sm">
                <Text fw={700} size="lg">Informații document</Text>
                <Divider />
                <Grid>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Contract:</Text>
                    <Text fw={500}>{document.contract_info?.serie_numar || 'N/A'}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Data contract:</Text>
                    <Text fw={500}>
                      {document.contract_info?.data_contract 
                        ? new Date(document.contract_info.data_contract).toLocaleDateString('ro-RO')
                        : 'N/A'}
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Facturi:</Text>
                    <Text fw={500}>{document.facturi.length} fișier(e)</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Note de recepție:</Text>
                    <Text fw={500}>{document.note_receptie.length} fișier(e)</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Data creării:</Text>
                    <Text fw={500}>{new Date(document.created_at).toLocaleDateString('ro-RO')}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Creat de:</Text>
                    <Text fw={500}>{document.created_by}</Text>
                  </Grid.Col>
                </Grid>
              </Stack>
            </Paper>

            {/* Avize */}
            <Paper withBorder p="md">
              <Group justify="space-between" mb="md">
                <Text fw={700}>Avize</Text>
                <Button
                  size="sm"
                  onClick={() => setAvizModalOpened(true)}
                >
                  Adaugă aviz
                </Button>
              </Group>
              {document.avize && document.avize.length > 0 ? (
                <Stack gap="sm">
                  {document.avize.map((aviz: any) => (
                    <Paper key={aviz.id} withBorder p="sm" bg="gray.0">
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" fw={500}>{aviz.username}</Text>
                          <Text size="xs" c="dimmed">{new Date(aviz.created_at).toLocaleString('ro-RO')}</Text>
                        </div>
                        <Badge color={aviz.status === 'approved' ? 'green' : 'red'}>
                          {aviz.status === 'approved' ? 'Aprobat' : 'Respins'}
                        </Badge>
                      </Group>
                      {aviz.comment && (
                        <Text size="sm" mt="xs">{aviz.comment}</Text>
                      )}
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  Nu există avize
                </Text>
              )}
            </Paper>

            {/* Documente */}
            <Paper withBorder p="md">
              <Group justify="space-between" mb="md">
                <Text fw={700}>Documente</Text>
                <Button
                  size="sm"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => setDocModalOpened(true)}
                >
                  Adaugă document
                </Button>
              </Group>
              {document.documente && document.documente.length > 0 ? (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Denumire</Table.Th>
                      <Table.Th>Serie și nr.</Table.Th>
                      <Table.Th>Data</Table.Th>
                      <Table.Th>Fișiere</Table.Th>
                      <Table.Th>Acțiuni</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {document.documente.map((doc: any) => (
                      <Table.Tr key={doc.id}>
                        <Table.Td>{doc.denumire}</Table.Td>
                        <Table.Td>{doc.serie_numar}</Table.Td>
                        <Table.Td>{new Date(doc.data_document).toLocaleDateString('ro-RO')}</Table.Td>
                        <Table.Td>
                          {doc.fisiere && doc.fisiere.length > 0 ? (
                            <Group gap="xs">
                              {doc.fisiere.map((hash: string, idx: number) => (
                                <ActionIcon
                                  key={hash}
                                  size="sm"
                                  variant="subtle"
                                  onClick={() => window.open(`/api/data/files/${hash}`, '_blank')}
                                  title={`Fișier ${idx + 1}`}
                                >
                                  <IconFileText size={14} />
                                </ActionIcon>
                              ))}
                            </Group>
                          ) : (
                            <Text size="sm" c="dimmed">-</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  Nu există documente adăugate
                </Text>
              )}
            </Paper>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="md">
            <Text fw={700} mb="md">Acțiuni</Text>
            <Stack gap="sm">
              {isAdmin && (
                <Switch
                  label="Confirmat"
                  checked={document.confirmat}
                  onChange={(e) => handleConfirmatToggle(e.currentTarget.checked)}
                />
              )}

              <Button
                variant="outline"
                fullWidth
                onClick={handleGenerateReferat}
              >
                Generează Referat de Confirmare
              </Button>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Aviz Modal */}
      <Modal
        opened={avizModalOpened}
        onClose={() => setAvizModalOpened(false)}
        title="Adaugă aviz"
        centered
      >
        <Stack gap="md">
          <Select
            label="Status"
            placeholder="Selectează statusul"
            data={[
              { value: 'approved', label: 'Aprobat' },
              { value: 'rejected', label: 'Respins' },
            ]}
            value={avizForm.status}
            onChange={(value) => setAvizForm({ ...avizForm, status: value || '' })}
            required
          />

          <Textarea
            label="Comentariu"
            placeholder="Adaugă un comentariu (opțional)"
            value={avizForm.comment}
            onChange={(e) => setAvizForm({ ...avizForm, comment: e.target.value })}
            minRows={3}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setAvizModalOpened(false)}>
              Anulează
            </Button>
            <Button onClick={handleAddAviz}>
              Adaugă aviz
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Document Modal */}
      <Modal
        opened={docModalOpened}
        onClose={() => setDocModalOpened(false)}
        title="Adaugă document"
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Denumire document"
            placeholder="Ex: Factură proformă"
            value={docForm.denumire}
            onChange={(e) => setDocForm({ ...docForm, denumire: e.target.value })}
            required
          />

          <TextInput
            label="Serie și număr"
            placeholder="Ex: 123/2024"
            value={docForm.serie_numar}
            onChange={(e) => setDocForm({ ...docForm, serie_numar: e.target.value })}
            required
          />

          <DateInput
            label="Data document"
            value={docForm.data_document}
            onChange={(val) => setDocForm({ ...docForm, data_document: val || new Date() })}
            valueFormat="DD/MM/YYYY"
            required
          />

          <Dropzone
            onDrop={handleFileUpload}
            loading={uploading}
            multiple
          >
            <Group justify="center" gap="xs" style={{ minHeight: 80, pointerEvents: 'none' }}>
              <Dropzone.Accept>
                <IconUpload size={32} stroke={1.5} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={32} stroke={1.5} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconFile size={32} stroke={1.5} />
              </Dropzone.Idle>
              <div>
                <Text size="sm" inline>
                  Fișiere document (opțional)
                </Text>
              </div>
            </Group>
          </Dropzone>

          {docForm.fisiere.length > 0 && (
            <Text size="sm" c="dimmed">
              {docForm.fisiere.length} fișier(e) încărcat(e)
            </Text>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setDocModalOpened(false)}>
              Anulează
            </Button>
            <Button onClick={handleAddDocument}>
              Adaugă document
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
