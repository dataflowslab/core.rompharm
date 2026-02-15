import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  SimpleGrid,
  Card,
  Text,
  Badge,
  Stack,
  Loader,
  Alert,
  Group,
  ActionIcon,
} from '@mantine/core';
import { IconAlertCircle, IconBook, IconChevronRight } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';

interface Registry {
  id: string;
  slug: string;
  title: string;
  description?: string;
  registry_start?: number;
  registry_current?: number;
  created_at: string;
}

export function RegistersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRegistries();
  }, []);

  const loadRegistries = async () => {
    try {
      const response = await api.get('/api/forms/registries/list');
      setRegistries(response.data || []);
    } catch (error: any) {
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to load registries'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Container size="xl" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading registries...')}</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack>
        <Title order={2}>{t('Registers')}</Title>

        {registries.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} title={t('No registries')}>
            {t('No forms with registries found. Enable registry on a form to see it here.')}
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="lg">
            {registries.map((registry) => (
              <Card
                key={registry.id}
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                onClick={() => navigate(`/registry/${registry.id}`)}
              >
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <IconBook size={32} color="#228be6" />
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      size="lg"
                    >
                      <IconChevronRight size={20} />
                    </ActionIcon>
                  </Group>

                  <Stack gap="xs">
                    <Text fw={700} size="lg" lineClamp={2}>
                      {registry.title}
                    </Text>

                    {registry.description && (
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {registry.description}
                      </Text>
                    )}
                  </Stack>

                  <Group gap="xs">
                    <Badge color="blue" variant="light">
                      {t('Start')}: #{registry.registry_start || 1}
                    </Badge>
                    {registry.registry_current && (
                      <Badge color="green" variant="light">
                        {t('Current')}: #{registry.registry_current}
                      </Badge>
                    )}
                  </Group>

                  <Text size="xs" c="dimmed">
                    {t('Created')}: {formatDate(registry.created_at)}
                  </Text>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
}
