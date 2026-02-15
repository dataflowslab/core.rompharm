import { useState } from 'react';
import { Modal, Stack, Text, Select, Divider, Group, Button } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Part } from '../../types/recipes';

interface DuplicateRecipeModalProps {
    opened: boolean;
    onClose: () => void;
    recipeId: string;
}

export function DuplicateRecipeModal({ opened, onClose, recipeId }: DuplicateRecipeModalProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [duplicateParts, setDuplicateParts] = useState<Part[]>([]);
    const [duplicateSearch, setDuplicateSearch] = useState('');
    const [duplicateProductId, setDuplicateProductId] = useState<string | null>(null);
    const [duplicating, setDuplicating] = useState(false);

    const searchDuplicateParts = async (query: string) => {
        if (!query || query.length < 2) {
            setDuplicateParts([]);
            return;
        }

        try {
            const response = await api.get('/api/recipes/parts', {
                params: { search: query },
            });
            setDuplicateParts(response.data);
        } catch (error) {
            console.error('Failed to search parts:', error);
        }
    };

    const handleDuplicate = async () => {
        if (!duplicateProductId) {
            notifications.show({
                title: t('Error'),
                message: t('Please select a product'),
                color: 'red',
            });
            return;
        }

        setDuplicating(true);
        try {
            const response = await api.post(`/api/recipes/${recipeId}/duplicate`, {
                product_id: parseInt(duplicateProductId)
            });

            notifications.show({
                title: t('Success'),
                message: t('Recipe duplicated successfully'),
                color: 'green',
            });

            onClose();
            setDuplicateProductId(null);
            setDuplicateSearch('');
            setDuplicateParts([]);

            // Navigate to new recipe
            navigate(`/recipes/${response.data._id}`);
        } catch (error: any) {
            console.error('Failed to duplicate recipe:', error);
            notifications.show({
                title: t('Error'),
                message: error.response?.data?.detail || t('Failed to duplicate recipe'),
                color: 'red',
            });
        } finally {
            setDuplicating(false);
        }
    };

    const handleClose = () => {
        setDuplicateProductId(null);
        setDuplicateSearch('');
        setDuplicateParts([]);
        onClose();
    };

    return (
        <Modal
            opened={opened}
            onClose={handleClose}
            title={t('Duplicate Recipe')}
            size="md"
        >
            <Stack gap="md">
                <Text size="sm" c="dimmed">
                    {t('Select a product for the new recipe. All ingredients will be copied.')}
                </Text>

                <Select
                    label={t('Product')}
                    placeholder={t('Search for product...')}
                    data={duplicateParts.map((part) => ({
                        value: String(part.id),
                        label: `${part.name} (${part.IPN})`,
                    }))}
                    value={duplicateProductId}
                    onChange={setDuplicateProductId}
                    onSearchChange={(query) => {
                        setDuplicateSearch(query);
                        searchDuplicateParts(query);
                    }}
                    searchValue={duplicateSearch}
                    searchable
                    clearable
                    required
                    nothingFoundMessage={
                        duplicateSearch.length < 2
                            ? t('Type at least 2 characters')
                            : t('No products found')
                    }
                />

                <Divider />

                <Group justify="flex-end">
                    <Button
                        variant="default"
                        onClick={handleClose}
                    >
                        {t('Cancel')}
                    </Button>
                    <Button
                        color="green"
                        onClick={handleDuplicate}
                        loading={duplicating}
                    >
                        {t('Duplicate')}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
