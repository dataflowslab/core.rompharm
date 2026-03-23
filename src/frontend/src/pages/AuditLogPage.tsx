import { useEffect, useState } from 'react';
import { Container, Title, Paper, Table, Loader, Alert, Text, Stack, Button, Group, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { hasSectionPermission } from '../utils/permissions';
import { debounce } from '../utils/selectHelpers';

interface AuditLog {
  id: string;
  action: string;
  username?: string;
  ip_address?: string;
  timestamp: string;
  resource_type?: string;
  resource_id?: string;
}

export function AuditLogPage() {
  const { roleSections } = useAuth();
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const limit = 50;
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

  const canViewAudit = hasSectionPermission(roleSections, 'audit', 'get');
  const loadLogs = () => {
    if (!canViewAudit) {
      setLoading(false);
      return;
    }
    const params: any = { limit, skip };
    if (search) params.search = search;
    if (dateRange[0]) params.date_from = dateRange[0].toISOString().split('T')[0];
    if (dateRange[1]) params.date_to = dateRange[1].toISOString().split('T')[0];

    api.get('/api/audit/', { params })
      .then((response) => {
        setLogs(response.data.logs);
        setTotal(response.data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLogs();
  }, [canViewAudit, skip, search, dateRange]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const loadMore = () => {
    setSkip(skip + limit);
  };

  const debouncedSearch = debounce((value: string) => {
    setSearch(value);
    setSkip(0);
  }, 300);

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading audit logs...')}</Text>
        </Stack>
      </Container>
    );
  }

  if (!canViewAudit) {
    return (
      <Container size="md" mt={50}>
        <Alert icon={<IconAlertCircle size={16} />} title={t('Access Denied')} color="red">
          {t('Access Denied')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Title order={2}>{t('Activity Log')}</Title>

        <Paper p="md">
          <Group>
            <TextInput
              placeholder={t('Search by action, username or IP...')}
              value={searchInput}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setSearchInput(value);
                debouncedSearch(value);
              }}
              style={{ flex: 1 }}
            />
            <DatePickerInput
              type="range"
              placeholder={t('Date range')}
              value={dateRange}
              onChange={(value) => {
                setDateRange(value);
                setSkip(0);
              }}
              clearable
              style={{ minWidth: '220px' }}
            />
          </Group>
        </Paper>

        {logs.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No audit logs found')}>
            {t('No audit logs found')}
          </Alert>
        ) : (
          <>
            <Paper shadow="sm" p="md" radius="md" withBorder>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('Timestamp')}</Table.Th>
                    <Table.Th>{t('Action')}</Table.Th>
                    <Table.Th>{t('Username')}</Table.Th>
                    <Table.Th>{t('IP Address')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {logs.map((log) => (
                    <Table.Tr key={log.id}>
                      <Table.Td>{formatDate(log.timestamp)}</Table.Td>
                      <Table.Td><Text size="sm" fw={500}>{log.action}</Text></Table.Td>
                      <Table.Td>{log.username || '-'}</Table.Td>
                      <Table.Td><Text size="sm" c="dimmed">{log.ip_address || '-'}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>

            {skip + limit < total && (
              <Group justify="center">
                <Button onClick={loadMore}>{t('Load More')}</Button>
              </Group>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
