import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Select,
  TextInput,
  NumberInput,
  Textarea,
  Button,
  Group,
  Divider,
  Text,
  Paper,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { Dropzone } from '@mantine/dropzone';
import { IconUpload, IconFile, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../../services/api';

interface AddOfertaModalProps {
  opened: boolean;
  onClose: () => void;
  achizitieId: string;
  onSuccess: () => void;
}

export function AddOfertaModal({ opened, onClose, achizitieId, onSuccess }: AddOfertaModalProps) {
  const [ofertantiOptions, setOfertantiOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [judeteOptions, setJudeteOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    ofertant_id: '',
    data_primirii: new Date(),
    valoare: 0,
    observatii: '',
    documentatie: [] as string[],
    // New ofertant fields
    ofertant_denumire: '',
    ofertant_cif: '',
    ofertant_regcom: '',
    ofertant_judet: '',
    ofertant_localitate: '',
    ofertant_adresa: '',
    ofertant_persoana_contact: '',
    ofertant_telefon: '',
    ofertant_email: '',
    ofertant_observatii: '',
  });

  const [showNewOfertant, setShowNewOfertant] = useState(false);

  useEffect(() => {
    if (opened) {
      loadOfertanti();
      loadJudete();
    }
  }, [opened]);

  const loadOfertanti = async () => {
    try {
      const response = await api.get('/api/procurement/achizitii/ofertanti/list');
      setOfertantiOptions([
        { value: 'new', label: '+ Adaugă ofertant nou' },
        ...response.data
      ]);
    } catch (error) {
      console.error('Failed to load ofertanti:', error);
    }
  };

  const loadJudete = async () => {
    try {
      const response = await api.get('/api/nomenclatoare/nom_judete');
      const options = response.data.map((j: any) => ({
        value: j.nume,
        label: j.nume,
      }));
      setJudeteOptions(options);
    } catch (error) {
      console.error('Failed to load judete:', error);
    }
  };

  const handleOfertantChange = (value: string | null) => {
    setFormData({ ...formData, ofertant_id: value || '' });
    setShowNewOfertant(value === 'new');
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
        documentatie: [...formData.documentatie, ...uploadedHashes],
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
        message: 'Nu s-au putut încărca fișierele',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.ofertant_id || !formData.valoare) {
      notifications.show({
        title: 'Eroare',
        message: 'Completează câmpurile obligatorii',
        color: 'red',
      });
      return;
    }

    if (showNewOfertant && !formData.ofertant_denumire) {
      notifications.show({
        title: 'Eroare',
        message: 'Completează denumirea ofertantului',
        color: 'red',
      });
      return;
    }

    try {
      setLoading(true);
      await api.post(`/api/procurement/achizitii/${achizitieId}/oferte`, {
        ...formData,
        data_primirii: formData.data_primirii.toISOString(),
      });

      notifications.show({
        title: 'Succes',
        message: 'Oferta a fost adăugată',
        color: 'green',
      });

      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Failed to add oferta:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut adăuga oferta',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      ofertant_id: '',
      data_primirii: new Date(),
      valoare: 0,
      observatii: '',
      documentatie: [],
      ofertant_denumire: '',
      ofertant_cif: '',
      ofertant_regcom: '',
      ofertant_judet: '',
      ofertant_localitate: '',
      ofertant_adresa: '',
      ofertant_persoana_contact: '',
      ofertant_telefon: '',
      ofertant_email: '',
      ofertant_observatii: '',
    });
    setShowNewOfertant(false);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Adaugă ofertă"
      size="lg"
      styles={{
        body: { maxHeight: '80vh', overflowY: 'auto' }
      }}
    >
      <Stack gap="md">
        <Select
          label="Ofertant"
          placeholder="Selectează ofertantul"
          data={ofertantiOptions}
          value={formData.ofertant_id}
          onChange={handleOfertantChange}
          searchable
          required
        />

        {showNewOfertant && (
          <Paper withBorder p="md" bg="gray.0">
            <Text size="sm" fw={600} mb="sm">Date ofertant nou</Text>
            <Stack gap="sm">
              <TextInput
                label="Denumire"
                value={formData.ofertant_denumire}
                onChange={(e) => setFormData({ ...formData, ofertant_denumire: e.target.value })}
                required
              />
              <Group grow>
                <TextInput
                  label="CIF"
                  value={formData.ofertant_cif}
                  onChange={(e) => setFormData({ ...formData, ofertant_cif: e.target.value })}
                />
                <TextInput
                  label="Reg. Com."
                  value={formData.ofertant_regcom}
                  onChange={(e) => setFormData({ ...formData, ofertant_regcom: e.target.value })}
                />
              </Group>
              <Group grow>
                <Select
                  label="Județ"
                  data={judeteOptions}
                  value={formData.ofertant_judet}
                  onChange={(value) => setFormData({ ...formData, ofertant_judet: value || '' })}
                  searchable
                />
                <TextInput
                  label="Localitate"
                  value={formData.ofertant_localitate}
                  onChange={(e) => setFormData({ ...formData, ofertant_localitate: e.target.value })}
                />
              </Group>
              <TextInput
                label="Adresă"
                value={formData.ofertant_adresa}
                onChange={(e) => setFormData({ ...formData, ofertant_adresa: e.target.value })}
              />
              <Group grow>
                <TextInput
                  label="Persoană contact"
                  value={formData.ofertant_persoana_contact}
                  onChange={(e) => setFormData({ ...formData, ofertant_persoana_contact: e.target.value })}
                />
                <TextInput
                  label="Telefon"
                  value={formData.ofertant_telefon}
                  onChange={(e) => setFormData({ ...formData, ofertant_telefon: e.target.value })}
                />
              </Group>
              <TextInput
                label="Email"
                type="email"
                value={formData.ofertant_email}
                onChange={(e) => setFormData({ ...formData, ofertant_email: e.target.value })}
              />
            </Stack>
          </Paper>
        )}

        <Divider />

        <DateTimePicker
          label="Data primirii"
          value={formData.data_primirii}
          onChange={(val) => setFormData({ ...formData, data_primirii: val || new Date() })}
          valueFormat="DD/MM/YYYY HH:mm"
          required
        />

        <NumberInput
          label="Valoare (lei)"
          value={formData.valoare}
          onChange={(val) => setFormData({ ...formData, valoare: val || 0 })}
          decimalScale={2}
          hideControls
          required
        />

        <Textarea
          label="Observații"
          value={formData.observatii}
          onChange={(e) => setFormData({ ...formData, observatii: e.target.value })}
          minRows={3}
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
                Documentație ofertă (opțional)
              </Text>
            </div>
          </Group>
        </Dropzone>

        {formData.documentatie.length > 0 && (
          <Text size="sm" c="dimmed">
            {formData.documentatie.length} fișier(e) încărcat(e)
          </Text>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Anulează
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Adaugă ofertă
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
