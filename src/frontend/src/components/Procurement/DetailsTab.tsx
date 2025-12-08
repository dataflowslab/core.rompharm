import { useState, useEffect } from 'react';
import { Grid, TextInput, Textarea, Select, Paper, Button, Group, Stack, Title, Text, Badge, Loader, ActionIcon } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconFileTypePdf, IconDownload, IconRefresh, IconTrash } from '@tabler/icons-react';
import api from '../../services/api';

interface Supplier {
  pk: number;
  name: string;
}

interface StockLocation {
  pk: number;
  name: string;
}

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

interface DetailsTabProps {
  order: PurchaseOrder;
  suppliers: Supplier[];
  stockLocations: StockLocation[];
  canEdit: boolean;
  onUpdate?: (data: any) => Promise<void>;
}

interface GeneratedDocument {
  _id: string;
  job_id: string;
  template_code: string;
  template_name: string;
  status: string;
  filename: string;
  version: number;
  created_at: string;
  created_by: string;
  error?: string;
  has_document?: boolean;
}

export function DetailsTab({ order, stockLocations, canEdit, onUpdate }: DetailsTabProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  
  // Document generation state
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);
  
  // Editable state
  const [formData, setFormData] = useState({
    reference: order.reference || '',
    supplier_reference: order.supplier_reference || '',
    description: order.description || '',
    target_date: order.target_date || '',
    destination: order.destination ? String(order.destination) : '',
    notes: order.notes || '',
  });

  // Parse dates
  const issueDate = order.issue_date ? new Date(order.issue_date) : null;
  const targetDate = formData.target_date ? new Date(formData.target_date) : null;

  // Hardcoded template
  const TEMPLATE_CODE = 'ILY5WVAV8SQD';
  const TEMPLATE_NAME = 'Comandă Achiziție';

  // Load documents
  useEffect(() => {
    loadDocuments();
  }, [order.pk]);

  const loadDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const response = await api.get(`/api/documents/procurement-order/${order.pk}`);
      const docs = response.data || [];
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleGenerateDocument = async () => {
    setGeneratingDoc(TEMPLATE_CODE);
    try {
      await api.post('/api/documents/procurement-order/generate', {
        order_id: order.pk,
        template_code: TEMPLATE_CODE,
        template_name: TEMPLATE_NAME,
      });
      
      notifications.show({
        title: t('Success'),
        message: t('Document generation started'),
        color: 'green',
      });
      
      // Reload documents after a short delay
      setTimeout(() => {
        loadDocuments();
      }, 1500);
    } catch (error: any) {
      console.error('Failed to generate document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to generate document'),
        color: 'red',
      });
    } finally {
      setGeneratingDoc(null);
    }
  };

  const handleDeleteDocument = async (doc: GeneratedDocument) => {
    if (!confirm(t('Are you sure you want to delete this document?'))) {
      return;
    }

    try {
      await api.delete(`/api/documents/procurement-order/${order.pk}/job/${doc.job_id}`);
      
      notifications.show({
        title: t('Success'),
        message: t('Document deleted'),
        color: 'green',
      });
      
      loadDocuments();
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete document'),
        color: 'red',
      });
    }
  };

  const handleDownloadDocument = async (doc: GeneratedDocument) => {
    try {
      const response = await api.get(
        `/api/documents/procurement-order/${order.pk}/job/${doc.job_id}/download`,
        { responseType: 'blob' }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Failed to download document:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to download document'),
        color: 'red',
      });
    }
  };

  const handleSave = async () => {
    if (!onUpdate) return;

    setSaving(true);
    try {
      const updateData: any = {
        reference: formData.reference,
        supplier_reference: formData.supplier_reference,
        description: formData.description,
        target_date: formData.target_date,
        notes: formData.notes,
      };

      if (formData.destination) {
        updateData.destination = parseInt(formData.destination);
      }

      await onUpdate(updateData);
      
      notifications.show({
        title: t('Success'),
        message: t('Order updated successfully'),
        color: 'green',
      });
    } catch (error: any) {
      console.error('Failed to update order:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update order'),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    return (
      formData.reference !== (order.reference || '') ||
      formData.supplier_reference !== (order.supplier_reference || '') ||
      formData.description !== (order.description || '') ||
      formData.target_date !== (order.target_date || '') ||
      formData.destination !== (order.destination ? String(order.destination) : '') ||
      formData.notes !== (order.notes || '')
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
      case 'completed':
        return 'green';
      case 'processing':
        return 'blue';
      case 'queued':
        return 'gray';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Grid gutter="md">
      {/* Document Sidebar - 1/4 width */}
      <Grid.Col span={3}>
        <Paper p="md" withBorder style={{ height: '100%' }}>
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={5}>{t('Documents')}</Title>
              <ActionIcon
                variant="subtle"
                onClick={loadDocuments}
                loading={loadingDocuments}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>

            {/* Generate Document Button */}
            <div>
              <Text size="sm" fw={500} mb="xs">{t('Generate Document')}</Text>
              <Button
                variant="light"
                size="sm"
                fullWidth
                onClick={handleGenerateDocument}
                loading={generatingDoc === TEMPLATE_CODE}
                leftSection={<IconFileTypePdf size={16} />}
                disabled={order.status < 20}
              >
                {t('Comandă Achiziție')}
              </Button>
              {order.status < 20 && (
                <Text size="xs" c="dimmed" mt="xs">
                  {t('Available after order is signed')}
                </Text>
              )}
            </div>

            {/* Generated Documents */}
            <div>
              <Text size="sm" fw={500} mb="xs">{t('Generated')}</Text>
              {loadingDocuments ? (
                <Loader size="sm" />
              ) : documents.length === 0 ? (
                <Text size="xs" c="dimmed">{t('No documents generated')}</Text>
              ) : (
                <Stack gap="sm">
                  {documents.map((doc) => (
                    <Paper key={doc._id} p="sm" withBorder>
                      <Stack gap="xs">
                        <Text size="sm" fw={500}>
                          {doc.template_name} {order.reference}
                        </Text>
                        {doc.has_document ? (
                          <Group gap="xs">
                            <Button
                              size="xs"
                              variant="light"
                              fullWidth
                              leftSection={<IconDownload size={14} />}
                              onClick={() => handleDownloadDocument(doc)}
                            >
                              {t('Download')}
                            </Button>
                            <ActionIcon
                              size="lg"
                              variant="light"
                              color="red"
                              onClick={() => handleDeleteDocument(doc)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        ) : doc.status === 'failed' ? (
                          <Badge size="sm" color="red" fullWidth>
                            {t('Failed')}
                          </Badge>
                        ) : (
                          <Badge size="sm" color={getStatusColor(doc.status)} fullWidth>
                            {doc.status === 'processing' ? t('Processing...') : t('Queued')}
                          </Badge>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </div>
          </Stack>
        </Paper>
      </Grid.Col>

      {/* Order Details Form - 3/4 width */}
      <Grid.Col span={9}>
        <Paper p="md" withBorder>
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label={t('Order Reference')}
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                readOnly={!canEdit}
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Supplier Reference')}
                value={formData.supplier_reference}
                onChange={(e) => setFormData({ ...formData, supplier_reference: e.target.value })}
                readOnly={!canEdit}
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <TextInput
                label={t('Description')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                readOnly={!canEdit}
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Supplier')}
                value={order.supplier_detail?.name || `Supplier ${order.supplier}`}
                readOnly
                disabled
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label={t('Currency')}
                value={order.order_currency || 'EUR'}
                readOnly
                disabled
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <DatePickerInput
                label={t('Issue Date')}
                value={issueDate}
                readOnly
                disabled
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <DatePickerInput
                label={t('Target Date')}
                value={targetDate}
                onChange={(date) => {
                  if (date) {
                    setFormData({ ...formData, target_date: date.toISOString().split('T')[0] });
                  }
                }}
                disabled={!canEdit}
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <Select
                label={t('Destination')}
                value={formData.destination}
                onChange={(value) => setFormData({ ...formData, destination: value || '' })}
                data={stockLocations.map(loc => ({ value: String(loc.pk), label: loc.name }))}
                disabled={!canEdit}
                searchable
                clearable
              />
            </Grid.Col>

            <Grid.Col span={12}>
              <Textarea
                label={t('Notes')}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                readOnly={!canEdit}
                minRows={4}
              />
            </Grid.Col>

            {canEdit && (
              <Grid.Col span={12}>
                <Group justify="flex-end">
                  <Button
                    leftSection={<IconDeviceFloppy size={16} />}
                    onClick={handleSave}
                    loading={saving}
                    disabled={!hasChanges()}
                  >
                    {t('Save Changes')}
                  </Button>
                </Group>
              </Grid.Col>
            )}
          </Grid>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}
