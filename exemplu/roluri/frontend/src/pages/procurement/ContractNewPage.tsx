import { useNavigate } from 'react-router-dom';
import { Container, Title, Button, Group } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { ContractForm } from './ContractForm';

export function ContractNewPage() {
  const navigate = useNavigate();

  const handleSubmit = async (data: any) => {
    try {
      const response = await api.post('/api/procurement/contracte/create', data);
      
      notifications.show({
        title: 'Succes',
        message: 'Contractul a fost creat cu succes',
        color: 'green',
      });

      navigate(`/procurement/contracte/${response.data._id}`);
    } catch (error: any) {
      console.error('Failed to create contract:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut crea contractul',
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
            onClick={() => navigate('/procurement/contracte')}
          >
            Înapoi
          </Button>
          <Title order={2}>Contract nou</Title>
        </Group>
      </Group>

      <ContractForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/procurement/contracte')}
      />
    </Container>
  );
}
