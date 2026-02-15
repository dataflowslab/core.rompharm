import { useState } from 'react';
import {
  Paper,
  Title,
  Table,
  Group,
  Text,
  ActionIcon,
  TextInput,
  Stack,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { Dropzone } from '@mantine/dropzone';
import { IconUpload, IconFile, IconX, IconTrash, IconDownload, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../../services/api';
import { PdfSignatureBadge } from './PdfSignatureBadge';

interface AchizitieFile {
  _id: string;
  file_hash: string;
  denumire: string;
  data_document?: string;
  observatii?: string;
}

interface FisiereTabelProps {
  achizitieId: string;
  files: AchizitieFile[];
  isEditable: boolean;
  onUpdate: () => void;
}

export function FisiereTabel({ achizitieId, files, isEditable, onUpdate }: FisiereTabelProps) {
  const [uploading, setUploading] = useState(false);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  const handleFileUpload = async (uploadedFiles: File[]) => {
    try {
      setUploading(true);

      for (const file of uploadedFiles) {
        // Upload file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name);
        formData.append('main', 'false');

        const uploadResponse = await api.post('/api/library/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        // Add to achizitie
        await api.post(`/api/procurement/achizitii/${achizitieId}/files`, {
          file_hash: uploadResponse.data.hash,
          denumire: file.name,
          data_document: null,
          observatii: '',
        });
      }

      notifications.show({
        title: 'Succes',
        message: `${uploadedFiles.length} fișier(e) încărcat(e)`,
        color: 'green',
      });

      onUpdate();
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

  const handleEdit = (file: AchizitieFile) => {
    setEditingFile(file._id);
    setEditData({
      denumire: file.denumire,
      data_document: file.data_document ? new Date(file.data_document) : null,
      observatii: file.observatii || '',
    });
  };

  const handleSaveEdit = async (fileId: string, fileHash: string) => {
    try {
      await api.put(`/api/procurement/achizitii/${achizitieId}/files/${fileId}`, {
        file_hash: fileHash,
        denumire: editData.denumire,
        data_document: editData.data_document ? editData.data_document.toISOString().split('T')[0] : null,
        observatii: editData.observatii,
      });

      notifications.show({
        title: 'Succes',
        message: 'Fișierul a fost actualizat',
        color: 'green',
      });

      setEditingFile(null);
      onUpdate();
    } catch (error: any) {
      console.error('Failed to update file:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut actualiza fișierul',
        color: 'red',
      });
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi acest fișier?')) return;

    try {
      await api.delete(`/api/procurement/achizitii/${achizitieId}/files/${fileId}`);
      notifications.show({
        title: 'Succes',
        message: 'Fișierul a fost șters',
        color: 'green',
      });
      onUpdate();
    } catch (error: any) {
      console.error('Failed to delete file:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut șterge fișierul',
        color: 'red',
      });
    }
  };

  return (
    <Paper withBorder p="md">
      <Title order={4} mb="md">Fișiere</Title>

      {isEditable && (
        <Dropzone
          onDrop={handleFileUpload}
          loading={uploading}
          multiple
          mb="md"
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
                Poți încărca multiple fișiere
              </Text>
            </div>
          </Group>
        </Dropzone>
      )}

      {files.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          Nu există fișiere adăugate
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Denumire</Table.Th>
              <Table.Th>Data document</Table.Th>
              <Table.Th>Observații</Table.Th>
              <Table.Th>Acțiuni</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {files.map((file) => (
              <Table.Tr key={file._id}>
                <Table.Td>
                  {editingFile === file._id && isEditable ? (
                    <TextInput
                      value={editData.denumire}
                      onChange={(e) => setEditData({ ...editData, denumire: e.target.value })}
                      size="sm"
                    />
                  ) : (
                    <Group gap="xs">
                      <Text size="sm">{file.denumire}</Text>
                      <PdfSignatureBadge endpoint={`/api/data/files/${file.file_hash}/signature`} />
                    </Group>
                  )}
                </Table.Td>
                <Table.Td>
                  {editingFile === file._id && isEditable ? (
                    <DateInput
                      value={editData.data_document}
                      onChange={(val) => setEditData({ ...editData, data_document: val })}
                      valueFormat="DD/MM/YYYY"
                      size="sm"
                      clearable
                    />
                  ) : (
                    <Text size="sm">
                      {file.data_document ? new Date(file.data_document).toLocaleDateString('ro-RO') : '-'}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {editingFile === file._id && isEditable ? (
                    <TextInput
                      value={editData.observatii}
                      onChange={(e) => setEditData({ ...editData, observatii: e.target.value })}
                      size="sm"
                    />
                  ) : (
                    <Text size="sm">{file.observatii || '-'}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => window.open(`/api/data/files/${file.file_hash}`, '_blank')}
                    >
                      <IconDownload size={16} />
                    </ActionIcon>
                    {isEditable && (
                      <>
                        {editingFile === file._id ? (
                          <ActionIcon
                            variant="subtle"
                            color="green"
                            onClick={() => handleSaveEdit(file._id, file.file_hash)}
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                        ) : (
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => handleEdit(file)}
                          >
                            <IconFile size={16} />
                          </ActionIcon>
                        )}
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDelete(file._id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}


