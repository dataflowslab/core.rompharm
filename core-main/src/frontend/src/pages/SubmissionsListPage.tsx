import { useEffect, useState, useMemo } from 'react';
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
  Select,
  Paper,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconEye, IconArrowUp, IconArrowDown, IconSelector, IconSearch, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

type SortField = 'submitted_at' | 'form_title' | 'submitted_by' | 'state';
type SortDirection = 'asc' | 'desc';

export function SubmissionsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [formFilter, setFormFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('submitted_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadSubmissions();
    // Set form filter from URL params
    const formParam = searchParams.get('form');
    if (formParam) {
      setFormFilter(formParam);
    }
  }, [searchParams]);

  const loadSubmissions = async () => {
    try {
      const response = await api.get('/api/data/submissions/all');
      setSubmissions(response.data);
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

  // Get unique forms for filter dropdown
  const formOptions = useMemo(() => {
    const uniqueForms = new Map<string, string>();
    submissions.forEach(sub => {
      if (!uniqueForms.has(sub.form_id)) {
        uniqueForms.set(sub.form_id, sub.form_title);
      }
    });
    return [
      { value: '', label: t('All Forms') },
      ...Array.from(uniqueForms.entries()).map(([id, title]) => ({
        value: id,
        label: title
      }))
    ];
  }, [submissions, t]);

  // Filter by date range from URL params
  const filteredByDate = useMemo(() => {
    const filter = searchParams.get('filter');
    if (!filter || filter === 'all') return submissions;

    const now = new Date();
    let cutoffDate: Date;

    if (filter === '7days') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (filter === '30days') {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      return submissions;
    }

    return submissions.filter(sub => new Date(sub.submitted_at) >= cutoffDate);
  }, [submissions, searchParams]);

  // Filter by form
  const filteredByForm = useMemo(() => {
    if (!formFilter) return filteredByDate;
    return filteredByDate.filter(sub => sub.form_id === formFilter);
  }, [filteredByDate, formFilter]);

  // Search in submissions
  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return filteredByForm;

    const query = searchQuery.toLowerCase();
    return filteredByForm.filter(sub => {
      // Search in form title
      if (sub.form_title.toLowerCase().includes(query)) return true;
      
      // Search in submitted_by
      if (sub.submitted_by?.toLowerCase().includes(query)) return true;
      
      // Search in state
      if (STATE_LABELS[sub.state]?.toLowerCase().includes(query)) return true;
      
      return false;
    });
  }, [filteredByForm, searchQuery]);

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
        case 'form_title':
          aVal = a.form_title.toLowerCase();
          bVal = b.form_title.toLowerCase();
          break;
        case 'submitted_by':
          aVal = (a.submitted_by || '').toLowerCase();
          bVal = (b.submitted_by || '').toLowerCase();
          break;
        case 'state':
          aVal = a.state;
          bVal = b.state;
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
          <Title order={2}>{t('All Submissions')}</Title>
          <Group>
            <TextInput
              placeholder={t('Search...')}
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
              w={250}
            />
            <Select
              placeholder={t('Filter by form')}
              data={formOptions}
              value={formFilter}
              onChange={setFormFilter}
              clearable
              w={250}
            />
          </Group>
        </Group>

        {sortedSubmissions.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No submissions')}>
            {searchQuery || formFilter ? t('No submissions found matching your criteria.') : t('No submissions found.')}
          </Alert>
        ) : (
          <Paper shadow="sm" withBorder>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
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
                    onClick={() => handleSort('form_title')}
                  >
                    <Group gap="xs">
                      {t('Form')}
                      {getSortIcon('form_title')}
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
                      <Text size="sm">{formatDate(submission.submitted_at)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{submission.form_title}</Text>
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
