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
  Table,
  Anchor,
} from '@mantine/core';
import { 
  IconArrowLeft, 
  IconInfoCircle, 
  IconClipboardCheck,
  IconTransfer,
  IconBook,
  IconExternalLink,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { formatDate } from '../utils/dateFormat';
import { QualityControlTab } from '../components/Stock/QualityControlTab';
import { TransfersTab } from '../components/Stock/TransfersTab';
import { JournalTab } from '../components/Stock/JournalTab';

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
    manufacturer_id?: string;
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

  const getDaysUntilExpiry = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryColor = (days: number | null) => {
    if (days === null) return undefined;
    if (days < 0) return 'red';
    if (days <= 7) return 'orange';
    return undefined;
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

  const daysUntilExpiry = getDaysUntilExpiry(stock.expiry_date);
  const expiryColor = getExpiryColor(daysUntilExpiry);

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Stack gap={4}>
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(-1)}
              size="sm"
            >
              {t('Back')}
            </Button>
          </Group>
          <Title order={2}>Stock {stock.batch_code}</Title>
          <Text size="sm" c="dimmed">{stock.part_detail?.name}</Text>
        </Stack>
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
            {t('Quality Control')}
          </Tabs.Tab>
          <Tabs.Tab value="transfers" leftSection={<IconTransfer size={16} />}>
            {t('Transfers')}
          </Tabs.Tab>
          <Tabs.Tab value="journal" leftSection={<IconBook size={16} />}>
            {t('Journal')}
          </Tabs.Tab>
        </Tabs.List>

        {/* Stock Details Tab */}
        <Tabs.Panel value="details" pt="md">
          <Grid>
            {/* Column A: Stock Information */}
            <Grid.Col span={6}>
              <Paper shadow="xs" p="md" withBorder>
                <Title order={4} mb="md">{t('Stock Information')}</Title>
                <Table>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td fw={500}>{t('Batch Code')}</Table.Td>
                      <Table.Td>{stock.batch_code || '-'}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>{t('Location')}</Table.Td>
                      <Table.Td>{stock.location_detail?.name || '-'}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>{t('Supplier')}</Table.Td>
                      <Table.Td>{stock.supplier_name || '-'}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>{t('Supplier Batch Code')}</Table.Td>
                      <Table.Td>{stock.supplier_batch_code || '-'}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>{t('Received Quantity')}</Table.Td>
                      <Table.Td>{stock.quantity} {stock.part_detail?.um}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>{t('Received On')}</Table.Td>
                      <Table.Td>{formatDate(stock.received_date)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>{t('Manufactured On')}</Table.Td>
                      <Table.Td>{formatDate(stock.manufacturing_date)}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>{t('Expiry Date')}</Table.Td>
                      <Table.Td>
                        <Stack gap={4}>
                          <Text c={expiryColor}>{formatDate(stock.expiry_date)}</Text>
                          {daysUntilExpiry !== null && (
                            <Text size="sm" c={expiryColor}>
                              {daysUntilExpiry >= 0 
                                ? `${daysUntilExpiry} ${t('days remaining')}`
                                : `${Math.abs(daysUntilExpiry)} ${t('days expired')}`
                              }
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Paper>
            </Grid.Col>

            {/* Column B: Product Information */}
            <Grid.Col span={6}>
              <Paper shadow="xs" p="md" withBorder>
                <Title order={4} mb="md">{t('Product Information')}</Title>
                <Table>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td fw={500}>{t('Name')}</Table.Td>
                      <Table.Td>{stock.part_detail?.name || '-'}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>{t('IPN')}</Table.Td>
                      <Table.Td>{stock.part_detail?.ipn || '-'}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>{t('Manufacturer')}</Table.Td>
                      <Table.Td>
                        {stock.part_detail?.manufacturer_id ? (
                          <Anchor
                            href={`/inventory/manufacturers/${stock.part_detail.manufacturer_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View Manufacturer <IconExternalLink size={14} />
                          </Anchor>
                        ) : '-'}
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={500}>{t('View Product')}</Table.Td>
                      <Table.Td>
                        <Button
                          component="a"
                          href={`/inventory/articles/${stock.part_id}`}
                          target="_blank"
                          size="xs"
                          variant="light"
                          rightSection={<IconExternalLink size={14} />}
                        >
                          {t('Open in new tab')}
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        {/* Quality Control Tab */}
        <Tabs.Panel value="qc" pt="md">
          <QualityControlTab 
            stockId={id!} 
            stock={stock} 
            onUpdate={fetchStockDetails}
          />
        </Tabs.Panel>

        {/* Transfers Tab */}
        <Tabs.Panel value="transfers" pt="md">
          <TransfersTab stockId={id!} />
        </Tabs.Panel>

        {/* Journal Tab */}
        <Tabs.Panel value="journal" pt="md">
          <JournalTab stockId={id!} stock={stock} />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
