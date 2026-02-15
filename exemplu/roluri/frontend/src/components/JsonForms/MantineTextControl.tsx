import { withJsonFormsControlProps } from '@jsonforms/react';
import { TextInput, Textarea } from '@mantine/core';
import { rankWith, isStringControl } from '@jsonforms/core';

interface MantineTextControlProps {
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

const MantineTextControl = ({
  data,
  handleChange,
  path,
  label,
  required,
  description,
  errors,
  schema,
  uischema,
}: MantineTextControlProps) => {
  const isMultiline = schema.format === 'textarea' || uischema?.options?.multi;
  const maxLength = schema.maxLength;

  if (isMultiline) {
    return (
      <Textarea
        label={label}
        value={data || ''}
        onChange={(event) => handleChange(path, event.currentTarget.value)}
        required={required}
        description={description}
        error={errors}
        minRows={uischema?.options?.rows || 3}
        maxLength={maxLength}
        autosize
        withAsterisk={required}
      />
    );
  }

  return (
    <TextInput
      label={label}
      value={data || ''}
      onChange={(event) => handleChange(path, event.currentTarget.value)}
      required={required}
      description={description}
      error={errors}
      maxLength={maxLength}
      withAsterisk={required}
    />
  );
};

export const mantineTextControlTester = rankWith(
  3,
  isStringControl
);

export default withJsonFormsControlProps(MantineTextControl);
