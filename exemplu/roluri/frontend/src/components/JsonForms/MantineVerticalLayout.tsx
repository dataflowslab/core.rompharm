import { withJsonFormsLayoutProps } from '@jsonforms/react';
import { JsonFormsDispatch } from '@jsonforms/react';
import { Stack } from '@mantine/core';
import { rankWith, uiTypeIs } from '@jsonforms/core';

interface MantineVerticalLayoutProps {
  uischema: any;
  schema: any;
  path: string;
  visible?: boolean;
  renderers?: any[];
  cells?: any[];
}

const MantineVerticalLayout = ({
  uischema,
  schema,
  path,
  visible,
  renderers,
  cells,
}: MantineVerticalLayoutProps) => {
  if (!visible) {
    return null;
  }

  const elements = uischema.elements || [];

  return (
    <Stack gap="md">
      {elements.map((element: any, index: number) => (
        <JsonFormsDispatch
          key={index}
          uischema={element}
          schema={schema}
          path={path}
          renderers={renderers}
          cells={cells}
        />
      ))}
    </Stack>
  );
};

export const mantineVerticalLayoutTester = rankWith(
  2,
  uiTypeIs('VerticalLayout')
);

export default withJsonFormsLayoutProps(MantineVerticalLayout);
