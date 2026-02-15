import { Paper, Stack, Text, Grid, Divider, Group, Button, Table } from '@mantine/core';
import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { IconFileText } from '@tabler/icons-react';

interface DocumentInfoProps {
  document: {
    titlu_document: string;
    nr_inreg: string;
    revizia: number;
    data_reviziei: string | null;
    compartiment: string;
    descriere: string;
    referat_id?: string;
    pdf_path?: string;
    pdf_hash?: string;
    pdf_filename?: string;
    pdf_a_signed_path?: string;
    pdf_b_path?: string;
    pdf_b_signed_path?: string;
    pdf_final_signed_path?: string;
    form_data?: {
      descriereScurta?: string;
      descriereDetaliata?: string;
      valorificareTip?: string;
      tabel1?: any[];
      tabel2?: any[];
    };
    form_data_b?: {
      checkboxPropuneriInregistrate?: boolean;
      tabel3?: any[];
      checkboxNuSauRezervat?: boolean;
      creditAngajament?: string;
      creditBugetar?: string;
      checkboxCrediteleInsuficiente?: boolean;
      checkboxIntrucat?: boolean;
      intrucatMotiv?: string;
    };
    rezultat_ordonator?: 'Aprobat' | 'Anulat' | 'Respins';
    motiv_ordonator?: string;
    finalizat?: boolean;
  };
}

