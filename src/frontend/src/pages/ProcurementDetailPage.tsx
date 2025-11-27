import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Title, 
  Tabs, 
  Grid, 
  TextInput, 
  Textarea, 
  Select, 
  Button, 
  Group, 
  Table,
  Modal,
  NumberInput,
  Paper,
  Text,
  Badge,
  Stack,
  ActionIcon,
  Anchor
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconArrowLeft, IconPlus, IconTrash, IconEdit, IconUpload, IconFile, IconExternalLink, IconSearch, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { procurementApi } from '../services/procurement';
import { notifications } from '@mantine/notifications';
import { DetailsTab, ApprovalsTab, ReceivedStockTab } from '../components/Procurement';

interface PurchaseOrder {
  pk: number;
  reference: string;
  description: string;
  supplier: number;
  supplier_detail?: {
    name: string;
    pk: number;
  };
  supplier_reference: string;
  order_currency: string;
  issue_date: string;
  target_date: string;
  destination?: number;
  destination_detail?: {
    name: string;
  };
  notes: string;
  status: number;
  status_text: string;
}

interface PurchaseOrderItem {
  pk: number;
  part: number;
  part_detail?: {
    name: string;
    description: string;
    IPN: string;
  };
  quantity: number;
  received: number;
  purchase_price: number;
  purchase_price_currency: string;
  destination?: number;
  destination_detail?: {
    name: string;
  };
  reference: string;
  notes: string;
}

interface Part {
  pk: number;
  name: string;
  description: string;
  IPN: string;
}

interface StockLocation {
  pk: number;
  name: string;
  description?: string;
}

interface Attachment {
  pk: number;
  attachment: string;
  filename: string;
  comment: string;
  upload_date: string;
}

