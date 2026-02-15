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
  Modal,
  Text,
  Stack,
  Tabs,
  Table,
  ActionIcon,
  Paper,
} from '@mantine/core';
import { 
  IconArrowLeft, 
  IconAlertCircle, 
  IconCheck, 
  IconClock, 
  IconX,
  IconFileText,
  IconHistory,
  IconEye,
  IconPlus,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { FundamentareForm } from './FundamentareForm';
import { SectionBForm } from './SectionBForm';
import { DocumentInfo } from './components/DocumentInfo';
import { WorkflowSidebar } from './components/WorkflowSidebar';
import { WorkflowSidebarNew } from './components/WorkflowSidebarNew';
import { ActivityTimelineNew } from './components/ActivityTimelineNew';
import { OrdonatorDecisionModal } from './components/OrdonatorDecisionModal';
import { useDocumentStates } from './hooks/useDocumentStates';

interface DocumentData {
  _id: string;
  titlu_document: string;
  nr_inreg: string;
  revizia: number;
  revision?: number;
  parent_doc_id?: string;
  is_latest_revision?: boolean;
  data_reviziei: string | null;
  compartiment: string;
  descriere: string;
  stare: string;
  created_at: string;
  created_by: string;
  form_data: any;
  error?: string;
  pdf_path?: string;
  pdf_a_signed_path?: string;
  // Secțiunea B
  form_data_b?: any;
  stare_b?: string;
  error_b?: string;
  pdf_b_path?: string;
  pdf_b_signed_path?: string;
  // Casuta 5 - Ordonator
  rezultat_ordonator?: 'Aprobat' | 'Anulat' | 'Respins';
  motiv_ordonator?: string;
  pdf_ordonator_signed_path?: string;
  // Casuta 6 - Final
  pdf_final_signed_path?: string;
  finalizat?: boolean;
}

interface Revision {
  id: string;
  revision: number;
  nr_inreg: string;
  titlu_document: string;
  data_reviziei: string;
  stare: string;
  is_latest_revision: boolean;
  created_at: string;
  created_by: string;
  can_delete: boolean;
  can_cancel: boolean;
}

interface RevisionsTabProps {
  documentId: string;
  currentRevision: number;
  revisions: Revision[];
  loading: boolean;
  onLoadRevisions: () => void;
}

function RevisionsTab({ documentId, currentRevision, revisions, loading, onLoadRevisions }: RevisionsTabProps) {
  const navigate = useNavigate();
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [creatingRevision, setCreatingRevision] = useState(false);

  useEffect(() => {
    if (!loadedOnce) {
      onLoadRevisions();
      setLoadedOnce(true);
    }
  }, [loadedOnce, onLoadRevisions]);

  const handleCreateRevision = async () => {
    if (!confirm('Crearea unei revizii noi va face reviziile anterioare inoperabile. Ești sigur(ă) că vrei să creezi o revizie nouă?')) {
      return;
    }

    try {
      setCreatingRevision(true);
      const response = await api.post(`/api/procurement/fundamentare/${documentId}/create-revision`);
      
      notifications.show({
        title: 'Succes',
        message: `Revizia ${response.data.revision} creată cu succes`,
        color: 'green',
      });

      // Navigate to the new revision
      navigate(`/procurement/fundamentare/${response.data.new_doc_id}`);
    } catch (error: any) {
      console.error('Failed to create revision:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut crea revizia',
        color: 'red',
      });
    } finally {
      setCreatingRevision(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; size: string }> = {
      'Nouă': { color: 'gray', size: 'sm' },
      Draft: { color: 'gray', size: 'sm' },
      Compilare: { color: 'blue', size: 'sm' },
      Finalizat: { color: 'green', size: 'sm' },
      Eroare: { color: 'red', size: 'sm' },
      Anulat: { color: 'orange', size: 'sm' },
    };

    const config = statusConfig[status] || { color: 'gray', size: 'sm' };

    return (
      <Badge color={config.color} variant="filled" size={config.size as any}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Paper withBorder p="md">
        <Group justify="center" p="xl">
          <Loader size="md" />
        </Group>
      </Paper>
    );
  }

  if (revisions.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text c="dimmed" ta="center">
          Nu există revizii pentru acest document
        </Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      {/* Buton creare revizie - doar pentru Semnat C */}
      {revisions.length > 0 && revisions[0].is_latest_revision && revisions[0].stare === 'Semnat C' && (
        <Group justify="flex-end" mb="md">
          <Button
            leftSection={<IconPlus size={16} />}
            color="green"
            onClick={handleCreateRevision}
            loading={creatingRevision}
          >
            Crează revizie
          </Button>
        </Group>
      )}
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Revizie</Table.Th>
            <Table.Th>Data</Table.Th>
            <Table.Th>Stare</Table.Th>
            <Table.Th>Creat de</Table.Th>
            <Table.Th>Acțiuni</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {revisions.map((rev) => (
            <Table.Tr 
              key={rev.id}
              style={{ 
                backgroundColor: rev.is_latest_revision ? '#f0f9ff' : undefined,
                fontWeight: rev.is_latest_revision ? 500 : undefined
              }}
            >
              <Table.Td>
                {rev.revision === 0 ? (
                  <Text size="sm">Inițială</Text>
                ) : (
                  <Text size="sm">Revizia {rev.revision}</Text>
                )}
                {rev.is_latest_revision && (
                  <Badge color="blue" size="xs" ml="xs">Actuală</Badge>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm">{rev.data_reviziei}</Text>
              </Table.Td>
              <Table.Td>{getStatusBadge(rev.stare)}</Table.Td>
              <Table.Td>
                <Text size="sm">{rev.created_by}</Text>
              </Table.Td>
              <Table.Td>
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  size="sm"
                  onClick={() => navigate(`/procurement/fundamentare/${rev.id}`)}
                  title="Vizualizează revizie"
                >
                  <IconEye size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

export function FundamentareDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getStateColor, getStateIcon } = useDocumentStates();
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [editSectionBModalOpened, setEditSectionBModalOpened] = useState(false);
  const [editSectionCModalOpened, setEditSectionCModalOpened] = useState(false);
  const [ordonatorModalOpened, setOrdonatorModalOpened] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingOrdonator, setUploadingOrdonator] = useState(false);
  const [uploadingFinal, setUploadingFinal] = useState(false);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('details');

  useEffect(() => {
    if (id) {
      loadDocument();
    }
  }, [id]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/procurement/fundamentare/${id}`);
      setDocument(response.data);
    } catch (error: any) {
      console.error('Failed to load document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut încărca documentul',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReprocessA = async () => {
    if (!document || !id) return;

    try {
      await api.post(`/api/procurement/fundamentare/${id}/reprocess`);
      
      notifications.show({
        title: 'Succes',
        message: 'Documentul a fost trimis pentru reprocesare',
        color: 'green',
      });

      setTimeout(() => {
        loadDocument();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to reprocess document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut reprocesa documentul',
        color: 'red',
      });
    }
  };

  const handleCasuta1Click = () => {
    // Check if this is a previous revision (not the latest)
    if (document?.revision !== undefined && document.revision > 0 && !document.is_latest_revision) {
      notifications.show({
        title: 'Atenție',
        message: 'Nu poți modifica o revizie anterioară. Doar cea mai nouă revizie poate fi editată.',
        color: 'orange',
      });
      return;
    }

    // Check if revision is cancelled
    if (document?.stare === 'Anulat') {
      notifications.show({
        title: 'Atenție',
        message: 'Nu poți modifica o revizie anulată.',
        color: 'orange',
      });
      return;
    }

    if (document?.pdf_a_signed_path) {
      notifications.show({
        title: 'Atenție',
        message: 'Nu poți modifica formularul după ce PDF-ul semnat a fost încărcat. Șterge mai întâi PDF-ul semnat.',
        color: 'orange',
      });
      return;
    }

    if (document?.stare === 'Eroare' || !document?.pdf_path) {
      setEditModalOpened(true);
    } else if (document?.pdf_path) {
      window.open(`/${document.pdf_path}`, '_blank');
    }
  };

  const handleFormUpdate = async (formData: any) => {
    if (!document || !id) return;

    try {
      await api.put(`/api/procurement/fundamentare/${id}`, {
        titlu_document: formData.titluDocument,
        nr_inreg: formData.nrUnicInreg,
        revizia: formData.revizia,
        data_reviziei: formData.dataReviziei,
        compartiment: formData.compartiment,
        descriere: formData.descriereScurta || formData.titluDocument,
        form_data: formData,
      });

      notifications.show({
        title: 'Succes',
        message: 'Formularul a fost actualizat',
        color: 'green',
      });

      setEditModalOpened(false);
      await handleReprocessA();
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

  const handleSectionBUpdate = async (formData: any) => {
    if (!document || !id) return;

    try {
      await api.post(`/api/procurement/fundamentare/${id}/process-section-b`, {
        form_data: formData,
      });

      notifications.show({
        title: 'Succes',
        message: 'Secțiunea B a fost salvată și trimisă pentru procesare',
        color: 'green',
      });

      setEditSectionBModalOpened(false);
      setTimeout(() => {
        loadDocument();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to update Section B:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut actualiza Secțiunea B',
        color: 'red',
      });
    }
  };

  const handleSignedPdfUpload = async (files: File[]) => {
    if (!document || !id || files.length === 0) return;

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
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', `${document.nr_inreg}_A_semnat`);
      formData.append('main', 'false');

      const response = await api.post('/api/library/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Attach file using hash
      await api.post(`/api/procurement/fundamentare/${id}/attach-file`, null, {
        params: {
          file_hash: response.data.hash,
          doc_type: 'section_a_signed'
        }
      });

      notifications.show({
        title: 'Succes',
        message: 'PDF-ul semnat a fost încărcat cu succes',
        color: 'green',
      });

      loadDocument();
    } catch (error: any) {
      console.error('Failed to upload signed PDF:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut încărca PDF-ul',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSignedPdfBUpload = async (files: File[]) => {
    if (!document || !id || files.length === 0) return;

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
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', `${document.nr_inreg}_B_semnat`);
      formData.append('main', 'false');

      const response = await api.post('/api/library/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Attach file using hash
      await api.post(`/api/procurement/fundamentare/${id}/attach-file`, null, {
        params: {
          file_hash: response.data.hash,
          doc_type: 'section_b_signed'
        }
      });

      notifications.show({
        title: 'Succes',
        message: 'PDF-ul semnat B a fost încărcat cu succes',
        color: 'green',
      });

      loadDocument();
    } catch (error: any) {
      console.error('Failed to upload signed PDF B:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut încărca PDF-ul',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSignedPdfB = async () => {
    if (!document || !id) return;

    try {
      // Delete Section B signed PDF hash
      await api.post(`/api/procurement/fundamentare/${id}/attach-file`, null, {
        params: {
          file_hash: '',
          doc_type: 'section_b_signed'
        }
      });

      notifications.show({
        title: 'Succes',
        message: 'PDF-ul semnat B a fost șters',
        color: 'green',
      });

      loadDocument();
    } catch (error: any) {
      console.error('Failed to delete signed PDF B:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut șterge PDF-ul',
        color: 'red',
      });
    }
  };

  const handleDeleteSignedPdf = () => {
    setDeleteConfirmOpened(true);
  };

  const confirmDeleteSignedPdf = async () => {
    if (!document || !id) return;

    try {
      // Delete Section A signed PDF hash and also clear Section B data
      await api.post(`/api/procurement/fundamentare/${id}/attach-file`, null, {
        params: {
          file_hash: '',
          doc_type: 'section_a_signed'
        }
      });

      notifications.show({
        title: 'Succes',
        message: 'PDF-ul semnat a fost șters. Secțiunea B a fost resetată.',
        color: 'green',
      });

      setDeleteConfirmOpened(false);
      loadDocument();
    } catch (error: any) {
      console.error('Failed to delete signed PDF:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut șterge PDF-ul',
        color: 'red',
      });
    }
  };

  const handleOrdonatorDecision = async (data: { rezultat: string; motiv?: string }) => {
    if (!document || !id) return;

    try {
      await api.post(`/api/procurement/fundamentare/${id}/ordonator-decision`, {
        rezultat: data.rezultat,
        motiv: data.motiv,
      });

      notifications.show({
        title: 'Succes',
        message: 'Decizia ordonatorului a fost salvată',
        color: 'green',
      });

      setOrdonatorModalOpened(false);
      loadDocument();
    } catch (error: any) {
      console.error('Failed to save ordonator decision:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut salva decizia',
        color: 'red',
      });
    }
  };

  const handleOrdonatorSignedPdfUpload = async (files: File[]) => {
    if (!document || !id || files.length === 0) return;

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
      setUploadingOrdonator(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', `${document.nr_inreg}_Ordonator_semnat`);
      formData.append('main', 'false');

      const response = await api.post('/api/library/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Attach file using hash
      await api.post(`/api/procurement/fundamentare/${id}/attach-file`, null, {
        params: {
          file_hash: response.data.hash,
          doc_type: 'ordonator_signed'
        }
      });

      notifications.show({
        title: 'Succes',
        message: 'PDF-ul semnat de ordonator a fost încărcat cu succes',
        color: 'green',
      });

      loadDocument();
    } catch (error: any) {
      console.error('Failed to upload ordonator signed PDF:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut încărca PDF-ul',
        color: 'red',
      });
    } finally {
      setUploadingOrdonator(false);
    }
  };

  const handleFinalSignedPdfUpload = async (files: File[]) => {
    if (!document || !id || files.length === 0) return;

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
      setUploadingFinal(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', `${document.nr_inreg}_Final_semnat`);
      formData.append('main', 'false');

      const response = await api.post('/api/library/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Attach file using hash and finalize document
      await api.post(`/api/procurement/fundamentare/${id}/attach-file`, null, {
        params: {
          file_hash: response.data.hash,
          doc_type: 'final_signed'
        }
      });

      notifications.show({
        title: 'Succes',
        message: 'PDF-ul final a fost încărcat cu succes. Documentul este finalizat!',
        color: 'green',
      });

      loadDocument();
    } catch (error: any) {
      console.error('Failed to upload final signed PDF:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut încărca PDF-ul final',
        color: 'red',
      });
    } finally {
      setUploadingFinal(false);
    }
  };

  const loadRevisions = async () => {
    if (!id) return;

    try {
      setLoadingRevisions(true);
      const response = await api.get(`/api/procurement/fundamentare/${id}/revisions`);
      setRevisions(response.data);
    } catch (error: any) {
      console.error('Failed to load revisions:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut încărca lista de revizii',
        color: 'red',
      });
    } finally {
      setLoadingRevisions(false);
    }
  };

  const handleSkipStep = async (stepType: string) => {
    if (!id) return;

    // Confirm action
    if (!confirm(`Ești sigur că vrei să marchezi acest pas ca semnat offline? Această acțiune va permite continuarea workflow-ului fără încărcarea efectivă a documentului.`)) {
      return;
    }

    try {
      const response = await api.post(`/api/procurement/fundamentare/${id}/skip-step`, null, {
        params: { step_type: stepType }
      });

      notifications.show({
        title: 'Succes',
        message: response.data.message || 'Pasul a fost sărit cu succes',
        color: 'green',
      });

      loadDocument();
    } catch (error: any) {
      console.error('Failed to skip step:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut sări pasul',
        color: 'red',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    // Map icon names to actual icon components
    const iconMap: Record<string, any> = {
      IconClock,
      IconCheck,
      IconX,
    };

    const iconName = getStateIcon(status);
    const Icon = iconMap[iconName] || IconClock;

    return (
      <Badge color={getStateColor(status)} variant="filled" leftSection={<Icon size={14} />}>
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
        <Button mt="md" onClick={() => navigate('/procurement/fundamentare')}>
          Înapoi la listă
        </Button>
      </Container>
    );
  }

  const getDocumentTitle = () => {
    const baseTitle = `Document fundamentare ${document.nr_inreg}`;
    if (document.revision && document.revision > 0) {
      return `${baseTitle} (rev ${document.revision})`;
    }
    return baseTitle;
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/procurement/fundamentare')}
          >
            Înapoi
          </Button>
          <Title order={2} style={{ fontSize: '1.4rem' }}>{getDocumentTitle()}</Title>
        </Group>
        {getStatusBadge(document.stare)}
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }} order={{ base: 2, md: 1 }}>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="details" leftSection={<IconFileText size={16} />}>
                Detalii Document
              </Tabs.Tab>
              <Tabs.Tab value="revisions" leftSection={<IconHistory size={16} />}>
                Revizii
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="details" pt="md">
              <DocumentInfo document={document} />
            </Tabs.Panel>

            <Tabs.Panel value="revisions" pt="md">
              <RevisionsTab 
                documentId={id!} 
                currentRevision={document.revision || 0}
                revisions={revisions}
                loading={loadingRevisions}
                onLoadRevisions={loadRevisions}
              />
            </Tabs.Panel>
          </Tabs>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }} order={{ base: 1, md: 2 }}>
          <Stack gap="md">
            {/* New Approval Workflow System */}
            <WorkflowSidebarNew
              document={document}
              onEditA={() => setEditModalOpened(true)}
              onEditB={() => setEditSectionBModalOpened(true)}
              onEditC={() => setEditSectionCModalOpened(true)}
              onRefresh={loadDocument}
            />
            
            {/* Old Workflow - Keep for compatibility during transition */}
            {/* <WorkflowSidebar
              document={document}
              uploading={uploading}
              uploadingB={false}
              uploadingOrdonator={uploadingOrdonator}
              uploadingFinal={uploadingFinal}
              onCasuta1Click={handleCasuta1Click}
              onEditClick={() => setEditModalOpened(true)}
              onSignedPdfUpload={handleSignedPdfUpload}
              onDeleteSignedPdf={handleDeleteSignedPdf}
              onCasuta3Click={() => setEditSectionBModalOpened(true)}
              onEditSectionBClick={() => setEditSectionBModalOpened(true)}
              onSignedPdfBUpload={handleSignedPdfBUpload}
              onDeleteSignedPdfB={handleDeleteSignedPdfB}
              onCasuta5Click={() => setOrdonatorModalOpened(true)}
              onOrdonatorSignedPdfUpload={handleOrdonatorSignedPdfUpload}
              onCasuta6Click={() => {}}
              onFinalSignedPdfUpload={handleFinalSignedPdfUpload}
              onRefresh={loadDocument}
            /> */}
            
            <ActivityTimelineNew document={document} />
          </Stack>
        </Grid.Col>
      </Grid>

      {/* Modal for editing form data */}
      <Modal
        opened={editModalOpened}
        onClose={() => setEditModalOpened(false)}
        title="Editează Formularul - Secțiunea A"
        size="90%"
        styles={{
          body: { maxHeight: '80vh', overflowY: 'auto' }
        }}
      >
        {document && document.form_data && (
          <FundamentareForm
            onSubmit={handleFormUpdate}
            onCancel={() => setEditModalOpened(false)}
            initialData={document.form_data}
            showSectionB={false}
          />
        )}
      </Modal>

      {/* Modal for editing Section B */}
      <Modal
        opened={editSectionBModalOpened}
        onClose={() => setEditSectionBModalOpened(false)}
        title="Editează Formularul - Secțiunea B"
        size="90%"
        styles={{
          body: { maxHeight: '80vh', overflowY: 'auto' }
        }}
      >
        <SectionBForm
          onSubmit={handleSectionBUpdate}
          onCancel={() => setEditSectionBModalOpened(false)}
          initialData={document?.form_data_b || {}}
        />
      </Modal>

      {/* Modal for delete confirmation */}
      <Modal
        opened={deleteConfirmOpened}
        onClose={() => setDeleteConfirmOpened(false)}
        title="Confirmare ștergere"
        centered
      >
        <Text size="sm" mb="md">
          Ești sigur că vrei să ștergi PDF-ul semnat? Această acțiune nu poate fi anulată.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setDeleteConfirmOpened(false)}>
            Anulează
          </Button>
          <Button color="red" onClick={confirmDeleteSignedPdf}>
            Șterge
          </Button>
        </Group>
      </Modal>

      {/* Modal for editing Section C */}
      <Modal
        opened={editSectionCModalOpened}
        onClose={() => setEditSectionCModalOpened(false)}
        title="Editează Formularul - Secțiunea C"
        size="90%"
        styles={{
          body: { maxHeight: '80vh', overflowY: 'auto' }
        }}
      >
        <Paper withBorder p="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Secțiunea C este pentru validarea finală a documentului.
            </Text>
            <Text size="sm">
              Momentan, această secțiune nu necesită date suplimentare.
              Folosește butoanele de semnare din workflow pentru a aproba documentul.
            </Text>
            <Group justify="flex-end">
              <Button onClick={() => setEditSectionCModalOpened(false)}>
                Închide
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Modal>

      {/* Modal for Ordonator Decision */}
      <OrdonatorDecisionModal
        opened={ordonatorModalOpened}
        onClose={() => setOrdonatorModalOpened(false)}
        onSubmit={handleOrdonatorDecision}
      />
    </Container>
  );
}
