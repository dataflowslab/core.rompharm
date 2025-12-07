import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Button,
  Table,
  Group,
  Stack,
  ActionIcon,
  Badge,
  Alert,
  Loader,
  Text
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconSend, IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import { ConfirmModal } from '../components/Common/ConfirmModal';
import { CampaignModal } from '../components/CRM/CampaignModal';

interface Campaign {
  id: string;
  type: string;
  title: string;
  message: string;
  segment_id: string;
  image?: string;
  link?: string;
  status: string;
  sent_count: number;
  created_at: string;
  sent_at?: string;
}

interface Segment {
  id: string;
  name: string;
}

export function CampaignsPage() {
  const { t } = useTranslation();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [sendConfirmOpened, setSendConfirmOpened] = useState(false);
  const [campaignToSend, setCampaignToSend] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
    loadSegments();
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await api.get('/api/crm/campaigns');
      setCampaigns(response.data);
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to load campaigns'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSegments = async () => {
    try {
      const response = await api.get('/api/crm/segments');
      setSegments(response.data);
    } catch (error) {
      console.error('Failed to load segments:', error);
    }
  };

  const handleOpenModal = (campaign?: Campaign) => {
    setEditingCampaign(campaign || null);
    setModalOpened(true);
  };

  const handleDelete = async () => {
    if (!campaignToDelete) return;

    try {
      await api.delete(`/api/crm/campaigns/${campaignToDelete}`);
      notifications.show({
        title: t('Success'),
        message: t('Campaign deleted successfully'),
        color: 'green'
      });
      loadCampaigns();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete campaign'),
        color: 'red'
      });
    } finally {
      setDeleteConfirmOpened(false);
      setCampaignToDelete(null);
    }
  };

  const handleSend = async () => {
    if (!campaignToSend) return;

    try {
      await api.post(`/api/crm/campaigns/${campaignToSend}/send`);
      notifications.show({
        title: t('Success'),
        message: t('Campaign marked for sending. It will be processed by the cron job.'),
        color: 'green'
      });
      loadCampaigns();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to send campaign'),
        color: 'red'
      });
    } finally {
      setSendConfirmOpened(false);
      setCampaignToSend(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'gray',
      sending: 'blue',
      sent: 'green'
    };
    return <Badge color={colors[status] || 'gray'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Title order={3}>{t('Loading campaigns...')}</Title>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Group justify="space-between">
          <Title order={2}>{t('Campaigns')}</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => handleOpenModal()}
          >
            {t('Add Campaign')}
          </Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Title')}</Table.Th>
              <Table.Th>{t('Type')}</Table.Th>
              <Table.Th>{t('Segment')}</Table.Th>
              <Table.Th>{t('Status')}</Table.Th>
              <Table.Th>{t('Sent Count')}</Table.Th>
              <Table.Th>{t('Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {campaigns.map((campaign) => {
              const segment = segments.find(s => s.id === campaign.segment_id);
              return (
                <Table.Tr key={campaign.id}>
                  <Table.Td>{campaign.title}</Table.Td>
                  <Table.Td>
                    <Badge variant="light">{campaign.type}</Badge>
                  </Table.Td>
                  <Table.Td>{segment?.name || '-'}</Table.Td>
                  <Table.Td>{getStatusBadge(campaign.status)}</Table.Td>
                  <Table.Td>{campaign.sent_count}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {campaign.status === 'draft' && (
                        <>
                          <ActionIcon
                            color="blue"
                            onClick={() => handleOpenModal(campaign)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            color="green"
                            onClick={() => {
                              setCampaignToSend(campaign.id);
                              setSendConfirmOpened(true);
                            }}
                          >
                            <IconSend size={16} />
                          </ActionIcon>
                          <ActionIcon
                            color="red"
                            onClick={() => {
                              setCampaignToDelete(campaign.id);
                              setDeleteConfirmOpened(true);
                            }}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </>
                      )}
                      {campaign.status !== 'draft' && (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        {campaigns.length === 0 && (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No campaigns')}>
            {t('No campaigns found. Create your first campaign to send to subscribers.')}
          </Alert>
        )}
      </Stack>

      <CampaignModal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setEditingCampaign(null);
        }}
        onSuccess={loadCampaigns}
        campaign={editingCampaign}
        segments={segments}
      />

      <ConfirmModal
        opened={deleteConfirmOpened}
        onClose={() => setDeleteConfirmOpened(false)}
        onConfirm={handleDelete}
        title={t('Delete Campaign')}
        message={t('Are you sure you want to delete this campaign?')}
      />

      <ConfirmModal
        opened={sendConfirmOpened}
        onClose={() => setSendConfirmOpened(false)}
        onConfirm={handleSend}
        title={t('Send Campaign')}
        message={t('Are you sure you want to send this campaign? It will be processed by the cron job.')}
      />
    </Container>
  );
}
