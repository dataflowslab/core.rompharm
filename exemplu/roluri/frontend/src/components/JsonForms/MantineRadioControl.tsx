import { withJsonFormsControlProps } from '@jsonforms/react';
import { Radio, RadioGroup, Stack } from '@mantine/core';
import { rankWith, and, isEnumControl, uiTypeIs } from '@jsonforms/core';

interface MantineRadioControlProps {
  data: any;
  handleChange: (path: string, value: any) => void;
  path: string;
  label: string;
  required?: boolean;
  description?: string;
  errors?: string;
  schema: any;
}

const MantineRadioControl = ({
  data,
  handleChange,
  path,
  label,
  required,
  description,
  errors,
  schema,
}: MantineRadioControlProps) => {
  const options = schema.enum || [];
  const enumTitles = schema.enumNames;

  return (
    <RadioGroup
      label={label}
      description={description}
      value={data || ''}
      onChange={(value) => handleChange(path, value)}
      error={errors}
      withAsterisk={required}
    >
      <Stack mt="xs" gap="xs">
        {options.map((option: any, index: number) => (
          <Radio
            key={option}
            value={String(option)}
            label={enumTitles?.[index] || String(option)}
          />
        ))}
      </Stack>
    </RadioGroup>
  );
};

export const mantineRadioControlTester = rankWith(
  4,
  and(
    isEnumControl,
    uiTypeIs('Radio')
  )
);

export default withJsonFormsControlProps(MantineRadioControl);
