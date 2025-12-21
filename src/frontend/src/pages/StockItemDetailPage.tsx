import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Tabs,
  Grid,
  Text,
  Badge,
  Group,
  Button,
  Stack,
  Card,
} from '@mantine/core';
import { IconArrowLeft, IconInfoCircle, IconClipboardCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { QCTab } from '../components/Stock/QCTab';

interface StockDetail {
  _id: string;
  part_id: string;
  quantity: number;
  location_id: string;
  batch_code: string;
  supplier_batch_code: string;
  status: number;
  state_id: string;
  supplier_um_id: string;
  notes: string;
  manufacturing_date?: string;
  expected_quantity?: number;
  expiry_date?: string;
  reset_date?: string;
  received_date?: string;
  containers?: any[];
  containers_cleaned?: boolean;
  supplier_ba_no?: string;
  supplier_ba_date?: string;
  accord_ba?: boolean;
  is_list_supplier?: boolean;
  clean_transport?: boolean;
  temperature_control?: boolean;
  temperature_conditions_met?: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  
  // Enriched data
  part_detail?: {
    name: string;
    ipn: string;
    um: string;
  };
  location_detail?: {
    name: string;
    description: string;
  };
  status_detail?: {
    name: string;
    value: number;
    color: string;
  };
  supplier_name?: string;
  stock_value?: number;
}

export function StockItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState<StockDetail | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('details');

  useEffect(() => {
    if (id) {
      fetchStockDetails();
    }
  }, [id]);

  const fetchStockDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/modules/inventory/api/stocks/${id}`);
      setStock(response.data);
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to load stock details',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Text>Loading...</Text>
      </Container>
    );
  }

  if (!stock) {
    return (
      <Container size="xl" py="xl">
        <Text>Stock not found</Text>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(-1)}
          >
            {t('Back')}
          </Button>
          <Title order={2}>{t('Stock Details')}</Title>
        </Group>
        {stock.status_detail && (
          <Badge
            size="lg"
            style={{
              backgroundColor: stock.status_detail.color || '#gray',
              color: '#fff',
            }}
          >
            {stock.status_detail.name}
          </Badge>
        )}
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="details" leftSection={<IconInfoCircle size={16} />}>
            {t('Stock Details')}
          </Tabs.Tab>
          <Tabs.Tab value="qc" leftSection={<IconClipboardCheck size={16} />}>
            {t('QC')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <Stack gap="md">
            {/* Article Information */}
            <Paper shadow="xs" p="md" withBorder>
              <Title order={4} mb="md">{t('Article Information')}</Title>
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Article Name')}</Text>
                  <Text fw={500}>{stock.part_detail?.name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('IPN')}</Text>
                  <Text fw={500}>{stock.part_detail?.ipn || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Unit of Measure')}</Text>
                  <Text fw={500}>{stock.part_detail?.um || '-'}</Text>
                </Grid.Col>
              </Grid>
            </Paper>

            {/* Stock Information */}
            <Paper shadow="xs" p="md" withBorder>
              <Title order={4} mb="md">{t('Stock Information')}</Title>
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Quantity')}</Text>
                  <Text fw={500}>{stock.quantity}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Expected Quantity')}</Text>
                  <Text fw={500}>{stock.expected_quantity || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Location')}</Text>
                  <Text fw={500}>{stock.location_detail?.name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Supplier')}</Text>
                  <Text fw={500}>{stock.supplier_name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Batch Code')}</Text>
                  <Text fw={500}>{stock.batch_code || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Supplier Batch Code')}</Text>
                  <Text fw={500}>{stock.supplier_batch_code || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Stock Value')}</Text>
                  <Text fw={500}>{stock.stock_value ? `${stock.stock_value.toFixed(2)} RON` : '-'}</Text>
                </Grid.Col>
              </Grid>
            </Paper>

            {/* Dates */}
            <Paper shadow="xs" p="md" withBorder>
              <Title order={4} mb="md">{t('Dates')}</Title>
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Manufacturing Date')}</Text>
                  <Text fw={500}>{stock.manufacturing_date || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Received Date')}</Text>
                  <Text fw={500}>{stock.received_date || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Expiry Date')}</Text>
                  <Text fw={500}>{stock.expiry_date || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Reset Date')}</Text>
                  <Text fw={500}>{stock.reset_date || '-'}</Text>
                </Grid.Col>
              </Grid>
            </Paper>

            {/* Containers */}
            {stock.containers && stock.containers.length > 0 && (
              <Paper shadow="xs" p="md" withBorder>
                <Title order={4} mb="md">{t('Containers')}</Title>
                <Stack gap="xs">
                  {stock.containers.map((container: any, index: number) => (
                    <Card key={index} withBorder>
                      <Grid>
                        <Grid.Col span={3}>
                          <Text size="sm" c="dimmed">{t('Num Containers')}</Text>
                          <Text fw={500}>{container.num_containers}</Text>
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <Text size="sm" c="dimmed">{t('Products/Container')}</Text>
                          <Text fw={500}>{container.products_per_container}</Text>
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <Text size="sm" c="dimmed">{t('Unit')}</Text>
                          <Text fw={500}>{container.unit}</Text>
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <Text size="sm" c="dimmed">{t('Value')}</Text>
                          <Text fw={500}>{container.value}</Text>
                        </Grid.Col>
                        <Grid.Col span={12}>
                          <Group gap="xs">
                            {container.is_damaged && <Badge color="red">{t('Damaged')}</Badge>}
                            {container.is_unsealed && <Badge color="orange">{t('Unsealed')}</Badge>}
                            {container.is_mislabeled && <Badge color="yellow">{t('Mislabeled')}</Badge>}
                          </Group>
                        </Grid.Col>
                      </Grid>
                    </Card>
                  ))}
                  <Text size="sm" c="dimmed" mt="xs">
                    {t('Containers Cleaned')}: {stock.containers_cleaned ? t('Yes') : t('No')}
                  </Text>
                </Stack>
              </Paper>
            )}

            {/* Notes */}
            {stock.notes && (
              <Paper shadow="xs" p="md" withBorder>
                <Title order={4} mb="md">{t('Notes')}</Title>
                <Text>{stock.notes}</Text>
              </Paper>
            )}

            {/* Metadata */}
            <Paper shadow="xs" p="md" withBorder>
              <Title order={4} mb="md">{t('Metadata')}</Title>
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Created At')}</Text>
                  <Text fw={500}>{new Date(stock.created_at).toLocaleString()}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Created By')}</Text>
                  <Text fw={500}>{stock.created_by}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Updated At')}</Text>
                  <Text fw={500}>{new Date(stock.updated_at).toLocaleString()}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">{t('Updated By')}</Text>
                  <Text fw={500}>{stock.updated_by}</Text>
                </Grid.Col>
              </Grid>
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="qc" pt="md">
          <QCTab 
            stockId={id!} 
            stock={stock} 
            onUpdate={fetchStockDetails}
          />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
