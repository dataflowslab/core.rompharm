import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Paper, Title, Tabs, Button, Group, Badge, Text, Grid, TextInput, Select, Textarea } from '@mantine/core';
import { IconArrowLeft, IconFileText, IconSignature } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { notifications } from '@mantine/notifications';

interface Request {
  _id: string;
  reference: string;
  source: number;
  destination: number;
  items: any[];
  line_items: number;
  status: string;
  notes: string;
  issue_date: string;
  created_at: string;
  created_by: string;
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
            onClick={() => navigate('/web/requests')}
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
                value={String(request.source)}
                readOnly
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Destination Location')}
                value={String(request.destination)}
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
                <Paper withBorder p="md">
                  {request.items.map((item, index) => (
                    <Group key={index} mb="sm">
                      <Text><strong>{t('Part')}:</strong> {item.part}</Text>
                      <Text><strong>{t('Quantity')}:</strong> {item.quantity}</Text>
                      {item.notes && <Text><strong>{t('Notes')}:</strong> {item.notes}</Text>}
                    </Group>
                  ))}
                </Paper>
              ) : (
                <Text size="sm" c="dimmed">{t('No items')}</Text>
              )}
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="approval" pt="md">
          <Text size="sm" c="dimmed">{t('Approval flow will be implemented here')}</Text>
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
}
