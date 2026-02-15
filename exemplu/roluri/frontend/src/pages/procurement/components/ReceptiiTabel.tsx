import { useState, useEffect } from 'react';
import {
  Paper,
  Title,
  Button,
  Table,
  Group,
  Text,
  ActionIcon,
  Modal,
  Select,
  Stack,
  Badge,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { Dropzone } from '@mantine/dropzone';
import { IconPlus, IconTrash, IconUpload, IconFile, IconX, IconDownload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../../services/api';

interface Receptie {
  id: string;
  tip: string;
  data_receptie: string;
  responsabil_id: string;
  responsabil_name?: string;
  documente: string[];
  created_at: string;
  created_by: string;
}

interface ReceptiiTabelProps {
  contractId: string;
  receptii: Receptie[];
  onUpdate: () => void;
  isAdmin: boolean;
}

export function ReceptiiTabel({ contractId, receptii, onUpdate, isAdmin }: ReceptiiTabelProps) {
  const [modalOpened, setModalOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [usersOptions, setUsersOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [formData, setFormData] = useState({
    tip: '',
    data_receptie: new Date(),
    responsabil_id: '',
    documente: [] as string[],
  });

  useEffect(() => {
    if (modalOpened) {
      loadUsers();
    }
  }, [modalOpened]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/users/select');
      const options = Array.isArray(response.data)
        ? response.data.map((user: any) => ({
            value: user.id || user._id || '',
            label: user.username || user.email || 'Unknown',
          })).filter((opt: any) => opt.value && opt.label)
        : [];
      setUsersOptions(options);
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsersOptions([]);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    try {
      setUploading(true);
      const uploadedHashes: string[] = [];

      for (const file of files) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('title', file.name);
        formDataUpload.append('main', 'false');

        const response = await api.post('/api/library/upload', formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        uploadedHashes.push(response.data.hash);
      }

      setFormData({
        ...formData,
        documente: [...formData.documente, ...uploadedHashes],
      });

      notifications.show({
        title: 'Succes',
        message: `${files.length} fișier(e) încărcat(e)`,
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to upload files:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || error.message || 'Nu s-au putut încărca fișierele',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.tip || !formData.responsabil_id) {
      notifications.show({
        title: 'Eroare',
        message: 'Completează toate câmpurile obligatorii',
        color: 'red',
      });
      return;
    }

    try {
      setLoading(true);
      await api.post(`/api/procurement/contracte/${contractId}/receptii`, {
        ...formData,
        data_receptie: formData.data_receptie.toISOString().split('T')[0],
      });

      notifications.show({
        title: 'Succes',
        message: 'Recepție înregistrată cu succes',
        color: 'green',
      });

      setModalOpened(false);
      setFormData({
        tip: '',
        data_receptie: new Date(),
        responsabil_id: '',
        documente: [],
      });
      onUpdate();
    } catch (error: any) {
      console.error('Failed to add receptie:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut înregistra recepția',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (receptieId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi această recepție?')) return;

    try {
      await api.delete(`/api/procurement/contracte/${contractId}/receptii/${receptieId}`);
      notifications.show({
        title: 'Succes',
        message: 'Recepție ștearsă cu succes',
        color: 'green',
      });
      onUpdate();
    } catch (error: any) {
      console.error('Failed to delete receptie:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut șterge recepția',
        color: 'red',
      });
    }
  };

  const getTipBadge = (tip: string) => {
    const config: Record<string, { color: string }> = {
      'totala': { color: 'green' },
      'partiala': { color: 'yellow' },
    };

    const { color } = config[tip] || { color: 'gray' };

    return (
      <Badge color={color} variant="filled">
        {tip === 'totala' ? 'Totală' : 'Parțială'}
      </Badge>
    );
  };

  return (
    <>
      <Paper withBorder p="md">
        <Group justify="space-between" mb="md">
          <Title order={4}>Recepții</Title>
          <Button
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpened(true)}
          >
            Înregistrare nouă
          </Button>
        </Group>

        {receptii.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            Nu există recepții înregistrate
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tip</Table.Th>
                <Table.Th>Data recepției</Table.Th>
                <Table.Th>Responsabil</Table.Th>
                <Table.Th>Document(e)</Table.Th>
                {isAdmin && <Table.Th>Acțiuni</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {receptii.map((rec) => (
                <Table.Tr key={rec.id}>
                  <Table.Td>{getTipBadge(rec.tip)}</Table.Td>
                  <Table.Td>{new Date(rec.data_receptie).toLocaleDateString('ro-RO')}</Table.Td>
                  <Table.Td>{rec.responsabil_name || 'N/A'}</Table.Td>
                  <Table.Td>
                    {rec.documente && rec.documente.length > 0 ? (
                      <Stack gap="xs">
                        {rec.documente.map((hash, idx) => (
                          <Group key={hash} gap="xs">
                            <Text size="sm">Doc {idx + 1}</Text>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              onClick={() => window.open(`/api/data/files/${hash}`, '_blank')}
                            >
                              <IconDownload size={14} />
                            </ActionIcon>
                          </Group>
                        ))}
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                  {isAdmin && (
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => handleDelete(rec.id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Add Receptie Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Înregistrare recepție"
        size="lg"
      >
        <Stack gap="md">
          <Select
            label="Tip"
            placeholder="Selectează tipul"
            data={[
              { value: 'totala', label: 'Totală' },
              { value: 'partiala', label: 'Parțială' },
            ]}
            value={formData.tip}
            onChange={(value) => setFormData({ ...formData, tip: value || '' })}
            required
          />

          <DateInput
            label="Data recepției"
            value={formData.data_receptie}
            onChange={(val) => setFormData({ ...formData, data_receptie: val || new Date() })}
            valueFormat="DD/MM/YYYY"
            required
          />

          <Select
            label="Responsabil"
            placeholder="Selectează responsabilul"
            data={usersOptions}
            value={formData.responsabil_id}
            onChange={(value) => setFormData({ ...formData, responsabil_id: value || '' })}
            searchable
            required
          />

          <Dropzone
            onDrop={handleFileUpload}
            loading={uploading}
            multiple
          >
            <Group justify="center" gap="xs" style={{ minHeight: 80, pointerEvents: 'none' }}>
              <Dropzone.Accept>
                <IconUpload size={32} stroke={1.5} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={32} stroke={1.5} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconFile size={32} stroke={1.5} />
              </Dropzone.Idle>
              <div>
                <Text size="sm" inline>
                  Document(e) recepție (opțional)
                </Text>
              </div>
            </Group>
          </Dropzone>

          {formData.documente.length > 0 && (
            <Text size="sm" c="dimmed">
              {formData.documente.length} fișier(e) încărcat(e)
            </Text>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setModalOpened(false)}>
              Anulează
            </Button>
            <Button onClick={handleAdd} loading={loading}>
              Înregistrează
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}


