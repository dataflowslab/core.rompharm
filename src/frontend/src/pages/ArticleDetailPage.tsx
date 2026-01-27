import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Tabs,
  Button,
  Group,
  LoadingOverlay,
  Text,
} from '@mantine/core';
import { IconPackage, IconBoxSeam, IconPaperclip, IconChefHat, IconTruckDelivery, IconLink } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { api } from '../services/api';
import { AddStockModal } from '../components/AddStockModal';
import { RecipesTable } from '../components/RecipesTable';
import {
  DetailsTab,
  StockTab,
  AllocationsTab,
  SuppliersTab,
  SupplierModal,
} from '../components/ArticleDetails';

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
  conversion_modifier?: number;
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
  manufacturer_um_id?: string;
  total_delivery_time?: string;
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

interface UnitOfMeasure {
  _id: string;
  name: string;
  symbol?: string;
  abrev: string;
}

export function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [article, setArticle] = useState<Article | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [manufacturers, setManufacturers] = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [systemUMs, setSystemUMs] = useState<UnitOfMeasure[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [stocks, setStocks] = useState<any[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [stockCalculations, setStockCalculations] = useState<any>(null);
  const [showSales, setShowSales] = useState(true);
  const [showPurchase, setShowPurchase] = useState(true);
  const [articleSuppliers, setArticleSuppliers] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  
  // Add Stock Modal
  const [addStockModalOpened, setAddStockModalOpened] = useState(false);
  
  // Supplier Modal
  const [supplierModalOpened, setSupplierModalOpened] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<Company[]>([]);
  const [supplierFormData, setSupplierFormData] = useState({
    supplier_id: '',
    supplier_code: '',
    notes: '',
    price: 0,
    currency: 'EUR',
  });

  const editor = useEditor({
    extensions: [StarterKit, Link],
    content: '',
  });

  useEffect(() => {
    if (id) {
      fetchArticle();
      fetchLocations();
      fetchManufacturers();
      fetchCategories();
      fetchSystemUMs();
      fetchRecipes();
    }
  }, [id]);

  useEffect(() => {
    if (article) {
      fetchStocks();
      fetchAllocations();
      fetchArticleSuppliers();
      if (editor) {
        editor.commands.setContent(article.notes || '');
      }
    }
  }, [article, showSales, showPurchase]);

  useEffect(() => {
    fetchSuppliers();
  }, []);

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

  const fetchManufacturers = async () => {
    try {
      const response = await api.get('/modules/inventory/api/manufacturers');
      setManufacturers(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to fetch manufacturers:', error);
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

  const fetchSystemUMs = async () => {
    try {
      const response = await api.get('/modules/inventory/api/system-ums');
      setSystemUMs(response.data || []);
    } catch (error) {
      console.error('Failed to fetch system UMs:', error);
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
      let orderType = null;
      if (showSales && !showPurchase) {
        orderType = 'sales';
      } else if (!showSales && showPurchase) {
        orderType = 'purchase';
      }

      const params = new URLSearchParams();
      if (orderType) {
        params.append('order_type', orderType);
      }

      const response = await api.get(
        `/modules/inventory/api/articles/${article._id}/allocations?${params.toString()}`
      );
      setAllocations(response.data || []);

      const calcResponse = await api.get(
        `/modules/inventory/api/articles/${article._id}/stock-calculations`
      );
      setStockCalculations(calcResponse.data);
    } catch (error) {
      console.error('Failed to fetch allocations:', error);
    } finally {
      setLoadingAllocations(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/modules/inventory/api/suppliers');
      setSuppliers(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const fetchArticleSuppliers = async () => {
    if (!article) return;
    setLoadingSuppliers(true);
    try {
      const response = await api.get(`/modules/inventory/api/articles/${article._id}/suppliers`);
      setArticleSuppliers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch article suppliers:', error);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierFormData({
      supplier_id: '',
      supplier_code: '',
      notes: '',
      price: 0,
      currency: 'EUR',
    });
    setSupplierModalOpened(true);
  };

  const handleEditSupplier = (supplier: any) => {
    setEditingSupplier(supplier);
    setSupplierFormData({
      supplier_id: supplier.supplier_id,
      supplier_code: supplier.supplier_code || '',
      notes: supplier.notes || '',
      price: supplier.price || 0,
      currency: supplier.currency || 'EUR',
    });
    setSupplierModalOpened(true);
  };

  const handleSaveSupplier = async () => {
    if (!article || !supplierFormData.supplier_id) {
      notifications.show({
        title: 'Error',
        message: 'Please select a supplier',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      if (editingSupplier) {
        await api.put(
          `/modules/inventory/api/articles/${article._id}/suppliers/${editingSupplier._id}`,
          supplierFormData
        );
        notifications.show({
          title: 'Success',
          message: 'Supplier updated successfully',
          color: 'green',
        });
      } else {
        await api.post(
          `/modules/inventory/api/articles/${article._id}/suppliers`,
          supplierFormData
        );
        notifications.show({
          title: 'Success',
          message: 'Supplier added successfully',
          color: 'green',
        });
      }
      setSupplierModalOpened(false);
      fetchArticleSuppliers();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to save supplier',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!article) return;

    try {
      await api.delete(`/modules/inventory/api/articles/${article._id}/suppliers/${supplierId}`);
      notifications.show({
        title: 'Success',
        message: 'Supplier removed successfully',
        color: 'green',
      });
      fetchArticleSuppliers();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to remove supplier',
        color: 'red',
      });
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
            <Tabs.Tab value="suppliers" leftSection={<IconTruckDelivery size={16} />}>
              Suppliers
            </Tabs.Tab>
            <Tabs.Tab value="stock" leftSection={<IconBoxSeam size={16} />}>
              Stock
            </Tabs.Tab>
            <Tabs.Tab value="allocations" leftSection={<IconLink size={16} />}>
              Allocations
            </Tabs.Tab>
            <Tabs.Tab value="recipes" leftSection={<IconChefHat size={16} />}>
              Recipes
            </Tabs.Tab>
            <Tabs.Tab value="attachments" leftSection={<IconPaperclip size={16} />}>
              Attachments
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="details" pt="md">
            <DetailsTab
              article={article}
              setArticle={setArticle}
              locations={locations}
              manufacturers={manufacturers}
              categories={categories}
              systemUMs={systemUMs}
              editor={editor}
            />
          </Tabs.Panel>

          <Tabs.Panel value="stock" pt="md">
            <StockTab
              stocks={stocks}
              loadingStocks={loadingStocks}
              articleUm={article.um}
              onAddStock={() => setAddStockModalOpened(true)}
            />
          </Tabs.Panel>

          <Tabs.Panel value="allocations" pt="md">
            <AllocationsTab
              allocations={allocations}
              loadingAllocations={loadingAllocations}
              stockCalculations={stockCalculations}
              articleUm={article.um}
              showSales={showSales}
              showPurchase={showPurchase}
              onToggleSales={() => setShowSales(!showSales)}
              onTogglePurchase={() => setShowPurchase(!showPurchase)}
            />
          </Tabs.Panel>

          <Tabs.Panel value="recipes" pt="md">
            <RecipesTable recipes={recipes} loading={loadingRecipes} />
          </Tabs.Panel>

          <Tabs.Panel value="suppliers" pt="md">
            <SuppliersTab
              articleSuppliers={articleSuppliers}
              loadingSuppliers={loadingSuppliers}
              article={article}
              systemUMs={systemUMs}
              onAddSupplier={handleAddSupplier}
              onEditSupplier={handleEditSupplier}
              onDeleteSupplier={handleDeleteSupplier}
            />
          </Tabs.Panel>

          <Tabs.Panel value="attachments" pt="md">
            <Text c="dimmed">Attachments coming soon...</Text>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      <AddStockModal
        opened={addStockModalOpened}
        onClose={() => setAddStockModalOpened(false)}
        onSuccess={fetchStocks}
        fixedArticleId={article._id}
        fixedArticleName={article.name}
        fixedArticleIpn={article.ipn}
      />

      <SupplierModal
        opened={supplierModalOpened}
        onClose={() => setSupplierModalOpened(false)}
        editingSupplier={editingSupplier}
        supplierFormData={supplierFormData}
        setSupplierFormData={setSupplierFormData}
        suppliers={suppliers}
        systemUMs={systemUMs}
        loading={loading}
        onSave={handleSaveSupplier}
      />
    </Container>
  );
}
