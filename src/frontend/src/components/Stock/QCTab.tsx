/**
 * QCTab Component
 * 
 * Editable QC (Quality Control) tab for stock items
 * Layout: Two columns
 * - Left: Editable form (Rompharm BA, Status)
 * - Right: Read-only info (Supplier BA, Transport Conditions)
 */

import { useState, useEffect } from 'react';
import {
  Paper,
  Title,
  Grid,
  Text,
  Badge,
  Button,
  TextInput,
  Select,
  Stack,
  Group,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';

interface QCTabProps {
  stockId: string;
  stock: any;
  onUpdate: () => void;
}

export function QCTab({ stockId, stock, onUpdate }: QCTabProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  
  // Editable fields
  const [rompharmBaNo, setRompharmBaNo] = useState('');
  const [rompharmBaDate, setRompharmBaDate] = useState<Date | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [stockStatuses, setStockStatuses] = useState<Array<{ value: string; label: string; color: string }>>([]);

  useEffect(() => {
    fetchStockStatuses();
  }, []);

  useEffect(() => {
    if (stock) {
      // Initialize fields from stock data
      // Rompharm BA fields are separate from Supplier BA fields
      setRompharmBaNo(stock.rompharm_ba_no || '');
      setRompharmBaDate(
        stock.rompharm_ba_date 
          ? new Date(stock.rompharm_ba_date) 
          : null
      );
      setSelectedStatus(stock.state_id || '');
    }
  }, [stock]);

  const fetchStockStatuses = async () => {
    try {
      const response = await api.get('/modules/depo_procurement/api/stock-statuses');
      const statuses = response.data.map((status: any) => ({
        value: status._id,
        label: status.name,
        color: status.color || 'gray',
      }));
      setStockStatuses(statuses);
    } catch (error: any) {
      console.error('Failed to fetch stock statuses:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load stock statuses'),
        color: 'red',
      });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updateData = {
        rompharm_ba_no: rompharmBaNo,
        rompharm_ba_date: rompharmBaDate ? rompharmBaDate.toISOString() : null,
        state_id: selectedStatus,
      };

      await api.put(`/modules/inventory/api/stocks/${stockId}`, updateData);
      
      notifications.show({
        title: t('Success'),
        message: t('QC information updated successfully'),
        color: 'green',
      });
      
      onUpdate();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update QC information'),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Grid>
      {/* Left Column: Editable Form */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper shadow="xs" p="md" withBorder>
          <Title order={4} mb="md">{t('Rompharm QC')}</Title>
          
          <Stack gap="md">
            <TextInput
              label={t('Rompharm BA No')}
              placeholder={t('Enter Rompharm BA number')}
              value={rompharmBaNo}
              onChange={(e) => setRompharmBaNo(e.target.value)}
            />

            <DateInput
              label={t('Rompharm BA Date')}
              placeholder={t('Select date')}
              value={rompharmBaDate}
              onChange={setRompharmBaDate}
              clearable
            />

            <Select
              label={t('Status')}
              placeholder={t('Select status')}
              value={selectedStatus}
              onChange={(value) => setSelectedStatus(value || '')}
              data={stockStatuses}
              searchable
              renderOption={({ option }) => {
                const status = stockStatuses.find(s => s.value === option.value);
                return (
                  <Group gap="xs">
                    <Badge
                      size="sm"
                      style={{
                        backgroundColor: status?.color || 'gray',
                        color: '#fff',
                      }}
                    >
                      {option.label}
                    </Badge>
                  </Group>
                );
              }}
            />

            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={saving}
              fullWidth
            >
              {t('Save Changes')}
            </Button>
          </Stack>
        </Paper>
      </Grid.Col>

      {/* Right Column: Read-only Information */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Stack gap="md">
          {/* Supplier BA Information */}
          <Paper shadow="xs" p="md" withBorder>
            <Title order={4} mb="md">{t('Supplier BA Information')}</Title>
            <Stack gap="sm">
              <div>
                <Text size="sm" c="dimmed">{t('Supplier BA No')}</Text>
                <Text fw={500}>{stock.supplier_ba_no || '-'}</Text>
              </div>
              
              <div>
                <Text size="sm" c="dimmed">{t('Supplier BA Date')}</Text>
                <Text fw={500}>
                  {stock.supplier_ba_date 
                    ? new Date(stock.supplier_ba_date).toLocaleDateString() 
                    : '-'}
                </Text>
              </div>

              <Divider />

              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">{t('In Accordance with Supplier BA')}</Text>
                  <Badge color={stock.accord_ba ? 'green' : 'gray'} mt="xs">
                    {stock.accord_ba ? t('Yes') : t('No')}
                  </Badge>
                </div>
                
                <div>
                  <Text size="sm" c="dimmed">{t('Supplier in List')}</Text>
                  <Badge color={stock.is_list_supplier ? 'green' : 'gray'} mt="xs">
                    {stock.is_list_supplier ? t('Yes') : t('No')}
                  </Badge>
                </div>
              </Group>
            </Stack>
          </Paper>

          {/* Transport Conditions */}
          <Paper shadow="xs" p="md" withBorder>
            <Title order={4} mb="md">{t('Transport Conditions')}</Title>
            <Stack gap="sm">
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">{t('Clean Transport')}</Text>
                  <Badge color={stock.clean_transport ? 'green' : 'gray'} mt="xs">
                    {stock.clean_transport ? t('Yes') : t('No')}
                  </Badge>
                </div>
                
                <div>
                  <Text size="sm" c="dimmed">{t('Temperature Control')}</Text>
                  <Badge color={stock.temperature_control ? 'green' : 'gray'} mt="xs">
                    {stock.temperature_control ? t('Yes') : t('No')}
                  </Badge>
                </div>
              </Group>

              {stock.temperature_control && (
                <>
                  <Divider />
                  <div>
                    <Text size="sm" c="dimmed">{t('Temperature Conditions Met')}</Text>
                    <Badge 
                      color={stock.temperature_conditions_met ? 'green' : 'red'} 
                      mt="xs"
                    >
                      {stock.temperature_conditions_met ? t('Yes') : t('No')}
                    </Badge>
                  </div>
                </>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
