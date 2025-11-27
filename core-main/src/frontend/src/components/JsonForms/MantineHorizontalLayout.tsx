import { withJsonFormsLayoutProps } from '@jsonforms/react';
import { JsonFormsDispatch } from '@jsonforms/react';
import { Grid } from '@mantine/core';
import { rankWith, uiTypeIs } from '@jsonforms/core';

interface MantineHorizontalLayoutProps {
  uischema: any;
  schema: any;
  path: string;
  visible?: boolean;
  renderers?: any[];
  cells?: any[];
}

const MantineHorizontalLayout = ({
  uischema,
  schema,
  path,
  visible,
  renderers,
  cells,
}: MantineHorizontalLayoutProps) => {
  if (!visible) {
    return null;
  }

  const elements = uischema.elements || [];

  return (
    <Grid gutter="md">
      {elements.map((element: any, index: number) => (
        <Grid.Col key={index} span={{ base: 12, sm: 12 / elements.length }}>
          <JsonFormsDispatch
            uischema={element}
            schema={schema}
            path={path}
            renderers={renderers}
            cells={cells}
          />
        </Grid.Col>
      ))}
    </Grid>
  );
};

export const mantineHorizontalLayoutTester = rankWith(
  2,
  uiTypeIs('HorizontalLayout')
);

export default withJsonFormsLayoutProps(MantineHorizontalLayout);
