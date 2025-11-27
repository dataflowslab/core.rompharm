import { withJsonFormsControlProps } from '@jsonforms/react';
import { NumberInput } from '@mantine/core';
import { rankWith, isIntegerControl } from '@jsonforms/core';

interface MantineIntegerControlProps {
  data: any;
  handleChange: (path: string, value: any) => void;
  path: string;
  label: string;
  required?: boolean;
  description?: string;
  errors?: string;
  schema: any;
}

const MantineIntegerControl = ({
  data,
  handleChange,
  path,
  label,
  required,
  description,
  errors,
  schema,
}: MantineIntegerControlProps) => {
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
      decimalScale={0}
      allowDecimal={false}
      allowNegative={schema.minimum === undefined || schema.minimum < 0}
    />
  );
};

export const mantineIntegerControlTester = rankWith(
  3,
  isIntegerControl
);

export default withJsonFormsControlProps(MantineIntegerControl);
