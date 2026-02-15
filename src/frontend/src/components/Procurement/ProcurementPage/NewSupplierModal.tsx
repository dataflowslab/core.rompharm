import { useState } from 'react';
import { Modal, Grid, TextInput, Checkbox, Group, Button } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import api from '../../../services/api';
import { procurementApi } from '../../../services/procurement';
import { ApiSelect } from '../../Common/ApiSelect';
import { Supplier } from '../../../types/procurement';

interface NewSupplierModalProps {
    opened: boolean;
    onClose: () => void;
    onSuccess: (newSupplier: Supplier) => void;
}

export function NewSupplierModal({ opened, onClose, onSuccess }: NewSupplierModalProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);

    const [newSupplierData, setNewSupplierData] = useState({
        name: '',
        currency: 'EUR',
        tax_id: '',
        is_supplier: true,
        is_manufacturer: false,
        cod: '',
        reg_code: '',
        address: '',
        country: '',
        city: ''
    });

    const handleCreateSupplier = async () => {
        if (!newSupplierData.name) {
            notifications.show({
                title: t('Error'),
                message: t('Company name is required'),
                color: 'red'
            });
            return;
        }

        setSubmitting(true);
        try {
            const response = await api.post(procurementApi.createSupplier(), newSupplierData);
            const newSupplier = response.data;

            notifications.show({
                title: t('Success'),
                message: t('Supplier created successfully'),
                color: 'green'
            });

            onSuccess(newSupplier);

            // Reset form
            setNewSupplierData({
                name: '',
                currency: 'EUR',
                tax_id: '',
                is_supplier: true,
                is_manufacturer: false,
                cod: '',
                reg_code: '',
                address: '',
                country: '',
                city: ''
            });
            onClose();
        } catch (error: any) {
            console.error('Failed to create supplier:', error);
            notifications.show({
                title: t('Error'),
                message: error.response?.data?.detail || t('Failed to create supplier'),
                color: 'red'
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={t('New Supplier')}
            size="lg"
            centered
        >
            <Grid>
                <Grid.Col span={12}>
                    <TextInput
                        label={t('Company Name')}
                        placeholder={t('Enter company name')}
                        value={newSupplierData.name}
                        onChange={(e) => setNewSupplierData({ ...newSupplierData, name: e.target.value })}
                        required
                    />
                </Grid.Col>

                <Grid.Col span={6}>
                    <ApiSelect
                        label={t('Currency')}
                        endpoint="/api/currencies"
                        value={newSupplierData.currency}
                        onChange={(value) => setNewSupplierData({ ...newSupplierData, currency: value || 'EUR' })}
                        valueField="_id"
                        labelFormat={(item) => item.abrev ? `${item.name} (${item.abrev})` : item.name}
                        searchable
                    />
                </Grid.Col>

                <Grid.Col span={6}>
                    <TextInput
                        label={t('Tax ID')}
                        placeholder={t('Tax identification number')}
                        value={newSupplierData.tax_id}
                        onChange={(e) => setNewSupplierData({ ...newSupplierData, tax_id: e.target.value })}
                    />
                </Grid.Col>

                <Grid.Col span={6}>
                    <TextInput
                        label={t('Cod')}
                        placeholder={t('F001')}
                        value={newSupplierData.cod}
                        onChange={(e) => setNewSupplierData({ ...newSupplierData, cod: e.target.value })}
                    />
                </Grid.Col>

                <Grid.Col span={6}>
                    <TextInput
                        label={t('Registration No.')}
                        placeholder={t('J40/12345/2020')}
                        value={newSupplierData.reg_code}
                        onChange={(e) => setNewSupplierData({ ...newSupplierData, reg_code: e.target.value })}
                    />
                </Grid.Col>

                <Grid.Col span={12}>
                    <TextInput
                        label={t('Address')}
                        placeholder={t('Street address')}
                        value={newSupplierData.address}
                        onChange={(e) => setNewSupplierData({ ...newSupplierData, address: e.target.value })}
                    />
                </Grid.Col>

                <Grid.Col span={6}>
                    <TextInput
                        label={t('Country')}
                        placeholder={t('Country')}
                        value={newSupplierData.country}
                        onChange={(e) => setNewSupplierData({ ...newSupplierData, country: e.target.value })}
                    />
                </Grid.Col>

                <Grid.Col span={6}>
                    <TextInput
                        label={t('City')}
                        placeholder={t('City')}
                        value={newSupplierData.city}
                        onChange={(e) => setNewSupplierData({ ...newSupplierData, city: e.target.value })}
                    />
                </Grid.Col>

                <Grid.Col span={6}>
                    <Checkbox
                        label={t('Is Supplier')}
                        checked={newSupplierData.is_supplier}
                        onChange={(e) => setNewSupplierData({ ...newSupplierData, is_supplier: e.currentTarget.checked })}
                    />
                </Grid.Col>

                <Grid.Col span={6}>
                    <Checkbox
                        label={t('Is Manufacturer')}
                        checked={newSupplierData.is_manufacturer}
                        onChange={(e) => setNewSupplierData({ ...newSupplierData, is_manufacturer: e.currentTarget.checked })}
                    />
                </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={onClose}>
                    {t('Cancel')}
                </Button>
                <Button onClick={handleCreateSupplier} loading={submitting}>
                    {t('Create')}
                </Button>
            </Group>
        </Modal>
    );
}
