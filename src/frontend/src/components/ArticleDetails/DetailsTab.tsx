import { 
  TextInput, 
  Select, 
  Checkbox, 
  NumberInput, 
  Group, 
  TagsInput 
} from '@mantine/core';
import { RichTextEditor, Link } from '@mantine/tiptap';
import { Editor } from '@tiptap/react';

interface Location {
  _id: string;
  name: string;
}

interface Company {
  _id: string;
  name: string;
}

interface Category {
  _id: string;
  name: string;
}

interface UnitOfMeasure {
  _id: string;
  name: string;
  symbol?: string;
  abrev: string;
}

interface Article {
  _id: string;
  name: string;
  ipn: string;
  default_location_id?: string;
  um: string;
  description?: string;
  notes?: string;
  keywords?: string[];
  link?: string;
  default_expiry?: number;
  minimum_stock?: number;
  is_component: boolean;
  is_assembly: boolean;
  is_testable: boolean;
  is_salable: boolean;
  is_active: boolean;
  storage_conditions?: string;
  regulated?: boolean;
  lotallexp?: boolean;
  selection_method?: string;
  category_id?: string;
  manufacturer_id?: string;
  manufacturer_ipn?: string;
  system_um_id?: string;
  total_delivery_time?: string;
}

interface DetailsTabProps {
  article: Article;
  setArticle: (article: Article) => void;
  locations: Location[];
  manufacturers: Company[];
  categories: Category[];
  systemUMs: UnitOfMeasure[];
  editor: Editor | null;
}

