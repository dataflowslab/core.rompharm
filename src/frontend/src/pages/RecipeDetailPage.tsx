import { Container, Title, Text } from '@mantine/core';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function RecipeDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="xl">{t('Recipe Details')}</Title>
      <Text>Recipe ID: {id}</Text>
      <Text c="dimmed" mt="md">
        {t('Recipe detail page is under construction...')}
      </Text>
    </Container>
  );
}
