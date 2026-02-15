import { useState, useEffect } from 'react';
import {
  Paper,
  Title,
  Checkbox,
  Table,
  TextInput,
  NumberInput,
  Textarea,
  Stack,
  Group,
  Text,
  Button,
  ActionIcon,
  Select,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconUpload, IconX, IconFile, IconTrash, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../../services/api';
import { SSISelector } from './SSISelector';

interface Tabel3Row {
  codAngajament: string;
  indicatorAngajament: string;
  program: string;
  codSSI: {
    sb: string;
    sf: string;
    ssi: string;
  };
  sumaRezervata: string;
  influente: string;
  sumaRezervataActualizata: string;
  sumaRezervataAnulCurent: string;
  influenteAnulCurent: string;
  sumaRezervataAnulCurentActualizata: string;
}

interface FormSectionBProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  onFileUpload: (files: File[]) => void;
  uploadedFiles: Array<{ name: string; url: string }>;
  onFileDelete: (index: number) => void;
}

export function FormSectionB({
  formData,
  onChange,
  onFileUpload,
  uploadedFiles,
  onFileDelete,
}: FormSectionBProps) {
  const { t } = useTranslation();
  const [tabel3Rows, setTabel3Rows] = useState<Tabel3Row[]>(
    formData.tabel3 || [
      {
        codAngajament: '',
        indicatorAngajament: '',
        program: '',
        codSSI: { sb: '', sf: '', ssi: '' },
        sumaRezervata: '',
        influente: '',
        sumaRezervataActualizata: '',
        sumaRezervataAnulCurent: '',
        influenteAnulCurent: '',
        sumaRezervataAnulCurentActualizata: '',
      },
    ]
  );

  const [programOptions, setProgramOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load program options from nomenclatoare
    const loadNomenclatoare = async () => {
      setLoading(true);
      try {
        // Load Programs
        const programsResponse = await api.get('/procurement/nomenclatoare/get', {
          params: {
            table: 'procurement_programe',
            sort_by: 'cod'
          }
        });
        
        if (programsResponse.data && Array.isArray(programsResponse.data)) {
          setProgramOptions(programsResponse.data.map((item: any) => ({
            value: item.value,
            label: item.label
          })));
        }
      } catch (error) {
        console.error('Error loading nomenclatoare:', error);
        setProgramOptions([]);
      } finally {
        setLoading(false);
      }
    };

    loadNomenclatoare();
  }, []);

  // Calculate totals
  const calculateTotals = () => {
    const totals = {
      sumaRezervataActualizata: 0,
      sumaRezervataAnulCurentActualizata: 0,
    };

    tabel3Rows.forEach((row) => {
      const val1 = parseFloat(row.sumaRezervataActualizata) || 0;
      const val2 = parseFloat(row.sumaRezervataAnulCurentActualizata) || 0;
      totals.sumaRezervataActualizata += val1;
      totals.sumaRezervataAnulCurentActualizata += val2;
    });

    return totals;
  };

  const totals = calculateTotals();

  const handleCheckboxChange = (field: string, checked: boolean) => {
    onChange(field, checked);
  };

  const handleTabel3Change = (index: number, field: keyof Tabel3Row, value: any) => {
    const newRows = [...tabel3Rows];
    newRows[index][field] = value;
    setTabel3Rows(newRows);
    onChange('tabel3', newRows);
  };

  const normalizeSsiValue = (value: any) => {
    if (!value) return { sb: '', sf: '', ssi: '' };
    if (typeof value === 'object' && value.sb && value.sf && value.ssi) {
      return value;
    }
    if (typeof value === 'string') {
      const digits = value.replace(/\D/g, '');
      if (digits.length >= 12) {
        return {
          sb: digits.slice(0, 2),
          sf: digits.slice(2, 3),
          ssi: digits.slice(3, 12),
        };
      }
    }
    return { sb: '', sf: '', ssi: '' };
  };

  const copyFromSectionA = () => {
    const sourceRows = Array.isArray(formData.tabel1) ? formData.tabel1 : [];
    if (sourceRows.length === 0) {
      notifications.show({
        title: 'Atenție',
        message: 'Secțiunea A nu are rânduri de copiat.',
        color: 'yellow',
      });
      return;
    }

    const newRows: Tabel3Row[] = sourceRows.map((row: any) => ({
      codAngajament: String(row.col1 || ''),
      indicatorAngajament: '',
      program: String(row.col2 || ''),
      codSSI: normalizeSsiValue(row.col3),
      sumaRezervata: String(row.col5 ?? ''),
      influente: String(row.col6 ?? ''),
      sumaRezervataActualizata: String(row.col7 ?? ''),
      sumaRezervataAnulCurent: String(row.col5 ?? ''),
      influenteAnulCurent: String(row.col6 ?? ''),
      sumaRezervataAnulCurentActualizata: String(row.col7 ?? ''),
    }));

    setTabel3Rows(newRows);
    onChange('tabel3', newRows);
    onChange('checkboxPropuneriInregistrate', true);

    notifications.show({
      title: 'Succes',
      message: 'Datele din Secțiunea A au fost copiate în Secțiunea B.',
      color: 'green',
    });
  };

  const addTabel3Row = () => {
    const newRow: Tabel3Row = {
      codAngajament: '',
      indicatorAngajament: '',
      program: '',
      codSSI: { sb: '', sf: '', ssi: '' },
      sumaRezervata: '',
      influente: '',
      sumaRezervataActualizata: '',
      sumaRezervataAnulCurent: '',
      influenteAnulCurent: '',
      sumaRezervataAnulCurentActualizata: '',
    };
    const newRows = [...tabel3Rows, newRow];
    setTabel3Rows(newRows);
    onChange('tabel3', newRows);
  };

  const removeTabel3Row = (index: number) => {
    if (tabel3Rows.length > 1) {
      const newRows = tabel3Rows.filter((_, i) => i !== index);
      setTabel3Rows(newRows);
      onChange('tabel3', newRows);
    }
  };

  return (
    <Paper withBorder p="md" mt="md">
      <Title order={4} mb="md">
        Secțiunea B: Situația evidențiată în sistemul de control al angajamentelor
      </Title>

      <Stack gap="md">
        {/* Checkbox principal */}
        <Checkbox
          label="Propunerile de la Secțiunea A au fost înregistrate în sistemul de control al angajamentelor după cum urmează:"
          checked={formData.checkboxPropuneriInregistrate || false}
          onChange={(e) => handleCheckboxChange('checkboxPropuneriInregistrate', e.currentTarget.checked)}
        />

        <Group justify="flex-end">
          <Button size="xs" variant="light" onClick={copyFromSectionA}>
            Copiază din A
          </Button>
        </Group>

        {/* Tabel 3 - activ doar dacă checkbox-ul este bifat */}
        {formData.checkboxPropuneriInregistrate && (
          <Paper withBorder p="sm">
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={500}>
                Tabel 3: Situația angajamentelor
              </Text>
              <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addTabel3Row}>
                Adaugă rând
              </Button>
            </Group>

            <div style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Cod angajament</Table.Th>
                    <Table.Th>Indicator angajament</Table.Th>
                    <Table.Th>Program</Table.Th>
                    <Table.Th>Cod SSI</Table.Th>
                    <Table.Th>Suma rezervată (lei)</Table.Th>
                    <Table.Th>Influențe +/-</Table.Th>
                    <Table.Th>Suma actualizată (lei)</Table.Th>
                    <Table.Th>Suma anul curent (lei)</Table.Th>
                    <Table.Th>Influențe +/-</Table.Th>
                    <Table.Th>Suma actualizată anul curent (lei)</Table.Th>
                    <Table.Th>Acțiuni</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {tabel3Rows.map((row, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={row.codAngajament}
                          onChange={(e) => handleTabel3Change(index, 'codAngajament', e.target.value)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={row.indicatorAngajament}
                          onChange={(e) => handleTabel3Change(index, 'indicatorAngajament', e.target.value)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          value={row.program}
                          onChange={(value) => handleTabel3Change(index, 'program', value || '')}
                          data={programOptions}
                          searchable
                          clearable
                          placeholder={loading ? "Se încarcă..." : "Selectează"}
                          disabled={loading}
                          styles={{ input: { minWidth: 150 } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <SSISelector
                          value={row.codSSI}
                          onChange={(value) => handleTabel3Change(index, 'codSSI', value)}
                          size="xs"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={row.sumaRezervata}
                          onChange={(e) => handleTabel3Change(index, 'sumaRezervata', e.target.value)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={row.influente}
                          onChange={(e) => handleTabel3Change(index, 'influente', e.target.value)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={row.sumaRezervataActualizata}
                          onChange={(e) => handleTabel3Change(index, 'sumaRezervataActualizata', e.target.value)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={row.sumaRezervataAnulCurent}
                          onChange={(e) => handleTabel3Change(index, 'sumaRezervataAnulCurent', e.target.value)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={row.influenteAnulCurent}
                          onChange={(e) => handleTabel3Change(index, 'influenteAnulCurent', e.target.value)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={row.sumaRezervataAnulCurentActualizata}
                          onChange={(e) =>
                            handleTabel3Change(index, 'sumaRezervataAnulCurentActualizata', e.target.value)
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => removeTabel3Row(index)}
                          disabled={tabel3Rows.length === 1}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {/* Rând TOTAL */}
                  <Table.Tr style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
                    <Table.Td>
                      <Text size="sm" fw={700}>TOTAL</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">X</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">X</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">X</Text>
                    </Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={700}>{totals.sumaRezervataActualizata.toFixed(2)}</Text>
                    </Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={700}>{totals.sumaRezervataAnulCurentActualizata.toFixed(2)}</Text>
                    </Table.Td>
                    <Table.Td></Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </div>
          </Paper>
        )}

        {/* Dropzone pentru capturi de imagine */}
        <Paper withBorder p="sm">
          <Text size="sm" fw={500} mb="xs">
            Captura de imagine/imagini din sistemul de control al angajamentelor bugetare
          </Text>
          <Text size="xs" c="dimmed" mb="sm">
            Este redată în rubrica de mai jos sau ca anexă la documentul de fundamentare
          </Text>

          <Dropzone
            onDrop={onFileUpload}
            accept={['image/*', 'application/pdf']}
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
                <Text size="sm" inline>
                  Trage fișierele aici sau click pentru a selecta
                </Text>
                <Text size="xs" c="dimmed" inline mt={4}>
                  Imagini sau PDF, max 10MB
                </Text>
              </div>
            </Group>
          </Dropzone>

          {uploadedFiles.length > 0 && (
            <Stack gap="xs" mt="sm">
              {uploadedFiles.map((file, index) => (
                <Group key={index} justify="space-between">
                  <Text size="sm">{file.name}</Text>
                  <ActionIcon color="red" variant="subtle" onClick={() => onFileDelete(index)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>

        {/* Checkbox "Nu s-au rezervat" */}
        <Checkbox
          label="Nu s-au rezervat în sistemul de control al angajamentelor credite de angajament în cuantum de ... lei, respectiv credite bugetare în cuantum de ... lei"
          checked={formData.checkboxNuSauRezervat || false}
          onChange={(e) => handleCheckboxChange('checkboxNuSauRezervat', e.currentTarget.checked)}
        />

        {/* Câmpuri activate de checkbox "Nu s-au rezervat" */}
        {formData.checkboxNuSauRezervat && (
          <Paper withBorder p="sm" bg="gray.0">
            <Stack gap="sm">
              <NumberInput
                label="Credite de angajament în cuantum de (lei)"
                value={formData.creditAngajament || ''}
                onChange={(value) => onChange('creditAngajament', value)}
                min={0}
                decimalScale={2}
              />

              <NumberInput
                label="Credite bugetare în cuantum de (lei)"
                value={formData.creditBugetar || ''}
                onChange={(value) => onChange('creditBugetar', value)}
                min={0}
                decimalScale={2}
              />

              {/* Checkbox-uri condiționale */}
              <Checkbox
                label="Întrucât creditele de angajament și/sau creditele bugetare sunt insuficiente. Din acest motiv, este interzisă emiterea de noi angajamente legale din inițiativa instituției publice la codul SSI și programul la care creditele de angajament și/sau bugetare sunt insuficiente."
                checked={formData.checkboxCrediteleInsuficiente || false}
                onChange={(e) => handleCheckboxChange('checkboxCrediteleInsuficiente', e.currentTarget.checked)}
              />

              <Checkbox
                label="Întrucât:"
                checked={formData.checkboxIntrucat || false}
                onChange={(e) => handleCheckboxChange('checkboxIntrucat', e.currentTarget.checked)}
              />

              {/* Textarea activat de checkbox "Întrucât" */}
              {formData.checkboxIntrucat && (
                <Textarea
                  placeholder="Introduceți motivul..."
                  value={formData.intrucatMotiv || ''}
                  onChange={(e) => onChange('intrucatMotiv', e.target.value)}
                  minRows={4}
                />
              )}
            </Stack>
          </Paper>
        )}
      </Stack>
    </Paper>
  );
}
