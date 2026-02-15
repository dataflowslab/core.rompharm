import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  Select,
  Group,
  Stack,
  Button,
  Text,
  Image,
  Paper,
  ActionIcon,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { IconUpload, IconX, IconPhoto, IconCalendar } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { api } from '../../services/api';

interface CampaignModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  campaign?: any;
  segments: any[];
}

export function CampaignModal({ opened, onClose, onSuccess, campaign, segments }: CampaignModalProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'email',
    title: '',
    message: '',
    segment_id: '',
    image: '',
    link: '',
    scheduled_at: null as Date | null
  });

  const editor = useEditor({
    extensions: [StarterKit, Link],
    content: formData.message,
    onUpdate: ({ editor }) => {
      setFormData({ ...formData, message: editor.getHTML() });
    },
  });

  useEffect(() => {
    if (campaign) {
      setFormData({
        type: campaign.type,
        title: campaign.title,
        message: campaign.message,
        segment_id: campaign.segment_id,
        image: campaign.image || '',
        link: campaign.link || '',
        scheduled_at: campaign.scheduled_at ? new Date(campaign.scheduled_at) : null
      });
      editor?.commands.setContent(campaign.message);
    } else {
      setFormData({
        type: 'email',
        title: '',
        message: '',
        segment_id: '',
        image: '',
        link: '',
        scheduled_at: null
      });
      editor?.commands.setContent('');
    }
  }, [campaign, opened, editor]);

  const handleImageUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    setUploading(true);
    try {
      const response = await api.post('/api/data/upload', formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Construct the file URL using the hash
      const fileUrl = `/api/data/files/${response.data.hash}`;
      setFormData({ ...formData, image: fileUrl });

      notifications.show({
        title: t('Success'),
        message: t('Image uploaded successfully'),
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to upload image'),
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (campaign) {
        await api.put(`/api/crm/campaigns/${campaign.id}`, formData);
        notifications.show({
          title: t('Success'),
          message: t('Campaign updated successfully'),
          color: 'green'
        });
      } else {
        await api.post('/api/crm/campaigns', formData);
        notifications.show({
          title: t('Success'),
          message: t('Campaign created successfully'),
          color: 'green'
        });
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to save campaign'),
        color: 'red'
      });
    }
  };

  const segmentOptions = segments.map(s => ({ value: s.id, label: s.name }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={campaign ? t('Edit Campaign') : t('Add Campaign')}
      size="xl"
    >
      <Stack>
        <Select
          label={t('Type')}
          data={[{ value: 'email', label: 'Email' }]}
          value={formData.type}
          onChange={(value) => setFormData({ ...formData, type: value || 'email' })}
          required
        />

        <DateTimePicker
          label={t('Scheduled At')}
          placeholder={t('Select date and time')}
          value={formData.scheduled_at}
          onChange={(value) => setFormData({ ...formData, scheduled_at: value })}
          leftSection={<IconCalendar size={16} />}
          clearable
          description={t('Campaign will be sent automatically at this date/time if active')}
          minDate={new Date()}
        />
        
        <TextInput
          label={t('Title')}
          placeholder={t('Enter campaign title')}
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />

        <div>
          <Text size="sm" fw={500} mb="xs">
            {t('Message')} <Text component="span" c="red">*</Text>
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

        <Select
          label={t('Segment')}
          placeholder={t('Select segment')}
          data={segmentOptions}
          value={formData.segment_id}
          onChange={(value) => setFormData({ ...formData, segment_id: value || '' })}
          required
        />

        <div>
          <Text size="sm" fw={500} mb="xs">
            {t('Image')}
          </Text>
          {formData.image ? (
            <Paper withBorder p="md" radius="md">
              <Group justify="space-between">
                <Image
                  src={formData.image}
                  alt="Campaign image"
                  h={100}
                  w="auto"
                  fit="contain"
                />
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={() => setFormData({ ...formData, image: '' })}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Group>
            </Paper>
          ) : (
            <Dropzone
              onDrop={handleImageUpload}
              onReject={() => {
                notifications.show({
                  title: t('Error'),
                  message: t('Invalid file type. Please upload an image.'),
                  color: 'red',
                });
              }}
              maxSize={5 * 1024 ** 2}
              accept={IMAGE_MIME_TYPE}
              loading={uploading}
            >
              <Group justify="center" gap="xl" mih={100} style={{ pointerEvents: 'none' }}>
                <Dropzone.Accept>
                  <IconUpload size={52} stroke={1.5} />
                </Dropzone.Accept>
                <Dropzone.Reject>
                  <IconX size={52} stroke={1.5} />
                </Dropzone.Reject>
                <Dropzone.Idle>
                  <IconPhoto size={52} stroke={1.5} />
                </Dropzone.Idle>

                <div>
                  <Text size="xl" inline>
                    {t('Drag image here or click to select')}
                  </Text>
                  <Text size="sm" c="dimmed" inline mt={7}>
                    {t('Image should not exceed 5MB')}
                  </Text>
                </div>
              </Group>
            </Dropzone>
          )}
        </div>

        <TextInput
          label={t('Link')}
          placeholder={t('Enter link URL')}
          value={formData.link}
          onChange={(e) => setFormData({ ...formData, link: e.target.value })}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.title || !formData.message || !formData.segment_id}
          >
            {campaign ? t('Update') : t('Create')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
