import { useEffect, useState } from 'react';
import { useNavigate } from '../../../src/frontend/node_modules/react-router-dom';
import {
  Container,
  Title,
  SimpleGrid,
  Card,
  Text,
  Badge,
  Group,
  Loader,
  Paper,
} from '@mantine/core';
import { IconTable, IconChevronRight } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../src/frontend/src/services/api';
import { notifications } from '@mantine/notifications';

interface Dataset {
  _id: string;
  name: string;
  table: string;
  fields: any[];
}

export function DatasetsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/datasets');
      setDatasets(response.data);
    } catch (error) {
      console.error('Failed to load datasets:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load datasets'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl">
      <Title order={2} mb="md">
        {t('DataSets')}
      </Title>

      {loading ? (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      ) : datasets.length === 0 ? (
        <Paper withBorder shadow="sm" p="xl">
          <Text c="dimmed" ta="center">
            {t('No datasets found')}
          </Text>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {datasets.map((dataset) => (
            <Card
              key={dataset._id}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/datasets/${dataset.table}`)}
            >
              <Group justify="space-between" mb="xs">
                <Group>
                  <IconTable size={24} />
                  <Text fw={500}>{dataset.name}</Text>
                </Group>
                <IconChevronRight size={20} />
              </Group>
              <Text size="sm" c="dimmed">
                {dataset.table}
              </Text>
              <Badge color="blue" variant="light" mt="sm">
                {Object.keys(dataset.fields[0] || {}).length} {t('fields')}
              </Badge>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Container>
  );
}
