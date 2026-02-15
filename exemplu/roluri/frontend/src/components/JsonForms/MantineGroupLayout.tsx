import { withJsonFormsLayoutProps } from '@jsonforms/react';
import { JsonFormsDispatch } from '@jsonforms/react';
import { Stack, Title, Divider, Box } from '@mantine/core';
import { rankWith, uiTypeIs } from '@jsonforms/core';

interface MantineGroupLayoutProps {
  uischema: any;
  schema: any;
  path: string;
  visible?: boolean;
  renderers?: any[];
  cells?: any[];
}

const MantineGroupLayout = ({
  uischema,
  schema,
  path,
  visible,
  renderers,
  cells,
}: MantineGroupLayoutProps) => {
  if (!visible) {
    return null;
  }

  const label = uischema.label;
  const elements = uischema.elements || [];
  const isRoot = uischema.options?.root === true;

  // Root group (technical wrapper) - no styling
  if (isRoot || !label) {
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
  }

  // Regular group with label - simple separator
  return (
    <Box>
      <Divider 
        label={<Title order={4}>{label}</Title>} 
        labelPosition="left"
        mb="md"
        mt="lg"
      />
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
    </Box>
  );
};

export const mantineGroupLayoutTester = rankWith(
  2,
  uiTypeIs('Group')
);

export default withJsonFormsLayoutProps(MantineGroupLayout);
