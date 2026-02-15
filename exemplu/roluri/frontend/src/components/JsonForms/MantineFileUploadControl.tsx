import { rankWith, ControlProps, isControl } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { Stack, Text, Group, Button, Badge, ActionIcon, Box, Loader } from '@mantine/core';
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import { IconUpload, IconX, IconFile, IconDownload } from '@tabler/icons-react';
import { useState } from 'react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';

/**
 * Mantine File Upload Control for JsonForms
 * Renders file upload with drag & drop
 * 
 * Triggers when:
 * - Schema type is "array"
 * - Items have contentMediaType: "application/octet-stream"
 */

export const MantineFileUploadControl = (props: ControlProps) => {
  const {
    data,
    handleChange,
    path,
    label,
    errors,
    schema,
    visible,
    enabled,
    required,
  } = props;

  const [uploadedFiles, setUploadedFiles] = useState<any[]>(data || []);
  const [uploading, setUploading] = useState(false);

  if (!visible) {
    return null;
  }

  const handleDrop = async (droppedFiles: FileWithPath[]) => {
    setUploading(true);

    try {
      // Upload each file using the platform's secure file upload API
      const uploadPromises = droppedFiles.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name);

        try {
          const response = await api.post('/api/documents/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
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
      const successfulUploads = uploadResults.filter((result) => result !== null);

      if (successfulUploads.length > 0) {
        const newFiles = [...uploadedFiles, ...successfulUploads];
        setUploadedFiles(newFiles);
        handleChange(path, newFiles);

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

  const handleRemove = async (index: number) => {
    const fileToRemove = uploadedFiles[index];
    
    // Optionally delete from server
    // Uncomment if you want to delete files when removed from form
    // try {
    //   await api.delete(`/api/documents/${fileToRemove.file_hash}`);
    // } catch (error) {
    //   console.error('Failed to delete file:', error);
    // }

    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    handleChange(path, newFiles);
  };

  const handleDownload = async (file: any) => {
    try {
      window.open(`/media/files/${file.filename}`, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut descărca fișierul',
        color: 'red',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Stack gap="sm">
      {label && (
        <Text fw={500} size="sm">
          {label}
          {required && <span style={{ color: 'red' }}> *</span>}
        </Text>
      )}

      <Dropzone
        onDrop={handleDrop}
        disabled={!enabled}
        maxSize={10 * 1024 * 1024} // 10MB
      >
        <Group justify="center" gap="xl" style={{ minHeight: 120, pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload size={50} stroke={1.5} />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={50} stroke={1.5} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconFile size={50} stroke={1.5} />
          </Dropzone.Idle>

          <div>
            <Text size="xl" inline>
              Trage fișiere aici sau click pentru a selecta
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Atașează fișiere (max 10MB per fișier)
            </Text>
          </div>
        </Group>
      </Dropzone>

      {uploading && (
        <Group justify="center" p="md">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Se încarcă fișierele...</Text>
        </Group>
      )}

      {uploadedFiles.length > 0 && (
        <Stack gap="xs">
          {uploadedFiles.map((file, index) => (
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
                  onClick={() => handleDownload(file)}
                  title="Descarcă"
                >
                  <IconDownload size={16} />
                </ActionIcon>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={() => handleRemove(index)}
                  disabled={!enabled}
                  title="Șterge"
                >
                  <IconX size={16} />
                </ActionIcon>
              </Group>
            </Group>
          ))}
        </Stack>
      )}

      {errors && (
        <Text c="red" size="sm">
          {errors}
        </Text>
      )}
    </Stack>
  );
};

export const mantineFileUploadControlTester = rankWith(
  4, // Higher priority
  (uischema, schema) => {
    if (!isControl(uischema)) {
      return false;
    }
    
    // Check if it's an array with file content
    return (
      schema.type === 'array' &&
      schema.items &&
      (schema.items as any).contentMediaType === 'application/octet-stream'
    );
  }
);

export default withJsonFormsControlProps(MantineFileUploadControl);
