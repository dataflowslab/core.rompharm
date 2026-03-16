import { Grid, Paper, Text, Stack } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';
import { notifications } from '@mantine/notifications';
import { formatDate } from '../../utils/dateFormat';
import { SafeSelect } from '../Common/SafeSelect';
import { debounce } from '../../utils/selectHelpers';

interface BuildOrder {
  _id: string;
  batch_code?: string;
  batch_code_text?: string;
  product_id?: string;
  location_detail?: {
    name: string;
    code: string;
  };
  product_detail?: {
    _id?: string;
    name: string;
    ipn: string;
    description?: string;
  };
  state_detail?: {
    name: string;
  };
  campaign?: boolean;
  created_at?: string;
  grup?: {
    batch_codes?: string[];
  };
}

interface BuildOrderDetailsTabProps {
  buildOrder: BuildOrder;
  onUpdated?: () => void;
}

export function BuildOrderDetailsTab({ buildOrder, onUpdated }: BuildOrderDetailsTabProps) {
  const { t } = useTranslation();
  const batchCode = buildOrder.batch_code_text || buildOrder.batch_code || '-';
  const groupCodes = buildOrder.grup?.batch_codes || [];
  const campaign = buildOrder.campaign ?? (groupCodes.length > 1);
  const [parts, setParts] = useState<any[]>([]);
  const [partSearch, setPartSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [selectedProductOption, setSelectedProductOption] = useState<any | null>(null);

  useEffect(() => {
    const initialProductId = buildOrder.product_id || buildOrder.product_detail?._id || null;
    setSelectedProductId(initialProductId);

    if (buildOrder.product_detail && initialProductId) {
      const option = {
        _id: initialProductId,
        name: buildOrder.product_detail.name,
        IPN: buildOrder.product_detail.ipn,
        label: `${buildOrder.product_detail.name} (${buildOrder.product_detail.ipn})`
      };
      setSelectedProductOption(option);
      setParts([option]);
    } else {
      setSelectedProductOption(null);
      setParts([]);
    }
  }, [buildOrder.product_id, buildOrder.product_detail]);

  const infoRows = useMemo(() => ([
    { label: t('Batch Code'), value: batchCode },
    { label: t('Location'), value: buildOrder.location_detail?.name || '-' },
    { label: t('Campaign'), value: campaign ? t('Yes') : t('No') },
    { label: t('Created'), value: formatDate(buildOrder.created_at || '') }
  ]), [batchCode, buildOrder.location_detail?.name, campaign, buildOrder.created_at, t]);

  const searchParts = async (query: string) => {
    if (!query || query.length < 2) {
      setParts(selectedProductOption ? [selectedProductOption] : []);
      return;
    }

    try {
      const response = await api.get(requestsApi.getParts(), {
        params: { search: query, is_assembly: true }
      });
      const results = response.data.results || response.data || [];
      const mapped = results.map((part: any) => ({
        _id: part._id,
        name: part.name,
        IPN: part.IPN || part.ipn || '',
        label: `${part.name} (${part.IPN || part.ipn || ''})`
      }));
      if (selectedProductOption && !mapped.some((p: any) => String(p._id) === String(selectedProductOption._id))) {
        mapped.unshift(selectedProductOption);
      }
      setParts(mapped);
    } catch (error) {
      console.error('Failed to search parts:', error);
    }
  };

  const debouncedSearchParts = debounce(searchParts, 250);

  const handleProductChange = async (value: string | null) => {
    if (value === selectedProductId) {
      return;
    }

    const nextValue = value || null;
    setSelectedProductId(nextValue);
    const matchedOption = parts.find((p: any) => String(p._id) === String(nextValue));
    if (matchedOption) {
      setSelectedProductOption(matchedOption);
    }
    setSavingProduct(true);
    try {
      await api.patch(requestsApi.updateBuildOrder(buildOrder._id), {
        product_id: value || null
      });
      notifications.show({
        title: t('Success'),
        message: t('Production product updated successfully'),
        color: 'green'
      });
      onUpdated?.();
    } catch (error: any) {
      console.error('Failed to update production product:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update production product'),
        color: 'red'
      });
      setSelectedProductId(buildOrder.product_id || buildOrder.product_detail?._id || null);
    } finally {
      setSavingProduct(false);
    }
  };

  return (
    <Paper p="md">
      {buildOrder.product_detail && (
        <Paper p="md" mb="md" withBorder style={{ backgroundColor: '#f8f9fa' }}>
          <Text size="lg" fw={600} mb="xs">
            {buildOrder.product_detail.name} ({buildOrder.product_detail.ipn})
          </Text>
          {buildOrder.product_detail.description && (
            <Text size="sm" c="dimmed">
              {buildOrder.product_detail.description}
            </Text>
          )}
        </Paper>
      )}

      <Grid>
        {infoRows.map((row) => (
          <Grid.Col span={4} key={row.label}>
            <Stack gap={2}>
              <Text size="sm" c="dimmed">{row.label}</Text>
              <Text fw={500}>{row.value}</Text>
            </Stack>
          </Grid.Col>
        ))}
        <Grid.Col span={6}>
          <SafeSelect
            label={t('Product')}
            placeholder={t('Select production product')}
            data={parts}
            value={selectedProductId || undefined}
            onChange={handleProductChange}
            onSearchChange={(query) => {
              setPartSearch(query);
              debouncedSearchParts(query);
            }}
            searchValue={partSearch}
            searchable
            clearable
            disabled={savingProduct}
            labelKey="label"
          />
        </Grid.Col>
        {groupCodes.length > 0 && (
          <Grid.Col span={12}>
            <Text size="sm" c="dimmed">
              {t('Batch Codes')}: {groupCodes.join(', ')}
            </Text>
          </Grid.Col>
        )}
      </Grid>
    </Paper>
  );
}
