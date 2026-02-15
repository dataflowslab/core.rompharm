import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Title, Button, Group } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';
import { SimpleDocumentForm, SimpleDocumentData } from './components/SimpleDocumentForm';

export function PaapNewPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: SimpleDocumentData) => {
    try {
      setLoading(true);
      const response = await api.post('/api/procurement/paap', data);

      notifications.show({
        title: 'Succes',
        message: 'Documentul PAAP a fost creat cu succes',
        color: 'green',
      });

      navigate(`/procurement/paap/${response.data.id}`);
    } catch (error: any) {
      console.error('Failed to create PAAP:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut crea documentul PAAP',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/procurement/paap')}
          >
            Inapoi
          </Button>
          <Title order={2}>PAAP nou</Title>
        </Group>
      </Group>

      <SimpleDocumentForm
        apiBase="/api/procurement/paap"
        onSubmit={handleSubmit}
        onCancel={() => navigate('/procurement/paap')}
        loading={loading}
      />
    </Container>
  );
}
