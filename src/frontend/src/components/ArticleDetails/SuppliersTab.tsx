import { Button, LoadingOverlay, Table, Text, Group, ActionIcon } from '@mantine/core';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';

interface SuppliersTabProps {
  articleSuppliers: any[];
  loadingSuppliers: boolean;
  onAddSupplier: () => void;
  onEditSupplier: (supplier: any) => void;
  onDeleteSupplier: (supplierId: string) => void;
}

export function SuppliersTab({
  articleSuppliers,
  loadingSuppliers,
  onAddSupplier,
  onEditSupplier,
  onDeleteSupplier,
}: SuppliersTabProps) {
  return (
    <>
      <Button 
        leftSection={<IconPlus size={16} />} 
        mb="md" 
        onClick={onAddSupplier}
      >
        Add Supplier
      </Button>

      {loadingSuppliers && <LoadingOverlay visible />}

      {articleSuppliers.length === 0 && !loadingSuppliers && (
        <Text c="dimmed">No suppliers configured for this article.</Text>
      )}

      {articleSuppliers.length > 0 && !loadingSuppliers && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Supplier</Table.Th>
              <Table.Th>Supplier Code</Table.Th>
              <Table.Th>U.M.</Table.Th>
              <Table.Th>Price</Table.Th>
              <Table.Th>Notes</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {articleSuppliers.map((supplier: any) => (
              <Table.Tr key={supplier._id}>
                <Table.Td>{supplier.supplier_detail?.name || '-'}</Table.Td>
                <Table.Td>{supplier.supplier_code || '-'}</Table.Td>
                <Table.Td>{supplier.um || '-'}</Table.Td>
                <Table.Td>
                  {supplier.price ? `${supplier.price.toFixed(2)} ${supplier.currency || 'EUR'}` : '-'}
                </Table.Td>
                <Table.Td>{supplier.notes || '-'}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => onEditSupplier(supplier)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => onDeleteSupplier(supplier._id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
