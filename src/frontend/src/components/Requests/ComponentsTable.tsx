import { useState, useEffect } from 'react';
import { Table, Select, NumberInput, Text, Paper, Title, Loader, ActionIcon, Group } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { requestsApi } from '../../services/requests';

interface Batch {
  batch_code: string;
  supplier_batch_code: string;
  quantity: number;
  location_id: string;
  state_id?: string;
  state_name?: string;
  expiry_date?: string;
  batch_date?: string;
}

interface BatchAllocation {
  batch_unique_key: string;
  batch_code: string;
  quantity: number;
}

interface Component {
  part_id: string;
  name: string;
  IPN: string;
  quantity: number;
  required_quantity: number;
  mandatory: boolean;
  type: number;
  alternatives?: Component[];
  selected_alternative?: number;
  batches?: Batch[];
  batch_allocations?: BatchAllocation[];
  requested_quantity?: number;
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
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

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
          // Alternative group - preload batches for all alternatives
          const alternativesWithBatches = await Promise.all(
            item.alternatives.map(async (alt: any) => {
              const batches = await loadBatches(alt.part_id);
              return {
                part_id: alt.part_id,
                name: alt.name,
                IPN: alt.IPN,
                quantity: alt.quantity,
                required_quantity: alt.quantity * productQuantity,
                mandatory: item.mandatory,
                type: 1,
                batches,
                batch_allocations: [],
                requested_quantity: batches.length > 0 ? 0 : alt.quantity * productQuantity
              };
            })
          );

