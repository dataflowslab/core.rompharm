import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Tabs,
  Stack,
  Group,
  Button,
  Modal,
  TextInput,
  Textarea,
  ActionIcon,
  Badge,
  Text,
  Paper,
  Loader,
  Alert,
  MultiSelect,
  Checkbox,
  SimpleGrid,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import {
  IconUpload,
  IconX,
  IconFile,
  IconEdit,
  IconTrash,
  IconDownload,
  IconAlertCircle,
  IconFolder,
  IconFolderOpen,
  IconSearch,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';
import { SecureImage } from '../components/Library/SecureImage';

interface FileItem {
  id: string;
  title: string;
  description: string;
  original_filename: string;
  size: number;
  mime_type: string;
  owner: string;
  shared_with: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
  hash: string;
}

export function LibraryPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string | null>('my-files');
  const [myFiles, setMyFiles] = useState<FileItem[]>([]);
  const [sharedFiles, setSharedFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpened, setUploadModalOpened] = useState(false);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  
  // Pagination
  const [myFilesSkip, setMyFilesSkip] = useState(0);
  const [sharedFilesSkip, setSharedFilesSkip] = useState(0);
  const [myFilesHasMore, setMyFilesHasMore] = useState(false);
  const [sharedFilesHasMore, setSharedFilesHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const limit = 20;
  
  // Upload form
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  // Edit form
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSharedWith, setEditSharedWith] = useState<string[]>([]);
  const [editTags, setEditTags] = useState<string[]>([]);

  useEffect(() => {
    loadFiles(true);
  }, [activeTab, searchQuery]);

  const loadFiles = async (reset: boolean = false) => {
    setLoading(true);
    try {
      if (activeTab === 'my-files') {
        const skip = reset ? 0 : myFilesSkip;
        const response = await api.get('/api/library/my-files', {
          params: { skip, limit, search: searchQuery || undefined },
        });
        setMyFiles(reset ? response.data.files : [...myFiles, ...response.data.files]);
        setMyFilesSkip(skip + limit);
        setMyFilesHasMore(response.data.has_more);
      } else {
        const skip = reset ? 0 : sharedFilesSkip;
        const response = await api.get('/api/library/shared-with-me', {
          params: { skip, limit, search: searchQuery || undefined },
        });
        setSharedFiles(reset ? response.data.files : [...sharedFiles, ...response.data.files]);
        setSharedFilesSkip(skip + limit);
        setSharedFilesHasMore(response.data.has_more);
      }
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

  const handleUpload = async () => {
    if (!uploadFile) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a file'),
        color: 'red',
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadTitle) formData.append('title', uploadTitle);
      if (uploadDescription) formData.append('description', uploadDescription);

      await api.post('/api/library/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      notifications.show({
        title: t('Success'),
        message: t('File uploaded successfully'),
        color: 'green',
      });

      setUploadModalOpened(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');
      loadFiles(true);
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to upload file'),
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (file: FileItem) => {
    setEditingFile(file);
    setEditTitle(file.title);
    setEditDescription(file.description);
    setEditSharedWith(file.shared_with || []);
    setEditTags(file.tags || []);
    setEditModalOpened(true);
  };

  const handleSaveEdit = async () => {
    if (!editingFile) return;

    try {
      await api.put(`/api/library/files/${editingFile.id}`, {
        title: editTitle,
        description: editDescription,
        shared_with: editSharedWith,
        tags: editTags,
      });

      notifications.show({
        title: t('Success'),
        message: t('File updated successfully'),
        color: 'green',
      });

      setEditModalOpened(false);
      loadFiles(true);
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to update file'),
        color: 'red',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return;

    const confirmed = confirm(
      t('Are you sure you want to delete {{count}} file(s)? This action cannot be undone and files will be permanently removed.', {
        count: selectedFiles.size,
      })
    );

    if (!confirmed) return;

    try {
      await api.post('/api/library/files/bulk-delete', Array.from(selectedFiles));
      
      notifications.show({
        title: t('Success'),
        message: t('Files deleted successfully'),
        color: 'green',
      });
      
      setSelectedFiles(new Set());
      loadFiles(true);
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete files'),
        color: 'red',
      });
    }
  };

  const handleDelete = async (fileId: string) => {
    const confirmed = confirm(
      t('Are you sure you want to delete this file? This action cannot be undone.')
    );

    if (!confirmed) return;

    try {
      await api.delete(`/api/library/files/${fileId}`);
      notifications.show({
        title: t('Success'),
        message: t('File deleted successfully'),
        color: 'green',
      });
      loadFiles(true);
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to delete file'),
        color: 'red',
      });
    }
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const response = await api.get(`/api/library/files/${fileId}/download`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: t('Failed to download file'),
        color: 'red',
      });
    }
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ro-RO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  const getFilePreview = (file: FileItem) => {
    const isImage = file.mime_type?.startsWith('image/');
    const ext = file.original_filename.split('.').pop()?.toUpperCase() || 'FILE';
    
    if (isImage) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', minHeight: '400px' }}>
          <SecureImage
            fileId={file.id}
            alt={file.title}
            style={{
              maxHeight: '400px',
              maxWidth: '100%',
              objectFit: 'contain'
            }}
          />
        </div>
      );
    }
    
    return (
      <Paper p="xl" withBorder style={{ textAlign: 'center', backgroundColor: '#f8f9fa' }}>
        <Stack align="center" gap="md">
          <div
            style={{
              width: 120,
              height: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#e9ecef',
              borderRadius: '8px',
              border: '2px solid #dee2e6',
            }}
          >
            <Text size="48px" fw={700} c="#868e96" style={{ fontFamily: 'monospace' }}>
              {ext}
            </Text>
          </div>
          <Text size="sm" c="dimmed">{t('Preview not available for this file type')}</Text>
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={() => handleDownload(file.id, file.original_filename)}
          >
            {t('Download')}
          </Button>
        </Stack>
      </Paper>
    );
  };

  const renderFileGrid = (files: FileItem[], showOwner: boolean = false) => {
    if (files.length === 0) {
      return (
        <Alert icon={<IconAlertCircle size={16} />} title={t('No files')}>
          {searchQuery
            ? t('No files found matching your search.')
            : t('No files found in this section.')}
        </Alert>
      );
    }

    return (
      <Stack>
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="md">
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
              >
                <Stack gap="xs">
                  <div 
                    style={{ position: 'relative', width: '100%', aspectRatio: '1/1', cursor: 'pointer' }}
                    onClick={() => !showOwner && handleEdit(file)}
                  >
                    {getFileIcon(file)}
                    {!showOwner && (
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleFileSelection(file.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ position: 'absolute', top: 8, left: 8 }}
                      />
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
                    {showOwner && (
                      <Badge size="xs" variant="light" mt={4}>
                        {file.owner}
                      </Badge>
                    )}
                  </div>
                  <Group gap="xs" justify="center">
                    <ActionIcon
                      color="blue"
                      variant="subtle"
                      size="sm"
                      onClick={() => handleDownload(file.id, file.original_filename)}
                      title={t('Download')}
                    >
                      <IconDownload size={14} />
                    </ActionIcon>
                    {!showOwner && (
                      <>
                        <ActionIcon
                          color="orange"
                          variant="subtle"
                          size="sm"
                          onClick={() => handleEdit(file)}
                          title={t('Edit')}
                        >
                          <IconEdit size={14} />
                        </ActionIcon>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          size="sm"
                          onClick={() => handleDelete(file.id)}
                          title={t('Delete')}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </>
                    )}
                  </Group>
                </Stack>
              </Paper>
            );
          })}
        </SimpleGrid>

        {((activeTab === 'my-files' && myFilesHasMore) ||
          (activeTab === 'shared' && sharedFilesHasMore)) && (
          <Button variant="light" onClick={() => loadFiles(false)} loading={loading} fullWidth>
            {t('Load More')}
          </Button>
        )}
      </Stack>
    );
  };

  if (loading && myFiles.length === 0 && sharedFiles.length === 0) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading files...')}</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Group justify="space-between">
          <Title order={2}>{t('Library')}</Title>
          <Group>
            {selectedFiles.size > 0 && (
              <Button
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={handleBulkDelete}
              >
                {t('Delete')} ({selectedFiles.size})
              </Button>
            )}
            <Button leftSection={<IconUpload size={16} />} onClick={() => setUploadModalOpened(true)}>
              {t('Upload File')}
            </Button>
          </Group>
        </Group>

        <TextInput
          placeholder={t('Search files...')}
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          rightSection={
            searchQuery && (
              <ActionIcon variant="subtle" onClick={() => setSearchQuery('')}>
                <IconX size={16} />
              </ActionIcon>
            )
          }
        />

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="my-files" leftSection={<IconFolder size={16} />}>
              {t('My Files')}
            </Tabs.Tab>
            <Tabs.Tab value="shared" leftSection={<IconFolderOpen size={16} />}>
              {t('Shared with Me')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="my-files" pt="md">
            {renderFileGrid(myFiles, false)}
          </Tabs.Panel>

          <Tabs.Panel value="shared" pt="md">
            {renderFileGrid(sharedFiles, true)}
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Upload Modal */}
      <Modal opened={uploadModalOpened} onClose={() => setUploadModalOpened(false)} title={t('Upload File')} size="lg">
        <Stack>
          <Dropzone onDrop={(files) => setUploadFile(files[0])} maxFiles={1} loading={uploading}>
            <Group justify="center" gap="xs" style={{ minHeight: 120, pointerEvents: 'none' }}>
              <Dropzone.Accept>
                <IconUpload size={52} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={52} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconFile size={52} />
              </Dropzone.Idle>
              <div>
                <Text size="xl" inline>
                  {uploadFile ? uploadFile.name : t('Drag file here or click to select')}
                </Text>
                <Text size="sm" c="dimmed" inline mt={7}>
                  {uploadFile ? `${formatFileSize(uploadFile.size)} - ${uploadFile.type}` : t('Any file type accepted')}
                </Text>
              </div>
            </Group>
          </Dropzone>

          <TextInput
            label={t('Title')}
            placeholder={t('Enter file title (optional)')}
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
          />

          <Textarea
            label={t('Description')}
            placeholder={t('Enter file description (optional)')}
            value={uploadDescription}
            onChange={(e) => setUploadDescription(e.target.value)}
            minRows={3}
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={() => setUploadModalOpened(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleUpload} loading={uploading} disabled={!uploadFile}>
              {t('Upload')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Modal */}
      <Modal opened={editModalOpened} onClose={() => setEditModalOpened(false)} title={t('Edit File')} size="lg">
        <Stack>
          {editingFile && getFilePreview(editingFile)}

          <TextInput
            label={t('Title')}
            placeholder={t('Enter file title')}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />

          <Textarea
            label={t('Description')}
            placeholder={t('Enter file description')}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            minRows={3}
          />

          <MultiSelect
            label={t('Share with')}
            placeholder={t('Enter usernames or roles')}
            data={editSharedWith}
            value={editSharedWith}
            onChange={setEditSharedWith}
            searchable
          />

          <MultiSelect
            label={t('Tags')}
            placeholder={t('Add tags (e.g., "shared")')}
            data={['shared', 'important', 'archive', ...editTags.filter((t) => !['shared', 'important', 'archive'].includes(t))]}
            value={editTags}
            onChange={setEditTags}
            searchable
          />

          {editingFile && (
            <Paper p="md" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  {t('Metadata')}
                </Text>
                <Group gap="xl">
                  <div>
                    <Text size="xs" c="dimmed">
                      {t('Owner')}
                    </Text>
                    <Text size="sm">{editingFile.owner}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      {t('Created')}
                    </Text>
                    <Text size="sm">{formatDate(editingFile.created_at)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      {t('Modified')}
                    </Text>
                    <Text size="sm">{formatDate(editingFile.updated_at)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      {t('Size')}
                    </Text>
                    <Text size="sm">{formatFileSize(editingFile.size)}</Text>
                  </div>
                </Group>
              </Stack>
            </Paper>
          )}

          <Group justify="flex-end">
            <Button variant="light" onClick={() => setEditModalOpened(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSaveEdit}>{t('Save')}</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
