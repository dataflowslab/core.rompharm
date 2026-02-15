import { useState, useEffect } from 'react';
import { Paper, Title, Table, Group, Badge, ActionIcon, Text } from '@mantine/core';
import { IconEye, IconTrash } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import api from '../services/api';
import { requestsApi } from '../services/requests';
import { notifications } from '@mantine/notifications';
import { formatDate } from '../utils/dateFormat';

interface Request {
  _id: string;
  reference: string;
  source: number;
  destination: number;
  source_name?: string;
  destination_name?: string;
  line_items: number;
  status: string;
  issue_date: string;
  created_at: string;
}

export function BuildOrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      // Pass has_batch_codes=true to filter for build orders
      const response = await api.get(requestsApi.getRequests(), {
        params: { has_batch_codes: true }
      });
      setRequests(response.data.results || []);
    } catch (error) {
      console.error('Failed to load build orders:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load build orders'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (request: Request) => {
    modals.openConfirmModal({
      title: t('Delete Request'),
      children: (
        <Text size="sm">
          {t('Are you sure you want to delete this request?')}
          <br />
          <strong>{request.reference}</strong>
        </Text>
      ),
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(requestsApi.deleteRequest(request._id));
          notifications.show({
            title: t('Success'),
            message: t('Request deleted successfully'),
            color: 'green'
          });
          loadRequests();
        } catch (error: any) {
          console.error('Failed to delete request:', error);
          notifications.show({
            title: t('Error'),
            message: error.response?.data?.detail || t('Failed to delete request'),
            color: 'red'
          });
        }
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'gray';
      case 'Approved': return 'green';
      case 'Refused': return 'red';
      case 'Canceled': return 'orange';
      default: return 'blue';
    }
  };

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Build Orders')}</Title>
      </Group>

      {loading ? (
        <Text>{t('Loading...')}</Text>
      ) : requests.length === 0 ? (
        <Text size="sm" c="dimmed">{t('No build orders found')}</Text>
      ) : (
        <Table striped withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Reference')}</Table.Th>
              <Table.Th>{t('Source')}</Table.Th>
              <Table.Th>{t('Destination')}</Table.Th>
              <Table.Th>{t('Line Items')}</Table.Th>
              <Table.Th>{t('Status')}</Table.Th>
              <Table.Th>{t('Issue Date')}</Table.Th>
              <Table.Th style={{ width: '100px' }}>{t('Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {requests.map((request) => (
              <Table.Tr key={request._id} style={{ cursor: 'pointer' }}>
                <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                  {request.reference}
                </Table.Td>
                <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                  {request.source_name || request.source}
                </Table.Td>
                <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                  {request.destination_name || request.destination}
                </Table.Td>
                <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                  {request.line_items}
                </Table.Td>
                <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                  <Badge color={getStatusColor(request.status)}>{request.status}</Badge>
                </Table.Td>
                <Table.Td onClick={() => navigate(`/requests/${request._id}`)}>
                  {formatDate(request.issue_date)}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => navigate(`/requests/${request._id}`)}
                      title={t('View')}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(request)}
                      title={t('Delete')}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
