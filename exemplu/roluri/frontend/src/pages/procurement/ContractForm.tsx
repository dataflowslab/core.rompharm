import { useState, useEffect } from 'react';
import {
  Stack,
  TextInput,
  Select,
  Button,
  Group,
  Paper,
  Title,
  Grid,
  Textarea,
  Modal,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { Dropzone } from '@mantine/dropzone';
import { IconUpload, IconFile, IconX, IconPlus } from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';

interface ContractFormProps {
  onSuccess?: (contractId: string) => void;
  onCancel?: () => void;
  initialData?: any;
}

export function ContractForm({ onSuccess, onCancel, initialData }: ContractFormProps) {
  const [formData, setFormData] = useState({
    furnizor_id: initialData?.furnizor_id || '',
    tip_document_id: initialData?.tip_document_id || '',
    contract_parinte_id: initialData?.contract_parinte_id || '',
    nr_document: initialData?.nr_document || '',
    data_document: initialData?.data_document ? new Date(initialData.data_document) : new Date(),
    conditii_livrare: initialData?.conditii_livrare || '',
    conditii_plata: initialData?.conditii_plata || '',
    stare_id: initialData?.stare_id || '',
    observatii: initialData?.observatii || '',
  });

  const [companiiOptions, setCompaniiOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [tipuriDocOptions, setTipuriDocOptions] = useState<Array<{ value: string; label: string; content: string }>>([]);
  const [contracteParinteOptions, setContracteParinteOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [stariOptions, setStariOptions] = useState<Array<{ value: string; label: string; color: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file_id: string; filename: string }>>([]);
  
  // Modal for adding new company
  const [companieModalOpened, setCompanieModalOpened] = useState(false);
  const [newCompanieData, setNewCompanieData] = useState({
    denumire: '',
    cif: '',
    regcom: '',
  });

  // Get selected tip document content
  const selectedTipDoc = tipuriDocOptions.find(t => t.value === formData.tip_document_id);
  const isContract = selectedTipDoc?.content === 'contract';
  const showContractParinte = !isContract && formData.tip_document_id && formData.furnizor_id;

  useEffect(() => {
    loadCompanii();
    loadTipuriDocumente();
    loadStari();
  }, []);

  useEffect(() => {
    // Load contracte parinte when furnizor changes
    if (formData.furnizor_id && showContractParinte) {
      loadContracteParinte(formData.furnizor_id);
    }
  }, [formData.furnizor_id, showContractParinte]);

  const loadCompanii = async () => {
    try {
      const response = await api.get('/api/procurement/nomenclatoare/companii');
      setCompaniiOptions(response.data.map((c: any) => ({
        value: c.value,
        label: c.label,
      })));
    } catch (error) {
      console.error('Failed to load companii:', error);
    }
  };

  const loadTipuriDocumente = async () => {
    try {
      const response = await api.get('/api/procurement/contracte/nomenclatoare/tipuri-documente');
      setTipuriDocOptions(response.data);
    } catch (error) {
      console.error('Failed to load tipuri documente:', error);
    }
  };

  const loadContracteParinte = async (furnizorId: string) => {
    try {
      const response = await api.get(`/api/procurement/contracte/nomenclatoare/contracte-furnizor/${furnizorId}`);
      setContracteParinteOptions(response.data);
    } catch (error) {
      console.error('Failed to load contracte parinte:', error);
    }
  };

  const loadStari = async () => {
    try {
      const response = await api.get('/api/procurement/contracte/nomenclatoare/stari');
      setStariOptions(response.data);
    } catch (error) {
      console.error('Failed to load stari:', error);
    }
  };

  const handleAddCompanie = async () => {
    if (!newCompanieData.denumire || !newCompanieData.cif) {
      notifications.show({
        title: 'Eroare',
        message: 'Completează denumirea și CIF-ul',
        color: 'red',
      });
      return;
    }

    try {
      const response = await api.post('/api/procurement/companii/create', {
        denumire: newCompanieData.denumire,
        cif: newCompanieData.cif,
        regcom: newCompanieData.regcom,
        adresa: {},
        reprezentant_legal: { nume: '-' }, // Required field
        persoana_contact: {},
      });

      notifications.show({
        title: 'Succes',
        message: 'Companie adăugată cu succes',
        color: 'green',
      });

      // Reload companii and select the new one
      await loadCompanii();
      setFormData({ ...formData, furnizor_id: response.data._id });
      setCompanieModalOpened(false);
      setNewCompanieData({ denumire: '', cif: '', regcom: '' });
    } catch (error: any) {
      console.error('Failed to add companie:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut adăuga compania',
        color: 'red',
      });
    }
  };

  const handleFileUpload = async (files: File[]) => {
    try {
      setUploading(true);
      const uploaded: Array<{ file_id: string; filename: string }> = [];

      for (const file of files) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('title', file.name);
        formDataUpload.append('main', 'false');

        const response = await api.post('/api/library/upload', formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        uploaded.push({
          file_id: response.data.hash,
          filename: file.name,
        });
      }

      setUploadedFiles([...uploadedFiles, ...uploaded]);

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

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(uploadedFiles.filter(f => f.file_id !== fileId));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.furnizor_id || !formData.tip_document_id || !formData.nr_document || 
        !formData.data_document || !formData.stare_id) {
      notifications.show({
        title: 'Eroare',
        message: 'Completează toate câmpurile obligatorii',
        color: 'red',
      });
      return;
    }

    // If not contract, contract_parinte_id is required
    if (showContractParinte && !formData.contract_parinte_id) {
      notifications.show({
        title: 'Eroare',
        message: 'Selectează contractul părinte',
        color: 'red',
      });
      return;
    }

    try {
      setLoading(true);

      // Prepare data
      const submitData = {
        ...formData,
        data_document: formData.data_document.toISOString().split('T')[0],
        contract_parinte_id: isContract ? null : formData.contract_parinte_id,
      };

      // Create contract
      const response = await api.post('/api/procurement/contracte/create', submitData);
      const contractId = response.data._id;

      // Link uploaded files to contract
      for (const file of uploadedFiles) {
        try {
          await api.post(`/api/procurement/contracte/${contractId}/documente/link`, null, {
            params: { file_id: file.file_id }
          });
        } catch (error) {
          console.error('Failed to link file:', error);
        }
      }

      notifications.show({
        title: 'Succes',
        message: 'Contract creat cu succes',
        color: 'green',
      });

      if (onSuccess) {
        onSuccess(contractId);
      }
    } catch (error: any) {
      console.error('Failed to create contract:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut crea contractul',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Title order={4} mb="md">Date contract</Title>
        <Stack gap="sm">
          <Group align="flex-end">
            <Select
              label="Companie (Furnizor)"
              placeholder="Selectează compania"
              data={companiiOptions}
              value={formData.furnizor_id}
              onChange={(value) => setFormData({ ...formData, furnizor_id: value || '' })}
              searchable
              required
              style={{ flex: 1 }}
            />
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCompanieModalOpened(true)}
            >
              Adaugă nouă
            </Button>
          </Group>

          <Select
            label="Tip document"
            placeholder="Selectează tipul"
            data={tipuriDocOptions.map(t => ({ value: t.value, label: t.label }))}
            value={formData.tip_document_id}
            onChange={(value) => setFormData({ ...formData, tip_document_id: value || '', contract_parinte_id: '' })}
            required
          />

          {showContractParinte && (
            <Select
              label="Act adițional la contractul"
              placeholder="Selectează contractul"
              data={contracteParinteOptions}
              value={formData.contract_parinte_id}
              onChange={(value) => setFormData({ ...formData, contract_parinte_id: value || '' })}
              searchable
              required
              description="Selectează contractul principal la care se atașează acest document"
            />
          )}

          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Nr. document"
                placeholder="Ex: 123/2024"
                value={formData.nr_document}
                onChange={(e) => setFormData({ ...formData, nr_document: e.target.value })}
                required
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="Data document"
                value={formData.data_document}
                onChange={(val) => setFormData({ ...formData, data_document: val || new Date() })}
                valueFormat="DD/MM/YYYY"
                required
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Condiții de livrare"
            placeholder="Descriere condiții de livrare..."
            value={formData.conditii_livrare}
            onChange={(e) => setFormData({ ...formData, conditii_livrare: e.target.value })}
            rows={3}
          />

          <Textarea
            label="Condiții de plată"
            placeholder="Descriere condiții de plată..."
            value={formData.conditii_plata}
            onChange={(e) => setFormData({ ...formData, conditii_plata: e.target.value })}
            rows={3}
          />

          <Select
            label="Stare"
            placeholder="Selectează starea"
            data={stariOptions.map(s => ({ value: s.value, label: s.label }))}
            value={formData.stare_id}
            onChange={(value) => setFormData({ ...formData, stare_id: value || '' })}
            required
          />

          <Textarea
            label="Observații"
            placeholder="Observații..."
            value={formData.observatii}
            onChange={(e) => setFormData({ ...formData, observatii: e.target.value })}
            rows={3}
          />

          <Divider label="Documente" />

          <Grid>
            <Grid.Col span={6}>
              <Dropzone
                onDrop={handleFileUpload}
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
                    <Title order={5} inline>
                      Încarcă documente
                    </Title>
                    <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>
                      Poți încărca multiple fișiere
                    </p>
                  </div>
                </Group>
              </Dropzone>
            </Grid.Col>
            <Grid.Col span={6}>
              <Paper withBorder p="sm" style={{ minHeight: 100 }}>
                <Title order={6} mb="xs">Documente încărcate</Title>
                {uploadedFiles.length === 0 ? (
                  <p style={{ fontSize: '14px', color: '#666' }}>Niciun document încărcat</p>
                ) : (
                  <Stack gap="xs">
                    {uploadedFiles.map((file) => (
                      <Group key={file.file_id} justify="space-between">
                        <span style={{ fontSize: '14px' }}>{file.filename}</span>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => handleRemoveFile(file.file_id)}
                        >
                          Șterge
                        </Button>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Grid.Col>
          </Grid>
        </Stack>
      </Paper>

      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={onCancel}>
          Anulează
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          Salvează
        </Button>
      </Group>

      {/* Modal for adding new company */}
      <Modal
        opened={companieModalOpened}
        onClose={() => setCompanieModalOpened(false)}
        title="Adaugă companie nouă"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Denumire"
            placeholder="Denumire companie"
            value={newCompanieData.denumire}
            onChange={(e) => setNewCompanieData({ ...newCompanieData, denumire: e.target.value })}
            required
          />
          <TextInput
            label="CIF"
            placeholder="CIF companie"
            value={newCompanieData.cif}
            onChange={(e) => setNewCompanieData({ ...newCompanieData, cif: e.target.value })}
            required
          />
          <TextInput
            label="Nr. Înreg. Reg. Com."
            placeholder="Nr. Reg. Com."
            value={newCompanieData.regcom}
            onChange={(e) => setNewCompanieData({ ...newCompanieData, regcom: e.target.value })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setCompanieModalOpened(false)}>
              Anulează
            </Button>
            <Button onClick={handleAddCompanie}>
              Adaugă
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
