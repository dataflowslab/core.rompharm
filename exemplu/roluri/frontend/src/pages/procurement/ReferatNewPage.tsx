import { useNavigate } from 'react-router-dom';
import { Container, Title, Button, Group } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { ReferatForm } from './ReferatForm';

export function ReferatNewPage() {
  const navigate = useNavigate();

  const handleSubmit = async (data: any) => {
    try {
      const response = await api.post('/api/procurement/referate', data);
      
      notifications.show({
        title: 'Succes',
        message: 'Referatul a fost creat cu succes',
        color: 'green',
      });

      navigate(`/procurement/referate/${response.data.id}`);
    } catch (error: any) {
      console.error('Failed to create referat:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut crea referatul',
        color: 'red',
      });
    }
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/procurement/referate')}
          >
            Înapoi
          </Button>
          <Title order={2}>Referat nou</Title>
        </Group>
      </Group>

      <ReferatForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/procurement/referate')}
      />
    </Container>
  );
}
