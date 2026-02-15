import { useState } from 'react';
import {
  Paper,
  Title,
  Button,
  Table,
  Group,
  Text,
  ActionIcon,
  Badge,
  Stack,
} from '@mantine/core';
import { IconPlus, IconTrash, IconDownload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../../services/api';

interface Oferta {
  _id: string;
  ofertant_id: string;
  ofertant_denumire: string;
  ofertant_cif: string;
  data_primirii: string;
  valoare: number;
  observatii?: string;
  documentatie: string[];
}

interface OferteTabelProps {
  achizitieId: string;
  oferte: Oferta[];
  isEditable: boolean;
  onUpdate: () => void;
  onAddOferta: () => void;
}

export function OferteTabel({ achizitieId, oferte, isEditable, onUpdate, onAddOferta }: OferteTabelProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (ofertaId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi această ofertă?')) return;

    try {
      setDeleting(ofertaId);
      await api.delete(`/api/procurement/achizitii/${achizitieId}/oferte/${ofertaId}`);
      notifications.show({
        title: 'Succes',
        message: 'Oferta a fost ștearsă',
        color: 'green',
      });
      onUpdate();
    } catch (error: any) {
      console.error('Failed to delete oferta:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut șterge oferta',
        color: 'red',
      });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>Oferte primite</Title>
        {isEditable && (
          <Button
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={onAddOferta}
          >
            Adaugă ofertă
          </Button>
        )}
      </Group>

      {oferte.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          Nu există oferte adăugate
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Ofertant</Table.Th>
              <Table.Th>CIF</Table.Th>
              <Table.Th>Data primirii</Table.Th>
              <Table.Th>Valoare (lei)</Table.Th>
              <Table.Th>Observații</Table.Th>
              <Table.Th>Documentație</Table.Th>
              {isEditable && <Table.Th>Acțiuni</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {oferte.map((oferta) => (
              <Table.Tr key={oferta._id}>
                <Table.Td>{oferta.ofertant_denumire}</Table.Td>
                <Table.Td>{oferta.ofertant_cif}</Table.Td>
                <Table.Td>{new Date(oferta.data_primirii).toLocaleString('ro-RO')}</Table.Td>
                <Table.Td>{oferta.valoare.toFixed(2)}</Table.Td>
                <Table.Td>{oferta.observatii || '-'}</Table.Td>
                <Table.Td>
                  {oferta.documentatie && oferta.documentatie.length > 0 ? (
                    <Stack gap="xs">
                      {oferta.documentatie.map((hash, idx) => (
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
                {isEditable && (
                  <Table.Td>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => handleDelete(oferta._id)}
                      loading={deleting === oferta._id}
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
  );
}
