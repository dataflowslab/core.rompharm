import { Box, Title, Radio, Stack, Checkbox, TextInput, Paper, Button, Group, Table } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Tabel1Row } from '../Tabel1Row';
import { Tabel2Row } from '../Tabel2Row';

interface TableRow {
  id: string;
  [key: string]: string | number;
}

interface FormSectionTablesProps {
  formData: {
    valorificareTip: 'stabilita' | 'ramane' | '';
    tabel1: TableRow[];
    showRemainingSum: boolean;
    remainingSum: string;
    angajamenteLegale: 'niciun' | 'anulCurent' | '';
    seStingAnulCurent: boolean;
    nuSeEfectueazaPlati: boolean;
    seEfectueazaPlatiMultiAn: boolean;
    tabel2: TableRow[];
    angajamenteAnulUrmator: boolean;
  };
  onChange: (field: string, value: any) => void;
  onAddTabel1Row: () => void;
  onRemoveTabel1Row: (id: string) => void;
  onUpdateTabel1Cell: (id: string, column: string, value: string) => void;
  onAddTabel2Row: () => void;
  onRemoveTabel2Row: (id: string) => void;
  onUpdateTabel2Cell: (id: string, column: string, value: string) => void;
  onCopyFromTabel1: () => void;
}

export function FormSectionTables({
  formData,
  onChange,
  onAddTabel1Row,
  onRemoveTabel1Row,
  onUpdateTabel1Cell,
  onAddTabel2Row,
  onRemoveTabel2Row,
  onUpdateTabel2Cell,
  onCopyFromTabel1,
}: FormSectionTablesProps) {
  return (
    <>
      {/* 4. Valoarea angajamentelor */}
      <Box>
        <Title order={5} mb="sm">4. Valoarea angajamentelor legale (pe toată perioada de valabilitate a documentului de fundamentare):</Title>
        <Radio.Group
          value={formData.valorificareTip}
          onChange={(value) => onChange('valorificareTip', value)}
        >
          <Stack gap="xs">
            <Radio value="stabilita" label="Se stabilește ținând cont de:" />
            <Radio value="ramane" label="Rămâne în sumă de:" />
          </Stack>
        </Radio.Group>
      </Box>

      {/* Tabel 1 */}
      {formData.valorificareTip === 'stabilita' && (
        <Paper withBorder p="md">
          <Group justify="space-between" mb="md">
            <Title order={5}>Tabel 1</Title>
            <Button leftSection={<IconPlus size={16} />} onClick={onAddTabel1Row} size="sm">
              Adaugă rând
            </Button>
          </Group>

          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr style={{ fontSize: '0.76rem' }}>
                  <Table.Th style={{ width: '12%' }}>El. fundamentare (1) / Program (2)</Table.Th>
                  <Table.Th>Cod SSI (3)</Table.Th>
                  <Table.Th style={{ width: '11%' }}>Parametrii de fundamentare (4)</Table.Th>
                  <Table.Th style={{ width: '11%' }}>Valoare totală revizie precedentă (lei) (5)</Table.Th>
                  <Table.Th style={{ width: '11%' }}>Influențe +/- (lei) (6)</Table.Th>
                  <Table.Th style={{ width: '11%' }}>Valoarea totală actualizată (lei) (7=5+6)</Table.Th>
                  <Table.Th style={{ width: '40px', maxWidth: '40px', textAlign: 'center' }}>-</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {formData.tabel1.map((row) => (
                  <Tabel1Row
                    key={row.id}
                    row={row}
                    onUpdate={onUpdateTabel1Cell}
                    onRemove={onRemoveTabel1Row}
                  />
                ))}
                {formData.tabel1.length > 0 && (
                  <Table.Tr style={{ fontSize: '0.76rem' }}>
                    <Table.Td fw={700}>TOTAL</Table.Td>
                    <Table.Td ta="center">X</Table.Td>
                    <Table.Td ta="center">X</Table.Td>
                    <Table.Td fw={700}>
                      {formData.tabel1.reduce((sum, row) => sum + (parseFloat(row.col5 as string) || 0), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td fw={700}>
                      {formData.tabel1.reduce((sum, row) => sum + (parseFloat(row.col6 as string) || 0), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td fw={700}>
                      {formData.tabel1.reduce((sum, row) => sum + (parseFloat(row.col7 as string) || 0), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td></Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Box>
        </Paper>
      )}

      {/* Sumă rămasă */}
      {formData.valorificareTip === 'ramane' && (
        <Box>
          <Checkbox
            label="Calculează suma rămasă"
            checked={formData.showRemainingSum}
            onChange={(e) => onChange('showRemainingSum', e.target.checked)}
          />
          {formData.showRemainingSum && (
            <TextInput
              label="Sumă rămasă"
              value={formData.remainingSum}
              onChange={(e) => onChange('remainingSum', e.target.value)}
              mt="sm"
            />
          )}
        </Box>
      )}

      {/* 5. Angajamente legale */}
      <Box>
        <Title order={5} mb="sm">5. Angajamente legale</Title>
        <Radio.Group
          value={formData.angajamenteLegale}
          onChange={(value) => {
            onChange('angajamenteLegale', value);
            onChange('seStingAnulCurent', false);
            onChange('nuSeEfectueazaPlati', false);
            onChange('seEfectueazaPlatiMultiAn', false);
          }}
        >
          <Stack gap="md">
            <Radio
              value="niciun"
              label="niciun angajament legal nu a fost emis și în anul curent nu se anticipează emiterea niciunui angajament legal"
            />
            <Radio
              value="anulCurent"
              label="în anul curent se anticipează emiterea / a cel puțin unui angajament legal / au fost emise angajamente legale / se înregistrează creșteri ale valorii angajamentelor legale emise în anii precedenți. În ceea ce privește plățile, intenția este de a:"
            />
          </Stack>
        </Radio.Group>

        {formData.angajamenteLegale === 'anulCurent' && (
          <Radio.Group
            value={
              formData.seStingAnulCurent ? 'sting' :
              formData.nuSeEfectueazaPlati ? 'nuPlati' :
              formData.seEfectueazaPlatiMultiAn ? 'platiMultiAn' : ''
            }
            onChange={(value) => {
              onChange('seStingAnulCurent', value === 'sting');
              onChange('nuSeEfectueazaPlati', value === 'nuPlati');
              onChange('seEfectueazaPlatiMultiAn', value === 'platiMultiAn');
            }}
          >
            <Stack gap="xs" ml="xl" mt="md">
              <Radio
                value="sting"
                label="se sting în anul curent toate obligațiile de plată:"
              />
              <Radio
                value="nuPlati"
                label="nu se efectuează plăți în anul curent, planificarea acestora fiind cea din tabelul de mai jos:"
              />
              <Radio
                value="platiMultiAn"
                label="se efectuează plăți timp de mai mulți ani bugetari, planificarea acestora fiind cea din tabelul de mai jos:"
              />
            </Stack>
          </Radio.Group>
        )}
      </Box>

      {/* Tabel 2 */}
      {(formData.seEfectueazaPlatiMultiAn || formData.nuSeEfectueazaPlati) && (
        <Paper withBorder p="md">
          <Group justify="space-between" mb="md">
            <Title order={5}>Tabel 2 - Planificare plăți</Title>
            <Group gap="xs">
              <Button 
                variant="light" 
                size="sm"
                onClick={onCopyFromTabel1}
              >
                Copiază din Tabel 1 (a)
              </Button>
              <Button leftSection={<IconPlus size={16} />} onClick={onAddTabel2Row} size="sm">
                Adaugă rând
              </Button>
            </Group>
          </Group>

          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr style={{ fontSize: '0.76rem' }}>
                  <Table.Th style={{ width: '12%' }}>Program (1)</Table.Th>
                  <Table.Th>Cod SSI (2)</Table.Th>
                  <Table.Th style={{ width: '11%' }}>Plăți ani precedenți (lei) (3)</Table.Th>
                  <Table.Th style={{ width: '11%' }}>Plăți estimate an curent (lei) (4)</Table.Th>
                  <Table.Th style={{ width: '11%' }}>Plăți estimate an n+1 (lei) (5)</Table.Th>
                  <Table.Th style={{ width: '11%' }}>Plăți estimate an n+2 (lei) (6)</Table.Th>
                  <Table.Th style={{ width: '11%' }}>Plăți estimate an n+3 (lei) (7)</Table.Th>
                  <Table.Th style={{ width: '11%' }}>Plăți estimate anii următori (lei) (8)</Table.Th>
                  <Table.Th style={{ width: '90px', textAlign: 'center' }}>Coerență</Table.Th>
                  <Table.Th style={{ width: '40px', maxWidth: '40px', textAlign: 'center' }}>-</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {formData.tabel2.map((row) => (
                  <Tabel2Row
                    key={row.id}
                    row={row}
                    onUpdate={onUpdateTabel2Cell}
                    onRemove={onRemoveTabel2Row}
                  />
                ))}
                {formData.tabel2.length > 0 && (
                  <Table.Tr style={{ fontSize: '0.76rem' }}>
                    <Table.Td fw={700}>TOTAL</Table.Td>
                    <Table.Td ta="center">X</Table.Td>
                    <Table.Td fw={700}>
                      {formData.tabel2.reduce((sum, row) => sum + (parseFloat(row.col3 as string) || 0), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td fw={700}>
                      {formData.tabel2.reduce((sum, row) => sum + (parseFloat(row.col4 as string) || 0), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td fw={700}>
                      {formData.tabel2.reduce((sum, row) => sum + (parseFloat(row.col5 as string) || 0), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td fw={700}>
                      {formData.tabel2.reduce((sum, row) => sum + (parseFloat(row.col6 as string) || 0), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td fw={700}>
                      {formData.tabel2.reduce((sum, row) => sum + (parseFloat(row.col7 as string) || 0), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td fw={700}>
                      {formData.tabel2.reduce((sum, row) => sum + (parseFloat(row.col8 as string) || 0), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td></Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Box>
        </Paper>
      )}

      {/* Final checkbox */}
      <Checkbox
        label="Angajamentele legale se vor emite în contul anului următor"
        checked={formData.angajamenteAnulUrmator}
        onChange={(e) => onChange('angajamenteAnulUrmator', e.target.checked)}
      />
    </>
  );
}
