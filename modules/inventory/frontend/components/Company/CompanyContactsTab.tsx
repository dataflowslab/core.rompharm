
import React from 'react';
import { Tabs, Group, Title, Button, Table, ActionIcon } from '@mantine/core';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';

interface Contact {
    name: string;
    role?: string;
    phone?: string;
    email?: string;
}

interface CompanyContactsTabProps {
    contacts: Contact[];
    handleAddContact: () => void;
    handleEditContact: (index: number) => void;
    handleDeleteContact: (index: number) => void;
}

export function CompanyContactsTab({
    contacts,
    handleAddContact,
    handleEditContact,
    handleDeleteContact
}: CompanyContactsTabProps) {
    return (
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
                    {contacts?.map((contact, index) => (
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
    );
}
