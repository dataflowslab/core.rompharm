import { useState, useEffect, useMemo } from 'react';
import {
  Stack,
  TextInput,
  Select,
  Button,
  Group,
  Paper,
  Title,
  NumberInput,
  Checkbox,
  Textarea,
  Table,
  ActionIcon,
  Text,
  Divider,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { Dropzone } from '@mantine/dropzone';
import { IconPlus, IconTrash, IconUpload, IconFile, IconX } from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { useProcurementYears } from '../../hooks/useProcurementYears';

interface BunServiciu {
  id: string;
  denumire: string;
  cantitate: number;
  um: string;
  periodicitate: string;
  urgent: boolean;
  motiv: string;
}

interface ReferatFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
}

export function ReferatForm({ onSubmit, onCancel, initialData }: ReferatFormProps) {
  const currentYear = new Date().getFullYear();
  const isEditing = Boolean(initialData);
  const { years, loading: yearsLoading } = useProcurementYears();
  
  const [formData, setFormData] = useState({
    data_intocmirii: initialData?.data_intocmirii ? new Date(initialData.data_intocmirii) : new Date(),
    departament: initialData?.departament || '',
    titlu: initialData?.titlu || '',
    categorie: initialData?.categorie || '',
    bunuri_servicii: initialData?.bunuri_servicii || [],
    justificare: initialData?.justificare || '',
    termen: initialData?.termen || '',
    valoare_estimata: initialData?.valoare_estimata || 0,
    surse_finantare: initialData?.surse_finantare || '',
    fonduri_disponibile: initialData?.fonduri_disponibile || '',
    an_bugetar: initialData?.an_bugetar || currentYear,
    atasamente: initialData?.atasamente || [],
  });

  const [departamente, setDepartamente] = useState<Array<{ value: string; label: string }>>([]);
  const [umOptions, setUmOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDepartamente();
    loadUM();
  }, []);

  useEffect(() => {
    if (!years.length || isEditing) {
      return;
    }
    setFormData((prev) => {
      const prevValue = prev.an_bugetar?.toString();
      if (prevValue && years.some((year) => year.value === prevValue)) {
        return prev;
      }
      const latestYear = years.reduce((max, year) => (year.year > max ? year.year : max), years[0].year);
      return { ...prev, an_bugetar: latestYear };
    });
  }, [years, isEditing]);

  const yearOptions = useMemo(() => {
    const options = years.map((year) => ({
      value: year.value,
      label: year.label,
    }));
    const currentValue = formData.an_bugetar?.toString();
    if (currentValue && !options.some((option) => option.value === currentValue)) {
      options.unshift({ value: currentValue, label: currentValue });
    }
    return options;
  }, [years, formData.an_bugetar]);

  useEffect(() => {
    // Auto-calculate total from bunuri_servicii
    const total = formData.bunuri_servicii.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.valoare_estimata) || 0);
    }, 0);
    if (total !== formData.valoare_estimata) {
      setFormData({ ...formData, valoare_estimata: total });
    }
  }, [formData.bunuri_servicii]);

  const loadDepartamente = async () => {
    try {
      const response = await api.get('/api/procurement/departamente');
      setDepartamente(response.data);
    } catch (error) {
      console.error('Failed to load departamente:', error);
    }
  };

  const loadUM = async () => {
    try {
      const response = await api.get('/api/datasets/nom_um/items', {
        params: { limit: 500, sort_by: 'name', sort_order: 'asc' },
      });
      const items = Array.isArray(response.data?.items) ? response.data.items : [];
      const options = items.map((um: any) => ({
        value: um.slug || um.cod || um.code || um._id,
        label: um.name || um.nume || um.denumire || um.descriere || um.slug || um.cod || um._id,
      }));
      if (options.length > 0) {
        setUmOptions(options);
      } else {
        setUmOptions([
          { value: 'buc', label: 'Bucata' },
          { value: 'kg', label: 'Kilogram' },
          { value: 'l', label: 'Litru' },
          { value: 'm', label: 'Metru' },
        ]);
      }
    } catch (error) {
      console.error('Failed to load UM:', error);
      // Fallback options
      setUmOptions([
        { value: 'buc', label: 'Bucată' },
        { value: 'kg', label: 'Kilogram' },
        { value: 'l', label: 'Litru' },
        { value: 'm', label: 'Metru' },
      ]);
    }
  };

  const addBunServiciu = () => {
    const newItem: BunServiciu = {
      id: Date.now().toString(),
      denumire: '',
      cantitate: 0,
      um: 'buc',
      periodicitate: '',
      urgent: false,
      motiv: '',
    };
    setFormData({
      ...formData,
      bunuri_servicii: [...formData.bunuri_servicii, newItem],
    });
  };

  const removeBunServiciu = (id: string) => {
    setFormData({
      ...formData,
      bunuri_servicii: formData.bunuri_servicii.filter((item: any) => item.id !== id),
    });
  };

  const updateBunServiciu = (id: string, field: string, value: any) => {
    setFormData({
      ...formData,
      bunuri_servicii: formData.bunuri_servicii.map((item: any) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
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
        atasamente: [...formData.atasamente, ...uploadedHashes],
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
        message: 'Nu s-au putut încărca fișierele',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const removeAtasament = (hash: string) => {
    setFormData({
      ...formData,
      atasamente: formData.atasamente.filter((h: string) => h !== hash),
    });
  };

  const handleSubmit = () => {
    // Validation
    if (!formData.data_intocmirii || !formData.departament || !formData.titlu || !formData.categorie) {
      notifications.show({
        title: 'Eroare',
        message: 'Completează toate câmpurile obligatorii',
        color: 'red',
      });
      return;
    }

    if (!formData.fonduri_disponibile || !formData.an_bugetar) {
      notifications.show({
        title: 'Eroare',
        message: 'Completează toate câmpurile obligatorii din Date financiare',
        color: 'red',
      });
      return;
    }

    const submitData = {
      ...formData,
      data_intocmirii: formData.data_intocmirii.toISOString().split('T')[0],
    };

    onSubmit(submitData);
  };

  return (
    <Stack gap="md">
      {/* Date generale */}
      <Paper withBorder p="md">
        <Title order={4} mb="md">Date generale</Title>
        <Stack gap="sm">
          <DatePickerInput
            label="Data întocmirii"
            placeholder="zz.ll.aaaa"
            value={formData.data_intocmirii}
            onChange={(date) => setFormData({ ...formData, data_intocmirii: date || new Date() })}
            valueFormat="DD.MM.YYYY"
            required
          />

          <Select
            label="Departament"
            placeholder="Selectează departamentul"
            data={departamente}
            value={formData.departament}
            onChange={(value) => setFormData({ ...formData, departament: value || '' })}
            searchable
            required
          />

          <TextInput
            label="Titlu"
            placeholder="Introduceți titlul referatului"
            value={formData.titlu}
            onChange={(e) => setFormData({ ...formData, titlu: e.target.value })}
            required
          />

          <Select
            label="Categorie"
            placeholder="Selectează categoria"
            data={[
              { value: 'bunuri', label: 'Bunuri' },
              { value: 'servicii', label: 'Servicii' },
              { value: 'lucrari', label: 'Lucrări' },
            ]}
            value={formData.categorie}
            onChange={(value) => setFormData({ ...formData, categorie: value || '' })}
            required
          />
        </Stack>
      </Paper>

      {/* Bunuri și servicii */}
      <Paper withBorder p="md">
        <Group justify="space-between" mb="md">
          <Title order={4}>Bunuri și servicii</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={addBunServiciu} size="sm">
            Adaugă rând
          </Button>
        </Group>

        {formData.bunuri_servicii.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Denumire*</Table.Th>
                  <Table.Th>Cantitate*</Table.Th>
                  <Table.Th>UM*</Table.Th>
                  <Table.Th>Periodicitate</Table.Th>
                  <Table.Th>Urgent</Table.Th>
                  <Table.Th>Motiv</Table.Th>
                  <Table.Th>Acțiuni</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {formData.bunuri_servicii.map((item: any) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <TextInput
                        value={item.denumire}
                        onChange={(e) => updateBunServiciu(item.id, 'denumire', e.target.value)}
                        size="xs"
                        required
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={item.cantitate}
                        onChange={(val) => updateBunServiciu(item.id, 'cantitate', val || 0)}
                        size="xs"
                        min={0}
                        hideControls
                        required
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        value={item.um}
                        onChange={(val) => updateBunServiciu(item.id, 'um', val || 'buc')}
                        data={umOptions}
                        size="xs"
                        searchable
                        required
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        value={item.periodicitate}
                        onChange={(e) => updateBunServiciu(item.id, 'periodicitate', e.target.value)}
                        size="xs"
                      />
                    </Table.Td>
                    <Table.Td>
                      <Checkbox
                        checked={item.urgent}
                        onChange={(e) => updateBunServiciu(item.id, 'urgent', e.target.checked)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        value={item.motiv}
                        onChange={(e) => updateBunServiciu(item.id, 'motiv', e.target.value)}
                        size="xs"
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon color="red" variant="subtle" onClick={() => removeBunServiciu(item.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        ) : (
          <Text c="dimmed" ta="center" py="md">
            Nu există rânduri adăugate. Click pe "Adaugă rând" pentru a începe.
          </Text>
        )}
        <Divider my="md" />
        <Stack gap="sm">
          <Textarea
            label="Justificare"
            placeholder="Introduceți justificarea"
            value={formData.justificare}
            onChange={(e) => setFormData({ ...formData, justificare: e.target.value })}
            minRows={3}
          />
          <TextInput
            label="Termen"
            placeholder="Introduceți termenul"
            value={formData.termen}
            onChange={(e) => setFormData({ ...formData, termen: e.target.value })}
          />
        </Stack>
      </Paper>

      {/* Date financiare */}
      <Paper withBorder p="md">
        <Title order={4} mb="md">Date financiare</Title>
        <Stack gap="sm">
          <NumberInput
            label="Valoare estimată totală"
            placeholder="Se calculează automat din tabel"
            value={formData.valoare_estimata}
            onChange={(val) => setFormData({ ...formData, valoare_estimata: val || 0 })}
            decimalScale={2}
            hideControls
            required
            description="Valoarea se calculează automat, dar poate fi suprascrisă"
          />

          <Textarea
            label="Surse de finanțare"
            placeholder="Introduceți sursele de finanțare"
            value={formData.surse_finantare}
            onChange={(e) => setFormData({ ...formData, surse_finantare: e.target.value })}
            minRows={3}
          />

          <Select
            label="Există fonduri disponibile"
            placeholder="Selectează"
            data={[
              { value: 'Da', label: 'Da' },
              { value: 'Nu', label: 'Nu' },
              { value: 'Nu știu', label: 'Nu știu' },
            ]}
            value={formData.fonduri_disponibile}
            onChange={(value) => setFormData({ ...formData, fonduri_disponibile: value || '' })}
            required
          />

                    <Select
            label="An bugetar"
            placeholder="Selectează anul"
            data={yearOptions}
            value={formData.an_bugetar ? formData.an_bugetar.toString() : null}
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                an_bugetar: value ? parseInt(value, 10) : prev.an_bugetar || currentYear,
              }))
            }
            disabled={yearsLoading}
            required
          />
        </Stack>
      </Paper>

      {/* Atașamente */}
      <Paper withBorder p="md">
        <Title order={4} mb="md">Atașamente</Title>
        <Text size="sm" c="dimmed" mb="md">
          Poți încărca documente justificative, capturi de ecran, note interne, estimări de preț etc.
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

        {formData.atasamente.length > 0 && (
          <Stack gap="xs" mt="md">
            <Divider label="Fișiere încărcate" />
            {formData.atasamente.map((hash: string, idx: number) => (
              <Group key={hash} justify="space-between">
                <Text size="sm">Fișier {idx + 1}: {hash.substring(0, 20)}...</Text>
                <ActionIcon color="red" variant="subtle" onClick={() => removeAtasament(hash)}>
                  <IconTrash size={16} />
                </ActionIcon>
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

