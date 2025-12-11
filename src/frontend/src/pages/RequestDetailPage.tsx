import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Paper, Title, Tabs, Button, Group, Badge, Text, Grid, TextInput, Textarea, Table } from '@mantine/core';
import { IconArrowLeft, IconFileText, IconSignature, IconTruck, IconPackage } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { notifications } from '@mantine/notifications';
import { ApprovalsTab } from '../components/Requests/ApprovalsTab';
import { OperationsTab } from '../components/Requests/OperationsTab';
import { ReceptieTab } from '../components/Requests/ReceptieTab';

interface StockLocation {
  pk: number;
  name: string;
}

interface Part {
  pk: number;
  name: string;
  IPN: string;
}

interface RequestItem {
  part: number;
  quantity: number;
  notes?: string;
  part_detail?: Part;
}

interface Request {
  _id: string;
  reference: string;
  source: number;
  destination: number;
  items: RequestItem[];
  line_items: number;
  status: string;
  notes: string;
  issue_date: string;
  created_at: string;
  created_by: string;
  source_detail?: StockLocation;
  destination_detail?: StockLocation;
}

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('details');

  useEffect(() => {
    if (id) {
      loadRequest();
    }
  }, [id]);

  const loadRequest = async () => {
    try {
      const response = await api.get(`/api/requests/${id}`);
      setRequest(response.data);
    } catch (error) {
      console.error('Failed to load request:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load request'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
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

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return <Paper p="md"><Text>{t('Loading...')}</Text></Paper>;
  }

  if (!request) {
    return <Paper p="md"><Text>{t('Request not found')}</Text></Paper>;
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/requests')}
          >
            {t('Back')}
          </Button>
          <Title order={2}>{request.reference}</Title>
          <Badge color={getStatusColor(request.status)} size="lg">
            {request.status}
          </Badge>
        </Group>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="details" leftSection={<IconFileText size={16} />}>
            {t('Details')}
          </Tabs.Tab>
          <Tabs.Tab value="approval" leftSection={<IconSignature size={16} />}>
            {t('Approval')}
          </Tabs.Tab>
          {request.status === 'Approved' && (
            <Tabs.Tab value="operations" leftSection={<IconTruck size={16} />}>
              {t('Operations')}
            </Tabs.Tab>
          )}
          {request.status === 'Finished' && (
            <Tabs.Tab value="reception" leftSection={<IconPackage size={16} />}>
              {t('Reception')}
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label={t('Reference')}
                value={request.reference}
                readOnly
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Status')}
                value={request.status}
                readOnly
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Source Location')}
                value={request.source_detail?.name || String(request.source)}
                readOnly
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Destination Location')}
                value={request.destination_detail?.name || String(request.destination)}
                readOnly
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Issue Date')}
                value={formatDate(request.issue_date)}
                readOnly
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Created By')}
                value={request.created_by}
                readOnly
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <Textarea
                label={t('Notes')}
                value={request.notes || ''}
                readOnly
                minRows={3}
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <Title order={4} mb="md">{t('Items')}</Title>
              {request.items && request.items.length > 0 ? (
                <Table striped withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('Part')}</Table.Th>
                      <Table.Th>{t('IPN')}</Table.Th>
                      <Table.Th>{t('Quantity')}</Table.Th>
                      <Table.Th>{t('Notes')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {request.items.map((item, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>{item.part_detail?.name || item.part}</Table.Td>
                        <Table.Td>{item.part_detail?.IPN || '-'}</Table.Td>
                        <Table.Td>{item.quantity}</Table.Td>
                        <Table.Td>{item.notes || '-'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text size="sm" c="dimmed">{t('No items')}</Text>
              )}
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="approval" pt="md">
          {id && <ApprovalsTab requestId={id} onReload={loadRequest} />}
        </Tabs.Panel>

        {request.status === 'Approved' && (
          <Tabs.Panel value="operations" pt="md">
            {id && <OperationsTab requestId={id} onReload={loadRequest} />}
          </Tabs.Panel>
        )}

        {request.status === 'Finished' && (
          <Tabs.Panel value="reception" pt="md">
            {id && <ReceptieTab requestId={id} onReload={loadRequest} />}
          </Tabs.Panel>
        )}
      </Tabs>
    </Paper>
  );
}
