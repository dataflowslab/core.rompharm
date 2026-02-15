import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Button,
  Group,
  Text,
  Loader,
  Alert,
  Paper,
  SimpleGrid,
  ActionIcon,
} from '@mantine/core';
import { IconSearch, IconX, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../services/api';
import { SecureImage } from './SecureImage';

interface FileItem {
  id: string;
  title: string;
  description: string;
  original_filename: string;
  size: number;
  mime_type: string;
  owner: string;
  hash: string;
}

interface FilePickerProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (files: FileItem[]) => void;
  multiple?: boolean;
}

export function FilePicker({ opened, onClose, onSelect, multiple = true }: FilePickerProps) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  useEffect(() => {
    if (opened) {
      loadFiles(true);
      setSelectedFiles(new Set());
    }
  }, [opened, search]);

  const loadFiles = async (reset: boolean = false) => {
    setLoading(true);
    try {
      const newSkip = reset ? 0 : skip;
      const response = await api.get('/api/library/files/all', {
        params: {
          skip: newSkip,
          limit,
          search: search || undefined,
        },
      });

      const newFiles = response.data.files;
      setFiles(reset ? newFiles : [...files, ...newFiles]);
      setSkip(newSkip + limit);
      setHasMore(response.data.has_more);
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to load files'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFile = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      if (!multiple) {
        newSelected.clear();
      }
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleConfirm = () => {
    const selected = files.filter((f) => selectedFiles.has(f.id));
    onSelect(selected);
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (file: FileItem) => {
    const isImage = file.mime_type?.startsWith('image/');
    
    if (isImage) {
      return (
        <div style={{ 
          width: '100%', 
          height: '100%', 
          overflow: 'hidden', 
          borderRadius: '4px', 
          backgroundColor: '#f8f9fa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <SecureImage
            fileId={file.id}
            alt={file.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
            onError={() => {
              // Fallback handled by SecureImage component
            }}
          />
        </div>
      );
    }

    // Get file extension
    const ext = file.original_filename.split('.').pop()?.toUpperCase() || 'FILE';
    
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f1f3f5',
          borderRadius: '4px',
          border: '1px solid #dee2e6',
        }}
      >
        <Text size="xl" fw={700} c="#868e96" style={{ fontFamily: 'monospace' }}>
          {ext}
        </Text>
      </div>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Choose from Library')}
      size="xl"
    >
      <Stack>
        <TextInput
          placeholder={t('Search files...')}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          rightSection={
            search && (
              <ActionIcon variant="subtle" onClick={() => setSearch('')}>
                <IconX size={16} />
              </ActionIcon>
            )
          }
        />

        {loading && files.length === 0 ? (
          <Stack align="center" py="xl">
            <Loader size="lg" />
            <Text>{t('Loading files...')}</Text>
          </Stack>
        ) : files.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No files')}>
            {t('No files found. Upload files to the library first.')}
          </Alert>
        ) : (
          <>
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
              {files.map((file) => {
                const isSelected = selectedFiles.has(file.id);
                return (
                  <Paper
                    key={file.id}
                    p="xs"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #228be6' : undefined,
                      backgroundColor: isSelected ? '#e7f5ff' : undefined,
                    }}
                    onClick={() => handleToggleFile(file.id)}
                  >
                    <Stack gap="xs">
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1' }}>
                        {getFileIcon(file)}
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              backgroundColor: '#228be6',
                              borderRadius: '50%',
                              padding: 4,
                            }}
                          >
                            <IconCheck size={16} color="white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <Text 
                          size="sm" 
                          fw={500} 
                          lineClamp={2}
                          title={file.title}
                          style={{ 
                            minHeight: '2.5em',
                            lineHeight: '1.25em',
                            wordBreak: 'break-word'
                          }}
                        >
                          {file.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatFileSize(file.size)}
                        </Text>
                      </div>
                    </Stack>
                  </Paper>
                );
              })}
            </SimpleGrid>

            {hasMore && (
              <Button
                variant="light"
                onClick={() => loadFiles(false)}
                loading={loading}
                fullWidth
              >
                {t('Load More')}
              </Button>
            )}
          </>
        )}

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {selectedFiles.size} {t('file(s) selected')}
          </Text>
          <Group>
            <Button variant="light" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedFiles.size === 0}
              leftSection={<IconCheck size={16} />}
            >
              {t('Select')} ({selectedFiles.size})
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
