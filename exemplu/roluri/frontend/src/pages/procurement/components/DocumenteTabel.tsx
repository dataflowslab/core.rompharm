import { useState } from 'react';
import {
  Paper,
  Title,
  Button,
  Table,
  Group,
  Text,
  ActionIcon,
  Modal,
  TextInput,
  Stack,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../../services/api';

interface Document {
  id: string;
  denumire: string;
  serie_numar: string;
  data_document: string;
  revizie: string;
  created_at: string;
  created_by: string;
}

interface DocumenteTabelProps {
  contractId: string;
  documente: Document[];
  onUpdate: () => void;
}

export function DocumenteTabel({ contractId, documente, onUpdate }: DocumenteTabelProps) {
  const [modalOpened, setModalOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    denumire: '',
    serie_numar: '',
    data_document: new Date(),
    revizie: '',
  });

  const handleAdd = async () => {
    if (!formData.denumire || !formData.serie_numar || !formData.revizie) {
      notifications.show({
        title: 'Eroare',
        message: 'Completează toate câmpurile',
        color: 'red',
      });
      return;
    }

    try {
      setLoading(true);
      await api.post(`/api/procurement/contracte/${contractId}/documente`, {
        ...formData,
        data_document: formData.data_document.toISOString().split('T')[0],
      });

      notifications.show({
        title: 'Succes',
        message: 'Document adăugat cu succes',
        color: 'green',
      });

      setModalOpened(false);
      setFormData({
        denumire: '',
        serie_numar: '',
        data_document: new Date(),
        revizie: '',
      });
      onUpdate();
    } catch (error: any) {
      console.error('Failed to add document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut adăuga documentul',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi acest document?')) return;

    try {
      await api.delete(`/api/procurement/contracte/${contractId}/documente/${documentId}`);
      notifications.show({
        title: 'Succes',
        message: 'Document șters cu succes',
        color: 'green',
      });
      onUpdate();
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut șterge documentul',
        color: 'red',
      });
    }
  };

  return (
    <>
      <Paper withBorder p="md">
        <Group justify="space-between" mb="md">
          <Title order={4}>Documente</Title>
          <Button
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpened(true)}
          >
            Adaugă document
          </Button>
        </Group>

        {documente.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            Nu există documente adăugate
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Denumire</Table.Th>
                <Table.Th>Serie și număr</Table.Th>
                <Table.Th>Data</Table.Th>
                <Table.Th>Revizie</Table.Th>
                <Table.Th>Acțiuni</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {documente.map((doc) => (
                <Table.Tr key={doc.id}>
                  <Table.Td>{doc.denumire}</Table.Td>
                  <Table.Td>{doc.serie_numar}</Table.Td>
                  <Table.Td>{new Date(doc.data_document).toLocaleDateString('ro-RO')}</Table.Td>
                  <Table.Td>{doc.revizie}</Table.Td>
                  <Table.Td>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Add Document Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Adaugă document"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Denumire document"
            placeholder="Ex: Act adițional nr. 1"
            value={formData.denumire}
            onChange={(e) => setFormData({ ...formData, denumire: e.target.value })}
            required
          />

          <TextInput
            label="Serie și număr"
            placeholder="Ex: 123/2024"
            value={formData.serie_numar}
            onChange={(e) => setFormData({ ...formData, serie_numar: e.target.value })}
            required
          />

          <DateInput
            label="Data document"
            value={formData.data_document}
            onChange={(val) => setFormData({ ...formData, data_document: val || new Date() })}
            valueFormat="DD/MM/YYYY"
            required
          />

          <TextInput
            label="Revizie"
            placeholder="Ex: Rev. 0"
            value={formData.revizie}
            onChange={(e) => setFormData({ ...formData, revizie: e.target.value })}
            required
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setModalOpened(false)}>
              Anulează
            </Button>
            <Button onClick={handleAdd} loading={loading}>
              Adaugă
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
