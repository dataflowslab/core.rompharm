import { Group, Paper, Title, Text, Button } from '@mantine/core';
import { IconChefHat } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Recipe } from '../../../types/recipes';

interface RecipeHeaderProps {
    recipe: Recipe;
    onIncrementVersion: () => void;
    onDuplicate: () => void;
}

export function RecipeHeader({ recipe, onIncrementVersion, onDuplicate }: RecipeHeaderProps) {
    const { t } = useTranslation();

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    return (
        <Paper p="md" withBorder mb="md">
            <Group justify="space-between">
                <Group>
                    <IconChefHat size={32} />
                    <div>
                        <Title order={3}>{recipe.product_detail.name}</Title>
                        <Text size="sm" c="dimmed">
                            {t('Code')}: {recipe.product_detail.IPN}
                        </Text>
                    </div>
                </Group>
                <div style={{ textAlign: 'right' }}>
                    <Text size="sm">
                        {t('Revision')}: {recipe.rev}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {formatDate(recipe.rev_date)}
                    </Text>
                </div>
            </Group>
        </Paper>
    );
}
