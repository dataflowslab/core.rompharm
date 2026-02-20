import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Tabs,
  TextInput,
  Textarea,
  Button,
  Group,
  LoadingOverlay,
  Checkbox,
  Table,
  ActionIcon,
  Modal,
  Select,
  Text,
  NumberInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconEdit, IconTrash, IconDeviceFloppy } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { api } from '../../../../src/frontend/src/services/api';
import { CompanyDetailsTab } from '../components/Company/CompanyDetailsTab';
import { CompanyAddressesTab } from '../components/Company/CompanyAddressesTab';
import { CompanyContactsTab } from '../components/Company/CompanyContactsTab';
import { CompanyArticlesTab } from '../components/Company/CompanyArticlesTab';

interface Supplier {
  _id: string;
  name: string;

  vatno?: string;
  regno?: string;
  payment_conditions?: string;
  delivery_conditions?: string;
  bank_account?: string;
  currency_id?: string;
  is_supplier: boolean;
  is_manufacturer: boolean;
  is_client: boolean;
  addresses?: Address[];
  contacts?: Contact[];
}

interface Address {
  name: string;
  country?: string;
  country_id?: string;
  city?: string;
  postal_code?: string;
  address?: string;
  description?: string;
  contact?: string;
  email?: string;
}

interface Contact {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

interface Part {
  _id: string;
  name: string;
  ipn: string;
  supplier_code?: string;
  supplier_currency?: string;
}

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('details');

  // Details form
  const [detailsForm, setDetailsForm] = useState({
    name: '',

    vatno: '',
    regno: '',
    payment_conditions: '',
    delivery_conditions: '',
    bank_account: '',
    currency_id: '',
    is_supplier: false,
    is_manufacturer: false,
    is_client: false,
  });

  // Countries and Currencies
  const [countries, setCountries] = useState<Array<{ value: string; label: string }>>([]);
  const [currencies, setCurrencies] = useState<Array<{ value: string; label: string }>>([]);

  // Address modal
  const [addressModalOpened, { open: openAddressModal, close: closeAddressModal }] = useDisclosure(false);
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState<Address>({
    name: '',
    country: '',
    city: '',
    address: '',
    description: '',
    contact: '',
    email: '',
  });

  // Contact modal
  const [contactModalOpened, { open: openContactModal, close: closeContactModal }] = useDisclosure(false);
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState<Contact>({
    name: '',
    role: '',
    phone: '',
    email: '',
  });

  // Parts
  const [parts, setParts] = useState<Part[]>([]);
  const [allParts, setAllParts] = useState<Part[]>([]);
  const [partForm, setPartForm] = useState({
    part_id: '',
    supplier_code: '',
    currency: 'EUR',
  });

