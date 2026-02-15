import { rankWith, isObjectArrayControl, ControlProps, update } from '@jsonforms/core';
import { withJsonFormsArrayControlProps } from '@jsonforms/react';
import { Button, Table, Group, Stack, ActionIcon, Box, TextInput, NumberInput, Select } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { MantineRendererProps } from './MantineRendererProps';

/**
 * Array Table Renderer for JsonForms
 * Renders an array of objects as a table with add/remove functionality
 * 
 * Usage in UI Schema:
 * {
 *   "type": "Control",
 *   "label": "Tabel 1",
 *   "scope": "#/properties/sectiuneaA/properties/tabel1",
 *   "options": {
 *     "detail": {
 *       "type": "VerticalLayout",
 *       "elements": [
 *         { "type": "Control", "scope": "#/items/properties/cell1" },
 *         { "type": "Control", "scope": "#/items/properties/cell2" }
 *       ]
 *     }
 *   }
 * }
 */

export const ArrayTableRenderer = (props: ControlProps & MantineRendererProps) => {
  const {
    data,
    path,
    schema,
    uischema,
    addItem,
    removeItems,
    handleChange,
    label,
    visible,
    enabled,
    errors,
  } = props;

  if (!visible) {
    return null;
  }

  const arrayData = data || [];
  const itemSchema = schema.items as any;

  // Get column headers from schema properties
  const getColumnHeaders = () => {
    if (!itemSchema || !itemSchema.properties) {
      return [];
    }
    return Object.keys(itemSchema.properties)
      .filter(key => key !== 'rowType') // Skip rowType from display
      .map((key) => ({
        key,
        label: itemSchema.properties[key].title || key,
        type: itemSchema.properties[key].type,
        enum: itemSchema.properties[key].enum,
      }));
  };

  const columns = getColumnHeaders();

  const handleAddRow = () => {
    const newRow: any = { rowType: 'data' };
    columns.forEach(col => {
      newRow[col.key] = col.type === 'number' ? 0 : '';
    });
    addItem(path, newRow)();
  };

  const handleRemoveRow = (index: number) => {
    removeItems(path, [index])();
  };

  const handleCellChange = (rowIndex: number, cellKey: string, value: any) => {
    const newPath = `${path}.${rowIndex}.${cellKey}`;
    handleChange(newPath, value);
  };

  const renderCell = (rowIndex: number, col: any, value: any) => {
    const cellPath = `${path}.${rowIndex}.${col.key}`;
    
    if (col.enum) {
      // Render select for enum
      return (
        <Select
          value={value || ''}
          onChange={(val) => handleCellChange(rowIndex, col.key, val)}
          data={col.enum.map((e: string) => ({ value: e, label: e }))}
          disabled={!enabled}
          size="xs"
          styles={{ input: { minHeight: '32px' } }}
        />
      );
    } else if (col.type === 'number') {
      // Render number input
      return (
        <NumberInput
          value={value || 0}
          onChange={(val) => handleCellChange(rowIndex, col.key, val)}
          disabled={!enabled}
          size="xs"
          hideControls
          styles={{ input: { minHeight: '32px' } }}
        />
      );
    } else {
      // Render text input
      return (
        <TextInput
          value={value || ''}
          onChange={(e) => handleCellChange(rowIndex, col.key, e.currentTarget.value)}
          disabled={!enabled}
          size="xs"
          styles={{ input: { minHeight: '32px' } }}
        />
      );
    }
  };

  return (
    <Stack gap="md">
      {label && (
        <Group justify="space-between">
          <Box fw={500}>{label}</Box>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleAddRow}
            disabled={!enabled}
            size="sm"
          >
            Adaugă rând
          </Button>
        </Group>
      )}

      {arrayData.length === 0 ? (
        <Box c="dimmed" ta="center" p="md">
          Nu există înregistrări. Apasă "Adaugă rând" pentru a adăuga.
        </Box>
      ) : (
        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: '50px' }}>#</Table.Th>
                {columns.map((col) => (
                  <Table.Th key={col.key}>{col.label}</Table.Th>
                ))}
                <Table.Th style={{ width: '80px' }}>Acțiuni</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {arrayData.map((item: any, index: number) => (
                <Table.Tr key={index}>
                  <Table.Td>{index + 1}</Table.Td>
                  {columns.map((col) => (
                    <Table.Td key={col.key} style={{ minWidth: '150px' }}>
                      {renderCell(index, col, item[col.key])}
                    </Table.Td>
                  ))}
                  <Table.Td>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => handleRemoveRow(index)}
                      disabled={!enabled}
                      title="Șterge rând"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      )}

      {errors && errors.length > 0 && (
        <Box c="red" fz="sm">
          {errors}
        </Box>
      )}
    </Stack>
  );
};

// Tester function - checks if this renderer should be used
export const arrayTableTester = rankWith(
  10, // Priority (higher = more specific, must be higher than default array renderer)
  isObjectArrayControl
);

// Export with JsonForms props
export default withJsonFormsArrayControlProps(ArrayTableRenderer);
