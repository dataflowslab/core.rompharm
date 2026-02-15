import { withJsonFormsControlProps } from '@jsonforms/react';
import { Checkbox, CheckboxGroup, Stack } from '@mantine/core';
import { rankWith, isBooleanControl } from '@jsonforms/core';

interface MantineCheckboxControlProps {
  data: any;
  handleChange: (path: string, value: any) => void;
  path: string;
  label: string;
  required?: boolean;
  description?: string;
  errors?: string;
  schema: any;
}

const MantineCheckboxControl = ({
  data,
  handleChange,
  path,
  label,
  required,
  description,
  errors,
  schema,
}: MantineCheckboxControlProps) => {
  // Check if it's a checkbox group (array of values)
  if (schema.type === 'array' && schema.items?.enum) {
    const options = schema.items.enum;
    const enumTitles = schema.items.enumNames;

    return (
      <CheckboxGroup
        label={label}
        description={description}
        value={data || []}
        onChange={(value) => handleChange(path, value)}
        error={errors}
        withAsterisk={required}
      >
        <Stack mt="xs" gap="xs">
          {options.map((option: any, index: number) => (
            <Checkbox
              key={option}
              value={String(option)}
              label={enumTitles?.[index] || String(option)}
            />
          ))}
        </Stack>
      </CheckboxGroup>
    );
  }

  // Single checkbox for boolean
  return (
    <Checkbox
      label={label}
      description={description}
      checked={data || false}
      onChange={(event) => handleChange(path, event.currentTarget.checked)}
      error={errors}
    />
  );
};

export const mantineCheckboxControlTester = rankWith(
  3,
  isBooleanControl
);

export default withJsonFormsControlProps(MantineCheckboxControl);
