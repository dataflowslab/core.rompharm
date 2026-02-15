import { useState } from 'react';
import { Modal, Grid, Select, TextInput, Textarea, Group, Button } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { procurementApi } from '../../../services/procurement';
import { Supplier, StockLocation } from '../../../types/procurement';

interface NewPurchaseOrderModalProps {
    opened: boolean;
    onClose: () => void;
    suppliers: Supplier[];
    stockLocations: StockLocation[];
    onOpenNewSupplier: () => void;
}

export function NewPurchaseOrderModal({
    opened,
    onClose,
    suppliers,
    stockLocations,
    onOpenNewSupplier,
}: NewPurchaseOrderModalProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        supplier_id: '',
        reference: '',
        description: '',
        supplier_reference: '',
        currency: 'EUR',
        issue_date: new Date(),
        target_date: null as Date | null,
        destination_id: '',
        notes: ''
    });

    const handleSupplierChange = (value: string | null) => {
        if (!value) {
            setFormData({ ...formData, supplier_id: '' });
            return;
        }

        // Find supplier by _id and get currency
        const supplier = suppliers.find(s => String(s._id) === value);
        const supplierCurrency = supplier?.currency || 'EUR';

        // Update both supplier_id and currency
        setFormData(prev => ({
            ...prev,
            supplier_id: value,
            currency: supplierCurrency
        }));
    };

    const handleSubmit = async () => {
        if (!formData.supplier_id) {
            notifications.show({
                title: t('Error'),
                message: t('Please select a supplier'),
                color: 'red'
            });
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                supplier_id: formData.supplier_id,
                reference: formData.reference || undefined,
                description: formData.description || undefined,
                supplier_reference: formData.supplier_reference || undefined,
                currency: formData.currency || undefined,
                issue_date: formData.issue_date ? formData.issue_date.toISOString().split('T')[0] : undefined,
                target_date: formData.target_date ? formData.target_date.toISOString().split('T')[0] : undefined,
                destination_id: formData.destination_id || undefined,
                notes: formData.notes || undefined
            };

            const response = await api.post(procurementApi.createPurchaseOrder(), payload);
            const newOrder = response.data;

            notifications.show({
                title: t('Success'),
                message: t('Purchase order created successfully'),
                color: 'green'
            });

            // Reset form
            setFormData({
                supplier_id: '',
                reference: '',
                description: '',
                supplier_reference: '',
                currency: 'EUR',
                issue_date: new Date(),
                target_date: null,
                destination_id: '',
                notes: ''
            });

            onClose();

            // Navigate to the new purchase order detail page
            navigate(`/procurement/${newOrder._id}`);
        } catch (error: any) {
            console.error('Failed to create purchase order:', error);

            // Extract error message from response
            let errorMessage = t('Failed to create purchase order');
            if (error.response?.data?.detail) {
                if (Array.isArray(error.response.data.detail)) {
                    // Handle validation errors array
                    errorMessage = error.response.data.detail.map((err: any) => {
                        if (err.loc && err.msg) {
                            return `${err.loc.join('.')}: ${err.msg}`;
                        }
                        return err.msg || JSON.stringify(err);
                    }).join(', ');
                } else if (typeof error.response.data.detail === 'string') {
                    errorMessage = error.response.data.detail;
                }
            }

            notifications.show({
                title: t('Error'),
                message: errorMessage,
                color: 'red',
                autoClose: 10000
            });
        } finally {
            setSubmitting(false);
        }
    };

    const supplierOptions = [
        ...suppliers.filter(s => s._id != null).map(s => ({
            value: String(s._id),
            label: s.name
        })),
        { value: '__new__', label: `➕ ${t('New supplier')}` }
    ];

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={t('New Purchase Order')}
            size="lg"
            centered
        >
            <Grid>
                <Grid.Col span={12}>
                    <Select
                        label={t('Supplier')}
                        placeholder={t('Select supplier')}
                        data={supplierOptions}
                        value={formData.supplier_id}
                        onChange={(value) => {
                            if (value === '__new__') {
                                onOpenNewSupplier();
                            } else {
                                handleSupplierChange(value);
                            }
                        }}
                        searchable
                        required
                    />
                </Grid.Col>

                <Grid.Col span={12}>
                    <TextInput
                        label={t('Supplier Reference')}
                        placeholder={t('Supplier order number')}
                        value={formData.supplier_reference}
                        onChange={(e) => setFormData({ ...formData, supplier_reference: e.target.value })}
                    />
                </Grid.Col>

                <Grid.Col span={12}>
                    <TextInput
                        label={t('Description')}
                        placeholder={t('Order description')}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                </Grid.Col>

                <Grid.Col span={12}>
                    <Select
                        label={t('Destination')}
                        placeholder={t('Select stock location')}
                        data={stockLocations.filter(loc => (loc.pk || loc._id) != null).map(loc => ({
                            value: String(loc.pk || loc._id),
                            label: loc.name
                        }))}
                        value={formData.destination_id}
                        onChange={(value) => setFormData({ ...formData, destination_id: value || '' })}
                        searchable
                    />
                </Grid.Col>

                <Grid.Col span={6}>
                    <DatePickerInput
                        label={t('Order Date')}
                        placeholder={t('Select date')}
                        value={formData.issue_date}
                        onChange={(value) => setFormData({ ...formData, issue_date: value || new Date() })}
                    />
                </Grid.Col>

                <Grid.Col span={6}>
                    <DatePickerInput
                        label={t('Target Date')}
                        placeholder={t('Select date')}
                        value={formData.target_date}
                        onChange={(value) => setFormData({ ...formData, target_date: value })}
                    />
                </Grid.Col>

                <Grid.Col span={12}>
                    <Textarea
                        label={t('Notes')}
                        placeholder={t('Additional notes')}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        minRows={3}
                    />
                </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={onClose}>
                    {t('Cancel')}
                </Button>
                <Button onClick={handleSubmit} loading={submitting}>
                    {t('Create')}
                </Button>
            </Group>
        </Modal>
    );
}
