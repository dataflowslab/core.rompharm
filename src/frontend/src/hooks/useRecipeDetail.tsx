import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { Text } from '@mantine/core'; // Import Text for the modal content
import api from '../services/api';
import { Recipe, RecipeItem } from '../types/recipes';

export function useRecipeDetail(id: string | undefined) {
    const { t } = useTranslation();

    // Data state
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [loading, setLoading] = useState(true);

    // Journal state
    const [logs, setLogs] = useState<any[]>([]);
    const [revisions, setRevisions] = useState<any[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    // Modal states
    const [addIngredientModalOpened, setAddIngredientModalOpened] = useState(false);
    const [duplicateModalOpened, setDuplicateModalOpened] = useState(false);

    // Edit ingredient modal state
    const [editModalOpened, setEditModalOpened] = useState(false);
    const [editingItem, setEditingItem] = useState<{ item: RecipeItem; index: number; altIndex?: number } | null>(null);

    // Add alternative modal state
    const [addAltModalOpened, setAddAltModalOpened] = useState(false);
    const [addAltItemIndex, setAddAltItemIndex] = useState<number | null>(null);

    // UI state
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

    const loadRecipe = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const response = await api.get(`/api/recipes/${id}`);
            setRecipe(response.data);
        } catch (error: any) {
            console.error('Failed to load recipe:', error);
            notifications.show({
                title: t('Error'),
                message: error.response?.data?.detail || t('Failed to load recipe'),
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    const loadJournalData = useCallback(async () => {
        if (!id) return;
        setLogsLoading(true);
        try {
            const [logsRes, revisionsRes] = await Promise.all([
                api.get(`/api/recipes/${id}/logs`),
                api.get(`/api/recipes/${id}/revisions`)
            ]);

            setLogs(logsRes.data);
            setRevisions(revisionsRes.data);
        } catch (error) {
            console.error('Failed to load journal data:', error);
        } finally {
            setLogsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (id) {
            loadRecipe();
            loadJournalData();
        }
    }, [id, loadRecipe, loadJournalData]);

    const toggleGroup = (index: number) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedGroups(newExpanded);
    };

    const handleIncrementVersion = () => {
        modals.openConfirmModal({
            title: t('Increment Version'),
            children: (
                <Text size= "sm" >
                { t('Are you sure you want to increment the version? This will update the revision number and date.') }
                </Text>
      ),
            labels: { confirm: t('Confirm'), cancel: t('Cancel') },
        onConfirm: async () => {
            try {
                const response = await api.post(`/api/recipes/${id}/increment-version`);

                notifications.show({
                    title: t('Success'),
                    message: `${t('Version incremented to')} ${response.data.new_rev}`,
                    color: 'green',
                });

                loadRecipe();
            } catch (error: any) {
                console.error('Failed to increment version:', error);
                notifications.show({
                    title: t('Error'),
                    message: error.response?.data?.detail || t('Failed to increment version'),
                    color: 'red',
                });
            }
        },
    });
};

const handleDeleteItem = async (index: number) => {
    if (!confirm(t('Are you sure you want to delete this ingredient?'))) {
        return;
    }

    try {
        await api.delete(`/api/recipes/${id}/items/${index}`);

        notifications.show({
            title: t('Success'),
            message: t('Ingredient deleted successfully'),
            color: 'green',
        });

        loadRecipe();
    } catch (error: any) {
        console.error('Failed to delete item:', error);
        notifications.show({
            title: t('Error'),
            message: error.response?.data?.detail || t('Failed to delete ingredient'),
            color: 'red',
        });
    }
};

const handleDeleteAlternative = async (groupIndex: number, altIndex: number) => {
    if (!confirm(t('Are you sure you want to delete this alternative?'))) {
        return;
    }

    try {
        await api.delete(`/api/recipes/${id}/items/${groupIndex}/alternatives/${altIndex}`);

        notifications.show({
            title: t('Success'),
            message: t('Alternative deleted successfully'),
            color: 'green',
        });

        loadRecipe();
    } catch (error: any) {
        console.error('Failed to delete alternative:', error);
        notifications.show({
            title: t('Error'),
            message: error.response?.data?.detail || t('Failed to delete alternative'),
            color: 'red',
        });
    }
};

return {
    recipe,
    loading,
    logs,
    revisions,
    logsLoading,
    expandedGroups,
    toggleGroup,
    loadRecipe,
    // Modals state & handlers
    addIngredientModalOpened,
    setAddIngredientModalOpened,
    duplicateModalOpened,
    setDuplicateModalOpened,
    editModalOpened,
    setEditModalOpened,
    editingItem,
    setEditingItem,
    addAltModalOpened,
    setAddAltModalOpened,
    addAltItemIndex,
    setAddAltItemIndex,
    // Actions
    handleIncrementVersion,
    handleDeleteItem,
    handleDeleteAlternative
};
}
