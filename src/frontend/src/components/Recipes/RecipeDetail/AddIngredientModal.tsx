import { useState } from 'react';
import { Modal, Stack, Select, NumberInput, Checkbox, Textarea, Divider, Group, Button, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import api from '../../../services/api';
import { Part } from '../../../types/recipes';

interface AddIngredientModalProps {
    opened: boolean;
    onClose: () => void;
    recipeId: string;
    onSuccess: () => void;
}

export function AddIngredientModal({ opened, onClose, recipeId, onSuccess }: AddIngredientModalProps) {
    const { t } = useTranslation();

    // Form state
    const [itemType, setItemType] = useState<string>('1');
    const [selectedPart, setSelectedPart] = useState<string | null>(null);
    const [quantity, setQuantity] = useState<number>(1);
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [mandatory, setMandatory] = useState(true);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Search state
    const [parts, setParts] = useState<Part[]>([]);
    const [searchValue, setSearchValue] = useState('');

    const resetForm = () => {
        setItemType('1');
        setSelectedPart(null);
        setQuantity(1);
        setStartDate(new Date());
        setEndDate(null);
        setMandatory(true);
        setNotes('');
        setSearchValue('');
        setParts([]);
    };

    const handleClose = () => {
        onClose();
        resetForm();
    };

    const searchParts = async (query: string) => {
        if (!query || query.length < 2) {
            setParts([]);
            return;
        }

        try {
            const response = await api.get('/api/recipes/parts', {
                params: { search: query },
            });
            setParts(response.data);
        } catch (error) {
            console.error('Failed to search parts:', error);
        }
    };

    const handleAddItem = async () => {
        if (itemType === '1' && !selectedPart) {
            notifications.show({
                title: t('Error'),
                message: t('Please select a product'),
                color: 'red',
            });
            return;
        }

        setSaving(true);
        try {
            const itemData: any = {
                type: parseInt(itemType),
                mandatory,
                notes: notes || undefined,
            };

            if (itemType === '1') {
                itemData.product_id = parseInt(selectedPart!);
                itemData.q = quantity;
                itemData.start = startDate.toISOString();
                if (endDate) {
                    itemData.fin = endDate.toISOString();
                }
            }

            await api.post(`/api/recipes/${recipeId}/items`, itemData);

            notifications.show({
                title: t('Success'),
                message: t('Ingredient added successfully'),
                color: 'green',
            });

            handleClose();
            onSuccess();
        } catch (error: any) {
            console.error('Failed to add item:', error);
            notifications.show({
                title: t('Error'),
                message: error.response?.data?.detail || t('Failed to add ingredient'),
                color: 'red',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={handleClose}
            title={t('Add Ingredient')}
            size="lg"
        >
            <Stack gap="md">
                <Select
                    label={t('Type')}
                    data={[
                        { value: '1', label: t('Single Product') },
                        { value: '2', label: t('Alternative Group') },
                    ]}
                    value={itemType}
                    onChange={(value) => setItemType(value || '1')}
                />

                {itemType === '1' && (
                    <>
                        <Select
                            label={t('Product')}
                            placeholder={t('Search for product...')}
                            data={parts.map((part) => ({
                                value: String(part.id),
                                label: `${part.name} (${part.IPN})`,
                            }))}
                            value={selectedPart}
                            onChange={setSelectedPart}
                            onSearchChange={(query) => {
                                setSearchValue(query);
                                searchParts(query);
                            }}
                            searchValue={searchValue}
                            searchable
                            clearable
                            nothingFoundMessage={
                                searchValue.length < 2
                                    ? t('Type at least 2 characters')
                                    : t('No products found')
                            }
                        />

                        <NumberInput
                            label={t('Quantity')}
                            value={quantity}
                            onChange={(value) => setQuantity(Number(value) || 1)}
                            min={0}
                            step={0.1}
                        />

                        <DatePickerInput
                            label={t('Start Date')}
                            value={startDate}
                            onChange={(date) => setStartDate(date || new Date())}
                        />

                        <DatePickerInput
                            label={t('End Date')}
                            placeholder={t('Optional')}
                            value={endDate}
                            onChange={setEndDate}
                            clearable
                        />
                    </>
                )}

                {itemType === '2' && (
                    <Text size="sm" c="dimmed">
                        {t('After creating the group, you can add alternative products to it.')}
                    </Text>
                )}

                <Checkbox
                    label={t('Mandatory')}
                    checked={mandatory}
                    onChange={(e) => setMandatory(e.currentTarget.checked)}
                />

                <Textarea
                    label={t('Notes')}
                    placeholder={t('Optional notes...')}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    minRows={3}
                />

                <Divider />

                <Group justify="flex-end">
                    <Button
                        variant="default"
                        onClick={handleClose}
                    >
                        {t('Cancel')}
                    </Button>
                    <Button
                        leftSection={<IconDeviceFloppy size={16} />}
                        onClick={handleAddItem}
                        loading={saving}
                    >
                        {t('Add')}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
