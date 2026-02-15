import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Group,
  Paper,
  Text,
  Stack,
  Grid,
  Modal,
  Loader,
  Alert,
  ActionIcon,
  Badge,
} from '@mantine/core';
import { IconArrowLeft, IconAlertCircle, IconEdit, IconTrash, IconDownload, IconFile } from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { SimpleDocumentForm, SimpleDocumentData } from './components/SimpleDocumentForm';
import { WorkflowSidebarGeneric } from './components/WorkflowSidebarGeneric';

interface PaapDoc extends SimpleDocumentData {
  _id: string;
  nr?: number;
  created_at?: string;
  created_by?: string;
  created_by_name?: string;
  shared_with_names?: string[];
  is_owner?: boolean;
  an?: number;
  rev?: number;
  stare?: string;
  stare_id?: string;
  is_latest_for_year?: boolean;
  is_latest_approved_for_year?: boolean;
  has_approved_for_year?: boolean;
  can_edit?: boolean;
}

export function PaapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<PaapDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      loadPaap();
    }
  }, [id]);

  const loadPaap = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/procurement/paap/${id}`);
      setDoc(response.data);
    } catch (error: any) {
      console.error('Failed to load PAAP:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut incarca documentul PAAP',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: SimpleDocumentData) => {
    if (!id) return;
    try {
      setSaving(true);
      await api.put(`/api/procurement/paap/${id}`, data);

      notifications.show({
        title: 'Succes',
        message: 'Documentul PAAP a fost actualizat',
        color: 'green',
      });

      setEditModalOpened(false);
      loadPaap();
    } catch (error: any) {
      console.error('Failed to update PAAP:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut actualiza documentul PAAP',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!id) return;

    try {
      await api.delete(`/api/procurement/paap/${id}`);
      notifications.show({
        title: 'Succes',
        message: 'Documentul PAAP a fost sters',
        color: 'green',
      });
      navigate('/procurement/paap');
    } catch (error: any) {
      console.error('Failed to delete PAAP:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut sterge documentul PAAP',
        color: 'red',
      });
    }
  };

  const handleDownloadFile = async (fileId: string, filename?: string) => {
    try {
      const response = await api.get(`/api/library/files/${fileId}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = filename || `document-${fileId}`;
      window.document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut descărca fișierul',
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

  if (!doc) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Eroare" color="red">
          Documentul PAAP nu a fost gasit
        </Alert>
        <Button mt="md" onClick={() => navigate('/procurement/paap')}>
          Inapoi la lista
        </Button>
      </Container>
    );
  }

  const canEdit = !!doc.can_edit;
  const statusText = doc.stare || 'In asteptare';
  const normalizedStatus = statusText.toLowerCase();
  let statusColor = 'yellow';
  if (normalizedStatus.includes('aprobat') || normalizedStatus.includes('semnat')) {
    statusColor = 'green';
  } else if (normalizedStatus.includes('anulat')) {
    statusColor = 'gray';
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/procurement/paap')}
          >
            Inapoi
          </Button>
          <Title order={2}>PAAP {doc.nr ? `#${doc.nr}` : ''}</Title>
        </Group>
        <Group gap="xs">
          <Badge size="lg" color={statusColor}>
            {statusText}
          </Badge>
        </Group>
        {doc.is_owner && canEdit && (
          <Group gap="xs">
            <Button
              leftSection={<IconEdit size={16} />}
              variant="light"
              onClick={() => setEditModalOpened(true)}
            >
              Editeaza
            </Button>
            <Button
              leftSection={<IconTrash size={16} />}
              color="red"
              variant="light"
              onClick={() => setDeleteModalOpened(true)}
            >
              Sterge
            </Button>
          </Group>
        )}
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            <Paper withBorder p="md">
              <Stack gap="xs">
                <Text fw={700} size="lg">{doc.titlu}</Text>
                <Text size="sm" c="dimmed">
                  Creat de: {doc.created_by_name || doc.created_by || '-'}
                </Text>
                <Text size="sm" c="dimmed">
                  Data: {doc.created_at ? new Date(doc.created_at).toLocaleDateString('ro-RO') : '-'}
                </Text>
                <Text size="sm" c="dimmed">
                  An: {doc.an || '-'} | Rev: {doc.rev || '-'}
                </Text>
                <Text size="sm" c="dimmed">
                  Share: {(doc.shared_with_names || []).join(', ') || '-'}
                </Text>
              </Stack>
            </Paper>

            <Paper withBorder p="md">
              <Text fw={700} mb="sm">Descriere</Text>
              {doc.descriere ? (
                <div dangerouslySetInnerHTML={{ __html: doc.descriere }} />
              ) : (
                <Text c="dimmed">Nu exista descriere</Text>
              )}
            </Paper>

            <Paper withBorder p="md">
              <Text fw={700} mb="sm">Fisiere</Text>
              {doc.files.length === 0 ? (
                <Text c="dimmed">Nu exista fisiere</Text>
              ) : (
                <Stack gap="xs">
                  {doc.files.map((file) => (
                    <Group key={file.file_id} justify="space-between">
                      <Group gap="xs">
                        <IconFile size={16} />
                        <Text size="sm">{file.filename}</Text>
                      </Group>
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => handleDownloadFile(file.file_id, file.filename)}
                      >
                        <IconDownload size={16} />
                      </ActionIcon>
                    </Group>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            <WorkflowSidebarGeneric
              document={doc}
              docType="paap"
              onRefresh={loadPaap}
            />
          </Stack>
        </Grid.Col>
      </Grid>

      <Modal
        opened={editModalOpened}
        onClose={() => setEditModalOpened(false)}
        title="Editeaza PAAP"
        size="lg"
      >
        <SimpleDocumentForm
          apiBase="/api/procurement/paap"
          initialData={doc}
          onSubmit={handleUpdate}
          onCancel={() => setEditModalOpened(false)}
          loading={saving}
          submitLabel="Salveaza"
        />
      </Modal>

      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Confirmare stergere"
        centered
      >
        <Text size="sm" mb="md">
          Esti sigur ca vrei sa stergi documentul <strong>{doc.titlu}</strong>?
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setDeleteModalOpened(false)}>
            Anuleaza
          </Button>
          <Button color="red" onClick={confirmDelete}>
            Sterge
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
