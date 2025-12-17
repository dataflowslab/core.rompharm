import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Tabs,
  TextInput,
  Select,
  Checkbox,
  NumberInput,
  Button,
  Group,
  LoadingOverlay,
  TagsInput,
  Table,
  Text,
  Badge,
} from '@mantine/core';
import { IconPackage, IconBoxSeam, IconPaperclip, IconChefHat } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { api } from '../services/api';

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
  supplier_id?: string;
}

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

export function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [article, setArticle] = useState<Article | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [suppliers, setSuppliers] = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [stocks, setStocks] = useState<any[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Link],
    content: '',
  });

  useEffect(() => {
    if (id) {
      fetchArticle();
      fetchLocations();
      fetchSuppliers();
      fetchCategories();
      fetchRecipes(); // Auto-load recipes
    }
  }, [id]);

  useEffect(() => {
    if (article) {
      fetchStocks(); // Auto-load stocks when article is loaded
      fetchAllocations(); // Auto-load allocations when article is loaded
      if (editor) {
        editor.commands.setContent(article.notes || '');
      }
    }
  }, [article]);

  const fetchArticle = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/modules/inventory/api/articles/${id}`);
      setArticle(response.data);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch article',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await api.get('/modules/inventory/api/locations');
      setLocations(response.data || []);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/modules/inventory/api/companies?is_supplier=true');
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/modules/inventory/api/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchRecipes = async () => {
    if (!id) return;
    setLoadingRecipes(true);
    try {
      const response = await api.get(`/modules/inventory/api/articles/${id}/recipes`);
      setRecipes(response.data || []);
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const fetchStocks = async () => {
    if (!article) return;
    setLoadingStocks(true);
    try {
      // Search stocks by part_id (article._id)
      const response = await api.get(`/modules/inventory/api/stocks?part_id=${article._id}`);
      setStocks(response.data.results || []);
    } catch (error) {
      console.error('Failed to fetch stocks:', error);
    } finally {
      setLoadingStocks(false);
    }
  };

  const fetchAllocations = async () => {
    if (!article) return;
    setLoadingAllocations(true);
    try {
      // Placeholder - implement when allocations API is ready
      setAllocations([]);
    } catch (error) {
      console.error('Failed to fetch allocations:', error);
    } finally {
      setLoadingAllocations(false);
    }
  };

  const handleSave = async () => {
    if (!article) return;

    setLoading(true);
    try {
      const updateData = {
        ...article,
        notes: editor?.getHTML() || '',
      };

      await api.put(`/modules/inventory/api/articles/${id}`, updateData);
      notifications.show({
        title: 'Success',
        message: 'Article updated successfully',
        color: 'green',
      });
      fetchArticle();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to update article',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!article) {
    return (
      <Container size="xl">
        <LoadingOverlay visible />
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>{article.name}</Title>
        <Group>
          <Button variant="default" onClick={() => navigate('/inventory/articles')}>
            Back
          </Button>
          <Button onClick={handleSave} loading={loading}>
            Save Changes
          </Button>
        </Group>
      </Group>

      <Paper p="md" pos="relative">
        <LoadingOverlay visible={loading} />

        <Tabs defaultValue="details">
          <Tabs.List>
            <Tabs.Tab value="details" leftSection={<IconPackage size={16} />}>
              Part Details
            </Tabs.Tab>
            <Tabs.Tab value="stock" leftSection={<IconBoxSeam size={16} />}>
              Stock
            </Tabs.Tab>
            <Tabs.Tab value="allocations">
              Allocations
            </Tabs.Tab>
            <Tabs.Tab value="recipes" leftSection={<IconChefHat size={16} />}>
              Recipes
            </Tabs.Tab>
            <Tabs.Tab value="attachments" leftSection={<IconPaperclip size={16} />} disabled>
              Attachments
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="details" pt="md">
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
              label="Unit of Measure"
              placeholder="e.g., buc, kg, L"
              required
              value={article.um}
              onChange={(e) => setArticle({ ...article, um: e.currentTarget.value })}
              mb="sm"
            />

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

            {/* Supplier and Link on same row (1/3 + 2/3) */}
            <Group grow mb="sm" align="flex-start">
              <Select
                label="Supplier"
                placeholder="Select supplier"
                data={suppliers.map((sup) => ({ value: sup._id, label: sup.name }))}
                value={article.supplier_id || ''}
                onChange={(value) => setArticle({ ...article, supplier_id: value || undefined })}
                searchable
                clearable
                style={{ flex: 1 }}
              />
              <TextInput
                label="Link"
                placeholder="External link"
                value={article.link || ''}
                onChange={(e) => setArticle({ ...article, link: e.currentTarget.value })}
                style={{ flex: 2 }}
              />
            </Group>

            {/* Minimum Stock and Default Expiry on same row (1/2 + 1/2) */}
            <Group grow mb="sm" align="flex-start">
              <NumberInput
                label="Minimum Stock"
                placeholder="0"
                value={article.minimum_stock || 0}
                onChange={(value) => setArticle({ ...article, minimum_stock: Number(value) || 0 })}
              />
              <NumberInput
                label="Default Expiry (days)"
                placeholder="0"
                value={article.default_expiry || 0}
                onChange={(value) => setArticle({ ...article, default_expiry: Number(value) || 0 })}
              />
            </Group>

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
                  { value: 'LIFO', label: 'LIFO (Last In, First Out)' },
                  { value: 'FEFO', label: 'FEFO (First Expired, First Out)' },
                ]}
                value={article.selection_method || 'FIFO'}
                onChange={(value) => setArticle({ ...article, selection_method: value || 'FIFO' })}
              />
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
                label="Lot/Expiry Required"
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
          </Tabs.Panel>

          <Tabs.Panel value="stock" pt="md">
            {loadingStocks && <LoadingOverlay visible />}

            {stocks.length === 0 && !loadingStocks && (
              <Text c="dimmed">No stock items found for this article.</Text>
            )}

            {stocks.length > 0 && !loadingStocks && (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Batch Code</Table.Th>
                    <Table.Th>Batch Date</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Location</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Supplier</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {stocks.map((stock: any) => (
                    <Table.Tr key={stock._id}>
                      <Table.Td>{stock.batch_code || '-'}</Table.Td>
                      <Table.Td>
                        {stock.batch_date ? new Date(stock.batch_date).toLocaleDateString() : '-'}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={stock.status === 'OK' ? 'green' : 'yellow'}>
                          {stock.status || 'Unknown'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{stock.location_name || '-'}</Table.Td>
                      <Table.Td>{stock.quantity || 0} {article.um}</Table.Td>
                      <Table.Td>{stock.supplier_name || '-'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="allocations" pt="md">
            {loadingAllocations && <LoadingOverlay visible />}

            {allocations.length === 0 && !loadingAllocations && (
              <Text c="dimmed">No allocations found for this article.</Text>
            )}

            {allocations.length > 0 && !loadingAllocations && (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Order</Table.Th>
                    <Table.Th>Batch Code</Table.Th>
                    <Table.Th>Allocated Qty</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Date</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {allocations.map((allocation: any) => (
                    <Table.Tr key={allocation._id}>
                      <Table.Td>{allocation.order_ref || '-'}</Table.Td>
                      <Table.Td>{allocation.batch_code || '-'}</Table.Td>
                      <Table.Td>{allocation.quantity || 0} {article.um}</Table.Td>
                      <Table.Td>
                        <Badge color="blue">{allocation.status || 'Pending'}</Badge>
                      </Table.Td>
                      <Table.Td>
                        {allocation.created_at ? new Date(allocation.created_at).toLocaleDateString() : '-'}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="recipes" pt="md">
            {loadingRecipes && <LoadingOverlay visible />}

            {recipes.length === 0 && !loadingRecipes && (
              <Text c="dimmed">No recipes found using this article.</Text>
            )}

            {recipes.length > 0 && !loadingRecipes && (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product Code</Table.Th>
                    <Table.Th>Product Name</Table.Th>
                    <Table.Th>Revision</Table.Th>
                    <Table.Th>Rev Date</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {recipes.map((recipe) => (
                    <Table.Tr key={recipe._id}>
                      <Table.Td>{recipe.product_code || '-'}</Table.Td>
                      <Table.Td>{recipe.product_name || '-'}</Table.Td>
                      <Table.Td>
                        <Badge color="blue">Rev {recipe.rev || 0}</Badge>
                      </Table.Td>
                      <Table.Td>
                        {recipe.rev_date ? new Date(recipe.rev_date).toLocaleDateString() : '-'}
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => navigate(`/recipes/${recipe._id}`)}
                        >
                          View Recipe
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="attachments" pt="md">
            <p>Attachments coming soon...</p>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Container>
  );
}
