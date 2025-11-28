import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Group,
  Text,
  Badge,
  Tabs,
  Loader,
  Center,
  Alert,
  Button,
  Table,
  Select,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconInfoCircle,
  IconPackage,
  IconTruck,
  IconPaperclip,
  IconArrowLeft,
} from '@tabler/icons-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { salesService, SalesOrder, SalesOrderItem, Shipment } from '../services/sales';

export function SalesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('details');

  useEffect(() => {
    if (id) {
      loadOrderData();
    }
  }, [id]);

  const loadOrderData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [orderData, itemsData, shipmentsData, attachmentsData, statusesData] = await Promise.all([
        salesService.getSalesOrder(Number(id)),
        salesService.getSalesOrderItems(Number(id)),
        salesService.getShipments(Number(id)),
        salesService.getAttachments(Number(id)),
        salesService.getOrderStatuses(),
      ]);

      setOrder(orderData);
      setItems(itemsData.results || itemsData || []);
      setShipments(shipmentsData.results || shipmentsData || []);
      setAttachments(attachmentsData.results || attachmentsData || []);
      setStatuses(statusesData.statuses || []);
    } catch (err: any) {
      console.error('Failed to load sales order:', err);
      setError(err.response?.data?.detail || 'Failed to load sales order');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string | null) => {
    if (!newStatus || !order) return;

    try {
      await salesService.updateOrderStatus(order.pk, Number(newStatus));
      await loadOrderData();
    } catch (err: any) {
      console.error('Failed to update status:', err);
      alert('Failed to update status');
    }
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 10: return 'yellow'; // Pending
      case 20: return 'blue';   // In Progress
      case 30: return 'green';  // Shipped
      case 40: return 'red';    // Cancelled
      case 50: return 'gray';   // Lost
      case 60: return 'orange'; // Returned
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (error || !order) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error || 'Sales order not found'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Button
        leftSection={<IconArrowLeft size={16} />}
        variant="subtle"
        onClick={() => navigate('/sales')}
        mb="md"
      >
        {t('Back to Sales Orders')}
      </Button>

      <Paper shadow="sm" p="md" mb="md">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={2}>{order.reference}</Title>
            <Text size="sm" c="dimmed">
              {t('Customer')}: {order.customer_detail?.name || order.customer}
            </Text>
          </div>
          <Group>
            <Badge size="lg" color={getStatusColor(order.status)}>
              {order.status_text || `Status ${order.status}`}
            </Badge>
            <Select
              placeholder={t('Change status')}
              data={statuses.map((s) => ({
                value: String(s.value),
                label: s.label,
              }))}
              value={String(order.status)}
              onChange={handleStatusChange}
              w={200}
            />
          </Group>
        </Group>
      </Paper>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="details" leftSection={<IconInfoCircle size={16} />}>
            {t('Details')}
          </Tabs.Tab>
          <Tabs.Tab value="items" leftSection={<IconPackage size={16} />}>
            {t('Items')} ({items.length})
          </Tabs.Tab>
          <Tabs.Tab value="shipments" leftSection={<IconTruck size={16} />}>
            {t('Shipments')} ({shipments.length})
          </Tabs.Tab>
          <Tabs.Tab value="attachments" leftSection={<IconPaperclip size={16} />}>
            {t('Attachments')} ({attachments.length})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <Paper shadow="sm" p="md">
            <Group grow>
              <div>
                <Text size="sm" c="dimmed">{t('Reference')}</Text>
                <Text fw={500}>{order.reference}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">{t('Customer')}</Text>
                <Text fw={500}>{order.customer_detail?.name || order.customer}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">{t('Status')}</Text>
                <Badge color={getStatusColor(order.status)}>
                  {order.status_text || `Status ${order.status}`}
                </Badge>
              </div>
            </Group>

            <Group grow mt="md">
              <div>
                <Text size="sm" c="dimmed">{t('Creation Date')}</Text>
                <Text>{order.creation_date || '-'}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">{t('Target Date')}</Text>
                <Text>{order.target_date || '-'}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">{t('Shipment Date')}</Text>
                <Text>{order.shipment_date || '-'}</Text>
              </div>
            </Group>

            {order.description && (
              <div style={{ marginTop: '1rem' }}>
                <Text size="sm" c="dimmed">{t('Description')}</Text>
                <Text>{order.description}</Text>
              </div>
            )}

            {order.notes && (
              <div style={{ marginTop: '1rem' }}>
                <Text size="sm" c="dimmed">{t('Notes')}</Text>
                <Text>{order.notes}</Text>
              </div>
            )}

            {order.total_price && (
              <div style={{ marginTop: '1rem' }}>
                <Text size="sm" c="dimmed">{t('Total Price')}</Text>
                <Text fw={700} size="lg">{order.total_price}</Text>
              </div>
            )}
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="items" pt="md">
          <Paper shadow="sm" p="md">
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Part')}</Table.Th>
                  <Table.Th>{t('Quantity')}</Table.Th>
                  <Table.Th>{t('Allocated')}</Table.Th>
                  <Table.Th>{t('Shipped')}</Table.Th>
                  <Table.Th>{t('Price')}</Table.Th>
                  <Table.Th>{t('Reference')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                      <Text c="dimmed">{t('No items')}</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  items.map((item) => (
                    <Table.Tr key={item.pk}>
                      <Table.Td>
                        <div>
                          <Text size="sm" fw={500}>
                            {item.part_detail?.name || item.part}
                          </Text>
                          {item.part_detail?.IPN && (
                            <Text size="xs" c="dimmed">
                              {item.part_detail.IPN}
                            </Text>
                          )}
                        </div>
                      </Table.Td>
                      <Table.Td>{item.quantity}</Table.Td>
                      <Table.Td>{item.allocated || 0}</Table.Td>
                      <Table.Td>{item.shipped || 0}</Table.Td>
                      <Table.Td>
                        {item.sale_price ? `${item.sale_price} ${item.sale_price_currency || ''}` : '-'}
                      </Table.Td>
                      <Table.Td>{item.reference || '-'}</Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="shipments" pt="md">
          <Paper shadow="sm" p="md">
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Reference')}</Table.Th>
                  <Table.Th>{t('Tracking Number')}</Table.Th>
                  <Table.Th>{t('Shipment Date')}</Table.Th>
                  <Table.Th>{t('Delivery Date')}</Table.Th>
                  <Table.Th>{t('Notes')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shipments.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                      <Text c="dimmed">{t('No shipments')}</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  shipments.map((shipment) => (
                    <Table.Tr key={shipment.pk}>
                      <Table.Td>{shipment.reference || '-'}</Table.Td>
                      <Table.Td>{shipment.tracking_number || '-'}</Table.Td>
                      <Table.Td>{shipment.shipment_date || '-'}</Table.Td>
                      <Table.Td>{shipment.delivery_date || '-'}</Table.Td>
                      <Table.Td>{shipment.notes || '-'}</Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="attachments" pt="md">
          <Paper shadow="sm" p="md">
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('File')}</Table.Th>
                  <Table.Th>{t('Comment')}</Table.Th>
                  <Table.Th>{t('Upload Date')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {attachments.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={3} style={{ textAlign: 'center' }}>
                      <Text c="dimmed">{t('No attachments')}</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  attachments.map((attachment) => (
                    <Table.Tr key={attachment.pk}>
                      <Table.Td>
                        <a href={attachment.attachment} target="_blank" rel="noopener noreferrer">
                          {attachment.attachment?.split('/').pop() || 'File'}
                        </a>
                      </Table.Td>
                      <Table.Td>{attachment.comment || '-'}</Table.Td>
                      <Table.Td>{attachment.upload_date || '-'}</Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
