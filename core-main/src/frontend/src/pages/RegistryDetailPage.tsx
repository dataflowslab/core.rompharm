import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Table,
  Badge,
  Stack,
  Loader,
  Alert,
  Text,
  ActionIcon,
  Group,
  Paper,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconEye, IconArrowUp, IconArrowDown, IconSelector, IconSearch, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';

interface Submission {
  id: string;
  form_id: string;
  form_title: string;
  form_slug: string;
  submitted_by?: string;
  submitted_at: string;
  state: string;
  state_updated_at?: string;
  state_updated_by?: string;
  registry_number?: number;
}

const STATE_COLORS: Record<string, string> = {
  new: 'blue',
  in_review: 'yellow',
  approved: 'green',
  rejected: 'red',
  cancelled: 'gray'
};

const STATE_LABELS: Record<string, string> = {
  new: 'Nou',
  in_review: 'În analiză',
  approved: 'Aprobat',
  rejected: 'Respins',
  cancelled: 'Anulat'
};

type SortField = 'submitted_at' | 'submitted_by' | 'state' | 'registry_number';
type SortDirection = 'asc' | 'desc';

export function RegistryDetailPage() {
  const { registryId } = useParams<{ registryId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [formTitle, setFormTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('registry_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    if (registryId) {
      loadSubmissions();
    }
  }, [registryId]);

  const loadSubmissions = async () => {
    try {
      const response = await api.get('/api/data/submissions/all');
      const allSubmissions = response.data;

      // Filter by form_id (registryId)
      const filtered = allSubmissions.filter((sub: Submission) => sub.form_id === registryId);
      
      setSubmissions(filtered);
      
      // Set form title from first submission
      if (filtered.length > 0) {
        setFormTitle(filtered[0].form_title);
      }
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to load submissions'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Search in submissions
  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return submissions;

    const query = searchQuery.toLowerCase();
    return submissions.filter(sub => {
      // Search in registry number
      if (sub.registry_number?.toString().includes(query)) return true;
      
      // Search in submitted_by
      if (sub.submitted_by?.toLowerCase().includes(query)) return true;
      
      // Search in state
      if (STATE_LABELS[sub.state]?.toLowerCase().includes(query)) return true;
      
      return false;
    });
  }, [submissions, searchQuery]);

  // Sort submissions
  const sortedSubmissions = useMemo(() => {
    const sorted = [...filteredSubmissions];
    sorted.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'submitted_at':
          aVal = new Date(a.submitted_at).getTime();
          bVal = new Date(b.submitted_at).getTime();
          break;
        case 'submitted_by':
          aVal = (a.submitted_by || '').toLowerCase();
          bVal = (b.submitted_by || '').toLowerCase();
          break;
        case 'state':
          aVal = a.state;
          bVal = b.state;
          break;
        case 'registry_number':
          aVal = a.registry_number || 0;
          bVal = b.registry_number || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredSubmissions, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <IconSelector size={14} />;
    return sortDirection === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
  };

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

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading submissions...')}</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Group justify="space-between">
          <Title order={2}>{t('Registry')}: {formTitle}</Title>
          <TextInput
            placeholder={t('Search in registry...')}
            leftSection={<IconSearch size={16} />}
            rightSection={
              searchQuery && (
                <ActionIcon
                  variant="subtle"
                  onClick={() => setSearchQuery('')}
                  size="sm"
                >
                  <IconX size={14} />
                </ActionIcon>
              )
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            w={300}
          />
        </Group>

        {sortedSubmissions.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No submissions')}>
            {searchQuery ? t('No submissions found matching your search.') : t('No submissions found.')}
          </Alert>
        ) : (
          <Paper shadow="sm" withBorder>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('registry_number')}
                  >
                    <Group gap="xs">
                      {t('Registry #')}
                      {getSortIcon('registry_number')}
                    </Group>
                  </Table.Th>
                  <Table.Th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('submitted_at')}
                  >
                    <Group gap="xs">
                      {t('Submitted At')}
                      {getSortIcon('submitted_at')}
                    </Group>
                  </Table.Th>
                  <Table.Th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('submitted_by')}
                  >
                    <Group gap="xs">
                      {t('Author')}
                      {getSortIcon('submitted_by')}
                    </Group>
                  </Table.Th>
                  <Table.Th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('state')}
                  >
                    <Group gap="xs">
                      {t('State')}
                      {getSortIcon('state')}
                    </Group>
                  </Table.Th>
                  <Table.Th>{t('Actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedSubmissions.map((submission) => (
                  <Table.Tr key={submission.id}>
                    <Table.Td>
                      <Text fw={700} size="lg">#{submission.registry_number}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatDate(submission.submitted_at)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{submission.submitted_by || t('Anonymous')}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Badge color={STATE_COLORS[submission.state] || 'gray'} size="sm">
                          {STATE_LABELS[submission.state] || submission.state}
                        </Badge>
                        {submission.state_updated_at && (
                          <Text size="xs" c="dimmed">
                            {formatDate(submission.state_updated_at)}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="blue"
                        onClick={() => navigate(`/submission/${submission.id}`)}
                        title={t('View details')}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
