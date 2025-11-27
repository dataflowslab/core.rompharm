import { withJsonFormsControlProps } from '@jsonforms/react';
import { NumberInput } from '@mantine/core';
import { rankWith, isNumberControl } from '@jsonforms/core';

interface MantineNumberControlProps {
  data: any;
  handleChange: (path: string, value: any) => void;
  path: string;
  label: string;
  required?: boolean;
  description?: string;
  errors?: string;
  schema: any;
}

const MantineNumberControl = ({
  data,
  handleChange,
  path,
  label,
  required,
  description,
  errors,
  schema,
}: MantineNumberControlProps) => {
  const min = schema.minimum;
  const max = schema.maximum;

  return (
    <NumberInput
      label={label}
      value={data ?? ''}
      onChange={(value) => handleChange(path, value)}
      required={required}
      description={description}
      error={errors}
      min={min}
      max={max}
      withAsterisk={required}
    />
  );
};

export const mantineNumberControlTester = rankWith(
  3,
  isNumberControl
);

export default withJsonFormsControlProps(MantineNumberControl);
