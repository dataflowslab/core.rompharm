import { useState, useEffect } from 'react';
import {
    Modal,
    Button,
    NumberInput,
    Stack,
    Group,
    Text,
    Table,
    Center,
    Loader,
} from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../services/api';

interface PrintLabelsModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: Array<{ id: string; name?: string; code?: string }>;
    table: string; // 'depo_parts', 'depo_stocks', 'depo_locations'
}

export function PrintLabelsModal({ isOpen, onClose, items, table }: PrintLabelsModalProps) {
    const [generating, setGenerating] = useState(false);
    const [quantities, setQuantities] = useState<Record<string, number>>({});

    useEffect(() => {
        if (isOpen) {
            const initialQuantities: Record<string, number> = {};
            items.forEach((item) => {
                initialQuantities[item.id] = 1;
            });
            setQuantities(initialQuantities);
        }
    }, [isOpen]);

    const handleQuantityChange = (id: string, value: number) => {
        setQuantities((prev) => ({
            ...prev,
            [id]: value,
        }));
    };

    const handlePrint = async () => {
        setGenerating(true);
        try {
            const itemsToPrint = items.map((item) => ({
                id: item.id,
                quantity: quantities[item.id] || 1,
            }));

            const response = await api.post(
                '/modules/inventory/api/generate-labels-docu',
                {
                    table: table,
                    items: itemsToPrint,
                },
                {
                    responseType: 'blob',
                }
            );

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'labels.pdf');
            link.setAttribute('target', '_blank');
            document.body.appendChild(link);
            link.click();

            window.URL.revokeObjectURL(url);
            link.remove();

            notifications.show({
                title: 'Success',
                message: 'Labels generated successfully',
                color: 'green',
            });

            onClose();
        } catch (error) {
            console.error('Failed to generate labels:', error);
            notifications.show({
                title: 'Error',
                message: 'Failed to generate labels',
                color: 'red',
            });
        } finally {
            setGenerating(false);
        }
    };

    return (
        <Modal
            opened={isOpen}
            onClose={onClose}
            title={<Group gap="xs"><IconPrinter size={20} /><Text fw={700}>Print Labels</Text></Group>}
            size="lg"
            withCloseButton={!generating}
            closeOnEscape={!generating}
            closeOnClickOutside={!generating}
        >
            {generating ? (
                <Center py="xl">
                    <Stack gap="xs" align="center">
                        <Text fw={700}>Label engine working!</Text>
                        <Text size="xs" c="dimmed" ta="center">
                            Please don&apos;t close or refresh this page until it is done.
                        </Text>
                        <Loader size="md" mt="sm" />
                    </Stack>
                </Center>
            ) : (
                <Stack gap="md">
                    <Text size="sm" fw={500}>Items to Print</Text>
                    <Table striped>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Name / Code</Table.Th>
                                <Table.Th style={{ width: 120 }}>Quantity</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {items.map((item) => (
                                <Table.Tr key={item.id}>
                                    <Table.Td>
                                        <Text size="sm">{item.name || item.code || item.id}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <NumberInput
                                            value={quantities[item.id]}
                                            onChange={(val) => handleQuantityChange(item.id, Number(val) || 1)}
                                            min={1}
                                            size="xs"
                                        />
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>

                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={onClose} disabled={generating}>
                            Cancel
                        </Button>
                        <Button
                            leftSection={<IconPrinter size={16} />}
                            onClick={handlePrint}
                            loading={generating}
                            disabled={items.length === 0}
                        >
                            Generate PDF
                        </Button>
                    </Group>
                </Stack>
            )}
        </Modal>
    );
}