export function DocumentInfo({ document }: DocumentInfoProps) {
  const [referatInfo, setReferatInfo] = useState<any>(null);
  const [loadingReferat, setLoadingReferat] = useState(false);

  useEffect(() => {
    if (document.referat_id) {
      loadReferatInfo();
    }
  }, [document.referat_id]);

  const loadReferatInfo = async () => {
    if (!document.referat_id) return;
    
    try {
      setLoadingReferat(true);
      const response = await api.get(`/api/procurement/referate/${document.referat_id}`);
      setReferatInfo(response.data);
    } catch (error) {
      console.error('Failed to load referat info:', error);
    } finally {
      setLoadingReferat(false);
    }
  };

  return (
    <Stack gap="md">
      {/* Referat asociat */}
      {document.referat_id && referatInfo && (
        <Paper withBorder p="md" bg="blue.0">
          <Group justify="space-between" mb="xs">
            <Group>
              <IconFileText size={20} />
              <Text fw={700}>Referat asociat</Text>
            </Group>
            <Button
              size="xs"
              variant="light"
              onClick={() => window.open(`/procurement/referate/${document.referat_id}`, '_blank')}
            >
              Vezi detalii
            </Button>
          </Group>
          <Grid>
            <Grid.Col span={6}>
              <Text size="xs" c="dimmed">Număr:</Text>
              <Text size="sm" fw={500}>#{referatInfo.nr}</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="xs" c="dimmed">Titlu:</Text>
              <Text size="sm" fw={500}>{referatInfo.titlu}</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="xs" c="dimmed">Departament:</Text>
              <Text size="sm">{referatInfo.departament}</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="xs" c="dimmed">Stare:</Text>
              <Text size="sm" c="green" fw={500}>{referatInfo.stare}</Text>
            </Grid.Col>
          </Grid>
        </Paper>
      )}

      {/* Header Information - Combined */}
      <Paper withBorder p="md">
        <Stack gap="sm">
          <Text fw={700} size="lg">{document.titlu_document || 'Fără titlu'}</Text>
          
          <Divider />
          
          <Grid>
            <Grid.Col span={6}>
              <Text size="xs" c="dimmed">Compartiment:</Text>
              <Text size="sm" fw={500}>{document.compartiment}</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="xs" c="dimmed">Revizie:</Text>
              <Text size="sm" fw={500}>
                {document.revizia} / {document.data_reviziei || '-'}
              </Text>
            </Grid.Col>
          </Grid>

          <Divider />

          <Text size="sm">{document.descriere}</Text>
        </Stack>
      </Paper>

      {/* Secțiunea A */}
      {document.form_data && (
        <Paper withBorder p="md">
          <Text fw={700} mb="sm">Secțiunea A - Fundamentare</Text>
          <Grid gutter="xs">
            {document.form_data.descriereScurta && (
              <Grid.Col span={12}>
                <Text size="xs" c="dimmed">Descriere scurtă:</Text>
                <Text size="sm">{document.form_data.descriereScurta}</Text>
              </Grid.Col>
            )}
            
            {document.form_data.descriereDetaliata && (
              <Grid.Col span={12}>
                <Text size="xs" c="dimmed">Descriere detaliată:</Text>
                <Text size="sm">{document.form_data.descriereDetaliata}</Text>
              </Grid.Col>
            )}

            {document.form_data.valorificareTip && (
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">Valoarea angajamentelor:</Text>
                <Text size="sm">
                  {document.form_data.valorificareTip === 'stabilita' 
                    ? 'Se stabilește' 
                    : 'Rămâne'}
                </Text>
              </Grid.Col>
            )}

            {document.form_data.tabel1 && document.form_data.tabel1.length > 0 && (
              <Grid.Col span={12}>
                <Text size="sm" fw={600} mb="xs">Tabel 1:</Text>
                <div style={{ overflowX: 'auto' }}>
                  <Table striped withTableBorder withColumnBorders size="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Element fundamentare</Table.Th>
                        <Table.Th>Program</Table.Th>
                        <Table.Th>Cod SSI</Table.Th>
                        <Table.Th>Parametrii fundamentare</Table.Th>
                        <Table.Th>Valoare totală revizie precedentă</Table.Th>
                        <Table.Th>Influențe +/-</Table.Th>
                        <Table.Th>Valoare totală actualizată</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {document.form_data.tabel1.map((row: any, idx: number) => (
                        <Table.Tr key={idx}>
                          <Table.Td>{row.col1 || '-'}</Table.Td>
                          <Table.Td>{row.col2 || '-'}</Table.Td>
                          <Table.Td>
                            {row.col3 && typeof row.col3 === 'object' && row.col3.code 
                              ? row.col3.code 
                              : (row.col3 || '-')}
                          </Table.Td>
                          <Table.Td>{row.col4 || '-'}</Table.Td>
                          <Table.Td>{row.col5 || '-'}</Table.Td>
                          <Table.Td>{row.col6 || '-'}</Table.Td>
                          <Table.Td>{row.col7 || '-'}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </Grid.Col>
            )}

            {document.form_data.tabel2 && document.form_data.tabel2.length > 0 && (
              <Grid.Col span={12}>
                <Text size="sm" fw={600} mb="xs">Tabel 2:</Text>
                <div style={{ overflowX: 'auto' }}>
                  <Table striped withTableBorder withColumnBorders size="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Program</Table.Th>
                        <Table.Th>Cod SSI</Table.Th>
                        <Table.Th>Col 3</Table.Th>
                        <Table.Th>Col 4</Table.Th>
                        <Table.Th>Col 5</Table.Th>
                        <Table.Th>Col 6</Table.Th>
                        <Table.Th>Col 7</Table.Th>
                        <Table.Th>Col 8</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {document.form_data.tabel2.map((row: any, idx: number) => (
                        <Table.Tr key={idx}>
                          <Table.Td>{row.col1 || '-'}</Table.Td>
                          <Table.Td>
                            {row.col2 && typeof row.col2 === 'object' && row.col2.code 
                              ? row.col2.code 
                              : (row.col2 || '-')}
                          </Table.Td>
                          <Table.Td>{row.col3 || '-'}</Table.Td>
                          <Table.Td>{row.col4 || '-'}</Table.Td>
                          <Table.Td>{row.col5 || '-'}</Table.Td>
                          <Table.Td>{row.col6 || '-'}</Table.Td>
                          <Table.Td>{row.col7 || '-'}</Table.Td>
                          <Table.Td>{row.col8 || '-'}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </Grid.Col>
            )}
          </Grid>
        </Paper>
      )}

      {/* Secțiunea B */}
      {document.form_data_b && (
        <Paper withBorder p="md">
          <Text fw={700} mb="sm">Secțiunea B - Analiză Bugetară</Text>
          <Grid gutter="xs">
            {document.form_data_b.checkboxPropuneriInregistrate && (
              <Grid.Col span={12}>
                <Text size="sm">✓ Propuneri înregistrate</Text>
              </Grid.Col>
            )}

            {document.form_data_b.tabel3 && document.form_data_b.tabel3.length > 0 && (
              <Grid.Col span={12}>
                <Text size="sm" fw={600} mb="xs">Tabel 3:</Text>
                <div style={{ overflowX: 'auto' }}>
                  <Table striped withTableBorder withColumnBorders size="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Cod angajament</Table.Th>
                        <Table.Th>Indicator</Table.Th>
                        <Table.Th>Program</Table.Th>
                        <Table.Th>Cod SSI</Table.Th>
                        <Table.Th>Suma rezervată</Table.Th>
                        <Table.Th>Influențe</Table.Th>
                        <Table.Th>Suma actualizată</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {document.form_data_b.tabel3.map((row: any, idx: number) => (
                        <Table.Tr key={idx}>
                          <Table.Td>{row.codAngajament || '-'}</Table.Td>
                          <Table.Td>{row.indicatorAngajament || '-'}</Table.Td>
                          <Table.Td>{row.program || '-'}</Table.Td>
                          <Table.Td>{row.codSSI || '-'}</Table.Td>
                          <Table.Td>{row.sumaRezervata || '-'}</Table.Td>
                          <Table.Td>{row.influente || '-'}</Table.Td>
                          <Table.Td>{row.sumaRezervataActualizata || '-'}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </Grid.Col>
            )}

            {document.form_data_b.checkboxNuSauRezervat && (
              <Grid.Col span={12}>
                <Text size="sm">✓ Nu s-au rezervat credite</Text>
              </Grid.Col>
            )}

            {document.form_data_b.creditAngajament && (
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">Credit Angajament:</Text>
                <Text size="sm">{document.form_data_b.creditAngajament}</Text>
              </Grid.Col>
            )}

            {document.form_data_b.creditBugetar && (
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">Credit Bugetar:</Text>
                <Text size="sm">{document.form_data_b.creditBugetar}</Text>
              </Grid.Col>
            )}

            {document.form_data_b.intrucatMotiv && (
              <Grid.Col span={12}>
                <Text size="xs" c="dimmed">Motiv:</Text>
                <Text size="sm">{document.form_data_b.intrucatMotiv}</Text>
              </Grid.Col>
            )}
          </Grid>
        </Paper>
      )}

      {/* Decizie Ordonator */}
      {document.rezultat_ordonator && (
        <Paper withBorder p="md">
          <Text fw={700} mb="sm">Decizie Ordonator</Text>
          <Grid gutter="xs">
            <Grid.Col span={6}>
              <Text size="xs" c="dimmed">Rezultat:</Text>
              <Text 
                size="sm" 
                fw={600}
                c={
                  document.rezultat_ordonator === 'Aprobat' ? 'green' :
                  document.rezultat_ordonator === 'Respins' ? 'red' : 'orange'
                }
              >
                {document.rezultat_ordonator}
              </Text>
            </Grid.Col>
            {document.motiv_ordonator && (
              <Grid.Col span={12}>
                <Text size="xs" c="dimmed">Motiv:</Text>
                <Text size="sm">{document.motiv_ordonator}</Text>
              </Grid.Col>
            )}
          </Grid>
        </Paper>
      )}

      {/* Status Finalizare */}
      {document.finalizat && (
        <Paper withBorder p="md" bg="green.0">
          <Group>
            <Text fw={700} c="green">✓ Document Finalizat</Text>
          </Group>
        </Paper>
      )}

      {/* PDF Downloads */}
      {(document.pdf_hash || document.pdf_path || document.pdf_a_signed_path || document.pdf_b_path || document.pdf_b_signed_path || document.pdf_final_signed_path) && (
        <Paper withBorder p="md">
          <Text fw={700} mb="sm">Documente PDF</Text>
          <Stack gap="xs">
            {(document.pdf_hash || document.pdf_path) && (
              <Group justify="space-between">
                <Text size="sm">PDF Secțiunea A (generat)</Text>
                <Button
                  component="a"
                  href={document.pdf_hash ? `/api/data/files/${document.pdf_hash}` : `/${document.pdf_path}`}
                  target="_blank"
                  size="xs"
                  variant="light"
                >
                  Descarcă
                </Button>
              </Group>
            )}
            
            {document.pdf_a_signed_path && (
              <Group justify="space-between">
                <Text size="sm">PDF Secțiunea A (semnat)</Text>
                <Button
                  component="a"
                  href={`/${document.pdf_a_signed_path}`}
                  target="_blank"
                  size="xs"
                  variant="light"
                  color="green"
                >
                  Descarcă
                </Button>
              </Group>
            )}
            
            {document.pdf_b_path && (
              <Group justify="space-between">
                <Text size="sm">PDF Secțiunea B (generat)</Text>
                <Button
                  component="a"
                  href={`/${document.pdf_b_path}`}
                  target="_blank"
                  size="xs"
                  variant="light"
                >
                  Descarcă
                </Button>
              </Group>
            )}
            
            {document.pdf_b_signed_path && (
              <Group justify="space-between">
                <Text size="sm">PDF Secțiunea B (semnat)</Text>
                <Button
                  component="a"
                  href={`/${document.pdf_b_signed_path}`}
                  target="_blank"
                  size="xs"
                  variant="light"
                  color="green"
                >
                  Descarcă
                </Button>
              </Group>
            )}
            
            {document.pdf_final_signed_path && (
              <Group justify="space-between">
                <Text size="sm" fw={600}>PDF Final (semnat)</Text>
                <Button
                  component="a"
                  href={`/${document.pdf_final_signed_path}`}
                  target="_blank"
                  size="xs"
                  variant="filled"
                  color="green"
                >
                  Descarcă
                </Button>
              </Group>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
