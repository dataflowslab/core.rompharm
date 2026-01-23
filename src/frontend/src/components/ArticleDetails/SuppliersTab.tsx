-aimport { Button, LoadingOverlay, Table, Text, Group, ActionIcon, Anchor } from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconExternalLink } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

interface SuppliersTabProps {
  articleSuppliers: any[];
  loadingSuppliers: boolean;
  article: any;
  systemUMs: any[];
  onAddSupplier: () => void;
  onEditSupplier: (supplier: any) => void;
  onDeleteSupplier: (supplierId: string) => void;
}

export function SuppliersTab({
  articleSuppliers,
  loadingSuppliers,
  article,
  systemUMs,
  onAddSupplier,
  onEditSupplier,
  onDeleteSupplier,
}: SuppliersTabProps) {
  const navigate = useNavigate();
  
  // Get system UM details
  const systemUM = systemUMs.find(um => um._id === article?.system_um_id);
  const conversionModifier = article?.conversion_modifier || 1;
  
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
              <Table.Th>Supplier U.M.</Table.Th>
              <Table.Th>System U.M.</Table.Th>
              <Table.Th>Price</Table.Th>
              <Table.Th>Notes</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {articleSuppliers.map((supplier: any) => {
              // Calculate: Supplier UM * conversion_modifier = System UM
              const calculation = supplier.um && systemUM 
                ? `${supplier.um} × ${conversionModifier} = ${systemUM.abrev}`
                : '-';
              
              return (
                <Table.Tr key={supplier._id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Anchor
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/inventory/suppliers/${supplier.supplier_id}`);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {supplier.supplier_detail?.name || '-'}
                      </Anchor>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/inventory/suppliers/${supplier.supplier_id}`);
                        }}
                      >
                        <IconExternalLink size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                  <Table.Td>{supplier.supplier_code || '-'}</Table.Td>
                  <Table.Td>{supplier.um || '-'}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{calculation}</Text>
                  </Table.Td>
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
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
