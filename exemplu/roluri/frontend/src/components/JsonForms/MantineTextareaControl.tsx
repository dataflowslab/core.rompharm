import { rankWith, isStringControl, ControlProps } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { Textarea } from '@mantine/core';

/**
 * Mantine Textarea Control for JsonForms
 * Renders multi-line text input
 * 
 * Triggers when:
 * - Schema type is "string"
 * - UI Schema has option "multi": true OR format: "textarea"
 * - OR maxLength > 200
 */

export const MantineTextareaControl = (props: ControlProps) => {
  const {
    data,
    handleChange,
    path,
    label,
    errors,
    schema,
    uischema,
    visible,
    enabled,
    required,
  } = props;

  if (!visible) {
    return null;
  }

  const isMultiLine = uischema.options?.multi === true || 
                      schema.format === 'textarea' ||
                      (schema.maxLength && schema.maxLength > 200);

  // Only render if it's actually a textarea
  if (!isMultiLine) {
    return null;
  }

  const rows = uischema.options?.rows || 4;
  const maxLength = schema.maxLength;

  return (
    <Textarea
      label={label}
      value={data || ''}
      onChange={(event) => handleChange(path, event.currentTarget.value)}
      error={errors}
      disabled={!enabled}
      required={required}
      minRows={rows}
      maxRows={rows + 4}
      autosize
      maxLength={maxLength}
      description={schema.description}
      placeholder={uischema.options?.placeholder || schema.description}
    />
  );
};

export const mantineTextareaControlTester = rankWith(
  3, // Higher priority than text control
  (uischema, schema) => {
    if (!isStringControl(uischema, schema)) {
      return false;
    }
    
    // Check if it should be rendered as textarea
    const isMultiLine = uischema.options?.multi === true || 
                        schema.format === 'textarea' ||
                        (schema.maxLength && schema.maxLength > 200);
    
    return isMultiLine;
  }
);

export default withJsonFormsControlProps(MantineTextareaControl);
