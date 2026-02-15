import { useEffect, useState } from 'react';
import {
  Stack,
  TextInput,
  Paper,
  Title,
  Group,
  Button,
  Text,
  ActionIcon,
  MultiSelect,
  NumberInput,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconUpload, IconX, IconFile, IconTrash, IconDownload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { api } from '../../../services/api';
import { PdfSignatureBadge } from './PdfSignatureBadge';

export interface SimpleDocumentFile {
  file_id: string;
  filename: string;
}

export interface SimpleDocumentData {
  titlu: string;
  descriere: string;
  files: SimpleDocumentFile[];
  shared_with: string[];
  an?: number;
}

interface SimpleDocumentFormProps {
  apiBase: string;
  initialData?: Partial<SimpleDocumentData>;
  onSubmit: (data: SimpleDocumentData) => void;
  onCancel: () => void;
  submitLabel?: string;
  loading?: boolean;
}

export function SimpleDocumentForm({
  apiBase,
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Salveaza',
  loading = false,
}: SimpleDocumentFormProps) {
  const currentYear = new Date().getFullYear();
  const [title, setTitle] = useState(initialData?.titlu || '');
  const [description, setDescription] = useState(initialData?.descriere || '');
  const [files, setFiles] = useState<SimpleDocumentFile[]>(initialData?.files || []);
  const [sharedWith, setSharedWith] = useState<string[]>(initialData?.shared_with || []);
  const [year, setYear] = useState<number>(initialData?.an || currentYear);
  const [shareOptions, setShareOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Link],
    content: description || '',
    onUpdate: ({ editor }) => {
      setDescription(editor.getHTML());
    },
  });

  useEffect(() => {
    setTitle(initialData?.titlu || '');
    setDescription(initialData?.descriere || '');
    setFiles(initialData?.files || []);
    setSharedWith(initialData?.shared_with || []);
    setYear(initialData?.an || currentYear);

    if (editor) {
      editor.commands.setContent(initialData?.descriere || '');
    }
  }, [initialData, editor]);

  useEffect(() => {
    const loadShareOptions = async () => {
      try {
        const response = await api.get(`${apiBase}/share-options`);
        const options = Array.isArray(response.data?.options) ? response.data.options : [];
        setShareOptions(options);

        if (!initialData) {
          const preselected = Array.isArray(response.data?.preselected) ? response.data.preselected : [];
          setSharedWith(preselected);
        }
      } catch (error) {
        console.error('Failed to load share options:', error);
        setShareOptions([]);
      }
    };

    loadShareOptions();
  }, [apiBase, initialData]);

  const handleFileUpload = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);
      const uploaded: SimpleDocumentFile[] = [];

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name);
        formData.append('main', 'false');

        const response = await api.post('/api/library/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        uploaded.push({
          file_id: response.data.hash,
          filename: file.name,
        });
      }

      setFiles((prev) => [...prev, ...uploaded]);

      notifications.show({
        title: 'Succes',
        message: `${selectedFiles.length} fisier(e) incarcate`,
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to upload files:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || error.message || 'Nu s-au putut incarca fisierele',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((file) => file.file_id !== fileId));
  };

  const handleDownloadFile = async (fileId: string) => {
    try {
      const response = await api.get(`/api/library/files/${fileId}/download`, {
        responseType: 'blob',
      });
      const file = files.find((item) => item.file_id === fileId);
      const filename = file?.filename || `document-${fileId}`;
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = filename;
      window.document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut descărca fișierul',
        color: 'red',
      });
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      notifications.show({
        title: 'Eroare',
        message: 'Titlul este obligatoriu',
        color: 'red',
      });
      return;
    }

    onSubmit({
      titlu: title.trim(),
      descriere: description || '',
      files,
      shared_with: sharedWith,
      an: year,
    });
  };

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Title order={4} mb="md">Detalii</Title>
        <Stack gap="sm">
          <TextInput
            label="Titlu"
            placeholder="Introdu titlul"
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            required
          />

          <NumberInput
            label="An"
            placeholder="Introdu anul"
            value={year}
            onChange={(value) => setYear(typeof value === 'number' ? value : currentYear)}
            min={2000}
            max={2100}
            required
          />

          <div>
            <Text size="sm" fw={500} mb="xs">
              Descriere
            </Text>
            <RichTextEditor editor={editor}>
              <RichTextEditor.Toolbar sticky stickyOffset={60}>
                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Bold />
                  <RichTextEditor.Italic />
                  <RichTextEditor.Underline />
                  <RichTextEditor.Strikethrough />
                  <RichTextEditor.ClearFormatting />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.H1 />
                  <RichTextEditor.H2 />
                  <RichTextEditor.H3 />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Blockquote />
                  <RichTextEditor.Hr />
                  <RichTextEditor.BulletList />
                  <RichTextEditor.OrderedList />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Link />
                  <RichTextEditor.Unlink />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Undo />
                  <RichTextEditor.Redo />
                </RichTextEditor.ControlsGroup>
              </RichTextEditor.Toolbar>
              <RichTextEditor.Content />
            </RichTextEditor>
          </div>

          <MultiSelect
            label="Share cu utilizatori"
            placeholder="Selecteaza utilizatorii"
            data={shareOptions}
            value={sharedWith}
            onChange={setSharedWith}
            searchable
            clearable
          />
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Title order={4} mb="md">Fisiere</Title>

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
                Trage fisierele aici sau click pentru a selecta
              </Text>
              <Text size="sm" c="dimmed" inline mt={7}>
                Poti incarca multiple fisiere
              </Text>
            </div>
          </Group>
        </Dropzone>

        {files.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            Nu exista fisiere incarcate
          </Text>
        ) : (
          <Stack gap="xs">
            {files.map((file) => (
              <Group key={file.file_id} justify="space-between">
                <Group gap="xs">
                  <IconFile size={16} />
                  <Text size="sm">{file.filename}</Text>
                  <PdfSignatureBadge endpoint={`/api/data/files/${file.file_id}/signature`} />
                </Group>
                <Group gap="xs">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    onClick={() => handleDownloadFile(file.file_id)}
                  >
                    <IconDownload size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => handleRemoveFile(file.file_id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </Paper>

      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={onCancel}>
          Anuleaza
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  );
}


