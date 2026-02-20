import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Table,
  Button,
  Group,
  TextInput,
  ActionIcon,
  Modal,
  Checkbox,
  LoadingOverlay,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconEdit, IconTrash, IconSearch } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../src/frontend/src/services/api';
import { formatDate } from '../../../../src/frontend/src/utils/dateFormat';

interface Supplier {
  _id: string;
  name: string;

  vatno?: string;
  regno?: string;
  is_supplier: boolean;
  is_manufacturer: boolean;
  is_client: boolean;
  addresses?: Array<{
    name: string;
    country?: string;
    city?: string;
    address?: string;
  }>;
  created_at?: string;
}

export function SuppliersPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [opened, { open, close }] = useDisclosure(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',

    vatno: '',
    regno: '',
    payment_conditions: '',
    is_supplier: true,
    is_manufacturer: false,
    is_client: false,
  });

  useEffect(() => {
    fetchSuppliers();
  }, [search]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await api.get(`/modules/inventory/api/suppliers?${params.toString()}`);
      setSuppliers(response.data.results || []);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch suppliers',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    // Validate at least one checkbox is selected
    if (!formData.is_supplier && !formData.is_manufacturer && !formData.is_client) {
      notifications.show({
        title: 'Validation Error',
        message: 'At least one of Supplier, Manufacturer, or Client must be selected',
        color: 'red',
      });
      return;
    }

    try {
      await api.post('/modules/inventory/api/suppliers', formData);
      notifications.show({
        title: 'Success',
        message: 'Supplier created successfully',
        color: 'green',
      });
      close();
      resetForm();
      fetchSuppliers();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to create supplier',
        color: 'red',
      });
    }
  };

  const handleDelete = (id: string, name: string) => {
    modals.openConfirmModal({
      title: 'Delete Supplier',
      children: (
        <Text size="sm">
          Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.delete(`/modules/inventory/api/suppliers/${id}`);
          notifications.show({
            title: 'Success',
            message: 'Supplier deleted successfully',
            color: 'green',
          });
          fetchSuppliers();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: 'Failed to delete supplier',
            color: 'red',
          });
        }
      },
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',

      vatno: '',
      regno: '',
      payment_conditions: '',
      is_supplier: true,
      is_manufacturer: false,
      is_client: false,
    });
  };

  const openCreateModal = () => {
    resetForm();
    open();
  };

  const getCountry = (supplier: Supplier) => {
    if (supplier.addresses && supplier.addresses.length > 0) {
      return supplier.addresses[0].country || '-';
    }
    return '-';
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>Suppliers</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
          New Supplier
        </Button>
      </Group>

      <Paper p="md" mb="md">
        <TextInput
          placeholder="Search suppliers..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
      </Paper>

      <Paper p="md" pos="relative">
        <LoadingOverlay visible={loading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Country</Table.Th>
              <Table.Th>VAT</Table.Th>
              <Table.Th>Created on</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {suppliers.map((supplier) => (
              <Table.Tr key={supplier._id}>
                <Table.Td style={{ fontFamily: 'monospace', color: '#868e96' }}>
                  {supplier._id}
                </Table.Td>
                <Table.Td>{supplier.name}</Table.Td>
                <Table.Td>{getCountry(supplier)}</Table.Td>
                <Table.Td>{supplier.vatno || '-'}</Table.Td>
                <Table.Td>{formatDate(supplier.created_at)}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      onClick={() => navigate(`/inventory/suppliers/${supplier._id}`)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => handleDelete(supplier._id, supplier.name)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal opened={opened} onClose={close} title="New Supplier" size="lg">
        <TextInput
          label="Name"
          placeholder="Supplier name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
          mb="sm"
        />



        <TextInput
          label="VAT Number"
          placeholder="VAT number"
          value={formData.vatno}
          onChange={(e) => setFormData({ ...formData, vatno: e.currentTarget.value })}
          mb="sm"
        />

        <TextInput
          label="Registration Number"
          placeholder="Registration number"
          value={formData.regno}
          onChange={(e) => setFormData({ ...formData, regno: e.currentTarget.value })}
          mb="sm"
        />

        <TextInput
          label="Payment Conditions"
          placeholder="e.g., 30 days"
          value={formData.payment_conditions}
          onChange={(e) => setFormData({ ...formData, payment_conditions: e.currentTarget.value })}
          mb="sm"
        />

        <Text size="sm" fw={500} mb="xs">
          Type *
        </Text>
        <Group mb="md">
          <Checkbox
            label="Supplier"
            checked={formData.is_supplier}
            onChange={(e) => setFormData({ ...formData, is_supplier: e.currentTarget.checked })}
          />
          <Checkbox
            label="Manufacturer"
            checked={formData.is_manufacturer}
            onChange={(e) => setFormData({ ...formData, is_manufacturer: e.currentTarget.checked })}
          />
          <Checkbox
            label="Client"
            checked={formData.is_client}
            onChange={(e) => setFormData({ ...formData, is_client: e.currentTarget.checked })}
          />
        </Group>

        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create</Button>
        </Group>
      </Modal>
    </Container>
  );
}