export function ProcurementDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('details');
  const [itemModalOpened, setItemModalOpened] = useState(false);
  const [editItemModalOpened, setEditItemModalOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchaseOrderItem | null>(null);
  const [partSearchQuery, setPartSearchQuery] = useState('');
  const [loadingParts, setLoadingParts] = useState(false);
  
  // Search and sort state for items
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSortField, setItemSortField] = useState<keyof PurchaseOrderItem | null>(null);
  const [itemSortDirection, setItemSortDirection] = useState<'asc' | 'desc'>('asc');

  // Form state for new item
  const [newItemData, setNewItemData] = useState({
    part: '',
    quantity: 1,
    purchase_price: 0,
    purchase_price_currency: 'EUR',
    destination: '',
    reference: '',
    notes: ''
  });

  // Form state for edit item
  const [editItemData, setEditItemData] = useState({
    quantity: 1,
    purchase_price: 0,
    purchase_price_currency: 'EUR',
    destination: '',
    reference: '',
    notes: ''
  });

  useEffect(() => {
    if (id) {
      loadPurchaseOrder();
      loadItems();
      loadStockLocations();
      loadAttachments();
    }
  }, [id]);

  // Load parts when user searches (debounced)
  useEffect(() => {
    if (partSearchQuery.length >= 2) {
      const timer = setTimeout(() => {
        loadParts(partSearchQuery);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setParts([]);
    }
  }, [partSearchQuery]);

  useEffect(() => {
    if (order) {
      setNewItemData(prev => ({
        ...prev,
        purchase_price_currency: order.order_currency || 'EUR'
      }));
    }
  }, [order]);

  const loadPurchaseOrder = async () => {
    setLoading(true);
    try {
      const response = await api.get(procurementApi.getPurchaseOrder(id!));
      setOrder(response.data);
    } catch (error) {
      console.error('Failed to load purchase order:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load purchase order'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      const response = await api.get(procurementApi.getOrderItems(id!));
      setItems(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  };

  const loadParts = async (search: string) => {
    if (search.length < 2) {
      setParts([]);
      return;
    }
    
    setLoadingParts(true);
    try {
      const response = await api.get(`${procurementApi.getParts()}?search=${encodeURIComponent(search)}`);
      setParts(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load parts:', error);
      setParts([]);
    } finally {
      setLoadingParts(false);
    }
  };

  const loadStockLocations = async () => {
    try {
      const response = await api.get(procurementApi.getStockLocations());
      setStockLocations(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load stock locations:', error);
    }
  };

  const loadAttachments = async () => {
    try {
      const response = await api.get(procurementApi.getAttachments(id!));
      setAttachments(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to load attachments:', error);
    }
  };

  const handleAddItem = async () => {
    if (!newItemData.part) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a part'),
        color: 'red'
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        part: parseInt(newItemData.part),
        quantity: newItemData.quantity,
        purchase_price: newItemData.purchase_price || undefined,
        purchase_price_currency: newItemData.purchase_price_currency || undefined,
        destination: newItemData.destination ? parseInt(newItemData.destination) : undefined,
        reference: newItemData.reference || undefined,
        notes: newItemData.notes || undefined
      };

      await api.post(procurementApi.addOrderItem(id!), payload);

      notifications.show({
        title: t('Success'),
        message: t('Item added successfully'),
        color: 'green'
      });

      // Reset form and reload items
      setNewItemData({
        part: '',
        quantity: 1,
        purchase_price: 0,
        purchase_price_currency: order?.order_currency || 'EUR',
        destination: '',
        reference: '',
        notes: ''
      });
      setItemModalOpened(false);
      loadItems();
    } catch (error: any) {
      console.error('Failed to add item:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to add item'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditItem = (item: PurchaseOrderItem) => {
    setEditingItem(item);
    setEditItemData({
      quantity: item.quantity,
      purchase_price: item.purchase_price,
      purchase_price_currency: item.purchase_price_currency,
      destination: item.destination ? String(item.destination) : '',
      reference: item.reference || '',
      notes: item.notes || ''
    });
    setEditItemModalOpened(true);
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    setSubmitting(true);
    try {
      const payload = {
        quantity: editItemData.quantity,
        purchase_price: editItemData.purchase_price || undefined,
        purchase_price_currency: editItemData.purchase_price_currency || undefined,
        destination: editItemData.destination ? parseInt(editItemData.destination) : undefined,
        reference: editItemData.reference || undefined,
        notes: editItemData.notes || undefined
      };

      await api.put(procurementApi.updateOrderItem(id!, editingItem.pk), payload);

      notifications.show({
        title: t('Success'),
        message: t('Item updated successfully'),
        color: 'green'
      });

      setEditItemModalOpened(false);
      setEditingItem(null);
      loadItems();
    } catch (error: any) {
      console.error('Failed to update item:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update item'),
        color: 'red'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm(t('Are you sure you want to delete this item?'))) return;

    try {
      await api.delete(procurementApi.deleteOrderItem(id!, itemId));
      notifications.show({
        title: t('Success'),
        message: t('Item deleted successfully'),
        color: 'green'
      });
      loadItems();
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete item'),
        color: 'red'
      });
    }
  };

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    const file = files[0];

    try {
      const formData = new FormData();
      formData.append('file', file);

      await api.post(procurementApi.uploadAttachment(id!), formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      notifications.show({
        title: t('Success'),
        message: t('File uploaded successfully'),
        color: 'green'
      });

      loadAttachments();
    } catch (error: any) {
      console.error('Failed to upload file:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to upload file'),
        color: 'red'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm(t('Are you sure you want to delete this attachment?'))) return;

    try {
      await api.delete(procurementApi.deleteAttachment(id!, attachmentId));
      notifications.show({
        title: t('Success'),
        message: t('Attachment deleted successfully'),
        color: 'green'
      });
      loadAttachments();
    } catch (error: any) {
      console.error('Failed to delete attachment:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete attachment'),
        color: 'red'
      });
    }
  };

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...items];

    // Apply search filter
    if (itemSearchQuery) {
      const query = itemSearchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.part_detail?.name?.toLowerCase().includes(query) ||
        item.part_detail?.IPN?.toLowerCase().includes(query) ||
        item.reference?.toLowerCase().includes(query) ||
        item.destination_detail?.name?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (itemSortField) {
      filtered.sort((a, b) => {
        let aVal: any = a[itemSortField];
        let bVal: any = b[itemSortField];

        // Handle nested part name
        if (itemSortField === 'part_detail') {
          aVal = a.part_detail?.name || '';
          bVal = b.part_detail?.name || '';
        }

        // Handle nested destination name
        if (itemSortField === 'destination_detail') {
          aVal = a.destination_detail?.name || '';
          bVal = b.destination_detail?.name || '';
        }

        // Handle null/undefined values
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';

        // Convert to number for numeric fields
        if (itemSortField === 'quantity' || itemSortField === 'received' || itemSortField === 'purchase_price') {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
          return itemSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // Convert to string for comparison
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (aStr < bStr) return itemSortDirection === 'asc' ? -1 : 1;
        if (aStr > bStr) return itemSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [items, itemSearchQuery, itemSortField, itemSortDirection]);

  const handleItemSort = (field: keyof PurchaseOrderItem) => {
    if (itemSortField === field) {
      setItemSortDirection(itemSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setItemSortField(field);
      setItemSortDirection('asc');
    }
  };

  const getItemSortIcon = (field: keyof PurchaseOrderItem) => {
    if (itemSortField !== field) return null;
    return itemSortDirection === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 10: return 'gray'; // Pending
      case 20: return 'blue'; // Placed
      case 30: return 'yellow'; // Complete
      case 40: return 'green'; // Received
      case 50: return 'red'; // Cancelled
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <Container size="xl">
        <Text>{t('Loading...')}</Text>
      </Container>
    );
  }

  if (!order) {
    return (
      <Container size="xl">
        <Text>{t('Purchase order not found')}</Text>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Group mb="md">
        <Button 
          variant="subtle" 
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/procurement')}
        >
          {t('Back')}
        </Button>
      </Group>

      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>{order.reference || t('Purchase Order')}</Title>
          <Text size="sm" c="dimmed">{order.supplier_detail?.name}</Text>
        </div>
        <Badge color={getStatusColor(order.status)} size="lg">
          {order.status_text}
        </Badge>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="details">{t('Details')}</Tabs.Tab>
          <Tabs.Tab value="approvals">{t('Approvals')}</Tabs.Tab>
          <Tabs.Tab value="items">{t('Items')}</Tabs.Tab>
          <Tabs.Tab value="receive-stock">{t('Receive Stock')}</Tabs.Tab>
          <Tabs.Tab value="attachments">{t('Attachments')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <DetailsTab 
            order={order} 
            suppliers={[]} 
            stockLocations={stockLocations} 
          />
        </Tabs.Panel>

        <Tabs.Panel value="approvals" pt="md">
          <ApprovalsTab 
            order={order} 
            onOrderUpdate={loadPurchaseOrder} 
          />
        </Tabs.Panel>

        <Tabs.Panel value="items" pt="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>{t('Order Items')}</Title>
            <Button 
              leftSection={<IconPlus size={16} />}
              onClick={() => setItemModalOpened(true)}
            >
              {t('New item')}
            </Button>
          </Group>

          <TextInput
            placeholder={t('Search items...')}
            leftSection={<IconSearch size={16} />}
            value={itemSearchQuery}
            onChange={(e) => setItemSearchQuery(e.target.value)}
            mb="md"
          />

          <Table striped withTableBorder withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('part_detail')}>
                  <Group gap="xs">
                    {t('Part')}
                    {getItemSortIcon('part_detail')}
                  </Group>
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('quantity')}>
                  <Group gap="xs">
                    {t('Quantity')}
                    {getItemSortIcon('quantity')}
                  </Group>
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('received')}>
                  <Group gap="xs">
                    {t('Received')}
                    {getItemSortIcon('received')}
                  </Group>
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('purchase_price')}>
                  <Group gap="xs">
                    {t('Unit Price')}
                    {getItemSortIcon('purchase_price')}
                  </Group>
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('destination_detail')}>
                  <Group gap="xs">
                    {t('Destination')}
                    {getItemSortIcon('destination_detail')}
                  </Group>
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleItemSort('reference')}>
                  <Group gap="xs">
                    {t('Reference')}
                    {getItemSortIcon('reference')}
                  </Group>
                </Table.Th>
                <Table.Th>{t('Actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredAndSortedItems.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}>{itemSearchQuery ? t('No results found') : t('No items')}</Table.Td>
                </Table.Tr>
              ) : (
                filteredAndSortedItems.map((item) => (
                  <Table.Tr key={item.pk}>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500}>{item.part_detail?.name || item.part}</Text>
                        {item.part_detail?.IPN && (
                          <Text size="xs" c="dimmed">{item.part_detail.IPN}</Text>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td>{item.quantity}</Table.Td>
                    <Table.Td>{item.received || 0}</Table.Td>
                    <Table.Td>
                      {item.purchase_price} {item.purchase_price_currency || order.order_currency}
                    </Table.Td>
                    <Table.Td>{item.destination_detail?.name || '-'}</Table.Td>
                    <Table.Td>{item.reference || '-'}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon 
                          variant="subtle" 
                          color="blue"
                          onClick={() => handleEditItem(item)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon 
                          variant="subtle" 
                          color="red"
                          onClick={() => handleDeleteItem(item.pk)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="attachments" pt="md">
          <Grid>
            <Grid.Col span={4}>
              <Paper p="md" withBorder>
                <Title order={5} mb="md">{t('Upload File')}</Title>
                <Dropzone
                  onDrop={handleFileUpload}
                  loading={uploading}
                  maxSize={10 * 1024 * 1024}
                >
                  <Group justify="center" gap="xl" style={{ minHeight: 120, pointerEvents: 'none' }}>
                    <div style={{ textAlign: 'center' }}>
                      <IconUpload size={50} stroke={1.5} />
                      <Text size="sm" mt="xs">
                        {t('Drag files here or click to select')}
                      </Text>
                      <Text size="xs" c="dimmed" mt={7}>
                        {t('Max file size: 10MB')}
                      </Text>
                    </div>
                  </Group>
                </Dropzone>
              </Paper>
            </Grid.Col>

            <Grid.Col span={8}>
              <Paper p="md" withBorder>
                <Title order={5} mb="md">{t('Attachments')}</Title>
                {attachments.length === 0 ? (
                  <Text size="sm" c="dimmed">{t('No attachments')}</Text>
                ) : (
                  <Stack gap="xs">
                    {attachments.map((attachment) => (
                      <Paper key={attachment.pk} p="sm" withBorder>
                        <Group justify="space-between">
                          <Group>
                            <IconFile size={20} />
                            <div>
                              <Anchor 
                                href={attachment.attachment} 
                                target="_blank"
                                size="sm"
                              >
                                {attachment.filename}
                              </Anchor>
                              {attachment.comment && (
                                <Text size="xs" c="dimmed">{attachment.comment}</Text>
                              )}
                            </div>
                          </Group>
                          <Group gap="xs">
                            <ActionIcon
                              component="a"
                              href={attachment.attachment}
                              target="_blank"
                              variant="subtle"
                              color="blue"
                            >
                              <IconExternalLink size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => handleDeleteAttachment(attachment.pk)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="receive-stock" pt="md">
          <ReceivedStockTab 
            orderId={id!} 
            items={items} 
            stockLocations={stockLocations}
            onReload={loadItems}
          />
        </Tabs.Panel>
      </Tabs>

      {/* New Item Modal */}
      <Modal
        opened={itemModalOpened}
        onClose={() => setItemModalOpened(false)}
        title={t('Add Item')}
        size="lg"
        centered
      >
        <Grid>
          <Grid.Col span={12}>
            <Select
              label={t('Part')}
              placeholder={t('Type at least 2 characters to search...')}
              data={parts.map(p => ({ 
                value: String(p.pk), 
                label: `${p.name} ${p.IPN ? `(${p.IPN})` : ''}` 
              }))}
              value={newItemData.part}
              onChange={(value) => setNewItemData({ ...newItemData, part: value || '' })}
              onSearchChange={setPartSearchQuery}
              searchValue={partSearchQuery}
              searchable
              required
              nothingFoundMessage={partSearchQuery.length < 2 ? t('Type at least 2 characters') : loadingParts ? t('Loading...') : t('No parts found')}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <NumberInput
              label={t('Quantity')}
              placeholder="1"
              value={newItemData.quantity}
              onChange={(value) => setNewItemData({ ...newItemData, quantity: Number(value) || 1 })}
              min={0.01}
              step={1}
              required
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <NumberInput
              label={t('Purchase Price')}
              placeholder="0.00"
              value={newItemData.purchase_price}
              onChange={(value) => setNewItemData({ ...newItemData, purchase_price: Number(value) || 0 })}
              min={0}
              step={0.01}
              decimalScale={2}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Select
              label={t('Currency')}
              data={['EUR', 'USD', 'RON', 'GBP']}
              value={newItemData.purchase_price_currency}
              onChange={(value) => setNewItemData({ ...newItemData, purchase_price_currency: value || 'EUR' })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Select
              label={t('Destination')}
              placeholder={t('Select stock location')}
              data={stockLocations.map(loc => ({ value: String(loc.pk), label: loc.name }))}
              value={newItemData.destination}
              onChange={(value) => setNewItemData({ ...newItemData, destination: value || '' })}
              searchable
              clearable
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <TextInput
              label={t('Reference')}
              placeholder={t('Item reference')}
              value={newItemData.reference}
              onChange={(e) => setNewItemData({ ...newItemData, reference: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Textarea
              label={t('Notes')}
              placeholder={t('Additional notes')}
              value={newItemData.notes}
              onChange={(e) => setNewItemData({ ...newItemData, notes: e.target.value })}
              minRows={3}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setItemModalOpened(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleAddItem} loading={submitting}>
            {t('Add')}
          </Button>
        </Group>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        opened={editItemModalOpened}
        onClose={() => setEditItemModalOpened(false)}
        title={t('Edit Item')}
        size="lg"
        centered
      >
        <Grid>
          <Grid.Col span={6}>
            <NumberInput
              label={t('Quantity')}
              placeholder="1"
              value={editItemData.quantity}
              onChange={(value) => setEditItemData({ ...editItemData, quantity: Number(value) || 1 })}
              min={0.01}
              step={1}
              required
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <NumberInput
              label={t('Purchase Price')}
              placeholder="0.00"
              value={editItemData.purchase_price}
              onChange={(value) => setEditItemData({ ...editItemData, purchase_price: Number(value) || 0 })}
              min={0}
              step={0.01}
              decimalScale={2}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Select
              label={t('Currency')}
              data={['EUR', 'USD', 'RON', 'GBP']}
              value={editItemData.purchase_price_currency}
              onChange={(value) => setEditItemData({ ...editItemData, purchase_price_currency: value || 'EUR' })}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            <Select
              label={t('Destination')}
              placeholder={t('Select stock location')}
              data={stockLocations.map(loc => ({ value: String(loc.pk), label: loc.name }))}
              value={editItemData.destination}
              onChange={(value) => setEditItemData({ ...editItemData, destination: value || '' })}
              searchable
              clearable
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <TextInput
              label={t('Reference')}
              placeholder={t('Item reference')}
              value={editItemData.reference}
              onChange={(e) => setEditItemData({ ...editItemData, reference: e.target.value })}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Textarea
              label={t('Notes')}
              placeholder={t('Additional notes')}
              value={editItemData.notes}
              onChange={(e) => setEditItemData({ ...editItemData, notes: e.target.value })}
              minRows={3}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setEditItemModalOpened(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleUpdateItem} loading={submitting}>
            {t('Update')}
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
