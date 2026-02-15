import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Table,
  Modal,
  Textarea,
  Group,
  Stack,
  ActionIcon,
  Button,
  Text,
  Alert,
  Loader,
  Badge,
  Paper
} from '@mantine/core';
import { IconEdit, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../services/api';

interface ConfigEntry {
  id: string;
  key: string;
  value: any;
  description?: string;
  updated_at?: string;
}

export function SettingsPage() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfigEntry | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await api.get('/api/config/entries/all');
      // Normalize response to always be an array
      const data = response.data;
      if (Array.isArray(data)) {
        setConfigs(data);
      } else if (data && typeof data === 'object') {
        // If single object, wrap in array
        setConfigs([data]);
      } else {
        setConfigs([]);
      }
    } catch (error) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to load settings'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config: ConfigEntry) => {
    setEditingConfig(config);
    // Pretty print JSON/object values
    if (typeof config.value === 'object') {
      setEditValue(JSON.stringify(config.value, null, 2));
    } else {
      setEditValue(String(config.value));
    }
    setModalOpened(true);
  };

  const handleSave = async () => {
    if (!editingConfig) return;

    setSaving(true);
    try {
      // Try to parse as JSON if it looks like JSON
      let valueToSave = editValue;
      if (editValue.trim().startsWith('{') || editValue.trim().startsWith('[')) {
        try {
          valueToSave = JSON.parse(editValue);
        } catch {
          // If parsing fails, save as string
        }
      }

      await api.put(`/api/config/entry/${editingConfig.key}`, { value: valueToSave });
      
      notifications.show({
        title: t('Success'),
        message: t('Setting updated successfully'),
        color: 'green',
        icon: <IconCheck size={16} />
      });
      
      setModalOpened(false);
      loadConfigs();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save setting'),
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const formatValue = (value: any): string => {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const getValuePreview = (value: any): string => {
    const str = formatValue(value);
    if (str.length > 50) {
      return str.substring(0, 50) + '...';
    }
    return str;
  };

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Title order={3}>{t('Loading settings...')}</Title>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Group justify="space-between">
          <Title order={2}>{t('Settings')}</Title>
          <Badge color="blue" variant="light">
            {configs.length} {t('entries')}
          </Badge>
        </Group>

        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          {t('Warning: Editing these settings directly can affect system behavior. Make sure you know what you are doing.')}
        </Alert>

        <Paper shadow="sm" withBorder>
          <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Key')}</Table.Th>
              <Table.Th>{t('Value')}</Table.Th>
              <Table.Th>{t('Last Updated')}</Table.Th>
              <Table.Th>{t('Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {configs.map((config) => (
              <Table.Tr key={config.id}>
                <Table.Td>
                  <Text fw={500} size="sm" ff="monospace">
                    {config.key}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" ff="monospace" style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {getValuePreview(config.value)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {config.updated_at ? new Date(config.updated_at).toLocaleString() : '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    color="blue"
                    onClick={() => handleEdit(config)}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          </Table>
        </Paper>

        {configs.length === 0 && (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No settings')}>
            {t('No configuration entries found in the database.')}
          </Alert>
        )}
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={t('Edit Setting')}
        size="lg"
      >
        <Stack>
          <Text size="sm" fw={500}>
            {t('Key')}: <Text span ff="monospace">{editingConfig?.key}</Text>
          </Text>

          <Textarea
            label={t('Value')}
            placeholder={t('Enter value (plain text or JSON format for objects/arrays)')}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            minRows={15}
            maxRows={30}
            styles={{ input: { fontFamily: 'monospace, monospace', fontSize: '0.875rem' } }}
          />

          <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
            <Stack gap="xs">
              <Text size="sm">{t('Tips:')}</Text>
              <Text size="xs">• {t('For plain text (like email content), just type normally')}</Text>
              <Text size="xs">• {t('For JSON arrays/objects, use proper JSON format with quotes')}</Text>
              <Text size="xs">• {t('Example array:')} {`[{"key": "value"}, {"key2": "value2"}]`}</Text>
            </Stack>
          </Alert>

          <Group justify="flex-end">
            <Button variant="light" onClick={() => setModalOpened(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {t('Save')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
