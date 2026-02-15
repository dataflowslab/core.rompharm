import { useState, useEffect } from 'react';
import {
  Stack,
  TextInput,
  Button,
  Group,
  Paper,
  Title,
  NumberInput,
  Textarea,
  Divider,
  Text,
  ActionIcon,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconUpload, IconFile, IconX, IconTrash, IconDownload } from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { SafeSelect, SafeMultiSelect } from './components';

interface DocTehnicFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  isEditing?: boolean;
}

export function DocTehnicForm({ onSubmit, onCancel, initialData, isEditing = false }: DocTehnicFormProps) {
  const [formData, setFormData] = useState({
    referat_id: initialData?.referat_id || '',
    fundamentare_id: initialData?.fundamentare_id || '',
    titlu: initialData?.titlu || '',
    tip_achizitie: initialData?.tip_achizitie || '',
    cod_cpv_principal: initialData?.cod_cpv_principal || '',
    coduri_cpv_secundare: initialData?.coduri_cpv_secundare || [],
    durata_contract: initialData?.durata_contract || '',
    valoare_estimata: initialData?.valoare_estimata || 0,
    caracteristici: initialData?.caracteristici || '',
    documentatie: initialData?.documentatie || [],
    responsabil_id: initialData?.responsabil_id || '',
    observatii: initialData?.observatii || '',
    versiune: initialData?.versiune || '1.0',
  });

  const [referateOptions, setReferateOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [fundamentareOptions, setFundamentareOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [cpvOptions, setCpvOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [usersOptions, setUsersOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingReferate, setLoadingReferate] = useState(false);
  const [loadingFundamentare, setLoadingFundamentare] = useState(false);

  useEffect(() => {
    loadReferateAprobate();
    loadFundamentareAprobate();
    loadCPVCodes();
    loadUsers();
  }, []);

  useEffect(() => {
    // When referat is selected, filter fundamentare to show only those linked to this referat
    if (formData.referat_id) {
      loadFundamentareByReferat(formData.referat_id);
      loadReferatDetails(formData.referat_id);
    } else {
      // If no referat selected, show all approved fundamentare
      loadFundamentareAprobate();
    }
  }, [formData.referat_id]);

  useEffect(() => {
    // When fundamentare is selected, auto-populate referat if it has one
    if (formData.fundamentare_id) {
      loadFundamentareDetails(formData.fundamentare_id);
    }
  }, [formData.fundamentare_id]);

  const loadReferateAprobate = async () => {
    setLoadingReferate(true);
    try {
      const response = await api.get('/api/procurement/referate/approved/list');
      setReferateOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load referate:', error);
      setReferateOptions([]);
    } finally {
      setLoadingReferate(false);
    }
  };

  const loadFundamentareAprobate = async () => {
    setLoadingFundamentare(true);
    try {
      const response = await api.get('/api/procurement/fundamentare/approved/list');
      setFundamentareOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load fundamentare:', error);
      setFundamentareOptions([]);
    } finally {
      setLoadingFundamentare(false);
    }
  };

  const loadFundamentareByReferat = async (referatId: string) => {
    setLoadingFundamentare(true);
    try {
      const response = await api.get('/api/procurement/fundamentare/approved/list', {
        params: { referat_id: referatId }
      });
      setFundamentareOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load fundamentare by referat:', error);
      setFundamentareOptions([]);
    } finally {
      setLoadingFundamentare(false);
    }
  };

  const loadCPVCodes = async (searchTerm: string = '') => {
    try {
      const params: any = { limit: 50 };
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      const response = await api.get('/api/procurement/nomenclatoare/coduri-cpv', { params });
      if (response.data && Array.isArray(response.data)) {
        const options = response.data.map((cpv: any) => ({
          value: cpv.value,
          label: cpv.label,
          cod: cpv.cod,
          nume: cpv.nume,
        }));
        setCpvOptions(options);
      } else {
        setCpvOptions([]);
      }
    } catch (error) {
      console.error('Failed to load CPV codes:', error);
      // Fallback to empty array to prevent white page
      setCpvOptions([]);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/users/select');
      if (response.data && Array.isArray(response.data)) {
        const options = response.data.map((user: any) => ({
          value: user.id || user._id || '',
          label: user.username || user.email || 'Unknown',
        })).filter((opt: any) => opt.value && opt.label);
        setUsersOptions(options);
      } else {
        setUsersOptions([]);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsersOptions([]);
    }
  };

  const loadReferatDetails = async (referatId: string) => {
    try {
      const response = await api.get(`/api/procurement/referate/${referatId}`);
      const referat = response.data;
      
      // Auto-populate tip_achizitie
      if (referat.categorie && !formData.tip_achizitie) {
        setFormData(prev => ({ ...prev, tip_achizitie: referat.categorie }));
      }
      
      // Auto-populate valoare_estimata if not set from fundamentare
      if (referat.valoare_estimata && !formData.fundamentare_id) {
        setFormData(prev => ({ ...prev, valoare_estimata: referat.valoare_estimata }));
      }
    } catch (error) {
      console.error('Failed to load referat details:', error);
    }
  };

  const loadFundamentareDetails = async (fundamentareId: string) => {
    try {
      const response = await api.get(`/api/procurement/fundamentare/${fundamentareId}`);
      const fundamentare = response.data;
      
      // Auto-populate referat if fundamentare has one
      if (fundamentare.referat_id && !formData.referat_id) {
        setFormData(prev => ({ ...prev, referat_id: fundamentare.referat_id }));
      }
      
      // Try to extract valoare_estimata from form_data
      if (fundamentare.form_data) {
        // Calculate from tabel1 if available
        if (fundamentare.form_data.tabel1 && fundamentare.form_data.tabel1.length > 0) {
          const total = fundamentare.form_data.tabel1.reduce((sum: number, row: any) => {
            return sum + (parseFloat(row.col7) || 0);
          }, 0);
          if (total > 0) {
            setFormData(prev => ({ ...prev, valoare_estimata: total }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load fundamentare details:', error);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;

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
    } catch (error: any) {
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

  const removeDocument = (hash: string) => {
    setFormData({
      ...formData,
      documentatie: formData.documentatie.filter((h: string) => h !== hash),
    });
  };

  const handleSubmit = () => {
    // Validation - referat is now required
    if (!formData.referat_id) {
      notifications.show({
        title: 'Eroare',
        message: 'Referatul este obligatoriu',
        color: 'red',
      });
      return;
    }

    if (!formData.titlu || !formData.tip_achizitie || !formData.cod_cpv_principal || 
        !formData.durata_contract || !formData.caracteristici || !formData.responsabil_id || 
        !formData.versiune) {
      notifications.show({
        title: 'Eroare',
        message: 'Completează toate câmpurile obligatorii',
        color: 'red',
      });
      return;
    }

    onSubmit(formData);
  };

  return (
    <Stack gap="md">
      {/* Legături cu alte documente */}
      <Paper withBorder p="md">
        <Title order={4} mb="md">Legături cu alte documente</Title>
        <Stack gap="sm">
          <SafeSelect
            label="Alege referat"
            placeholder="Selectează un referat aprobat"
            data={referateOptions}
            value={formData.referat_id}
            onChange={(value) => setFormData({ ...formData, referat_id: value || '' })}
            searchable
            clearable
            disabled={loadingReferate}
            nothingFoundMessage="Nu există referate aprobate"
            required
            description="Obligatoriu - selectează referatul asociat"
          />

          <SafeSelect
            label="Notă de fundamentare (opțional)"
            placeholder="Selectează o notă de fundamentare aprobată"
            data={fundamentareOptions}
            value={formData.fundamentare_id}
            onChange={(value) => setFormData({ ...formData, fundamentare_id: value || '' })}
            searchable
            clearable
            disabled={loadingFundamentare}
            nothingFoundMessage="Nu există note de fundamentare aprobate"
          />
        </Stack>
      </Paper>

      {/* Date principale */}
      <Paper withBorder p="md">
        <Title order={4} mb="md">Date principale</Title>
        <Stack gap="sm">
          <TextInput
            label="Titlu"
            placeholder="Introduceți titlul achizitiei"
            value={formData.titlu}
            onChange={(e) => setFormData({ ...formData, titlu: e.target.value })}
            required
          />

          <SafeSelect
            label="Tip achiziție"
            placeholder="Selectează tipul"
            data={[
              { value: 'bunuri', label: 'Bunuri' },
              { value: 'servicii', label: 'Servicii' },
              { value: 'lucrari', label: 'Lucrări' },
            ]}
            value={formData.tip_achizitie}
            onChange={(value) => setFormData({ ...formData, tip_achizitie: value || '' })}
            required
            description={formData.referat_id ? 'Completat automat din referat' : ''}
          />

          <SafeSelect
            label="Cod CPV principal"
            placeholder="Caută după cod sau nume..."
            data={cpvOptions}
            value={formData.cod_cpv_principal}
            onChange={(value) => setFormData({ ...formData, cod_cpv_principal: value || '' })}
            searchable
            required
            nothingFoundMessage="Nu există coduri CPV"
            onSearchChange={(query) => {
              if (query.length >= 2 || query.length === 0) {
                loadCPVCodes(query);
              }
            }}
            description="Caută după cod (ex: 03111000) sau nume (ex: Semințe)"
          />

          <SafeMultiSelect
            label="Coduri CPV secundare"
            placeholder="Caută după cod sau nume..."
            data={cpvOptions}
            value={formData.coduri_cpv_secundare}
            onChange={(value) => setFormData({ ...formData, coduri_cpv_secundare: value })}
            searchable
            nothingFoundMessage="Nu există coduri CPV"
            onSearchChange={(query) => {
              if (query.length >= 2 || query.length === 0) {
                loadCPVCodes(query);
              }
            }}
            description="Caută după cod sau nume"
          />

          <TextInput
            label="Durată contract estimată"
            placeholder="Ex: 12 luni, 24 luni, etc."
            value={formData.durata_contract}
            onChange={(e) => setFormData({ ...formData, durata_contract: e.target.value })}
            required
          />

          <NumberInput
            label="Valoare estimată (lei)"
            placeholder="Valoare estimată"
            value={formData.valoare_estimata}
            onChange={(val) => setFormData({ ...formData, valoare_estimata: val || 0 })}
            decimalScale={2}
            hideControls
            required
            description={formData.fundamentare_id || formData.referat_id ? 'Preluată automat din documentul selectat' : ''}
          />

          <Textarea
            label="Caracteristici"
            placeholder="Descrieți caracteristicile tehnice..."
            value={formData.caracteristici}
            onChange={(e) => setFormData({ ...formData, caracteristici: e.target.value })}
            minRows={4}
            required
          />

          <SafeSelect
            label="Persoană responsabilă"
            placeholder="Selectează persoana responsabilă"
            data={usersOptions}
            value={formData.responsabil_id}
            onChange={(value) => setFormData({ ...formData, responsabil_id: value || '' })}
            searchable
            required
            nothingFoundMessage="Nu există utilizatori"
          />

          <Textarea
            label="Observații"
            placeholder="Observații suplimentare..."
            value={formData.observatii}
            onChange={(e) => setFormData({ ...formData, observatii: e.target.value })}
            minRows={3}
          />

          <TextInput
            label="Versiune"
            placeholder="Ex: 1.0, 1.1, 2.0"
            value={formData.versiune}
            onChange={(e) => setFormData({ ...formData, versiune: e.target.value })}
            required
          />
        </Stack>
      </Paper>

      {/* Documentație */}
      <Paper withBorder p="md">
        <Title order={4} mb="md">Documentație</Title>
        <Text size="sm" c="dimmed" mb="md">
          Încarcă unul sau mai multe documente (specificații tehnice, desene, scheme, etc.)
        </Text>

        <Dropzone
          onDrop={handleFileUpload}
          loading={uploading}
          multiple
          maxSize={10 * 1024 * 1024}
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
              <Text size="lg" inline>
                Trage fișierele aici sau click pentru a selecta
              </Text>
              <Text size="sm" c="dimmed" inline mt={7}>
                Fișiere până la 10MB
              </Text>
            </div>
          </Group>
        </Dropzone>

        {formData.documentatie.length > 0 && (
          <Stack gap="xs" mt="md">
            <Divider label="Fișiere încărcate" />
            {formData.documentatie.map((hash: string, idx: number) => (
              <Group key={hash} justify="space-between">
                <Group>
                  <IconFile size={16} />
                  <Text size="sm">Document {idx + 1}</Text>
                </Group>
                <Group gap="xs">
                  {isEditing && (
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => window.open(`/api/data/files/${hash}`, '_blank')}
                    >
                      <IconDownload size={16} />
                    </ActionIcon>
                  )}
                  <ActionIcon color="red" variant="subtle" onClick={() => removeDocument(hash)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Actions */}
      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={onCancel}>
          Anulează
        </Button>
        <Button onClick={handleSubmit}>
          Salvează
        </Button>
      </Group>
    </Stack>
  );
}






