import { useState, useEffect } from 'react';
import {
  Container,
  Tabs,
  Loader,
  Center,
  Alert,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconInfoCircle,
  IconPackage,
  IconTruck,
  IconPaperclip,
  IconBoxSeam,
  IconReceipt
} from '@tabler/icons-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { salesService, SalesOrder, SalesOrderItem, Shipment } from '../services/sales';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';

import { SalesHeader } from '../components/Sales/SalesDetailPage/SalesHeader';
import { SalesDetailsTab } from '../components/Sales/SalesDetailPage/SalesDetailsTab';
import { SalesItemsTab } from '../components/Sales/SalesDetailPage/SalesItemsTab';
import { SalesAllocationTab } from '../components/Sales/SalesDetailPage/SalesAllocationTab';
import { SalesDeliveryTab } from '../components/Sales/SalesDetailPage/SalesDeliveryTab';
import { AttachmentsTable } from '../components/Common/AttachmentsTable';
import { JournalTab } from '../components/Common/JournalTab';

const SALES_APPROVAL_TEMPLATE = '69a1250e4e9208a5d9b2ac04';
const SALES_DOCUMENT_TEMPLATE = 'X1KXDPICLQGZ';

export function SalesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [approvalFlow, setApprovalFlow] = useState<any | null>(null);
  const [allocModalItemId, setAllocModalItemId] = useState<string | null>(null);
  const [allocModalOpen, setAllocModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('details');

  useEffect(() => {
    if (id) {
      loadOrderData();
    }
  }, [id]);

  const loadOrderData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      const [orderData, itemsData, shipmentsData, attachmentsData, statusesData] = await Promise.all([
        salesService.getSalesOrder(id),
        salesService.getSalesOrderItems(id),
        salesService.getShipments(id),
        salesService.getAttachments(id),
        salesService.getOrderStatuses(),
      ]);

      // Ensure approval flow exists (lazy create)
      let flow = await salesService.getApprovalFlow(id);
      if (!flow) {
        try {
          flow = await salesService.createApprovalFlow(id, SALES_APPROVAL_TEMPLATE);
        } catch (flowErr) {
          console.error('Failed to create approval flow for sales order', flowErr);
        }
      }

      let allocData: any[] = [];
      try {
        const res = await (salesService as any).getSalesOrderAllocations?.(id);
        if (res && res.results) allocData = res.results;
      } catch (e) { /* ignore */ }

      setOrder(orderData);
      setItems(itemsData.results || itemsData || []);
      setShipments(shipmentsData.results || shipmentsData || []);
      setAttachments(attachmentsData.results || attachmentsData || []);
      setStatuses(statusesData.statuses || []);
      setApprovalFlow(flow || null);
      setAllocations(allocData);
    } catch (err: any) {
      console.error('Failed to load sales order:', err);
      setError(err.response?.data?.detail || 'Failed to load sales order');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string | null) => {
    // left for backward compatibility – status change now handled via issueOrder()
  };

  const issueOrder = () => {
    if (!order) return;

    const issuedStatus = statuses.find(
      (s: any) => String(s.name || '').toLowerCase().includes('issued')
    );
    const stateId = issuedStatus?._id;

    if (!stateId) {
      notifications.show({
        title: t('Error'),
        message: t('Cannot find the "Issued" status in configuration.'),
        color: 'red',
      });
      return;
    }

    modals.openConfirmModal({
      title: t('Issue Sales Order'),
      children: t('Are you sure you want to issue this sales order?'),
      labels: { confirm: t('Issue'), cancel: t('Cancel') },
      confirmProps: { color: 'green' },
      onConfirm: async () => {
        try {
          await salesService.updateOrderStatus(order._id, undefined, stateId);
          notifications.show({
            title: t('Success'),
            message: t('Sales order issued'),
            color: 'green',
          });
          await loadOrderData();
        } catch (err: any) {
          console.error('Failed to issue order:', err);
          notifications.show({
            title: t('Error'),
            message: err.response?.data?.detail || t('Failed to issue order'),
            color: 'red',
          });
        }
      },
    });
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

  const isIssued =
    (order.state_detail?.name || order.status_text || '').toLowerCase().includes('issued');
  const isCompleted =
    (order.state_detail?.name || order.status_text || '').toLowerCase().includes('finish') ||
    (order.state_detail?.name || order.status_text || '').toLowerCase().includes('complete');

  const findStateIdByName = (match: RegExp) => {
    const s = statuses.find((st: any) => match.test((st.name || '').toLowerCase()));
    return s?._id;
  };

  const getCompletionGaps = () => {
    const gaps: string[] = [];
    items.forEach((item) => {
      const allocated = allocations
        .filter((a: any) => a.order_item_id === item._id && a.shipment_id)
        .reduce((sum: number, a: any) => sum + Number(a.quantity || 0), 0);
      const need = Number(item.quantity || 0);
      if (allocated + 1e-6 < need) {
        gaps.push(`${item.part_detail?.name || item.part}: ${allocated}/${need}`);
      }
    });
    return gaps;
  };

  const completeOrder = () => {
    const gaps = getCompletionGaps();
    if (gaps.length > 0) {
      modals.open({
        title: t('Cannot complete order'),
        children: (
          <div>
            <p>{t('All items must be fully allocated to deliveries. Missing:')}</p>
            <ul>
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        ),
      });
      return;
    }

    const finishedStateId = findStateIdByName(/finish|complete/);
    if (!finishedStateId) {
      notifications.show({
        title: t('Error'),
        message: t('Cannot find a Finished/Completed state in configuration.'),
        color: 'red',
      });
      return;
    }

    modals.openConfirmModal({
      title: t('Complete Sales Order'),
      children: t('Are you sure you want to mark this order as completed?'),
      labels: { confirm: t('Complete'), cancel: t('Cancel') },
      confirmProps: { color: 'teal' },
      onConfirm: async () => {
        try {
          await salesService.updateOrderStatus(order._id, undefined, finishedStateId);
          notifications.show({ title: t('Success'), message: t('Order completed'), color: 'green' });
          await loadOrderData();
        } catch (err: any) {
          console.error(err);
          notifications.show({
            title: t('Error'),
            message: err.response?.data?.detail || t('Failed to complete order'),
            color: 'red',
          });
        }
      },
    });
  };

  return (
    <Container size="xl">
      <SalesHeader
        order={order}
        statuses={statuses}
        onStatusChange={handleStatusChange}
        issueAction={!isIssued ? issueOrder : undefined}
        completeAction={isIssued && !isCompleted ? completeOrder : undefined}
        isCompleted={isCompleted}
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="details" leftSection={<IconInfoCircle size={16} />}>
            {t('Details')}
          </Tabs.Tab>
          <Tabs.Tab value="items" leftSection={<IconPackage size={16} />}>
            {t('Items')} ({items.length})
          </Tabs.Tab>
          <Tabs.Tab value="allocation" leftSection={<IconBoxSeam size={16} />}>
            {t('Allocation')} ({allocations.length})
          </Tabs.Tab>
          <Tabs.Tab value="delivery" leftSection={<IconTruck size={16} />}>
            {t('Delivery')} ({shipments.length})
          </Tabs.Tab>
          <Tabs.Tab value="attachments" leftSection={<IconPaperclip size={16} />}>
            {t('Attachments')} ({attachments.length})
          </Tabs.Tab>
          <Tabs.Tab value="journal" leftSection={<IconReceipt size={16} />}>
            {t('Journal')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <SalesDetailsTab
            order={order}
            approvalFlow={approvalFlow}
            documentTemplate={SALES_DOCUMENT_TEMPLATE}
            onRefresh={loadOrderData}
          />
        </Tabs.Panel>

        <Tabs.Panel value="items" pt="md">
          <SalesItemsTab
            order={order}
            items={items}
            onItemUpdate={loadOrderData}
            onAllocate={(itemId) => {
              setActiveTab('allocation');
              setAllocModalItemId(itemId);
              setAllocModalOpen(true);
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="allocation" pt="md">
          <SalesAllocationTab
            order={order}
            allocations={allocations}
            items={items}
            onAllocationUpdate={loadOrderData}
            prefillItemId={allocModalItemId}
            openExternalModal={allocModalOpen}
            onExternalModalHandled={() => setAllocModalOpen(false)}
          />
        </Tabs.Panel>

        <Tabs.Panel value="delivery" pt="md">
          <SalesDeliveryTab
            order={order}
            shipments={shipments}
            items={items}
            allocations={allocations}
            onShipmentUpdate={loadOrderData}
          />
        </Tabs.Panel>

        <Tabs.Panel value="attachments" pt="md">
          <AttachmentsTable
            attachments={attachments}
            onDownload={(att) => console.log('Download', att)}
            onDelete={(att) => console.log('Delete', att)}
          />
        </Tabs.Panel>

        <Tabs.Panel value="journal" pt="md">
          <JournalTab
            entityId={order._id}
            entityType="sales_order"
          />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
