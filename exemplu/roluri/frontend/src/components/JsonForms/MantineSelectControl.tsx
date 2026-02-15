import { withJsonFormsControlProps } from '@jsonforms/react';
import { Select, MultiSelect } from '@mantine/core';
import { rankWith, isEnumControl } from '@jsonforms/core';

interface MantineSelectControlProps {
  data: any;
  handleChange: (path: string, value: any) => void;
  path: string;
  label: string;
  required?: boolean;
  description?: string;
  errors?: string;
  schema: any;
  uischema: any;
}

const MantineSelectControl = ({
  data,
  handleChange,
  path,
  label,
  required,
  description,
  errors,
  schema,
  uischema,
}: MantineSelectControlProps) => {
  const isMultiple = schema.type === 'array' || uischema?.options?.multiple;
  const options = schema.enum || schema.items?.enum || [];
  const enumTitles = schema.enumNames || schema.items?.enumNames;

  const selectData = options.map((value: any, index: number) => ({
    value: String(value),
    label: enumTitles?.[index] || String(value),
  }));

  if (isMultiple) {
    return (
      <MultiSelect
        label={label}
        value={data || []}
        onChange={(value) => handleChange(path, value)}
        data={selectData}
        required={required}
        description={description}
        error={errors}
        searchable
        clearable
        withAsterisk={required}
      />
    );
  }

  return (
    <Select
      label={label}
      value={data || null}
      onChange={(value) => handleChange(path, value)}
      data={selectData}
      required={required}
      description={description}
      error={errors}
      searchable
      clearable
      withAsterisk={required}
    />
  );
};

export const mantineSelectControlTester = rankWith(
  3,
  isEnumControl
);

export default withJsonFormsControlProps(MantineSelectControl);
