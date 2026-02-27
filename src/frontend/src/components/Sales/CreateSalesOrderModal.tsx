import { useState, useEffect } from 'react';
import { Modal, Grid, TextInput, Textarea, Group, Button } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { SafeSelect } from '../Common';

interface CreateSalesOrderModalProps {
    opened: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function CreateSalesOrderModal({
    opened,
    onClose,
    onSuccess
}: CreateSalesOrderModalProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);

    const [customers, setCustomers] = useState<any[]>([]);

    // Load customers when modal opens
    useEffect(() => {
        if (opened) {
            loadCustomers();
        }
    }, [opened]);

    const loadCustomers = async () => {
        try {
            const response = await api.get('/api/sales/customers');
            setCustomers(response.data.results || response.data || []);
        } catch (error) {
            console.error('Failed to load customers:', error);
        }
    };

    const [formData, setFormData] = useState({
        customer_id: '',
        reference: '',
        description: '',
        customer_reference: '',
        currency: 'EUR',
        issue_date: new Date(),
        target_date: null as Date | null,
        notes: ''
    });

    const handleCustomerChange = (value: string | null) => {
        if (!value) {
            setFormData({ ...formData, customer_id: '' });
            return;
        }

        const customer = customers.find(c => String(c._id) === value);
        const customerCurrency = customer?.currency || 'EUR';

        setFormData(prev => ({
            ...prev,
            customer_id: value,
            currency: customerCurrency
        }));
    };

    const handleSubmit = async () => {
        if (!formData.customer_id) {
            notifications.show({
                title: t('Error'),
                message: t('Please select a customer'),
                color: 'red'
            });
            return;
        }

        setSubmitting(true);
        try {
        const payload = {
            customer_id: formData.customer_id,
            reference: formData.reference || undefined,
            description: formData.description || undefined,
            customer_reference: formData.customer_reference || undefined,
            currency: formData.currency || undefined,
            issue_date: formData.issue_date ? formData.issue_date.toISOString().split('T')[0] : undefined,
            target_date: formData.target_date ? formData.target_date.toISOString().split('T')[0] : undefined,
            notes: formData.notes || undefined
        };

        const response = await api.post('/api/sales/sales-orders', payload);
            const newOrder = response.data;

            notifications.show({
                title: t('Success'),
                message: t('Sales order created successfully'),
                color: 'green'
            });

            // Reset form
            setFormData({
                customer_id: '',
                reference: '',
                description: '',
                customer_reference: '',
            currency: 'EUR',
            issue_date: new Date(),
            target_date: null,
            notes: ''
        });

            onClose();
            if (onSuccess) onSuccess();

            // Navigate to the new sales order detail page
            navigate(`/sales/${newOrder._id}`);
        } catch (error: any) {
            console.error('Failed to create sales order:', error);

            let errorMessage = t('Failed to create sales order');
            if (error.response?.data?.detail) {
                if (typeof error.response.data.detail === 'string') {
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

    const customerOptions = customers.map(c => ({
        value: String(c._id),
        label: c.name
    }));

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={t('New Sales Order')}
            size="lg"
            centered
        >
            <Grid>
                <Grid.Col span={12}>
                    <SafeSelect
                        label={t('Customer')}
                        placeholder={t('Select customer')}
                        data={customerOptions}
                        value={formData.customer_id}
                        onChange={handleCustomerChange}
                        searchable
                        required
                    />
                </Grid.Col>

                <Grid.Col span={12}>
                    <TextInput
                        label={t('Customer Reference')}
                        placeholder={t('Customer PO number / Reference')}
                        value={formData.customer_reference}
                        onChange={(e) => setFormData({ ...formData, customer_reference: e.target.value })}
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

            <Grid.Col span={6}>
                <DatePickerInput
                    label={t('Issue Date')}
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
