import { useNavigate } from 'react-router-dom';
import { Container, Title, Button, Group } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { DocTehnicForm } from './DocTehnicForm';

export function DocTehnicNewPage() {
  const navigate = useNavigate();

  const handleSubmit = async (data: any) => {
    try {
      const response = await api.post('/api/procurement/achizitii', data);
      
      notifications.show({
        title: 'Succes',
        message: 'Achizitia a fost creat cu succes',
        color: 'green',
      });

      navigate(`/procurement/achizitii/${response.data.id}`);
    } catch (error: any) {
      console.error('Failed to create document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut crea Achizitia',
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
            onClick={() => navigate('/procurement/achizitii')}
          >
            Înapoi
          </Button>
          <Title order={2}>Achizitie noua</Title>
        </Group>
      </Group>

      <DocTehnicForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/procurement/achizitii')}
      />
    </Container>
  );
}



