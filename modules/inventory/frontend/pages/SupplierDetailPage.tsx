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

interface Supplier {
  _id: string;
  pk?: number;
  name: string;
  code?: string;
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
    code: '',
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
  const [partModalOpened, { open: openPartModal, close: closePartModal }] = useDisclosure(false);
  const [partForm, setPartForm] = useState({
    part_id: '',
    supplier_code: '',
    currency: 'EUR',
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
        code: data.code || '',
        vatno: data.vatno || '',
        regno: data.regno || '',
        payment_conditions: data.payment_conditions || '',
        delivery_conditions: data.delivery_conditions || '',
        bank_account: data.bank_account || '',
        currency_id: data.currency_id || '',
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
  const handleAddPart = () => {
    setPartForm({
      part_id: '',
      supplier_code: '',
      currency: 'EUR',
    });
    openPartModal();
  };

  const handleSavePart = async () => {
    try {
      await api.post(`/modules/inventory/api/suppliers/${id}/parts`, partForm);
      notifications.show({
        title: 'Success',
        message: 'Part added successfully',
        color: 'green',
      });
      closePartModal();
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

          <Tabs.Panel value="details" pt="md">
            <Group grow mb="sm">
              <TextInput
                label="Name"
                placeholder="Supplier name"
                required
                value={detailsForm.name}
                onChange={(e) => setDetailsForm({ ...detailsForm, name: e.currentTarget.value })}
                style={{ flex: 3 }}
              />
              <TextInput
                label="Code"
                placeholder="Auto-generated"
                value={detailsForm.code}
                disabled
                style={{ flex: 1 }}
              />
            </Group>

            <TextInput
              label="VAT Number"
              placeholder="VAT number"
              value={detailsForm.vatno}
              onChange={(e) => setDetailsForm({ ...detailsForm, vatno: e.currentTarget.value })}
              mb="sm"
            />

            <TextInput
              label="Registration Number"
              placeholder="Registration number"
              value={detailsForm.regno}
              onChange={(e) => setDetailsForm({ ...detailsForm, regno: e.currentTarget.value })}
              mb="sm"
            />

            <Group grow mb="sm" align="flex-start">
              <Textarea
                label="Delivery Conditions"
                placeholder="Delivery terms and conditions"
                value={detailsForm.delivery_conditions}
                onChange={(e) => setDetailsForm({ ...detailsForm, delivery_conditions: e.currentTarget.value })}
                minRows={3}
              />
              <NumberInput
                label="Payment Condition"
                placeholder="0"
                suffix=" zile"
                value={detailsForm.payment_conditions ? parseInt(detailsForm.payment_conditions) : 0}
                onChange={(value) => setDetailsForm({ ...detailsForm, payment_conditions: String(value || 0) })}
                min={0}
                allowNegative={false}
              />
            </Group>

            <TextInput
              label="Bank Account"
              placeholder="Bank account information"
              value={detailsForm.bank_account}
              onChange={(e) => setDetailsForm({ ...detailsForm, bank_account: e.currentTarget.value })}
              mb="sm"
            />

            <Select
              label="Currency"
              placeholder="Select currency"
              data={currencies}
              value={detailsForm.currency_id}
              onChange={(value) => setDetailsForm({ ...detailsForm, currency_id: value || '' })}
              searchable
              clearable
              mb="sm"
            />

            <Text size="sm" fw={500} mb="xs">
              Type *
            </Text>
            <Group mb="md">
              <Checkbox
                label="Supplier"
                checked={detailsForm.is_supplier}
                onChange={(e) => setDetailsForm({ ...detailsForm, is_supplier: e.currentTarget.checked })}
              />
              <Checkbox
                label="Manufacturer"
                checked={detailsForm.is_manufacturer}
                onChange={(e) => setDetailsForm({ ...detailsForm, is_manufacturer: e.currentTarget.checked })}
              />
              <Checkbox
                label="Client"
                checked={detailsForm.is_client}
                onChange={(e) => setDetailsForm({ ...detailsForm, is_client: e.currentTarget.checked })}
              />
            </Group>

            <Group justify="flex-end">
              <Button leftSection={<IconDeviceFloppy size={16} />} onClick={handleSaveDetails}>
                Save Changes
              </Button>
            </Group>
          </Tabs.Panel>

          <Tabs.Panel value="addresses" pt="md">
            <Group justify="space-between" mb="md">
              <Title order={4}>Addresses</Title>
              <Button leftSection={<IconPlus size={16} />} onClick={handleAddAddress}>
                Add Address
              </Button>
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Country</Table.Th>
                  <Table.Th>City</Table.Th>
                  <Table.Th>Address</Table.Th>
                  <Table.Th>Contact</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {supplier.addresses?.map((address, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{address.name}</Table.Td>
                    <Table.Td>{address.country || '-'}</Table.Td>
                    <Table.Td>{address.city || '-'}</Table.Td>
                    <Table.Td>{address.address || '-'}</Table.Td>
                    <Table.Td>{address.contact || '-'}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon variant="light" color="blue" onClick={() => handleEditAddress(index)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon variant="light" color="red" onClick={() => handleDeleteAddress(index)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          <Tabs.Panel value="contacts" pt="md">
            <Group justify="space-between" mb="md">
              <Title order={4}>Contacts</Title>
              <Button leftSection={<IconPlus size={16} />} onClick={handleAddContact}>
                Add Contact
              </Button>
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Phone</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {supplier.contacts?.map((contact, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{contact.name}</Table.Td>
                    <Table.Td>{contact.role || '-'}</Table.Td>
                    <Table.Td>{contact.phone || '-'}</Table.Td>
                    <Table.Td>{contact.email || '-'}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon variant="light" color="blue" onClick={() => handleEditContact(index)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon variant="light" color="red" onClick={() => handleDeleteContact(index)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          <Tabs.Panel value="articles" pt="md">
            <Group justify="space-between" mb="md">
              <Title order={4}>Articles</Title>
              <Button leftSection={<IconPlus size={16} />} onClick={handleAddPart}>
                Add Article
              </Button>
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>IPN</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Supplier Code</Table.Th>
                  <Table.Th>Currency</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {parts.map((part) => (
                  <Table.Tr key={part._id}>
                    <Table.Td>{part.ipn}</Table.Td>
                    <Table.Td>{part.name}</Table.Td>
                    <Table.Td>{part.supplier_code || '-'}</Table.Td>
                    <Table.Td>{part.supplier_currency || 'EUR'}</Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => handleDeletePart(part._id, part.name)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

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

      {/* Part Modal */}
      <Modal opened={partModalOpened} onClose={closePartModal} title="Add Article" size="lg">
        <Select
          label="Article"
          placeholder="Select article"
          required
          data={allParts.map((part) => ({ value: part._id, label: `${part.ipn} - ${part.name}` }))}
          value={partForm.part_id}
          onChange={(value) => setPartForm({ ...partForm, part_id: value || '' })}
          searchable
          mb="sm"
        />
        <TextInput
          label="Supplier Code"
          placeholder="Supplier's code for this article"
          value={partForm.supplier_code}
          onChange={(e) => setPartForm({ ...partForm, supplier_code: e.currentTarget.value })}
          mb="sm"
        />
        <Select
          label="Currency"
          placeholder="Currency"
          data={['EUR', 'USD', 'RON', 'GBP']}
          value={partForm.currency}
          onChange={(value) => setPartForm({ ...partForm, currency: value || 'EUR' })}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={closePartModal}>
            Cancel
          </Button>
          <Button onClick={handleSavePart}>Add</Button>
        </Group>
      </Modal>
    </Container>
  );
}
