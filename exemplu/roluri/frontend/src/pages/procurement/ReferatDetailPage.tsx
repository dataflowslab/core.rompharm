import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Group,
  Badge,
  Loader,
  Grid,
  Alert,
  Paper,
  Text,
  Stack,
  Table,
  Modal,
  Select,
  Textarea,
  Divider,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import {
  IconArrowLeft,
  IconAlertCircle,
  IconSend,
  IconDownload,
  IconUpload,
  IconFile,
  IconX,
} from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { ReferatActivityTimeline, WorkflowSidebarGeneric, PdfSignatureBadge } from './components';
import { ReferatForm } from './ReferatForm';
import { DocumentGenerationWidget, GeneratedDocumentEntry } from '../../components/DocumentGenerationWidget';
import { useAuth } from '../../context/AuthContext';

interface ReferatData {
  _id: string;
  nr: number;
  data_intocmirii: string;
  departament: string;
  titlu: string;
  categorie: string;
  bunuri_servicii: any[];
  justificare?: string;
  termen?: string;
  valoare_estimata: number;
  surse_finantare: string;
  fonduri_disponibile: string;
  an_bugetar: number;
  atasamente: string[];
  generated_docs?: GeneratedDocumentEntry[];
  signed_pdf_hash?: string;
  signed_pdf_filename?: string;
  signed_pdf_uploaded_at?: string;
  stare: string;
  created_at: string;
  created_by: string;
  motiv?: string;
  submitted_at?: string;
  submitted_by?: string;
  approved_at?: string;
  status_updated_at?: string;
  status_updated_by?: string;
}

