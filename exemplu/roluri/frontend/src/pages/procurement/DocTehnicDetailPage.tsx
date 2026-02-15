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
  Modal,
  Select,
  Textarea,
  Divider,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconAlertCircle,
  IconSend,
  IconDownload,
  IconFileText,
} from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { DocTehnicForm } from './DocTehnicForm';
import { WorkflowSidebarGeneric } from './components/WorkflowSidebarGeneric';
import { useAuth } from '../../context/AuthContext';

interface DocTehnicData {
  _id: string;
  nr: number;
  referat_id?: string;
  fundamentare_id?: string;
  titlu: string;
  tip_achizitie: string;
  cod_cpv_principal: string;
  coduri_cpv_secundare: string[];
  durata_contract: string;
  valoare_estimata: number;
  caracteristici: string;
  documentatie: string[];
  responsabil_id: string;
  responsabil_name?: string;
  observatii?: string;
  versiune: string;
  compartiment: string;
  stare: string;
  created_at: string;
  created_by: string;
  motiv?: string;
  referat_info?: any;
  fundamentare_info?: any;
}

export function DocTehnicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [document, setDocument] = useState<DocTehnicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [submitModalOpened, setSubmitModalOpened] = useState(false);
  const [statusModalOpened, setStatusModalOpened] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [motiv, setMotiv] = useState('');

  useEffect(() => {
    if (id) {
      loadDocument();
    }
  }, [id]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/procurement/achizitii/${id}`);
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



  const handleUpdate = async (formData: any) => {
    if (!document || !id) return;

    try {
      await api.put(`/api/procurement/achizitii/${id}`, formData);

      notifications.show({
        title: 'Succes',
        message: 'Documentul a fost actualizat',
        color: 'green',
      });

      setEditModalOpened(false);
      loadDocument();
    } catch (error: any) {
      console.error('Failed to update document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut actualiza documentul',
        color: 'red',
      });
    }
  };

  const handleSubmit = async () => {
    try {
      await api.post(`/api/procurement/achizitii/${id}/submit`);
      notifications.show({
        title: 'Succes',
        message: 'Documentul a fost trimis spre aprobare',
        color: 'green',
      });
      setSubmitModalOpened(false);
      loadDocument();
    } catch (error: any) {
      console.error('Failed to submit document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut trimite documentul',
        color: 'red',
      });
    }
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
      await api.post(`/api/procurement/achizitii/${id}/status`, {
        stare: newStatus,
        motiv: motiv || undefined,
      });
      notifications.show({
        title: 'Succes',
        message: 'Starea documentului a fost actualizată',
        color: 'green',
      });
      setStatusModalOpened(false);
      setNewStatus('');
      setMotiv('');
      loadDocument();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut actualiza starea',
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

  if (!document) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Eroare" color="red">
          Documentul nu a fost găsit
        </Alert>
        <Button mt="md" onClick={() => navigate('/procurement/achizitii')}>
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
            onClick={() => navigate('/procurement/achizitii')}
          >
            Înapoi
          </Button>
          <Title order={2}>Achizitie #{document.nr}</Title>
        </Group>
        {getStatusBadge(document.stare)}
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            {/* Legături cu alte documente */}
            {(document.referat_info || document.fundamentare_info) && (
              <Paper withBorder p="md" bg="blue.0">
                <Text fw={700} mb="sm">Documente asociate</Text>
                <Stack gap="xs">
                  {document.referat_info && (
                    <Group justify="space-between">
                      <Group>
                        <IconFileText size={16} />
                        <Text size="sm">Referat #{document.referat_info.nr} - {document.referat_info.titlu}</Text>
                      </Group>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => window.open(`/procurement/referate/${document.referat_id}`, '_blank')}
                      >
                        Vezi
                      </Button>
                    </Group>
                  )}
                  {document.fundamentare_info && (
                    <Group justify="space-between">
                      <Group>
                        <IconFileText size={16} />
                        <Text size="sm">{document.fundamentare_info.nr_inreg} - {document.fundamentare_info.titlu_document}</Text>
                      </Group>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => window.open(`/procurement/fundamentare/${document.fundamentare_id}`, '_blank')}
                      >
                        Vezi
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Paper>
            )}

            {/* Header Information */}
            <Paper withBorder p="md">
              <Stack gap="sm">
                <Text fw={700} size="lg">{document.titlu}</Text>
                <Divider />
                <Grid>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Număr:</Text>
                    <Text fw={500}>#{document.nr}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Versiune:</Text>
                    <Text fw={500}>{document.versiune}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Tip achiziție:</Text>
                    <Text fw={500}>{document.tip_achizitie}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Compartiment:</Text>
                    <Text fw={500}>{document.compartiment}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Responsabil:</Text>
                    <Text fw={500}>{document.responsabil_name || 'N/A'}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Data creării:</Text>
                    <Text fw={500}>{new Date(document.created_at).toLocaleDateString('ro-RO')}</Text>
                  </Grid.Col>
                </Grid>
              </Stack>
            </Paper>

            {/* Detalii tehnice */}
            <Paper withBorder p="md">
              <Text fw={700} mb="md">Detalii tehnice</Text>
              <Grid gutter="xs">
                <Grid.Col span={12}>
                  <Text size="xs" c="dimmed">Cod CPV principal:</Text>
                  <Text size="sm" fw={500}>{document.cod_cpv_principal}</Text>
                </Grid.Col>
                
                {document.coduri_cpv_secundare && document.coduri_cpv_secundare.length > 0 && (
                  <Grid.Col span={12}>
                    <Text size="xs" c="dimmed">Coduri CPV secundare:</Text>
                    <Text size="sm">{document.coduri_cpv_secundare.join(', ')}</Text>
                  </Grid.Col>
                )}

                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Durată contract estimată:</Text>
                  <Text size="sm">{document.durata_contract}</Text>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Valoare estimată:</Text>
                  <Text size="sm" fw={500}>{document.valoare_estimata.toFixed(2)} lei</Text>
                </Grid.Col>

                <Grid.Col span={12}>
                  <Text size="xs" c="dimmed">Caracteristici:</Text>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{document.caracteristici}</Text>
                </Grid.Col>

                {document.observatii && (
                  <Grid.Col span={12}>
                    <Text size="xs" c="dimmed">Observații:</Text>
                    <Text size="sm">{document.observatii}</Text>
                  </Grid.Col>
                )}
              </Grid>
            </Paper>

            {/* Documentație */}
            {document.documentatie && document.documentatie.length > 0 && (
              <Paper withBorder p="md">
                <Text fw={700} mb="md">Documentație</Text>
                <Stack gap="xs">
                  {document.documentatie.map((hash: string, idx: number) => (
                    <Group key={hash} justify="space-between">
                      <Text size="sm">Document {idx + 1}</Text>
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
            {document.motiv && (
              <Paper withBorder p="md" bg="red.0">
                <Text fw={700} mb="sm" c="red">Motiv {document.stare === 'Respins' ? 'respingere' : 'anulare'}:</Text>
                <Text size="sm">{document.motiv}</Text>
              </Paper>
            )}
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            <Paper withBorder p="md">
              <Text fw={700} mb="md">Actiuni</Text>
              <Stack gap="sm">
                {document.stare === '�n lucru' && (
                  <>
                    <Button
                      leftSection={<IconSend size={16} />}
                      onClick={() => setSubmitModalOpened(true)}
                      fullWidth
                    >
                      Trimite spre aprobare
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => setEditModalOpened(true)}
                      fullWidth
                    >
                      Editeaza
                    </Button>
                  </>
                )}

                {isAdmin && document.stare === 'Trimis spre aprobare' && (
                  <Button
                    onClick={() => setStatusModalOpened(true)}
                    fullWidth
                    color="cyan"
                  >
                    Actualizeaza starea
                  </Button>
                )}
              </Stack>
            </Paper>

            <WorkflowSidebarGeneric
              document={document}
              docType="achizitii"
              onRefresh={loadDocument}
            />
          </Stack>
        </Grid.Col>
      </Grid>

      {/* Edit Modal */}
      <Modal
        opened={editModalOpened}
        onClose={() => setEditModalOpened(false)}
        title="Editează Achizitie"
        size="90%"
        styles={{
          body: { maxHeight: '80vh', overflowY: 'auto' }
        }}
      >
        <DocTehnicForm
          onSubmit={handleUpdate}
          onCancel={() => setEditModalOpened(false)}
          initialData={document}
          isEditing={true}
        />
      </Modal>

      {/* Submit Confirmation Modal */}
      <Modal
        opened={submitModalOpened}
        onClose={() => setSubmitModalOpened(false)}
        title="Confirmare trimitere"
        centered
      >
        <Text size="sm" mb="md">
          Ești sigur că vrei să trimiți documentul spre aprobare? După trimitere nu vei mai putea face modificări.
        </Text>
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