export function DetailsTab({
  article,
  setArticle,
  locations,
  manufacturers,
  categories,
  systemUMs,
  editor,
}: DetailsTabProps) {
  return (
    <>
      {/* Name and IPN on same row (2/3 + 1/3) */}
      <Group grow mb="sm" align="flex-start">
        <TextInput
          label="Name"
          placeholder="Article name"
          required
          value={article.name}
          onChange={(e) => setArticle({ ...article, name: e.currentTarget.value })}
          style={{ flex: 2 }}
        />
        <TextInput
          label="IPN (Internal Part Number)"
          placeholder="IPN"
          required
          value={article.ipn}
          onChange={(e) => setArticle({ ...article, ipn: e.currentTarget.value })}
          style={{ flex: 1 }}
        />
      </Group>

      <TextInput
        label="Description"
        placeholder="Short description"
        value={article.description || ''}
        onChange={(e) => setArticle({ ...article, description: e.currentTarget.value })}
        mb="sm"
      />

      <TagsInput
        label="Keywords"
        placeholder="Add keywords"
        value={article.keywords || []}
        onChange={(value) => setArticle({ ...article, keywords: value })}
        mb="sm"
      />

      {/* Manufacturer and Manufacturer IPN on same row (1/2 + 1/2) */}
      <Group grow mb="sm" align="flex-start">
        <Select
          label="Manufacturer"
          placeholder="Select manufacturer"
          data={manufacturers.map((man) => ({ value: man._id, label: man.name }))}
          value={article.manufacturer_id || ''}
          onChange={(value) => setArticle({ ...article, manufacturer_id: value || undefined })}
          searchable
          clearable
        />
        <TextInput
          label="Manufacturer IPN"
          placeholder="Manufacturer part number"
          value={article.manufacturer_ipn || ''}
          onChange={(e) => setArticle({ ...article, manufacturer_ipn: e.currentTarget.value })}
        />
      </Group>

      {/* Link (full width) */}
      <TextInput
        label="Link"
        placeholder="External link"
        value={article.link || ''}
        onChange={(e) => setArticle({ ...article, link: e.currentTarget.value })}
        mb="sm"
      />

      {/* Minimum Stock (full width) */}
      <NumberInput
        label="Minimum Stock"
        placeholder="0"
        value={article.minimum_stock || 0}
        onChange={(value) => setArticle({ ...article, minimum_stock: Number(value) || 0 })}
        mb="sm"
      />

      {/* Category and Default Location on same row (1/2 + 1/2) */}
      <Group grow mb="sm" align="flex-start">
        <Select
          label="Category"
          placeholder="Select category"
          data={categories.map((cat) => ({ value: cat._id, label: cat.name }))}
          value={article.category_id || ''}
          onChange={(value) => setArticle({ ...article, category_id: value || undefined })}
          searchable
          clearable
        />
        <Select
          label="Default Location"
          placeholder="Select location"
          data={locations.map((loc) => ({ value: loc._id, label: loc.name }))}
          value={article.default_location_id || ''}
          onChange={(value) => setArticle({ ...article, default_location_id: value || undefined })}
          searchable
          clearable
        />
      </Group>

      {/* System U.M. and Total Delivery Time on same row (1/2 + 1/2) */}
      <Group grow mb="sm" align="flex-start">
        <Select
          label="System U.M."
          placeholder="Select system unit of measure"
          data={systemUMs.map((um) => ({ 
            value: um._id, 
            label: `${um.name} (${um.abrev})` 
          }))}
          value={article.system_um_id || ''}
          onChange={(value) => setArticle({ ...article, system_um_id: value || undefined })}
          searchable
          clearable
        />
        <TextInput
          label="Total Delivery Time"
          placeholder="e.g., 2-3 weeks"
          value={article.total_delivery_time || ''}
          onChange={(e) => setArticle({ ...article, total_delivery_time: e.currentTarget.value })}
        />
      </Group>

      {/* Storage Conditions and Selection Method on same row (1/2 + 1/2) */}
      <Group grow mb="sm" align="flex-start">
        <TextInput
          label="Storage Conditions"
          placeholder="e.g., 1-3 grade C"
          value={article.storage_conditions || ''}
          onChange={(e) => setArticle({ ...article, storage_conditions: e.currentTarget.value })}
        />
        <Select
          label="Selection Method"
          placeholder="Select method"
          data={[
            { value: 'FIFO', label: 'FIFO (First In, First Out)' },
            { value: 'LIFO', label: 'LIFO (Last In, Last Out)' },
            { value: 'FEFO', label: 'FEFO (First Expired, First Out)' },
          ]}
          value={article.selection_method || 'FIFO'}
          onChange={(value) => setArticle({ ...article, selection_method: value || 'FIFO' })}
        />
      </Group>

      {/* Default Expiry and empty space on same row (1/2 + 1/2) */}
      <Group grow mb="sm" align="flex-start">
        <NumberInput
          label="Default Expiry (days)"
          placeholder="0"
          value={article.default_expiry || 0}
          onChange={(value) => setArticle({ ...article, default_expiry: Number(value) || 0 })}
        />
        <div style={{ flex: 1 }}></div>
      </Group>

      <Group grow mb="sm">
        <Checkbox
          label="Component"
          checked={article.is_component}
          onChange={(e) => setArticle({ ...article, is_component: e.currentTarget.checked })}
        />
        <Checkbox
          label="Assembly"
          checked={article.is_assembly}
          onChange={(e) => setArticle({ ...article, is_assembly: e.currentTarget.checked })}
        />
      </Group>

      <Group grow mb="sm">
        <Checkbox
          label="Testable"
          checked={article.is_testable}
          onChange={(e) => setArticle({ ...article, is_testable: e.currentTarget.checked })}
        />
        <Checkbox
          label="Salable"
          checked={article.is_salable}
          onChange={(e) => setArticle({ ...article, is_salable: e.currentTarget.checked })}
        />
      </Group>

      <Group grow mb="sm">
        <Checkbox
          label="Regulated"
          checked={article.regulated || false}
          onChange={(e) => setArticle({ ...article, regulated: e.currentTarget.checked })}
        />
        <Checkbox
          label="Batch Required"
          checked={article.lotallexp || false}
          onChange={(e) => setArticle({ ...article, lotallexp: e.currentTarget.checked })}
        />
      </Group>

      <Checkbox
        label="Active"
        checked={article.is_active}
        onChange={(e) => setArticle({ ...article, is_active: e.currentTarget.checked })}
        mb="md"
      />

      <div>
        <label style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px', display: 'block' }}>
          Notes
        </label>
        <RichTextEditor editor={editor}>
          <RichTextEditor.Toolbar sticky stickyOffset={60}>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold />
              <RichTextEditor.Italic />
              <RichTextEditor.Underline />
              <RichTextEditor.Strikethrough />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.BulletList />
              <RichTextEditor.OrderedList />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Link />
              <RichTextEditor.Unlink />
            </RichTextEditor.ControlsGroup>
          </RichTextEditor.Toolbar>

          <RichTextEditor.Content />
        </RichTextEditor>
      </div>
    </>
  );
}