          processedComponents.push({
            part_id: '',
            name: t('Alternative Group'),
            IPN: '',
            quantity: 0,
            required_quantity: 0,
            mandatory: item.mandatory,
            type: 2,
            alternatives: alternativesWithBatches,
            selected_alternative: 0,
            batches: [],
            batch_allocations: [],
            requested_quantity: 0
          });
        } else if (item.type === 1 && item.part_id) {
          // Regular component
          const batches = await loadBatches(item.part_id);
          processedComponents.push({
            part_id: item.part_id,
            name: item.name,
            IPN: item.IPN,
            quantity: item.quantity,
            required_quantity: item.quantity * productQuantity,
            mandatory: item.mandatory,
            type: 1,
            batches,
            batch_allocations: [],
            requested_quantity: batches.length > 0 ? 0 : item.quantity * productQuantity
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

  const loadBatches = async (partId: string): Promise<Batch[]> => {
    try {
      const response = await api.get(requestsApi.getPartStockInfo(partId));
      return response.data.batches || [];
    } catch (error) {
      console.error(`Failed to load batches for part ${partId}:`, error);
      return [];
    }
  };

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const handleAlternativeChange = (componentIndex: number, alternativeIndex: number) => {
    const updated = [...components];
    const component = updated[componentIndex];
    
    // Flush batch allocations when changing alternative
    if (component.alternatives) {
      component.alternatives.forEach(alt => {
        alt.batch_allocations = [];
        alt.requested_quantity = alt.batches && alt.batches.length > 0 ? 0 : alt.required_quantity;
      });
    }
    
    component.selected_alternative = alternativeIndex;
    setComponents(updated);
    onComponentsChange(updated);
  };

  const handleBatchQuantityChange = (
    componentIndex: number,
    batchUniqueKey: string,
    quantity: number,
    maxQuantity: number,
    alternativeIndex?: number
  ) => {
    const updated = [...components];
    const component = alternativeIndex !== undefined 
      ? updated[componentIndex].alternatives![alternativeIndex]
      : updated[componentIndex];

    if (!component.batch_allocations) {
      component.batch_allocations = [];
    }

    // Limit quantity to available
    const limitedQuantity = Math.min(quantity, maxQuantity);

    const existingAllocation = component.batch_allocations.find(
      b => b.batch_unique_key === batchUniqueKey
    );

    if (existingAllocation) {
      existingAllocation.quantity = limitedQuantity;
    } else {
      const batch = component.batches?.find(b => getBatchUniqueKey(b) === batchUniqueKey);
      if (batch) {
        component.batch_allocations.push({
          batch_unique_key: batchUniqueKey,
          batch_code: batch.batch_code,
          quantity: limitedQuantity
        });
      }
    }

    setComponents(updated);
    onComponentsChange(updated);
  };

  const handleRequestedQuantityChange = (
    componentIndex: number,
    quantity: number,
    alternativeIndex?: number
  ) => {
    const updated = [...components];
    const component = alternativeIndex !== undefined 
      ? updated[componentIndex].alternatives![alternativeIndex]
      : updated[componentIndex];

    component.requested_quantity = quantity;
    setComponents(updated);
    onComponentsChange(updated);
  };

  const getTotalAllocated = (component: Component): number => {
    return component.batch_allocations?.reduce((sum, b) => sum + b.quantity, 0) || 0;
  };

  const getBatchUniqueKey = (batch: Batch): string => {
    return `${batch.batch_code}_${batch.location_id}_${batch.state_id || 'no_state'}`;
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const renderBatchRows = (component: Component, componentIndex: number, alternativeIndex?: number) => {
    if (!component.batches || component.batches.length === 0) {
      return null;
    }

    return component.batches.map((batch, batchIndex) => {
      const batchKey = getBatchUniqueKey(batch);
      const allocation = component.batch_allocations?.find(b => b.batch_unique_key === batchKey);
      const allocatedQty = allocation?.quantity || 0;

      return (
        <Table.Tr 
          key={`batch-${componentIndex}-${alternativeIndex}-${batchIndex}`}
          style={{ backgroundColor: '#fafafa' }}
        >
          <Table.Td style={{ paddingLeft: '48px' }}>
            <Text size="sm">↳ {batch.batch_code}</Text>
          </Table.Td>
          <Table.Td>
            <Text size="sm">{formatDate(batch.expiry_date)}</Text>
          </Table.Td>
          <Table.Td>
            <Text size="sm">{batch.quantity}</Text>
          </Table.Td>
          <Table.Td>
            <NumberInput
              size="xs"
              value={allocatedQty}
              onChange={(val) => handleBatchQuantityChange(
                componentIndex,
                batchKey,
                Number(val) || 0,
                batch.quantity,
                alternativeIndex
              )}
              min={0}
              max={batch.quantity}
              style={{ width: '100px' }}
            />
          </Table.Td>
        </Table.Tr>
      );
    });
  };

  const renderComponentRow = (component: Component, componentIndex: number) => {
    const hasBatches = component.batches && component.batches.length > 0;
    const isExpanded = expandedRows.has(componentIndex);
    const totalAllocated = getTotalAllocated(component);
    const isFullyAllocated = hasBatches && totalAllocated === component.required_quantity;
    const requestedQty = component.requested_quantity || 0;

    const rows = [];

    // Main row
    rows.push(
      <Table.Tr 
        key={`comp-${componentIndex}`}
        style={{ cursor: hasBatches ? 'pointer' : 'default' }}
        onClick={() => hasBatches && toggleRow(componentIndex)}
      >
        <Table.Td>
          <Group gap="xs">
            {hasBatches && (
              <ActionIcon size="sm" variant="subtle" color="gray">
                {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              </ActionIcon>
            )}
            <div>
              <Text size="sm" fw={500}>{component.name}</Text>
              <Text size="xs" c="dimmed">{component.IPN}</Text>
            </div>
          </Group>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{component.required_quantity}</Text>
        </Table.Td>
        <Table.Td>
          {hasBatches ? (
            <Text size="sm" c={isFullyAllocated ? 'green' : 'dimmed'}>
              {totalAllocated}
            </Text>
          ) : (
            <Text size="sm" c="dimmed">-</Text>
          )}
        </Table.Td>
        <Table.Td onClick={(e) => e.stopPropagation()}>
          {hasBatches ? (
            <Text 
              size="sm" 
              fw={isFullyAllocated ? 700 : 400}
              c={isFullyAllocated ? 'green' : 'dimmed'}
            >
              {totalAllocated}
            </Text>
          ) : (
            <NumberInput
              size="xs"
              value={requestedQty}
              onChange={(val) => handleRequestedQuantityChange(componentIndex, Number(val) || 0)}
              min={0}
              style={{ width: '100px' }}
            />
          )}
        </Table.Td>
      </Table.Tr>
    );

    // Batch rows (if expanded)
    if (hasBatches && isExpanded) {
      rows.push(...renderBatchRows(component, componentIndex));
    }

    return rows;
  };

  const renderAlternativeRow = (component: Component, componentIndex: number) => {
    if (!component.alternatives) return null;

    const selectedAlt = component.alternatives[component.selected_alternative || 0];
    const hasBatches = selectedAlt.batches && selectedAlt.batches.length > 0;
    const isExpanded = expandedRows.has(componentIndex);
    const totalAllocated = getTotalAllocated(selectedAlt);
    const isFullyAllocated = hasBatches && totalAllocated === selectedAlt.required_quantity;
    const requestedQty = selectedAlt.requested_quantity || 0;

    const rows = [];

    // Main row with alternative selector
    rows.push(
      <Table.Tr 
        key={`alt-${componentIndex}`}
        style={{ cursor: hasBatches ? 'pointer' : 'default' }}
        onClick={() => hasBatches && toggleRow(componentIndex)}
      >
        <Table.Td>
          <Group gap="xs">
            {hasBatches && (
              <ActionIcon size="sm" variant="subtle" color="gray">
                {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              </ActionIcon>
            )}
            <Select
              data={component.alternatives.map((alt, idx) => ({
                value: String(idx),
                label: `${idx + 1}. ${alt.name} (${alt.IPN})`
              }))}
              value={String(component.selected_alternative || 0)}
              onChange={(value) => handleAlternativeChange(componentIndex, parseInt(value || '0'))}
              size="xs"
              style={{ width: '300px' }}
              onClick={(e) => e.stopPropagation()}
              comboboxProps={{ withinPortal: false }}
            />
          </Group>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{selectedAlt.required_quantity}</Text>
        </Table.Td>
        <Table.Td>
          {hasBatches ? (
            <Text size="sm" c={isFullyAllocated ? 'green' : 'dimmed'}>
              {totalAllocated}
            </Text>
          ) : (
            <Text size="sm" c="dimmed">-</Text>
          )}
        </Table.Td>
        <Table.Td onClick={(e) => e.stopPropagation()}>
          {hasBatches ? (
            <Text 
              size="sm" 
              fw={isFullyAllocated ? 700 : 400}
              c={isFullyAllocated ? 'green' : 'dimmed'}
            >
              {totalAllocated}
            </Text>
          ) : (
            <NumberInput
              size="xs"
              value={requestedQty}
              onChange={(val) => handleRequestedQuantityChange(
                componentIndex, 
                Number(val) || 0, 
                component.selected_alternative || 0
              )}
              min={0}
              style={{ width: '100px' }}
            />
          )}
        </Table.Td>
      </Table.Tr>
    );

    // Batch rows (if expanded)
    if (hasBatches && isExpanded) {
      rows.push(...renderBatchRows(selectedAlt, componentIndex, component.selected_alternative || 0));
    }

    return rows;
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
      
      <Table striped withTableBorder highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Material')}</Table.Th>
            <Table.Th>{t('Required Qty')}</Table.Th>
            <Table.Th>{t('Allocated')}</Table.Th>
            <Table.Th>{t('Requested Qty')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {components.map((component, compIndex) => {
            if (component.type === 2) {
              return renderAlternativeRow(component, compIndex);
            } else {
              return renderComponentRow(component, compIndex);
            }
          })}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
