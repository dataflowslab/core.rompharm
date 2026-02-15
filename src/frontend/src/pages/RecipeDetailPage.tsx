import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Group,
  Button,
  Loader,
  Text,
  Tabs,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBook,
  IconHistory,
} from '@tabler/icons-react';

// Components
import { EditIngredientModal } from '../components/Recipes/EditIngredientModal';
import { AddAlternativeModal } from '../components/Recipes/AddAlternativeModal';
import { RecipeHeader } from '../components/Recipes/RecipeDetail/RecipeHeader';
import { RecipeJournalTab } from '../components/Recipes/RecipeDetail/RecipeJournalTab';
import { RecipeIngredientsTab } from '../components/Recipes/RecipeDetail/RecipeIngredientsTab';
import { AddIngredientModal } from '../components/Recipes/RecipeDetail/AddIngredientModal';
import { DuplicateRecipeModal } from '../components/Recipes/DuplicateRecipeModal';

// Hooks
import { useRecipeDetail } from '../hooks/useRecipeDetail';

export function RecipeDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    recipe,
    loading,
    logs,
    revisions,
    logsLoading,
    expandedGroups,
    toggleGroup,
    loadRecipe,
    // Modals
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
  } = useRecipeDetail(id);

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (!recipe) {
    return (
      <Container size="xl" py="xl">
        <Text>{t('Recipe not found')}</Text>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Group mb="xl" justify="space-between">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/recipes')}
        >
          {t('Back')}
        </Button>
        <Group>
          <Button
            variant="light"
            onClick={handleIncrementVersion}
          >
            {t('Increment Version')}
          </Button>
          <Button
            variant="light"
            color="green"
            onClick={() => setDuplicateModalOpened(true)}
          >
            {t('Duplicate Recipe')}
          </Button>
        </Group>
      </Group>

      {/* Recipe Header */}
      <RecipeHeader
        recipe={recipe}
        onIncrementVersion={handleIncrementVersion}
        onDuplicate={() => setDuplicateModalOpened(true)}
      />

      {/* Main Tabs: Recipe & Journal */}
      <Tabs defaultValue="recipe" mb="md">
        <Tabs.List>
          <Tabs.Tab value="recipe" leftSection={<IconBook size={16} />}>
            {t('Recipe')}
          </Tabs.Tab>
          <Tabs.Tab value="journal" leftSection={<IconHistory size={16} />}>
            {t('Journal')}
          </Tabs.Tab>
        </Tabs.List>

        {/* Recipe Tab */}
        <Tabs.Panel value="recipe">
          <RecipeIngredientsTab
            recipe={recipe}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
            onAddIngredient={() => setAddIngredientModalOpened(true)}
            onEditItem={(item, index, altIndex) => {
              setEditingItem({ item, index, altIndex });
              setEditModalOpened(true);
            }}
            onDeleteItem={handleDeleteItem}
            onAddAlternative={(index) => {
              setAddAltItemIndex(index);
              setAddAltModalOpened(true);
            }}
            onDeleteAlternative={handleDeleteAlternative}
          />
        </Tabs.Panel>

        {/* Journal Tab */}
        <Tabs.Panel value="journal">
          <RecipeJournalTab
            recipe={recipe}
            logs={logs}
            revisions={revisions}
            displayLogsLoading={logsLoading}
            onNavigateRevision={(revId) => navigate(`/recipes/${revId}`)}
          />
        </Tabs.Panel>
      </Tabs>

      {/* Add Ingredient Modal */}
      <AddIngredientModal
        opened={addIngredientModalOpened}
        onClose={() => setAddIngredientModalOpened(false)}
        recipeId={id!}
        onSuccess={loadRecipe}
      />

      {/* Duplicate Recipe Modal */}
      <DuplicateRecipeModal
        opened={duplicateModalOpened}
        onClose={() => setDuplicateModalOpened(false)}
        recipeId={id!}
      />

      {/* Edit Ingredient Modal */}
      {editingItem && (
        <EditIngredientModal
          opened={editModalOpened}
          onClose={() => {
            setEditModalOpened(false);
            setEditingItem(null);
          }}
          recipeId={id!}
          item={editingItem.item}
          itemIndex={editingItem.index}
          altIndex={editingItem.altIndex}
          onSuccess={() => {
            loadRecipe();
            notifications.show({
              title: t('Success'),
              message: t('Ingredient updated successfully'),
              color: 'green',
            });
          }}
        />
      )}

      {/* Add Alternative Modal */}
      {addAltItemIndex !== null && (
        <AddAlternativeModal
          opened={addAltModalOpened}
          onClose={() => {
            setAddAltModalOpened(false);
            setAddAltItemIndex(null);
          }}
          recipeId={id!}
          itemIndex={addAltItemIndex}
          onSuccess={() => {
            loadRecipe();
            notifications.show({
              title: t('Success'),
              message: t('Alternative added successfully'),
              color: 'green',
            });
          }}
        />
      )}
    </Container>
  );
}
