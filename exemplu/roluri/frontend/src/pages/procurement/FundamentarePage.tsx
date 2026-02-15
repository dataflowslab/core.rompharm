import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Table,
  Badge,
  Group,
  Modal,
  ActionIcon,
  Loader,
  Text,
  Paper,
  Collapse,
  Box,
} from '@mantine/core';
import { IconPlus, IconTrash, IconEye, IconChevronDown, IconChevronRight, IconCopy } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { FundamentareForm } from './FundamentareForm';
import { useDocumentStates } from './hooks/useDocumentStates';

interface FundamentareDocument {
  id: string;
  nr_inreg: string;
  revision: number;
  revision_display: string;
  total_revisions: number;
  has_revisions: boolean;
  compartiment: string;
  titlu_document: string;
  descriere: string;
  stare: string;
  stare_id: string | null;
  created_at: string;
  created_by: string;
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

export function FundamentarePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getStateColor } = useDocumentStates();
  const [documents, setDocuments] = useState<FundamentareDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [revisions, setRevisions] = useState<Record<string, Revision[]>>({});
  const [loadingRevisions, setLoadingRevisions] = useState<Set<string>>(new Set());
  const [confirmRevisionModal, setConfirmRevisionModal] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/procurement/fundamentare');
      setDocuments(response.data);
    } catch (error) {
      console.error('Failed to load documents:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load documents'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRevisions = async (docId: string) => {
    if (revisions[docId]) {
      // Already loaded
      return;
    }

    setLoadingRevisions(prev => new Set(prev).add(docId));
    try {
      const response = await api.get(`/api/procurement/fundamentare/${docId}/revisions`);
      setRevisions(prev => ({ ...prev, [docId]: response.data }));
    } catch (error) {
      console.error('Failed to load revisions:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load revisions'),
        color: 'red',
      });
    } finally {
      setLoadingRevisions(prev => {
        const newSet = new Set(prev);
        newSet.delete(docId);
        return newSet;
      });
    }
  };

  const toggleRow = async (docId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(docId)) {
      newExpanded.delete(docId);
    } else {
      newExpanded.add(docId);
      await loadRevisions(docId);
    }
    setExpandedRows(newExpanded);
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      setSubmitting(true);
      await api.post('/api/procurement/fundamentare', {
        titlu_document: formData.titluDocument,
        nr_inreg: formData.nrUnicInreg,
        revizia: formData.revizia,
        data_reviziei: formData.dataReviziei,
        compartiment: formData.compartiment,
        descriere: formData.descriereScurta,
        form_data: formData,
      });

      notifications.show({
        title: t('Success'),
        message: t('Document created successfully'),
        color: 'green',
      });

      setModalOpened(false);
      loadDocuments();
    } catch (error: any) {
      console.error('Failed to create document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to create document'),
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRevision = async (docId: string) => {
    try {
      const response = await api.post(`/api/procurement/fundamentare/${docId}/create-revision`);
      
      notifications.show({
        title: t('Success'),
        message: `Revizia ${response.data.revision} creată cu succes`,
        color: 'green',
      });

      setConfirmRevisionModal(null);
      loadDocuments();
      
      // Navigate to the new revision
      navigate(`/procurement/fundamentare/${response.data.new_doc_id}`);
    } catch (error: any) {
      console.error('Failed to create revision:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to create revision'),
        color: 'red',
      });
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Ești sigur(ă) că vrei să anulezi acest document? Documentul anulat nu mai poate fi modificat.')) {
      return;
    }

    try {
      await api.post(`/api/procurement/fundamentare/${id}/cancel`);
      notifications.show({
        title: t('Success'),
        message: 'Document anulat cu succes',
        color: 'green',
      });
      loadDocuments();
    } catch (error: any) {
      console.error('Failed to cancel document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || 'Nu s-a putut anula documentul',
        color: 'red',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge color={getStateColor(status)} variant="filled" size="sm">
        {status}
      </Badge>
    );
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Fundamentare')}</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setModalOpened(true)}
        >
          {t('Document nou')}
        </Button>
      </Group>

      {loading ? (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      ) : documents.length === 0 ? (
        <Text c="dimmed" ta="center" p="xl">
          {t('No documents found')}
        </Text>
      ) : (
        <Paper withBorder shadow="sm" p="md">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: '40px' }}></Table.Th>
                <Table.Th>#</Table.Th>
                <Table.Th>Nr. Înreg.</Table.Th>
                <Table.Th>Revizie</Table.Th>
                <Table.Th>Departament</Table.Th>
                <Table.Th>Descriere</Table.Th>
                <Table.Th>{t('Stare')}</Table.Th>
                <Table.Th>{t('Actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {documents.map((doc, index) => (
                <>
                  <Table.Tr key={doc.id}>
                    <Table.Td>
                      {doc.has_revisions && (
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => toggleRow(doc.id)}
                        >
                          {expandedRows.has(doc.id) ? (
                            <IconChevronDown size={16} />
                          ) : (
                            <IconChevronRight size={16} />
                          )}
                        </ActionIcon>
                      )}
                    </Table.Td>
                    <Table.Td>{index + 1}</Table.Td>
                    <Table.Td>{doc.nr_inreg}</Table.Td>
                    <Table.Td>
                      {doc.revision === 0 ? (
                        <Text size="sm">{doc.revision_display}</Text>
                      ) : (
                        <Text size="sm" fw={500}>
                          {doc.revision_display}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{doc.compartiment}</Table.Td>
                    <Table.Td>
                      <Box>
                        <Text fw={700} size="sm">{doc.titlu_document}</Text>
                        <Text size="xs" c="dimmed">{doc.descriere}</Text>
                      </Box>
                    </Table.Td>
                    <Table.Td>{getStatusBadge(doc.stare)}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => navigate(`/procurement/fundamentare/${doc.id}`)}
                          title="Vizualizează document"
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                        {/* Buton revizie - doar pentru Semnat C (696bd199e77d73555314a9b6) */}
                        {doc.stare_id === '696bd199e77d73555314a9b6' && (
                          <ActionIcon
                            variant="subtle"
                            color="green"
                            onClick={() => setConfirmRevisionModal(doc.id)}
                            title="Creare revizie nouă"
                          >
                            <IconPlus size={16} />
                          </ActionIcon>
                        )}
                        {/* Buton anulare - doar pentru Nouă (696bd199e77d73555314a9b3) */}
                        {doc.stare_id === '696bd199e77d73555314a9b3' && (
                          <ActionIcon
                            variant="subtle"
                            color="orange"
                            onClick={() => handleCancel(doc.id)}
                            title="Anulează document"
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                  
                  {expandedRows.has(doc.id) && (
                    <Table.Tr>
                      <Table.Td colSpan={8} style={{ padding: 0, backgroundColor: '#f8f9fa' }}>
                        <Collapse in={expandedRows.has(doc.id)}>
                          <Box p="md">
                            {loadingRevisions.has(doc.id) ? (
                              <Group justify="center" p="md">
                                <Loader size="sm" />
                              </Group>
                            ) : (
                              <Table striped size="sm">
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
                                  {revisions[doc.id]?.map((rev) => (
                                    <Table.Tr key={rev.id}>
                                      <Table.Td>
                                        {rev.revision === 0 ? 'Inițială' : `Revizia ${rev.revision}`}
                                      </Table.Td>
                                      <Table.Td>{rev.data_reviziei}</Table.Td>
                                      <Table.Td>{getStatusBadge(rev.stare)}</Table.Td>
                                      <Table.Td>{rev.created_by}</Table.Td>
                                      <Table.Td>
                                        <ActionIcon
                                          variant="subtle"
                                          color="blue"
                                          size="sm"
                                          onClick={() => navigate(`/procurement/fundamentare/${rev.id}`)}
                                        >
                                          <IconEye size={14} />
                                        </ActionIcon>
                                      </Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                            )}
                          </Box>
                        </Collapse>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Modal pentru creare document nou */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Document de Fundamentare"
        size="90%"
        styles={{
          body: { 
            maxHeight: '85vh', 
            overflowY: 'auto', 
            overflowX: 'hidden',
            padding: '0 1rem'
          },
          content: { maxWidth: '90vw' },
        }}
      >
        <FundamentareForm
          onSubmit={handleFormSubmit}
          onCancel={() => setModalOpened(false)}
          showSectionB={false}
        />
      </Modal>

      {/* Modal de confirmare pentru creare revizie */}
      <Modal
        opened={confirmRevisionModal !== null}
        onClose={() => setConfirmRevisionModal(null)}
        title="Confirmare creare revizie"
        size="md"
      >
        <Text mb="md">
          Crearea unei revizii noi va face reviziile anterioare inoperabile. 
          Ești sigur(ă) că vrei să creezi o revizie nouă?
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setConfirmRevisionModal(null)}>
            Anulează
          </Button>
          <Button
            color="blue"
            onClick={() => confirmRevisionModal && handleCreateRevision(confirmRevisionModal)}
          >
            Creează revizie
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
