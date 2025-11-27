import { useEffect, useState } from 'react';
import { Container, Title, Stack, SimpleGrid, Paper, Text, Button, Group, Loader } from '@mantine/core';
import { IconForms, IconExternalLink } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface FormShortcut {
  slug: string;
  title: string;
  description: string;
}

export function DashboardPage() {
  const { username } = useAuth();
  const { t } = useTranslation();
  const [shortcuts, setShortcuts] = useState<FormShortcut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShortcuts();
  }, []);

  const loadShortcuts = async () => {
    try {
      const response = await api.get('/api/auth/dashboard/shortcuts');
      setShortcuts(response.data.forms || []);
    } catch (error) {
      console.error('Failed to load shortcuts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl" mt={30}>
      <Stack gap="xl">
        <Title order={2}>
          {t('Welcome')}, {username}!
        </Title>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          {/* Column 1: Forms Shortcuts */}
          <Paper shadow="sm" p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconForms size={24} />
                <Title order={3}>{t('Forms')}</Title>
              </Group>

              {loading ? (
                <Stack align="center" py="md">
                  <Loader size="sm" />
                </Stack>
              ) : shortcuts.length > 0 ? (
                <Stack gap="xs">
                  {shortcuts.map((form) => (
                    <Button
                      key={form.slug}
                      component="a"
                      href={`/web/forms/${form.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="light"
                      fullWidth
                      leftSection={<IconExternalLink size={16} />}
                      styles={{
                        inner: { justifyContent: 'flex-start' },
                        label: { overflow: 'hidden', textOverflow: 'ellipsis' }
                      }}
                    >
                      {form.title}
                    </Button>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  {t('No form shortcuts configured')}
                </Text>
              )}
            </Stack>
          </Paper>

          {/* Column 2: Reserved for future use */}
          <Paper shadow="sm" p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={3}>{t('Quick Actions')}</Title>
              <Text size="sm" c="dimmed">
                {t('Coming soon...')}
              </Text>
            </Stack>
          </Paper>

          {/* Column 3: Reserved for future use */}
          <Paper shadow="sm" p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={3}>{t('Recent Activity')}</Title>
              <Text size="sm" c="dimmed">
                {t('Coming soon...')}
              </Text>
            </Stack>
          </Paper>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
