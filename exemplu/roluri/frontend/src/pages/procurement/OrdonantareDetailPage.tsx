/**
 * OrdonantareDetailPage - View ordonanțare document with workflow
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Group,
  Text,
  Badge,
  Stack,
  Grid,
  ActionIcon,
  LoadingOverlay,
  Table,
} from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../services/api';
import { WorkflowSidebarOrdonantare } from './components/WorkflowSidebarOrdonantare';
import { ActivityTimelineNew } from './components/ActivityTimelineNew';

interface Ordonantare {
  _id: string;
  nr_ordonant_pl: string;
  data_ordont_pl: string;
  fundamentare_id: string;
  fundamentare_nr_inreg: string;
  beneficiar: string;
  documente_justificative: string;
  iban_beneficiar: string;
  cif_beneficiar: string;
  banca_beneficiar: string;
  inf_pv_plata: string;
  inf_pv_plata1: string;
  stare: string;
  stare_a: string;
  stare_b: string;
  form_data: {
    tabel: any[];
  };
  created_at: string;
  created_by: string;
}

export function OrdonantareDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Ordonantare | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadDocument();
    }
  }, [id]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/procurement/ordonantare/${id}`);
      setDocument(response.data);
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut încărca documentul',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Nouă': 'blue',
      'Compilare': 'yellow',
      'Finalizat': 'green',
      'Eroare': 'red',
      'Anulat': 'gray',
    };
    return colors[status] || 'gray';
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (!document) {
    return (
      <Container size="xl" py="xl">
        <Text>Document nu a fost găsit</Text>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Grid>
        <Grid.Col span={9}>
          <Paper p="md" withBorder>
            <Group justify="space-between" mb="lg">
              <Group>
                <ActionIcon variant="subtle" onClick={() => navigate('/web/procurement/ordonantare')}>
                  <IconArrowLeft size={20} />
                </ActionIcon>
                <Title order={2}>Ordonanțare {document.nr_ordonant_pl}</Title>
              </Group>
              <Badge color={getStatusColor(document.stare)}>{document.stare}</Badge>
            </Group>

            <Stack gap="md">
              {/* Basic Info */}
              <div>
                <Text size="sm" c="dimmed">Nr. Ordonanță Plată</Text>
                <Text fw={500}>{document.nr_ordonant_pl}</Text>
              </div>

              <div>
                <Text size="sm" c="dimmed">Data Ordonanță Plată</Text>
                <Text fw={500}>
                  {new Date(document.data_ordont_pl).toLocaleDateString('ro-RO')}
                </Text>
              </div>

              <div>
                <Text size="sm" c="dimmed">Document Fundamentare</Text>
                <Text fw={500}>{document.fundamentare_nr_inreg}</Text>
              </div>

              <div>
                <Text size="sm" c="dimmed">Beneficiar</Text>
                <Text fw={500}>{document.beneficiar}</Text>
              </div>

              <div>
                <Text size="sm" c="dimmed">Documente Justificative</Text>
                <Text>{document.documente_justificative}</Text>
              </div>

              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">IBAN Beneficiar</Text>
                  <Text fw={500}>{document.iban_beneficiar}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">CIF Beneficiar</Text>
                  <Text fw={500}>{document.cif_beneficiar}</Text>
                </Grid.Col>
              </Grid>

              <div>
                <Text size="sm" c="dimmed">Bancă Beneficiar</Text>
                <Text fw={500}>{document.banca_beneficiar}</Text>
              </div>

              {document.inf_pv_plata && (
                <div>
                  <Text size="sm" c="dimmed">Informații PV Plată</Text>
                  <Text>{document.inf_pv_plata}</Text>
                </div>
              )}

              {document.inf_pv_plata1 && (
                <div>
                  <Text size="sm" c="dimmed">Informații PV Plată 1</Text>
                  <Text>{document.inf_pv_plata1}</Text>
                </div>
              )}

              {/* Table */}
              <div>
                <Title order={4} mb="sm">Tabel Angajamente</Title>
                <Table striped withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Cod Angajament</Table.Th>
                      <Table.Th>Indicator</Table.Th>
                      <Table.Th>Program</Table.Th>
                      <Table.Th>Cod SSI</Table.Th>
                      <Table.Th>Recepții</Table.Th>
                      <Table.Th>Plăți Anterioare</Table.Th>
                      <Table.Th>Sumă Ordonantată</Table.Th>
                      <Table.Th>Recepții Neplătite</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {document.form_data?.tabel?.map((row: any, idx: number) => (
                      <Table.Tr key={idx}>
                        <Table.Td>{row.cod_angajament}</Table.Td>
                        <Table.Td>{row.indicator_angajament}</Table.Td>
                        <Table.Td>{row.cod_ssi?.sb || '-'}</Table.Td>
                        <Table.Td>{row.cod_ssi?.code || '-'}</Table.Td>
                        <Table.Td>{row.receptii}</Table.Td>
                        <Table.Td>{row.plati_anterioare}</Table.Td>
                        <Table.Td>{row.suma_ordonantata_plata}</Table.Td>
                        <Table.Td>{row.receptii_neplatite}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>

              {/* Metadata */}
              <div>
                <Text size="sm" c="dimmed">Creat la</Text>
                <Text size="sm">
                  {new Date(document.created_at).toLocaleString('ro-RO')} de {document.created_by}
                </Text>
              </div>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={3}>
          <Stack gap="md">
            <WorkflowSidebarOrdonantare
              document={document}
              onRefresh={loadDocument}
            />
            
            <ActivityTimelineNew document={document} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
