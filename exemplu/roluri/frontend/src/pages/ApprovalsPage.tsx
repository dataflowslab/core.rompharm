import { useEffect, useState } from 'react';
import { Container, Title, Paper, Table, Text, Group, ActionIcon, Loader, Button } from '@mantine/core';
import { IconEye, IconRefresh } from '@tabler/icons-react';
import { api } from '../services/api';
import { notifications } from '@mantine/notifications';

interface ApprovalQueueItem {
  flow_id: string;
  flow_name: string;
  flow_type: string;
  object_source: string;
  object_id: string;
  title: string;
  number: string;
  stare: string;
  path: string;
  created_at?: string;
}

export function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/procurement/approval/queue');
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      console.error('Failed to load approvals queue:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut incarca lista de aprobari',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  if (loading) {
    return (
      <Container size="xl">
        <Group justify="center" p="xl">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>Aprobari</Title>
        <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={loadQueue}>
          Reincarca
        </Button>
      </Group>

      <Paper withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tip</Table.Th>
              <Table.Th>Nr.</Table.Th>
              <Table.Th>Titlu</Table.Th>
              <Table.Th>Flux</Table.Th>
              <Table.Th>Stare</Table.Th>
              <Table.Th>Actiuni</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                  <Text c="dimmed">Nu exista aprobari in asteptare</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              items.map((item) => (
                <Table.Tr key={item.flow_id}>
                  <Table.Td>{item.object_source.replace('procurement_', '')}</Table.Td>
                  <Table.Td>{item.number || '-'}</Table.Td>
                  <Table.Td>{item.title || '-'}</Table.Td>
                  <Table.Td>{item.flow_name || item.flow_type || '-'}</Table.Td>
                  <Table.Td>{item.stare || '-'}</Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => window.open(item.path, '_blank')}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Container>
  );
}
