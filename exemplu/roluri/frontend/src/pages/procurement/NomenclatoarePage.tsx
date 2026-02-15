import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';

interface Nomenclator {
  _id: string;
  name: string;
  table: string;
  fields: any[];
}

export function NomenclatoarePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [nomenclatoare, setNomenclatoare] = useState<Nomenclator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNomenclatoare();
  }, []);

  const loadNomenclatoare = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/datasets');
      setNomenclatoare(response.data);
    } catch (error) {
      console.error('Failed to load nomenclatoare:', error);
      notifications.show({
        title: t('Error'),
        message: t('Failed to load nomenclatoare'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl">
      <Title order={2} mb="md">
        {t('Nomenclatoare')}
      </Title>

      {loading ? (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      ) : nomenclatoare.length === 0 ? (
        <Paper withBorder shadow="sm" p="xl">
          <Text c="dimmed" ta="center">
            {t('No nomenclatoare found')}
          </Text>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {nomenclatoare.map((nom) => (
            <Card
              key={nom._id}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/procurement/nomenclatoare/${nom.table}`)}
            >
              <Group justify="space-between" mb="xs">
                <Group>
                  <IconTable size={24} />
                  <Text fw={500}>{nom.name}</Text>
                </Group>
                <IconChevronRight size={20} />
              </Group>
              <Text size="sm" c="dimmed">
                {nom.table}
              </Text>
              <Badge color="blue" variant="light" mt="sm">
                {Object.keys(nom.fields[0] || {}).length} {t('fields')}
              </Badge>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Container>
  );
}