export function ReferatDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [referat, setReferat] = useState<ReferatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitModalOpened, setSubmitModalOpened] = useState(false);
  const [statusModalOpened, setStatusModalOpened] = useState(false);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [motiv, setMotiv] = useState('');
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);
  const [uploadingSigned, setUploadingSigned] = useState(false);
  const [workflowRefresh, setWorkflowRefresh] = useState(0);

  useEffect(() => {
    if (id) {
      loadReferat();
    }
  }, [id]);

  const loadReferat = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/procurement/referate/${id}`);
      setReferat(response.data);
    } catch (error: any) {
      console.error('Failed to load referat:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut încărca referatul',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const templateCode = 'ZS29XUQ04THM';
  const templateName = 'Referat';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ro-RO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const handleSubmit = async () => {
    try {
      await api.post(`/api/procurement/referate/${id}/submit`);
      notifications.show({
        title: 'Succes',
        message: 'Referatul a fost trimis spre aprobare',
        color: 'green',
      });
      setSubmitModalOpened(false);
      loadReferat();
      setWorkflowRefresh((prev) => prev + 1);
    } catch (error: any) {
      console.error('Failed to submit referat:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut trimite referatul',
        color: 'red',
      });
    }
  };

  const handleGenerateDocument = async (code: string) => {
    if (!id) return;
    try {
      setGeneratingDoc(code);
      await api.post(`/api/procurement/referate/${id}/documents/generate`, {
        template_code: code,
        template_name: templateName,
      });
      notifications.show({
        title: 'Succes',
        message: 'Document generat cu succes',
        color: 'green',
      });
      await loadReferat();
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut genera documentul',
        color: 'red',
      });
    } finally {
      setGeneratingDoc(null);
    }
  };

  const handleDownloadDocument = (doc: GeneratedDocumentEntry) => {
    if (!id || !doc?.id) return;
    window.open(`/api/procurement/referate/${id}/documents/${doc.id}/download`, '_blank');
  };

  const handleSignedUpload = async (files: File[]) => {
    if (!id || files.length === 0) return;
    const file = files[0];
    if (file.type !== 'application/pdf') {
      notifications.show({
        title: 'Eroare',
        message: 'Doar fișiere PDF sunt permise',
        color: 'red',
      });
      return;
    }

    try {
      setUploadingSigned(true);
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      await api.post(`/api/procurement/referate/${id}/signed/upload`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notifications.show({
        title: 'Succes',
        message: 'Referatul semnat a fost încărcat',
        color: 'green',
      });
      await loadReferat();
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut încărca documentul semnat',
        color: 'red',
      });
    } finally {
      setUploadingSigned(false);
    }
  };

  const handleSignedDownload = () => {
    if (!id) return;
    window.open(`/api/procurement/referate/${id}/signed/download`, '_blank');
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) {
      notifications.show({
        title: 'Eroare',
        message: 'Selectează o stare',
        color: 'red',
      });
      return;
    }

    if ((newStatus === 'Respins' || newStatus === 'Anulat') && !motiv) {
      notifications.show({
        title: 'Eroare',
        message: 'Motivul este obligatoriu pentru această stare',
        color: 'red',
      });
      return;
    }

    try {
      await api.post(`/api/procurement/referate/${id}/status`, {
        stare: newStatus,
        motiv: motiv || undefined,
      });
      notifications.show({
        title: 'Succes',
        message: 'Starea referatului a fost actualizată',
        color: 'green',
      });
      setStatusModalOpened(false);
      setNewStatus('');
      setMotiv('');
      loadReferat();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut actualiza starea',
        color: 'red',
      });
    }
  };

  const handleUpdate = async (data: any) => {
    if (!id) return;
    try {
      setSavingEdit(true);
      await api.put(`/api/procurement/referate/${id}`, data);
      notifications.show({
        title: 'Succes',
        message: 'Referatul a fost actualizat',
        color: 'green',
      });
      setEditModalOpened(false);
      loadReferat();
    } catch (error: any) {
      console.error('Failed to update referat:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut actualiza referatul',
        color: 'red',
      });
    } finally {
      setSavingEdit(false);
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
      <Badge color={config.color} variant="filled" size="lg">
        {status}
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

  if (!referat) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Eroare" color="red">
          Referatul nu a fost găsit
        </Alert>
        <Button mt="md" onClick={() => navigate('/procurement/referate')}>
          Înapoi la listă
        </Button>
      </Container>
    );
  }

  const canEdit = referat.stare === 'În lucru';
  const canSubmit = referat.stare === 'În lucru';
  const canAdminUpdate = isAdmin && referat.stare === 'Trimis spre aprobare';
  const showActions = canEdit || canSubmit || canAdminUpdate;
  const hasSignedPdf = Boolean(referat.signed_pdf_hash);
  const generatedDocs: GeneratedDocumentEntry[] = (referat.generated_docs && referat.generated_docs.length > 0)
    ? referat.generated_docs.map((doc, index) => ({
        id: doc.id || `${doc.template_code || templateCode}-${index}`,
        template_code: doc.template_code || templateCode,
        template_name: doc.template_name || templateName,
        file_hash: doc.file_hash,
        filename: doc.filename,
        generated_at: doc.generated_at,
      }))
    : [
        {
          id: templateCode,
          template_code: templateCode,
          template_name: templateName,
        },
      ];

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/procurement/referate')}
          >
            Înapoi
          </Button>
          <Title order={2}>Referat #{referat.nr}</Title>
        </Group>
        {getStatusBadge(referat.stare)}
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            {/* Header Information */}
            <Paper withBorder p="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={700} size="lg">{referat.titlu}</Text>
                </Group>

                <Divider />

                <Grid>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Data întocmirii:</Text>
                    <Text fw={500}>{formatDateOnly(referat.data_intocmirii)}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Departament:</Text>
                    <Text fw={500}>{referat.departament}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Categorie:</Text>
                    <Text fw={500}>{referat.categorie}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Inițiator:</Text>
                    <Text fw={500}>{referat.created_by}</Text>
                  </Grid.Col>
                </Grid>
              </Stack>
            </Paper>

            {/* Bunuri și servicii */}
            {referat.bunuri_servicii && referat.bunuri_servicii.length > 0 && (
              <Paper withBorder p="md">
                <Text fw={700} mb="md">Bunuri și servicii</Text>
                <div style={{ overflowX: 'auto' }}>
                  <Table striped withTableBorder withColumnBorders size="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Denumire</Table.Th>
                        <Table.Th>Cantitate</Table.Th>
                        <Table.Th>UM</Table.Th>
                        <Table.Th>Periodicitate</Table.Th>
                        <Table.Th>Urgent</Table.Th>
                        <Table.Th>Motiv</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {referat.bunuri_servicii.map((item: any, idx: number) => (
                        <Table.Tr key={idx}>
                          <Table.Td>{item.denumire}</Table.Td>
                          <Table.Td>{item.cantitate}</Table.Td>
                          <Table.Td>{item.um}</Table.Td>
                          <Table.Td>{item.periodicitate || '-'}</Table.Td>
                          <Table.Td>{item.urgent ? 'Da' : 'Nu'}</Table.Td>
                          <Table.Td>{item.motiv || '-'}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </Paper>
            )}

            {(referat.justificare || referat.termen) && (
              <Paper withBorder p="md">
                <Text fw={700} mb="md">Justificare și termen</Text>
                <Stack gap="sm">
                  {referat.justificare && (
                    <div>
                      <Text size="sm" c="dimmed">Justificare:</Text>
                      <Text size="sm">{referat.justificare}</Text>
                    </div>
                  )}
                  {referat.termen && (
                    <div>
                      <Text size="sm" c="dimmed">Termen:</Text>
                      <Text size="sm">{referat.termen}</Text>
                    </div>
                  )}
                </Stack>
              </Paper>
            )}

            {/* Date financiare */}
            <Paper withBorder p="md">
              <Text fw={700} mb="md">Date financiare</Text>
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Valoare estimată totală:</Text>
                  <Text fw={500}>{referat.valoare_estimata.toFixed(2)} lei</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Fonduri disponibile:</Text>
                  <Text fw={500}>{referat.fonduri_disponibile}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">An bugetar:</Text>
                  <Text fw={500}>{referat.an_bugetar}</Text>
                </Grid.Col>
                {referat.surse_finantare && (
                  <Grid.Col span={12}>
                    <Text size="sm" c="dimmed">Surse de finanțare:</Text>
                    <Text size="sm">{referat.surse_finantare}</Text>
                  </Grid.Col>
                )}
              </Grid>
            </Paper>

            {/* Atașamente */}
            {referat.atasamente && referat.atasamente.length > 0 && (
              <Paper withBorder p="md">
                <Text fw={700} mb="md">Atașamente</Text>
                <Stack gap="xs">
                  {referat.atasamente.map((hash: string, idx: number) => (
                    <Group key={hash} justify="space-between">
                      <Group gap="xs">
                        <Text size="sm">Fișier {idx + 1}</Text>
                        <PdfSignatureBadge endpoint={id ? `/api/procurement/referate/${id}/files/${hash}/signature` : undefined} />
                      </Group>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconDownload size={14} />}
                        onClick={() => window.open(`/api/data/files/${hash}`, '_blank')}
                      >
                        Descarcă
                      </Button>
                    </Group>
                  ))}
                </Stack>
              </Paper>
            )}

            {/* Motiv (dacă există) */}
            {referat.motiv && (
              <Paper withBorder p="md" bg="red.0">
                <Text fw={700} mb="sm" c="red">Motiv {referat.stare === 'Respins' ? 'respingere' : 'anulare'}:</Text>
                <Text size="sm">{referat.motiv}</Text>
              </Paper>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            <DocumentGenerationWidget
              documents={generatedDocs}
              onGenerate={handleGenerateDocument}
              onDownload={handleDownloadDocument}
              generating={generatingDoc}
              title="Documente generate"
            />

            <Paper withBorder p="md">
              <Text fw={700} mb="sm">Referat semnat</Text>
              <Stack gap="sm">
                {hasSignedPdf ? (
                  <Stack gap={4}>
                    <Group gap="xs">
                      <Text size="sm" c="dimmed">
                        Document semnat încărcat
                      </Text>
                      <PdfSignatureBadge endpoint={id && referat.signed_pdf_hash ? `/api/procurement/referate/${id}/files/${referat.signed_pdf_hash}/signature` : undefined} />
                    </Group>
                    {referat.signed_pdf_uploaded_at && (
                      <Text size="xs" c="dimmed">
                        Încărcat la {formatDate(referat.signed_pdf_uploaded_at)}
                      </Text>
                    )}
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconDownload size={14} />}
                      onClick={handleSignedDownload}
                    >
                      Descarcă
                    </Button>
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">
                    Nu există document semnat încărcat
                  </Text>
                )}

                <Dropzone
                  onDrop={handleSignedUpload}
                  loading={uploadingSigned}
                  multiple={false}
                  maxSize={10 * 1024 * 1024}
                  accept={['application/pdf']}
                >
                  <Group justify="center" gap="xs" style={{ minHeight: 80, pointerEvents: 'none' }}>
                    <Dropzone.Accept>
                      <IconUpload size={24} stroke={1.5} />
                    </Dropzone.Accept>
                    <Dropzone.Reject>
                      <IconX size={24} stroke={1.5} />
                    </Dropzone.Reject>
                    <Dropzone.Idle>
                      <IconFile size={24} stroke={1.5} />
                    </Dropzone.Idle>
                    <div>
                      <Text size="sm" inline>
                        Încarcă PDF semnat
                      </Text>
                      <Text size="xs" c="dimmed" inline mt={4}>
                        Fișier PDF, max 10MB
                      </Text>
                    </div>
                  </Group>
                </Dropzone>
              </Stack>
            </Paper>

            {/* Acțiuni */}
            {showActions && (
              <Paper withBorder p="md">
                <Text fw={700} mb="md">Acțiuni</Text>
                <Stack gap="sm">
                  {referat.stare === 'În lucru' && (
                    <Button
                      leftSection={<IconSend size={16} />}
                      onClick={() => setSubmitModalOpened(true)}
                      fullWidth
                    >
                      Trimite spre aprobare
                    </Button>
                  )}

                  {isAdmin && referat.stare === 'Trimis spre aprobare' && (
                    <Button
                      onClick={() => setStatusModalOpened(true)}
                      fullWidth
                      color="cyan"
                    >
                      Actualizează starea
                    </Button>
                  )}

                  {referat.stare === 'În lucru' && (
                    <Button
                      variant="light"
                      onClick={() => setEditModalOpened(true)}
                      fullWidth
                    >
                      Editează
                    </Button>
                  )}
                </Stack>
              </Paper>
            )}

            {/* Jurnal activitate */}
            <ReferatActivityTimeline 
              referat={referat} 
              signatures={[]}
            />

            {(referat.stare === 'Trimis spre aprobare' || referat.stare === 'Aprobat') && (
              <WorkflowSidebarGeneric
                key={`referat-approvals-${workflowRefresh}`}
                document={referat}
                docType="referate"
                title="Aprobare"
                onRefresh={loadReferat}
                autoCreate={false}
              />
            )}
          </Stack>
        </Grid.Col>
      </Grid>
      {/* Edit Modal */}
      <Modal
        opened={editModalOpened}
        onClose={() => setEditModalOpened(false)}
        title="Editeaza referat"
        size="xl"
      >
        <ReferatForm
          initialData={referat}
          onSubmit={handleUpdate}
          onCancel={() => setEditModalOpened(false)}
        />
        {savingEdit && (
          <Text size="sm" c="dimmed" mt="sm">
            Se salveaza modificarile...
          </Text>
        )}
      </Modal>
      {/* Submit Confirmation Modal */}
      <Modal
        opened={submitModalOpened}
        onClose={() => setSubmitModalOpened(false)}
        title="Confirmare trimitere"
        centered
      >
        <Text size="sm" mb="md">
          Ești sigur că vrei să trimiți referatul spre aprobare? După trimitere nu vei mai putea face modificări.
        </Text>
        {!hasSignedPdf && (
          <Alert icon={<IconAlertCircle size={16} />} color="yellow" mb="md">
            Atenție! Nu ai încărcat documentul semnat. Referatul poate fi refuzat.
          </Alert>
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setSubmitModalOpened(false)}>
            Anulează
          </Button>
          <Button onClick={handleSubmit}>
            Trimite
          </Button>
        </Group>
      </Modal>

      {/* Status Update Modal */}
      <Modal
        opened={statusModalOpened}
        onClose={() => setStatusModalOpened(false)}
        title="Actualizează starea"
        centered
      >
        <Stack gap="md">
          <Select
            label="Stare nouă"
            placeholder="Selectează starea"
            data={[
              { value: 'Aprobat', label: 'Aprobat' },
              { value: 'Respins', label: 'Respins' },
              { value: 'Anulat', label: 'Anulat' },
            ]}
            value={newStatus}
            onChange={(value) => setNewStatus(value || '')}
            required
          />

          {(newStatus === 'Respins' || newStatus === 'Anulat') && (
            <Textarea
              label="Motiv"
              placeholder="Introduceți motivul..."
              value={motiv}
              onChange={(e) => setMotiv(e.target.value)}
              minRows={4}
              required
            />
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setStatusModalOpened(false)}>
              Anulează
            </Button>
            <Button onClick={handleStatusUpdate}>
              Salvează
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