  // New Product Modal
  const [createProductModalOpened, { open: openCreateProductModal, close: closeCreateProductModal }] = useDisclosure(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    ipn: '',
    um: 'buc',
    minimum_stock: 0,
    lotallexp: false,
  });

  useEffect(() => {
    if (id) {
      fetchSupplier();
      fetchSupplierParts();
      fetchAllParts();
    }
    fetchCountries();
    fetchCurrencies();
  }, [id]);

  const fetchCountries = async () => {
    try {
      const response = await api.get('/modules/inventory/api/countries');
      const data = response.data || [];
      setCountries(data.map((c: any) => ({ value: c._id, label: c.name })));
    } catch (error) {
      console.error('Failed to fetch countries:', error);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await api.get('/modules/inventory/api/currencies');
      const data = response.data || [];
      setCurrencies(data.map((c: any) => ({ value: c._id, label: `${c.code} - ${c.name}` })));
    } catch (error) {
      console.error('Failed to fetch currencies:', error);
    }
  };

  const fetchSupplier = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/modules/inventory/api/suppliers/${id}`);
      const data = response.data;
      setSupplier(data);
      setDetailsForm({
        name: data.name || '',

        vatno: data.vatno || '',
        regno: data.regno || '',
        payment_conditions: data.payment_conditions || '',
        delivery_conditions: data.delivery_conditions || '',
        bank_account: data.bank_account || '',
        currency_id: data.currency_id || null,
        is_supplier: data.is_supplier || false,
        is_manufacturer: data.is_manufacturer || false,
        is_client: data.is_client || false,
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch supplier',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierParts = async () => {
    try {
      const response = await api.get(`/modules/inventory/api/suppliers/${id}/parts`);
      setParts(response.data || []);
    } catch (error) {
      console.error('Failed to fetch supplier parts:', error);
    }
  };

  const fetchAllParts = async () => {
    try {
      const response = await api.get('/modules/inventory/api/articles?limit=1000');
      setAllParts(response.data.results || []);
    } catch (error) {
      console.error('Failed to fetch parts:', error);
    }
  };

  const handleSaveDetails = async () => {
    // Validate at least one checkbox
    if (!detailsForm.is_supplier && !detailsForm.is_manufacturer && !detailsForm.is_client) {
      notifications.show({
        title: 'Validation Error',
        message: 'At least one of Supplier, Manufacturer, or Client must be selected',
        color: 'red',
      });
      return;
    }

    try {
      await api.put(`/modules/inventory/api/suppliers/${id}`, detailsForm);
      notifications.show({
        title: 'Success',
        message: 'Supplier updated successfully',
        color: 'green',
      });
      fetchSupplier();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to update supplier',
        color: 'red',
      });
    }
  };

  // Address functions
  const handleAddAddress = () => {
    setEditingAddressIndex(null);
    setAddressForm({
      name: '',
      country: '',
      country_id: '',
      city: '',
      postal_code: '',
      address: '',
      description: '',
      contact: '',
      email: '',
    });
    openAddressModal();
  };

  const handleEditAddress = (index: number) => {
    if (supplier?.addresses && supplier.addresses[index]) {
      setEditingAddressIndex(index);
      setAddressForm(supplier.addresses[index]);
      openAddressModal();
    }
  };

  const handleSaveAddress = async () => {
    const addresses = [...(supplier?.addresses || [])];
    if (editingAddressIndex !== null) {
      addresses[editingAddressIndex] = addressForm;
    } else {
      addresses.push(addressForm);
    }

    try {
      await api.put(`/modules/inventory/api/suppliers/${id}`, { addresses });
      notifications.show({
        title: 'Success',
        message: 'Address saved successfully',
        color: 'green',
      });
      closeAddressModal();
      fetchSupplier();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to save address',
        color: 'red',
      });
    }
  };

  const handleDeleteAddress = (index: number) => {
    modals.openConfirmModal({
      title: 'Delete Address',
      children: <Text size="sm">Are you sure you want to delete this address?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const addresses = [...(supplier?.addresses || [])];
        addresses.splice(index, 1);
        try {
          await api.put(`/modules/inventory/api/suppliers/${id}`, { addresses });
          notifications.show({
            title: 'Success',
            message: 'Address deleted successfully',
            color: 'green',
          });
          fetchSupplier();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: 'Failed to delete address',
            color: 'red',
          });
        }
      },
    });
  };

  // Contact functions
  const handleAddContact = () => {
    setEditingContactIndex(null);
    setContactForm({
      name: '',
      role: '',
      phone: '',
      email: '',
    });
    openContactModal();
  };

  const handleEditContact = (index: number) => {
    if (supplier?.contacts && supplier.contacts[index]) {
      setEditingContactIndex(index);
      setContactForm(supplier.contacts[index]);
      openContactModal();
    }
  };

  const handleSaveContact = async () => {
    const contacts = [...(supplier?.contacts || [])];
    if (editingContactIndex !== null) {
      contacts[editingContactIndex] = contactForm;
    } else {
      contacts.push(contactForm);
    }

    try {
      await api.put(`/modules/inventory/api/suppliers/${id}`, { contacts });
      notifications.show({
        title: 'Success',
        message: 'Contact saved successfully',
        color: 'green',
      });
      closeContactModal();
      fetchSupplier();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to save contact',
        color: 'red',
      });
    }
  };

  const handleDeleteContact = (index: number) => {
    modals.openConfirmModal({
      title: 'Delete Contact',
      children: <Text size="sm">Are you sure you want to delete this contact?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const contacts = [...(supplier?.contacts || [])];
        contacts.splice(index, 1);
        try {
          await api.put(`/modules/inventory/api/suppliers/${id}`, { contacts });
          notifications.show({
            title: 'Success',
            message: 'Contact deleted successfully',
            color: 'green',
          });
          fetchSupplier();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: 'Failed to delete contact',
            color: 'red',
          });
        }
      },
    });
  };

  // Part functions
  const handleCreateNewProduct = async () => {
    try {
      // 1. Create the article
      const articleResponse = await api.post('/modules/inventory/api/articles', {
        ...newProductForm,
        supplier_id: id, // key to link it immediately or set default supplier
        is_active: true,
        is_component: true,
      });

      const newArticleId = articleResponse.data._id;

      // 2. Link it to this supplier (if not done automatically by creation, but usually not)
      // Actually, let's explicitly link it in the parts list
      await api.post(`/modules/inventory/api/suppliers/${id}/parts`, {
        part_id: newArticleId,
        supplier_code: '',
        currency: 'EUR',
      });

      notifications.show({
        title: 'Success',
        message: 'Product created and linked successfully',
        color: 'green',
      });
      closeCreateProductModal();
      // Reset form
      setNewProductForm({
        name: '',
        ipn: '',
        um: 'buc',
        minimum_stock: 0,
        lotallexp: false,
      });
      fetchSupplierParts();
      fetchAllParts();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to create product',
        color: 'red',
      });
    }
  };

  const handleSavePart = async () => {
    try {
      await api.post(`/modules/inventory/api/suppliers/${id}/parts`, partForm);
      notifications.show({
        title: 'Success',
        message: 'Part added successfully',
        color: 'green',
      });
      // Reset form but keep currency
      setPartForm({
        part_id: '',
        supplier_code: '',
        currency: partForm.currency,
      });
      fetchSupplierParts();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to add part',
        color: 'red',
      });
    }
  };

  const handleDeletePart = (partId: string, partName: string) => {
    modals.openConfirmModal({
      title: 'Remove Part',
      children: (
        <Text size="sm">
          Are you sure you want to remove <strong>{partName}</strong> from this supplier?
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(`/modules/inventory/api/suppliers/${id}/parts/${partId}`);
          notifications.show({
            title: 'Success',
            message: 'Part removed successfully',
            color: 'green',
          });
          fetchSupplierParts();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: 'Failed to remove part',
            color: 'red',
          });
        }
      },
    });
  };


  const handleAddPart = async () => {
    if (!partForm.part_id) {
      notifications.show({ title: 'Error', message: 'Please select an article', color: 'red' });
      return;
    }
    await handleSavePart();
  };

  if (!supplier) {
    return (
      <Container size="xl">
        <LoadingOverlay visible={true} />
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>
          {supplier.name} {supplier.id_str && <Text span c="dimmed" size="lg">({supplier.id_str})</Text>}
        </Title>
        <Button variant="default" onClick={() => navigate('/inventory/suppliers')}>
          Back
        </Button>
      </Group>

      <Paper p="md" pos="relative">
        <LoadingOverlay visible={loading} />
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="details">Details</Tabs.Tab>
            <Tabs.Tab value="addresses">Addresses</Tabs.Tab>
            <Tabs.Tab value="contacts">Contacts</Tabs.Tab>
            <Tabs.Tab value="articles">Articles</Tabs.Tab>
            <Tabs.Tab value="purchase_orders" disabled>
              Purchase Orders
            </Tabs.Tab>
          </Tabs.List>

          <CompanyDetailsTab
            detailsForm={detailsForm}
            setDetailsForm={setDetailsForm}
            currencies={currencies}
            handleSaveDetails={handleSaveDetails}
          />

          <CompanyAddressesTab
            addresses={supplier.addresses || []}
            handleAddAddress={handleAddAddress}
            handleEditAddress={handleEditAddress}
            handleDeleteAddress={handleDeleteAddress}
          />

          <CompanyContactsTab
            contacts={supplier.contacts || []}
            handleAddContact={handleAddContact}
            handleEditContact={handleEditContact}
            handleDeleteContact={handleDeleteContact}
          />

          <CompanyArticlesTab
            openCreateProductModal={openCreateProductModal}
            allParts={allParts}
            partForm={partForm}
            setPartForm={setPartForm}
            parts={parts}
            handleAddPart={handleAddPart}
            handleDeletePart={handleDeletePart}
          />

          <Tabs.Panel value="purchase_orders" pt="md">
            <Text c="dimmed">Purchase orders functionality coming soon...</Text>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      {/* Address Modal */}
      <Modal opened={addressModalOpened} onClose={closeAddressModal} title={editingAddressIndex !== null ? 'Edit Address' : 'Add Address'} size="lg">
        <TextInput
          label="Name"
          placeholder="e.g., HQ, Warehouse"
          required
          value={addressForm.name}
          onChange={(e) => setAddressForm({ ...addressForm, name: e.currentTarget.value })}
          mb="sm"
        />
        <Select
          label="Country"
          placeholder="Select country"
          data={countries}
          value={addressForm.country_id}
          onChange={(value) => setAddressForm({ ...addressForm, country_id: value || '' })}
          searchable
          clearable
          mb="sm"
        />
        <Group grow mb="sm">
          <TextInput
            label="City"
            placeholder="City"
            value={addressForm.city}
            onChange={(e) => setAddressForm({ ...addressForm, city: e.currentTarget.value })}
            style={{ flex: 2 }}
          />
          <TextInput
            label="Postal Code"
            placeholder="Postal code"
            value={addressForm.postal_code}
            onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.currentTarget.value })}
            style={{ flex: 1 }}
          />
        </Group>
        <TextInput
          label="Address"
          placeholder="Street address"
          value={addressForm.address}
          onChange={(e) => setAddressForm({ ...addressForm, address: e.currentTarget.value })}
          mb="sm"
        />
        <TextInput
          label="Description"
          placeholder="Notes about this address"
          value={addressForm.description}
          onChange={(e) => setAddressForm({ ...addressForm, description: e.currentTarget.value })}
          mb="sm"
        />
        <TextInput
          label="Contact"
          placeholder="Contact person"
          value={addressForm.contact}
          onChange={(e) => setAddressForm({ ...addressForm, contact: e.currentTarget.value })}
          mb="sm"
        />
        <TextInput
          label="Email"
          placeholder="Email"
          value={addressForm.email}
          onChange={(e) => setAddressForm({ ...addressForm, email: e.currentTarget.value })}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={closeAddressModal}>
            Cancel
          </Button>
          <Button onClick={handleSaveAddress}>Save</Button>
        </Group>
      </Modal>

      {/* Contact Modal */}
      <Modal opened={contactModalOpened} onClose={closeContactModal} title={editingContactIndex !== null ? 'Edit Contact' : 'Add Contact'} size="lg">
        <TextInput
          label="Name"
          placeholder="Contact name"
          required
          value={contactForm.name}
          onChange={(e) => setContactForm({ ...contactForm, name: e.currentTarget.value })}
          mb="sm"
        />
        <TextInput
          label="Role"
          placeholder="e.g., Project Manager"
          value={contactForm.role}
          onChange={(e) => setContactForm({ ...contactForm, role: e.currentTarget.value })}
          mb="sm"
        />
        <TextInput
          label="Phone"
          placeholder="Phone number"
          value={contactForm.phone}
          onChange={(e) => setContactForm({ ...contactForm, phone: e.currentTarget.value })}
          mb="sm"
        />
        <TextInput
          label="Email"
          placeholder="Email"
          value={contactForm.email}
          onChange={(e) => setContactForm({ ...contactForm, email: e.currentTarget.value })}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={closeContactModal}>
            Cancel
          </Button>
          <Button onClick={handleSaveContact}>Save</Button>
        </Group>
      </Modal>



      {/* Create Product Modal */}
      <Modal opened={createProductModalOpened} onClose={closeCreateProductModal} title="Create New Product" size="lg">
        <TextInput
          label="Name"
          placeholder="Product name"
          required
          value={newProductForm.name}
          onChange={(e) => setNewProductForm({ ...newProductForm, name: e.currentTarget.value })}
          mb="sm"
        />
        <TextInput
          label="IPN"
          placeholder="Internal Part Number"
          required
          value={newProductForm.ipn}
          onChange={(e) => setNewProductForm({ ...newProductForm, ipn: e.currentTarget.value })}
          mb="sm"
        />
        <TextInput
          label="Unit of Measure"
          placeholder="e.g. buc"
          required
          value={newProductForm.um}
          onChange={(e) => setNewProductForm({ ...newProductForm, um: e.currentTarget.value })}
          mb="sm"
        />
        <NumberInput
          label="Minimum Stock"
          placeholder="0"
          value={newProductForm.minimum_stock}
          onChange={(value) => setNewProductForm({ ...newProductForm, minimum_stock: Number(value) || 0 })}
          mb="sm"
        />
        <Checkbox
          label="Lotallexp"
          checked={newProductForm.lotallexp}
          onChange={(e) => setNewProductForm({ ...newProductForm, lotallexp: e.currentTarget.checked })}
          mb="lg"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={closeCreateProductModal}>Cancel</Button>
          <Button onClick={handleCreateNewProduct}>Create & Link</Button>
        </Group>
      </Modal>
    </Container >
  );
}

