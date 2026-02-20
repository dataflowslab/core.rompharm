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
  Modal,
  Text,
  Checkbox,
  TextInput,
  NumberInput,
  Select
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { api } from '../../../../src/frontend/src/services/api';

import { CompanyDetailsTab } from '../components/Company/CompanyDetailsTab';
import { CompanyAddressesTab } from '../components/Company/CompanyAddressesTab';
import { CompanyContactsTab } from '../components/Company/CompanyContactsTab';
import { CompanyArticlesTab } from '../components/Company/CompanyArticlesTab';

interface Manufacturer {
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
  ipn: string;
  name: string;
  supplier_code?: string;
  supplier_currency?: string;
}

export function ManufacturerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | null>('details');
  const [loading, setLoading] = useState(false);
  const [manufacturer, setManufacturer] = useState<Manufacturer | null>(null);

  // Form states
  const [detailsForm, setDetailsForm] = useState({
    name: '',
    vatno: '',
    regno: '',
    delivery_conditions: '',
    payment_conditions: '',
    bank_account: '',
    currency_id: '',
    is_supplier: false,
    is_manufacturer: false,
    is_client: false,
  });

  // Modal states
  const [addressModalOpened, { open: openAddressModal, close: closeAddressModal }] = useDisclosure(false);
  const [contactModalOpened, { open: openContactModal, close: closeContactModal }] = useDisclosure(false);
  const [createProductModalOpened, { open: openCreateProductModal, close: closeCreateProductModal }] = useDisclosure(false);

  // Editing states
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState<Address>({
    name: '',
    country: '',
    country_id: '',
    city: '',
    postal_code: '',
    address: '',
    description: '',
    contact: '',
    email: ''
  });

  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState<Contact>({
    name: '',
    role: '',
    phone: '',
    email: ''
  });

  // Products/Parts
  const [parts, setParts] = useState<Part[]>([]);
  const [allParts, setAllParts] = useState<Part[]>([]);
  const [partForm, setPartForm] = useState({
    part_id: '',
    supplier_code: '',
    currency: 'EUR'
  });

  const [newProductForm, setNewProductForm] = useState({
    name: '',
    ipn: '',
    um: '',
    minimum_stock: 0,
    lotallexp: false
  });

  const [currencies] = useState(['EUR', 'USD', 'RON', 'GBP']); // Mock currencies
  const [countries, setCountries] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    fetchData();
    fetchCountries();
    fetchAllParts();
  }, [id]);

  const fetchCountries = async () => {
    try {
      const response = await api.get('/modules/inventory/api/countries');
      setCountries(response.data.map((c: any) => ({ value: c._id, label: c.name })));
    } catch (error) {
      console.error("Failed to fetch countries", error);
    }
  };

  const fetchAllParts = async () => {
    try {
      const response = await api.get('/modules/inventory/api/articles?limit=1000');
      setAllParts(response.data.results || []);
    } catch (error) {
      console.error("Failed to fetch parts", error);
    }
  };

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      if (id === 'new') {
        setManufacturer({
          _id: 'new',
          name: 'New Manufacturer',
          is_supplier: false,
          is_manufacturer: true,
          is_client: false,
          addresses: [],
          contacts: []
        });
      } else {
        const response = await api.get(`/modules/inventory/api/manufacturers/${id}`);
        const data = response.data;
        setManufacturer(data);
        setDetailsForm({
          name: data.name || '',
          vatno: data.vatno || '',
          regno: data.regno || '',
          delivery_conditions: data.delivery_conditions || '',
          payment_conditions: data.payment_conditions || '',
          bank_account: data.bank_account || '',
          currency_id: data.currency_id || '',
          is_supplier: data.is_supplier || false,
          is_manufacturer: data.is_manufacturer || false,
          is_client: data.is_client || false,
        });

        // For now simulating parts, as the original fetchManufacturerParts was removed
        // In a real scenario, you'd fetch parts related to this manufacturer here.
        const partsResponse = await api.get(`/modules/inventory/api/suppliers/${id}/parts`);
        setParts(partsResponse.data || []);
      }
    } catch (error) {
      console.error(error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load manufacturer details',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!manufacturer) return;

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
      const payload = { ...detailsForm };

      let response;
      if (id === 'new') {
        response = await api.post('/modules/inventory/api/manufacturers', payload);
        notifications.show({
          title: 'Success',
          message: 'Manufacturer created successfully',
          color: 'green',
        });
        navigate(`/inventory/manufacturers/${response.data._id}`);
      } else {
        await api.put(`/modules/inventory/api/manufacturers/${id}`, payload);
        notifications.show({
          title: 'Success',
          message: 'Details saved successfully',
          color: 'green',
        });
      }

      fetchData();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to save details',
        color: 'red',
      });
    }
  };

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
      email: ''
    });
    openAddressModal();
  };

  const handleEditAddress = (index: number) => {
    if (!manufacturer?.addresses) return;
    setEditingAddressIndex(index);
    setAddressForm({ ...manufacturer.addresses[index] });
    openAddressModal();
  };

  const handleSaveAddress = async () => {
    if (!manufacturer) return;

    const newAddresses = [...(manufacturer.addresses || [])];
    const currentAddressForm = { ...addressForm };

    // Identify country name
    const countryObj = countries.find(c => c.value === currentAddressForm.country_id);
    if (countryObj) {
      currentAddressForm.country = countryObj.label;
    } else {
      currentAddressForm.country = ''; // Clear if no country selected
    }

    if (editingAddressIndex !== null) {
      newAddresses[editingAddressIndex] = currentAddressForm;
    } else {
      newAddresses.push(currentAddressForm);
    }

    try {
      await api.put(`/modules/inventory/api/manufacturers/${id}`, { addresses: newAddresses });
      closeAddressModal();
      fetchData();
      notifications.show({ title: 'Success', message: 'Address saved', color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Error', message: 'Failed to save address', color: 'red' });
    }
  };

  const handleDeleteAddress = async (index: number) => {
    if (!manufacturer || !manufacturer.addresses) return;

    modals.openConfirmModal({
      title: 'Delete Address',
      children: <Text>Are you sure you want to delete this address?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const newAddresses = manufacturer.addresses!.filter((_, i) => i !== index);
        try {
          await api.put(`/modules/inventory/api/manufacturers/${id}`, { addresses: newAddresses });
          fetchData();
          notifications.show({ title: 'Success', message: 'Address deleted', color: 'green' });
        } catch (error) {
          notifications.show({ title: 'Error', message: 'Failed to delete address', color: 'red' });
        }
      },
    });
  };

  const handleAddContact = () => {
    setEditingContactIndex(null);
    setContactForm({ name: '', role: '', phone: '', email: '' });
    openContactModal();
  };

  const handleEditContact = (index: number) => {
    if (!manufacturer?.contacts) return;
    setEditingContactIndex(index);
    setContactForm({ ...manufacturer.contacts[index] });
    openContactModal();
  };

  const handleSaveContact = async () => {
    if (!manufacturer) return;

    const newContacts = [...(manufacturer.contacts || [])];
    if (editingContactIndex !== null) {
      newContacts[editingContactIndex] = contactForm;
    } else {
      newContacts.push(contactForm);
    }

    try {
      await api.put(`/modules/inventory/api/manufacturers/${id}`, { contacts: newContacts });
      closeContactModal();
      fetchData();
      notifications.show({ title: 'Success', message: 'Contact saved', color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Error', message: 'Failed to save contact', color: 'red' });
    }
  };

  const handleDeleteContact = async (index: number) => {
    if (!manufacturer || !manufacturer.contacts) return;

    modals.openConfirmModal({
      title: 'Delete Contact',
      children: <Text>Are you sure you want to delete this contact?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const newContacts = manufacturer.contacts!.filter((_, i) => i !== index);
        try {
          await api.put(`/modules/inventory/api/manufacturers/${id}`, { contacts: newContacts });
          fetchData();
          notifications.show({ title: 'Success', message: 'Contact deleted', color: 'green' });
        } catch (error) {
          notifications.show({ title: 'Error', message: 'Failed to delete contact', color: 'red' });
        }
      },
    });
  };

  const handleAddPart = async () => {
    if (!partForm.part_id) {
      notifications.show({ title: 'Error', message: 'Please select an article', color: 'red' });
      return;
    }

    try {
      await api.post(`/modules/inventory/api/suppliers/${id}/parts`, partForm);
      notifications.show({
        title: 'Success',
        message: 'Part added successfully',
        color: 'green',
      });
      setPartForm({
        part_id: '',
        supplier_code: '',
        currency: partForm.currency,
      });
      fetchData(); // Re-fetch manufacturer data to update parts list
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to add part',
        color: 'red',
      });
    }
  };

  const handleDeletePart = async (partId: string, partName: string) => {
    modals.openConfirmModal({
      title: 'Remove Part',
      children: (
        <Text size="sm">
          Are you sure you want to remove <strong>{partName}</strong> from this manufacturer?
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
          fetchData(); // Re-fetch manufacturer data to update parts list
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

  const handleCreateNewProduct = async () => {
    try {
      // 1. Create the article
      const articleResponse = await api.post('/modules/inventory/api/articles', {
        ...newProductForm,
        manufacturer_id: id, // key to link it implicitly
        is_active: true,
        is_component: true,
      });

      const newArticleId = articleResponse.data._id;

      // 2. Link it to this manufacturer as a supplier part
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
      setNewProductForm({
        name: '',
        ipn: '',
        um: '',
        minimum_stock: 0,
        lotallexp: false,
      });
      fetchData(); // Re-fetch manufacturer data to update parts list
      fetchAllParts(); // Re-fetch all parts to update the select dropdown
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to create product',
        color: 'red',
      });
    }
  };


  if (!manufacturer) {
    return (
      <Container size="xl">
        <LoadingOverlay visible={true} />
      </Container>
    );
  }

  const _idShort = manufacturer._id ? manufacturer._id.slice(-6) : '';

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>
          {manufacturer.name} <Text span c="dimmed" size="lg">({_idShort})</Text>
        </Title>
        <Button variant="default" onClick={() => navigate('/inventory/manufacturers')}>
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
            addresses={manufacturer.addresses || []}
            handleAddAddress={handleAddAddress}
            handleEditAddress={handleEditAddress}
            handleDeleteAddress={handleDeleteAddress}
          />

          <CompanyContactsTab
            contacts={manufacturer.contacts || []}
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
