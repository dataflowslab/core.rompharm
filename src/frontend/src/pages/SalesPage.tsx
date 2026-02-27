import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Table,
  Badge,
  Text,
  Loader,
  Center,
  Alert,
  Group,
  ActionIcon,
  Button
} from '@mantine/core';
import { IconAlertCircle, IconEye, IconPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { salesService, SalesOrder } from '../services/sales';
import { CreateSalesOrderModal } from '../components/Sales/CreateSalesOrderModal';

export function SalesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await salesService.getSalesOrders();
      const results = data.results || data || [];
      setOrders(results);
    } catch (err: any) {
      console.error('Failed to load sales orders:', err);
      setError(err.response?.data?.detail || 'Failed to load sales orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 10: return 'yellow'; // Pending / Draft
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

  if (error) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('Sales Orders')}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setIsModalOpen(true)}>
          {t('New Order')}
        </Button>
      </Group>

      <Table striped withTableBorder withColumnBorders highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Reference')}</Table.Th>
            <Table.Th>{t('Customer')}</Table.Th>
            <Table.Th>{t('Line Items')}</Table.Th>
            <Table.Th>{t('Status')}</Table.Th>
            <Table.Th>{t('Issue Date')}</Table.Th>
            <Table.Th>{t('Target Date')}</Table.Th>
            <Table.Th>{t('Actions')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {orders.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                <Text c="dimmed">{t('No sales orders found')}</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            orders.map((order) => (
              <Table.Tr
                key={order._id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/sales/${order._id}`)}
              >
                <Table.Td>
                  <Text fw={500}>{order.reference}</Text>
                </Table.Td>
                <Table.Td>
                  {order.customer_detail?.name || order.customer || 'Unknown Customer'}
                </Table.Td>
                <Table.Td>
                  {order.line_items || 0}
                </Table.Td>
                <Table.Td>
                  <Badge color={order.state_detail?.color || getStatusColor(order.status)}>
                    {order.state_detail?.name || order.status_text || `Status ${order.status}`}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {order.issue_date || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {order.target_date || '-'}
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/sales/${order._id}`);
                    }}
                  >
                    <IconEye size={18} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      <CreateSalesOrderModal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadOrders}
      />
    </Container>
  );
}
