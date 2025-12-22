import { useState, useEffect } from 'react';
import { Table, Select, NumberInput, Text, Badge, Group, Paper, Title, Loader } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';

interface Batch {
  batch_code: string;
  supplier_batch_code: string;
  quantity: number;
  location_id: string;
}

interface ComponentBatchSelection {
  batch_code: string;
  quantity: number;
}

interface Component {
  part: number;
  name: string;
  IPN: string;
  quantity: number;
  required_quantity: number; // quantity * product_quantity
  mandatory: boolean;
  type: number;
  alternatives?: Component[];
  selected_alternative?: number; // Index of selected alternative
  batches?: Batch[];
  batch_selections?: ComponentBatchSelection[];
}

interface ComponentsTableProps {
  recipeData: any;
  productQuantity: number;
  onComponentsChange: (components: Component[]) => void;
}

export function ComponentsTable({ recipeData, productQuantity, onComponentsChange }: ComponentsTableProps) {
  const { t } = useTranslation();
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (recipeData && recipeData.items) {
      loadComponents();
    }
  }, [recipeData, productQuantity]);

  const loadComponents = async () => {
    setLoading(true);
    try {
      const processedComponents: Component[] = [];

      for (const item of recipeData.items) {
        if (item.type === 2 && item.alternatives && item.alternatives.length > 0) {
          // Alternative group
          const alternativesWithBatches = await Promise.all(
            item.alternatives.map(async (alt: any) => {
              const batches = await loadBatches(alt.part);
              return {
                part: alt.part,
                name: alt.name,
                IPN: alt.IPN,
                quantity: alt.quantity,
                required_quantity: alt.quantity * productQuantity,
                mandatory: item.mandatory,
                type: 1,
                batches,
                batch_selections: []
              };
            })
          );

          processedComponents.push({
            part: 0,
            name: t('Alternative Group'),
            IPN: '',
            quantity: 0,
            required_quantity: 0,
            mandatory: item.mandatory,
            type: 2,
            alternatives: alternativesWithBatches,
            selected_alternative: 0, // Default to first alternative
            batches: [],
            batch_selections: []
          });
        } else if (item.type === 1 && item.part) {
          // Regular component
          const batches = await loadBatches(item.part);
          processedComponents.push({
            part: item.part,
            name: item.name,
            IPN: item.IPN,
            quantity: item.quantity,
            required_quantity: item.quantity * productQuantity,
            mandatory: item.mandatory,
            type: 1,
            batches,
            batch_selections: []
          });
        }
      }

      setComponents(processedComponents);
      onComponentsChange(processedComponents);
    } catch (error) {
      console.error('Failed to load components:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBatches = async (partId: number): Promise<Batch[]> => {
    try {
      const response = await api.get(requestsApi.getPartStockInfo(partId));
      return response.data.batches || [];
    } catch (error) {
      console.error(`Failed to load batches for part ${partId}:`, error);
      return [];
    }
  };

  const handleAlternativeChange = (componentIndex: number, alternativeIndex: number) => {
    const updated = [...components];
    updated[componentIndex].selected_alternative = alternativeIndex;
    setComponents(updated);
    onComponentsChange(updated);
  };

  const handleBatchAdd = (componentIndex: number, alternativeIndex: number | null, batchCode: string) => {
    const updated = [...components];
    const component = alternativeIndex !== null 
      ? updated[componentIndex].alternatives![alternativeIndex]
      : updated[componentIndex];

    if (!component.batch_selections) {
      component.batch_selections = [];
    }

    // Check if batch already added
    const existing = component.batch_selections.find(b => b.batch_code === batchCode);
    if (!existing) {
      component.batch_selections.push({
        batch_code: batchCode,
        quantity: 0
      });
    }

    setComponents(updated);
    onComponentsChange(updated);
  };

  const handleBatchQuantityChange = (
    componentIndex: number,
    alternativeIndex: number | null,
    batchCode: string,
    quantity: number
  ) => {
    const updated = [...components];
    const component = alternativeIndex !== null 
      ? updated[componentIndex].alternatives![alternativeIndex]
      : updated[componentIndex];

    const batchSelection = component.batch_selections?.find(b => b.batch_code === batchCode);
    if (batchSelection) {
      batchSelection.quantity = quantity;
    }

    setComponents(updated);
    onComponentsChange(updated);
  };

  const getTotalAllocated = (component: Component): number => {
    return component.batch_selections?.reduce((sum, b) => sum + b.quantity, 0) || 0;
  };

  const getAvailableBatches = (component: Component): Batch[] => {
    const selectedBatches = component.batch_selections?.map(b => b.batch_code) || [];
    return component.batches?.filter(b => !selectedBatches.includes(b.batch_code)) || [];
  };

  if (loading) {
    return (
      <Paper p="md" withBorder>
        <Group justify="center">
          <Loader size="sm" />
          <Text size="sm">{t('Loading components...')}</Text>
        </Group>
      </Paper>
    );
  }

  if (components.length === 0) {
    return null;
  }

  return (
    <Paper p="md" withBorder>
      <Title order={5} mb="md">{t('Components & Batch Selection')}</Title>
      
      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Component')}</Table.Th>
            <Table.Th>{t('Required Qty')}</Table.Th>
            <Table.Th>{t('Allocated')}</Table.Th>
            <Table.Th>{t('Batch Selection')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {components.map((component, compIndex) => {
            if (component.type === 2 && component.alternatives) {
              // Alternative group
              const selectedAlt = component.alternatives[component.selected_alternative || 0];
              const totalAllocated = getTotalAllocated(selectedAlt);
              const remaining = selectedAlt.required_quantity - totalAllocated;

              return (
                <Table.Tr key={`comp-${compIndex}`}>
                  <Table.Td>
                    <Select
                      data={component.alternatives.map((alt, idx) => ({
                        value: String(idx),
                        label: `${alt.name} (${alt.IPN})`
                      }))}
                      value={String(component.selected_alternative || 0)}
                      onChange={(value) => handleAlternativeChange(compIndex, parseInt(value || '0'))}
                      size="xs"
                    />
                  </Table.Td>
                  <Table.Td>
                    <Badge color={remaining > 0 ? 'red' : 'green'}>
                      {selectedAlt.required_quantity}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={remaining > 0 ? 'red' : 'green'}>
                      {totalAllocated} / {selectedAlt.required_quantity}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {selectedAlt.batch_selections?.map((batchSel, bIdx) => (
                        <Group key={`batch-${bIdx}`} gap="xs">
                          <Text size="xs">{batchSel.batch_code}:</Text>
                          <NumberInput
                            size="xs"
                            value={batchSel.quantity}
                            onChange={(val) => handleBatchQuantityChange(
                              compIndex,
                              component.selected_alternative || 0,
                              batchSel.batch_code,
                              Number(val) || 0
                            )}
                            min={0}
                            max={selectedAlt.batches?.find(b => b.batch_code === batchSel.batch_code)?.quantity || 0}
                            style={{ width: '80px' }}
                          />
                        </Group>
                      ))}
                      {getAvailableBatches(selectedAlt).length > 0 && (
                        <Select
                          placeholder={t('Add batch')}
                          data={getAvailableBatches(selectedAlt).map(b => ({
                            value: b.batch_code,
                            label: `${b.batch_code} (${b.quantity} available)`
                          }))}
                          onChange={(value) => value && handleBatchAdd(compIndex, component.selected_alternative || 0, value)}
                          size="xs"
                          clearable
                          style={{ width: '200px' }}
                        />
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            } else {
              // Regular component
              const totalAllocated = getTotalAllocated(component);
              const remaining = component.required_quantity - totalAllocated;

              return (
                <Table.Tr key={`comp-${compIndex}`}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{component.name}</Text>
                    <Text size="xs" c="dimmed">{component.IPN}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={remaining > 0 ? 'red' : 'green'}>
                      {component.required_quantity}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={remaining > 0 ? 'red' : 'green'}>
                      {totalAllocated} / {component.required_quantity}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {component.batch_selections?.map((batchSel, bIdx) => (
                        <Group key={`batch-${bIdx}`} gap="xs">
                          <Text size="xs">{batchSel.batch_code}:</Text>
                          <NumberInput
                            size="xs"
                            value={batchSel.quantity}
                            onChange={(val) => handleBatchQuantityChange(
                              compIndex,
                              null,
                              batchSel.batch_code,
                              Number(val) || 0
                            )}
                            min={0}
                            max={component.batches?.find(b => b.batch_code === batchSel.batch_code)?.quantity || 0}
                            style={{ width: '80px' }}
                          />
                        </Group>
                      ))}
                      {getAvailableBatches(component).length > 0 && (
                        <Select
                          placeholder={t('Add batch')}
                          data={getAvailableBatches(component).map(b => ({
                            value: b.batch_code,
                            label: `${b.batch_code} (${b.quantity} available)`
                          }))}
                          onChange={(value) => value && handleBatchAdd(compIndex, null, value)}
                          size="xs"
                          clearable
                          style={{ width: '200px' }}
                        />
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            }
          })}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
