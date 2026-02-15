import { withJsonFormsControlProps } from '@jsonforms/react';
import { DateInput } from '@mantine/dates';
import { rankWith, isDateControl } from '@jsonforms/core';

interface MantineDateControlProps {
  data: any;
  handleChange: (path: string, value: any) => void;
  path: string;
  label: string;
  required?: boolean;
  description?: string;
  errors?: string;
}

const MantineDateControl = ({
  data,
  handleChange,
  path,
  label,
  required,
  description,
  errors,
}: MantineDateControlProps) => {
  const dateValue = data ? new Date(data) : null;

  return (
    <DateInput
      label={label}
      value={dateValue}
      onChange={(value) => {
        if (value) {
          handleChange(path, value.toISOString().split('T')[0]);
        } else {
          handleChange(path, undefined);
        }
      }}
      required={required}
      description={description}
      error={errors}
      valueFormat="DD-MM-YYYY"
      placeholder="ZZ-LL-AAAA"
      withAsterisk={required}
      clearable
    />
  );
};

export const mantineDateControlTester = rankWith(
  4,
  isDateControl
);

export default withJsonFormsControlProps(MantineDateControl);
