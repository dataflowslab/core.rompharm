import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Button,
  Group,
  Stack,
  Select,
  Paper,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconArrowLeft, IconUpload, IconFile, IconX } from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';

export function ExecutieBugetaraNewPage() {
  const navigate = useNavigate();
  const [contracteOptions, setContracteOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    contract_id: '',
    facturi: [] as string[],
    note_receptie: [] as string[],
  });

  useEffect(() => {
    loadContracte();
  }, []);

  const loadContracte = async () => {
    try {
      const response = await api.get('/api/procurement/docuplata/contracte/list');
      setContracteOptions(response.data);
    } catch (error) {
      console.error('Failed to load contracte:', error);
    }
  };

  const handleFacturiUpload = async (files: File[]) => {
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
        facturi: [...formData.facturi, ...uploadedHashes],
      });

      notifications.show({
        title: 'Succes',
        message: `${files.length} factură/facturi încărcată/încărcate`,
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to upload facturi:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca facturile',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleNoteReceptieUpload = async (files: File[]) => {
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
        note_receptie: [...formData.note_receptie, ...uploadedHashes],
      });

      notifications.show({
        title: 'Succes',
        message: `${files.length} notă/note de recepție încărcată/încărcate`,
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to upload note receptie:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca notele de recepție',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.contract_id) {
      notifications.show({
        title: 'Eroare',
        message: 'Selectează contractul',
        color: 'red',
      });
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/api/procurement/docuplata', formData);

      notifications.show({
        title: 'Succes',
        message: 'Document de plată creat cu succes',
        color: 'green',
      });

      navigate(`/procurement/executie-bugetara/${response.data.id}`);
    } catch (error: any) {
      console.error('Failed to create document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut crea documentul',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/procurement/executie-bugetara')}
          >
            Înapoi
          </Button>
          <Title order={2}>Înregistrare nouă</Title>
        </Group>
      </Group>

      <Stack gap="md">
        <Paper withBorder p="md">
          <Stack gap="md">
            <Select
              label="Contract"
              placeholder="Selectează contractul"
              data={contracteOptions}
              value={formData.contract_id}
              onChange={(value) => setFormData({ ...formData, contract_id: value || '' })}
              searchable
              required
            />

            <div>
              <Title order={5} mb="sm">Upload factură/facturi</Title>
              <Dropzone
                onDrop={handleFacturiUpload}
                loading={uploading}
                multiple
              >
                <Group justify="center" gap="xs" style={{ minHeight: 100, pointerEvents: 'none' }}>
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
                    <p style={{ fontSize: '16px', fontWeight: 500 }}>
                      Trage fișierele aici sau click pentru a selecta
                    </p>
                    <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>
                      Poți încărca multiple fișiere
                    </p>
                  </div>
                </Group>
              </Dropzone>
              {formData.facturi.length > 0 && (
                <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                  {formData.facturi.length} fișier(e) încărcat(e)
                </p>
              )}
            </div>

            <div>
              <Title order={5} mb="sm">Upload notă/note de recepție</Title>
              <Dropzone
                onDrop={handleNoteReceptieUpload}
                loading={uploading}
                multiple
              >
                <Group justify="center" gap="xs" style={{ minHeight: 100, pointerEvents: 'none' }}>
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
                    <p style={{ fontSize: '16px', fontWeight: 500 }}>
                      Trage fișierele aici sau click pentru a selecta
                    </p>
                    <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>
                      Poți încărca multiple fișiere
                    </p>
                  </div>
                </Group>
              </Dropzone>
              {formData.note_receptie.length > 0 && (
                <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                  {formData.note_receptie.length} fișier(e) încărcat(e)
                </p>
              )}
            </div>
          </Stack>
        </Paper>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => navigate('/procurement/executie-bugetara')}>
            Anulează
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Salvează
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
