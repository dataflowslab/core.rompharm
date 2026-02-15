import MantineTextControl, { mantineTextControlTester } from './MantineTextControl';
import MantineTextareaControl, { mantineTextareaControlTester } from './MantineTextareaControl';
import MantineDateControl, { mantineDateControlTester } from './MantineDateControl';
import MantineNumberControl, { mantineNumberControlTester } from './MantineNumberControl';
import MantineIntegerControl, { mantineIntegerControlTester } from './MantineIntegerControl';
import MantineSelectControl, { mantineSelectControlTester } from './MantineSelectControl';
import MantineCheckboxControl, { mantineCheckboxControlTester } from './MantineCheckboxControl';
import MantineRadioControl, { mantineRadioControlTester } from './MantineRadioControl';
import MantineGroupLayout, { mantineGroupLayoutTester } from './MantineGroupLayout';
import MantineVerticalLayout, { mantineVerticalLayoutTester } from './MantineVerticalLayout';
import MantineHorizontalLayout, { mantineHorizontalLayoutTester } from './MantineHorizontalLayout';
import ArrayTableRenderer, { arrayTableTester } from './ArrayTableRenderer';
import MantineFileUploadControl, { mantineFileUploadControlTester } from './MantineFileUploadControl';

export const mantineRenderers = [
  { tester: mantineFileUploadControlTester, renderer: MantineFileUploadControl },
  { tester: arrayTableTester, renderer: ArrayTableRenderer },
  { tester: mantineDateControlTester, renderer: MantineDateControl },
  { tester: mantineTextareaControlTester, renderer: MantineTextareaControl },
  { tester: mantineRadioControlTester, renderer: MantineRadioControl },
  { tester: mantineSelectControlTester, renderer: MantineSelectControl },
  { tester: mantineCheckboxControlTester, renderer: MantineCheckboxControl },
  { tester: mantineIntegerControlTester, renderer: MantineIntegerControl },
  { tester: mantineNumberControlTester, renderer: MantineNumberControl },
  { tester: mantineTextControlTester, renderer: MantineTextControl },
  { tester: mantineGroupLayoutTester, renderer: MantineGroupLayout },
  { tester: mantineVerticalLayoutTester, renderer: MantineVerticalLayout },
  { tester: mantineHorizontalLayoutTester, renderer: MantineHorizontalLayout },
];
