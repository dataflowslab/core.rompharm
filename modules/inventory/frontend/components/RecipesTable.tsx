import { Table, Badge, Button, Text, LoadingOverlay } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

interface RecipesTableProps {
  recipes: any[];
  loading?: boolean;
}

export function RecipesTable({ recipes, loading = false }: RecipesTableProps) {
  const navigate = useNavigate();

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (recipes.length === 0) {
    return <Text c="dimmed">No recipes found using this article.</Text>;
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Product Code</Table.Th>
          <Table.Th>Product Name</Table.Th>
          <Table.Th>Revision</Table.Th>
          <Table.Th>Rev Date</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {recipes.map((recipe) => (
          <Table.Tr key={recipe._id}>
            <Table.Td>{recipe.product_code || '-'}</Table.Td>
            <Table.Td>{recipe.product_name || '-'}</Table.Td>
            <Table.Td>
              <Badge color="blue">Rev {recipe.rev || 0}</Badge>
            </Table.Td>
            <Table.Td>
              {recipe.rev_date ? new Date(recipe.rev_date).toLocaleDateString() : '-'}
            </Table.Td>
            <Table.Td>
              <Button
                size="xs"
                variant="light"
                onClick={() => navigate(`/recipes/${recipe._id}`)}
              >
                View Recipe
              </Button>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
