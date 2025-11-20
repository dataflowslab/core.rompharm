import { useEffect, useState } from 'react';
import { Container, Title, Stack, SimpleGrid, Paper, Text, Group } from '@mantine/core';
import { IconClipboardList } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface RequestShortcut {}

export function DashboardPage() {
  const { username } = useAuth();
  const { t } = useTranslation();
  const [loading] = useState(false);

  useEffect(() => {}, []);

  return (
    <Container size="xl" mt={30}>
      <Stack gap="xl">
        <Title order={2}>
          {t('Welcome')}, {username}!
        </Title>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          {/* Column 1: Requests (empty for now) */}
          <Paper shadow="sm" p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconClipboardList size={24} />
                <Title order={3}>{t('Requests')}</Title>
              </Group>
              <Text size="sm" c="dimmed">
                {t('No requests configured')}
              </Text>
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
