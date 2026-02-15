
import React from 'react';
import { Tabs, Group, Title, Button, Table, ActionIcon } from '@mantine/core';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';

interface Address {
    name: string;
    country?: string;
    city?: string;
    address?: string;
    contact?: string;
}

interface CompanyAddressesTabProps {
    addresses: Address[];
    handleAddAddress: () => void;
    handleEditAddress: (index: number) => void;
    handleDeleteAddress: (index: number) => void;
}

export function CompanyAddressesTab({
    addresses,
    handleAddAddress,
    handleEditAddress,
    handleDeleteAddress
}: CompanyAddressesTabProps) {
    return (
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
                    {addresses?.map((address, index) => (
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
    );
}
