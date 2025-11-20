import { useEffect, useState } from 'react';
import { Container, Title, Paper, Table, Loader, Alert, Text, Stack, Badge } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface User {
  id: string;
  username: string;
  is_staff: boolean;
  last_login?: string;
  created_at: string;
}

export function UsersPage() {
  const { isStaff } = useAuth();
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isStaff) {
      api.get('/api/users/')
        .then((response) => setUsers(response.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isStaff]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('Never');
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading users...')}</Text>
        </Stack>
      </Container>
    );
  }

  if (!isStaff) {
    return (
      <Container size="md" mt={50}>
        <Alert icon={<IconAlertCircle size={16} />} title={t('Access Denied')} color="red">
          {t('Administrator access required to view this page.')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Title order={2}>{t('Users List')}</Title>

        {users.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No users found')}>
            {t('No users found')}
          </Alert>
        ) : (
          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Username')}</Table.Th>
                  <Table.Th>{t('Role')}</Table.Th>
                  <Table.Th>{t('Last Login')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>{user.username}</Table.Td>
                    <Table.Td>
                      <Badge color={user.is_staff ? 'blue' : 'gray'}>
                        {user.is_staff ? t('Admin') : t('User')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{formatDate(user.last_login)}</Table.Td>
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
