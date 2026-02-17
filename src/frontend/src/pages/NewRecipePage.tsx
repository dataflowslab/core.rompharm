import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Title, Paper, Select, Button, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconArrowLeft } from '@tabler/icons-react';
import api from '../services/api';

interface Part {
  _id: string;
  id?: number;
  name: string;
  IPN: string;
}

export function NewRecipePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  // Manual entry disabled for now
  // const [manualEntry, setManualEntry] = useState(false);
  // const [manualName, setManualName] = useState('');
  // const [manualCode, setManualCode] = useState('');

  const searchParts = async (query: string) => {
    if (!query || query.length < 2) {
      setParts([]);
      return;
    }

    try {
      const response = await api.get('/api/recipes/parts', {
        params: { search: query }
      });
      setParts(response.data);
    } catch (error) {
      console.error('Failed to search parts:', error);
    }
  };

  const handleCreate = async () => {
    if (!selectedPart) {
      notifications.show({
        title: t('Error'),
        message: t('Please select a product'),
        color: 'red'
      });
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/api/recipes', {
        product_id: selectedPart
      });

      notifications.show({
        title: t('Success'),
        message: t('Recipe created successfully'),
        color: 'green'
      });

      // Redirect to recipe detail page
      navigate(`/recipes/${response.data._id}`);
    } catch (error: any) {
      console.error('Failed to create recipe:', error);
      notifications.show({
        title: t('Error'),
        message: error.response?.data?.detail || t('Failed to create recipe'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="sm" py="xl">
      <Group mb="xl">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/recipes')}
        >
          {t('Back')}
        </Button>
      </Group>

      <Title order={2} mb="xl">{t('New Recipe')}</Title>

      <Paper p="xl" withBorder>
        <Select
          label={t('Select Product')}
          placeholder={t('Search for product...')}
          data={parts.map(part => ({
            value: String(part._id),
            label: `${part.name} (${part.IPN})`
          }))}
          value={selectedPart}
          onChange={setSelectedPart}
          onSearchChange={(query) => {
            setSearchValue(query);
            searchParts(query);
          }}
          searchValue={searchValue}
          searchable
          clearable
          nothingFoundMessage={searchValue.length < 2 ? t('Type at least 2 characters') : t('No products found')}
          mb="md"
        />

        {/* Manual entry option - commented out for now
        <Divider label={t('Or enter manually')} labelPosition="center" my="md" />

        <TextInput
          label={t('Product Name')}
          placeholder={t('Enter product name')}
          value={manualName}
          onChange={(e) => {
            setManualName(e.target.value);
            setManualEntry(true);
            setSelectedPart(null);
          }}
          mb="md"
        />

        <TextInput
          label={t('Code (IPN)')}
          placeholder={t('Enter product code')}
          value={manualCode}
          onChange={(e) => {
            setManualCode(e.target.value);
            setManualEntry(true);
            setSelectedPart(null);
          }}
          mb="md"
        />
        */}

        <Group justify="flex-end" mt="xl">
          <Button
            variant="default"
            onClick={() => navigate('/recipes')}
          >
            {t('Cancel')}
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleCreate}
            loading={loading}
            disabled={!selectedPart}
          >
            {t('Create Recipe')}
          </Button>
        </Group>
      </Paper>
    </Container>
  );
}
