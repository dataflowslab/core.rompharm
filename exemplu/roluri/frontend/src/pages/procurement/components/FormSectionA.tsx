import { useState } from 'react';
import { Box, Textarea, Text, Stack, Group, ActionIcon, Loader } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconUpload, IconX, IconFile, IconDownload } from '@tabler/icons-react';
import { api } from '../../../services/api';
import { notifications } from '@mantine/notifications';
import { SafeSelect } from './SafeSelect';

interface UploadedFile {
  file_hash: string;
  filename: string;
  original_filename: string;
  size: number;
  mime_type: string;
  uploaded_at: string;
}

interface FormSectionAProps {
  formData: {
    compartiment: string;
    descriereScurta: string;
    descriereDetaliata: string;
    atasamente: UploadedFile[];
  };
  departmentOptions: { value: string; label: string }[];
  loadingDepartments: boolean;
  onChange: (field: string, value: any) => void;
}

export function FormSectionA({ 
  formData, 
  departmentOptions, 
  loadingDepartments, 
  onChange 
}: FormSectionAProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileDrop = async (files: File[]) => {
    setUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('title', file.name);
        formDataUpload.append('main', 'false');

        try {
          const response = await api.post('/api/library/upload', formDataUpload, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          return {
            file_hash: response.data.file_hash,
            filename: response.data.filename,
            original_filename: file.name,
            size: file.size,
            mime_type: file.type,
            uploaded_at: new Date().toISOString(),
          };
        } catch (error: any) {
          console.error(`Failed to upload ${file.name}:`, error);
          notifications.show({
            title: 'Eroare upload',
            message: `Nu s-a putut încărca ${file.name}`,
            color: 'red',
          });
          return null;
        }
      });

      const uploadResults = await Promise.all(uploadPromises);
      const successfulUploads = uploadResults.filter((result) => result !== null) as UploadedFile[];

      if (successfulUploads.length > 0) {
        onChange('atasamente', [...formData.atasamente, ...successfulUploads]);

        notifications.show({
          title: 'Success',
          message: `${successfulUploads.length} fișier(e) încărcat(e) cu succes`,
          color: 'green',
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      notifications.show({
        title: 'Eroare',
        message: 'A apărut o eroare la încărcarea fișierelor',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    onChange('atasamente', formData.atasamente.filter((_, i) => i !== index));
  };

  const handleDownloadFile = (file: UploadedFile) => {
    window.open(`/media/files/${file.filename}`, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <>
      <SafeSelect
        label="1. Compartiment de specialitate:"
        value={formData.compartiment}
        onChange={(value) => onChange('compartiment', value || '')}
        data={departmentOptions}
        searchable
        required
        disabled={loadingDepartments}
        placeholder="Selectează compartiment"
        nothingFoundMessage="Nu există compartimente"
      />

      <Textarea
        label="2. Descrierea pe scurt a obiectului documentului de fundamentare/motivul reviziei:"
        value={formData.descriereScurta}
        onChange={(e) => onChange('descriereScurta', e.target.value)}
        minRows={3}
        required
        error={!formData.descriereScurta ? 'Câmpul este obligatoriu' : undefined}
      />

      <Box>
        <Textarea
          label="3. Descrierea pe larg a stării de fapt și de drept:"
          value={formData.descriereDetaliata}
          onChange={(e) => onChange('descriereDetaliata', e.target.value)}
          minRows={6}
          required
          error={!formData.descriereDetaliata ? 'Câmpul este obligatoriu' : undefined}
        />
        
        <Box mt="md">
          <Text fw={500} size="sm" mb="xs">Atașează fișiere:</Text>
          <Dropzone
            onDrop={handleFileDrop}
            maxSize={10 * 1024 * 1024}
            loading={uploading}
          >
            <Group justify="center" gap="xl" style={{ minHeight: 100, pointerEvents: 'none' }}>
              <Dropzone.Accept>
                <IconUpload size={40} stroke={1.5} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={40} stroke={1.5} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconFile size={40} stroke={1.5} />
              </Dropzone.Idle>

              <div>
                <Text size="lg" inline>
                  Trage fișiere aici sau click pentru a selecta
                </Text>
                <Text size="sm" c="dimmed" inline mt={7}>
                  Max 10MB per fișier
                </Text>
              </div>
            </Group>
          </Dropzone>

          {formData.atasamente.length > 0 && (
            <Stack gap="xs" mt="md">
              {formData.atasamente.map((file, index) => (
                <Group key={index} justify="space-between" p="xs" style={{ border: '1px solid #dee2e6', borderRadius: 4 }}>
                  <Group gap="sm">
                    <IconFile size={20} />
                    <div>
                      <Text size="sm" fw={500}>{file.original_filename}</Text>
                      <Text size="xs" c="dimmed">{formatFileSize(file.size)}</Text>
                    </div>
                  </Group>
                  <Group gap="xs">
                    <ActionIcon
                      color="blue"
                      variant="subtle"
                      onClick={() => handleDownloadFile(file)}
                      title="Descarcă"
                    >
                      <IconDownload size={16} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => handleRemoveFile(index)}
                      title="Șterge"
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </>
  );
}
