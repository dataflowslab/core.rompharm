
import React from 'react';
import { Tabs, Group, Title, Button, Table, ActionIcon, Select, TextInput } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

interface Part {
    _id: string;
    ipn: string;
    name: string;
    supplier_code?: string;
    supplier_currency?: string;
}

interface PartForm {
    part_id: string;
    supplier_code: string;
    currency: string;
}

interface CompanyArticlesTabProps {
    openCreateProductModal: () => void;
    allParts: Part[];
    partForm: PartForm;
    setPartForm: (form: PartForm) => void;
    parts: Part[];
    handleAddPart: () => void;
    handleDeletePart: (id: string, name: string) => void;
}

export function CompanyArticlesTab({
    openCreateProductModal,
    allParts,
    partForm,
    setPartForm,
    parts,
    handleAddPart,
    handleDeletePart
}: CompanyArticlesTabProps) {
    return (
        <Tabs.Panel value="articles" pt="md">
            <Group justify="space-between" mb="md">
                <Title order={4}>Articles</Title>
                <Button leftSection={<IconPlus size={16} />} onClick={openCreateProductModal}>
                    New Product
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
                    <Table.Tr>
                        <Table.Td>
                            <Select
                                placeholder="Select article"
                                data={allParts.map((part) => ({ value: part._id, label: `${part.ipn} - ${part.name}` }))}
                                value={partForm.part_id}
                                onChange={(value: string | null) => setPartForm({ ...partForm, part_id: value || '' })}
                                searchable
                                clearable
                                style={{ minWidth: 200 }}
                            />
                        </Table.Td>
                        <Table.Td>
                            -
                        </Table.Td>
                        <Table.Td>
                            <TextInput
                                placeholder="Supplier Code"
                                value={partForm.supplier_code}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPartForm({ ...partForm, supplier_code: e.currentTarget.value })}
                            />
                        </Table.Td>
                        <Table.Td>
                            <Select
                                data={['EUR', 'USD', 'RON', 'GBP']}
                                value={partForm.currency}
                                onChange={(value: string | null) => setPartForm({ ...partForm, currency: value || 'EUR' })}
                                style={{ width: 100 }}
                            />
                        </Table.Td>
                        <Table.Td>
                            <ActionIcon variant="filled" color="blue" onClick={handleAddPart}>
                                <IconPlus size={16} />
                            </ActionIcon>
                        </Table.Td>
                    </Table.Tr>
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
    );
}
