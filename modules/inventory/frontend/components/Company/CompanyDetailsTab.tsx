
import React from 'react';
import { Tabs, Group, TextInput, Textarea, NumberInput, Select, Text, Checkbox, Button } from '@mantine/core';
import { IconDeviceFloppy } from '@tabler/icons-react';

interface DetailsForm {
    name: string;
    vatno: string;
    regno: string;
    delivery_conditions: string;
    payment_conditions: string;
    bank_account: string;
    currency_id: string;
    is_supplier: boolean;
    is_manufacturer: boolean;
    is_client: boolean;
}

interface CompanyDetailsTabProps {
    detailsForm: DetailsForm;
    setDetailsForm: (form: DetailsForm) => void;
    currencies: { value: string; label: string }[];
    handleSaveDetails: () => void;
}

export function CompanyDetailsTab({
    detailsForm,
    setDetailsForm,
    currencies,
    handleSaveDetails
}: CompanyDetailsTabProps) {
    return (
        <Tabs.Panel value="details" pt="md">
            <Group grow mb="sm">
                <TextInput
                    label="Name"
                    placeholder="Manufacturer name"
                    required
                    value={detailsForm.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDetailsForm({ ...detailsForm, name: e.currentTarget.value })}
                    style={{ width: '100%' }}
                />
            </Group>

            <TextInput
                label="VAT Number"
                placeholder="VAT number"
                value={detailsForm.vatno}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDetailsForm({ ...detailsForm, vatno: e.currentTarget.value })}
                mb="sm"
            />

            <TextInput
                label="Registration Number"
                placeholder="Registration number"
                value={detailsForm.regno}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDetailsForm({ ...detailsForm, regno: e.currentTarget.value })}
                mb="sm"
            />

            <Group grow mb="sm" align="flex-start">
                <Textarea
                    label="Delivery Conditions"
                    placeholder="Delivery terms and conditions"
                    value={detailsForm.delivery_conditions}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDetailsForm({ ...detailsForm, delivery_conditions: e.currentTarget.value })}
                    minRows={3}
                />
                <NumberInput
                    label="Payment Condition"
                    placeholder="0"
                    suffix=" zile"
                    value={detailsForm.payment_conditions ? parseInt(detailsForm.payment_conditions) : 0}
                    onChange={(value: number | string) => setDetailsForm({ ...detailsForm, payment_conditions: String(value || 0) })}
                    min={0}
                    allowNegative={false}
                />
            </Group>

            <TextInput
                label="Bank Account"
                placeholder="Bank account information"
                value={detailsForm.bank_account}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDetailsForm({ ...detailsForm, bank_account: e.currentTarget.value })}
                mb="sm"
            />

            <Select
                label="Currency"
                placeholder="Select currency"
                data={currencies}
                value={detailsForm.currency_id}
                onChange={(value: string | null) => setDetailsForm({ ...detailsForm, currency_id: value || '' })}
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDetailsForm({ ...detailsForm, is_supplier: e.currentTarget.checked })}
                />
                <Checkbox
                    label="Manufacturer"
                    checked={detailsForm.is_manufacturer}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDetailsForm({ ...detailsForm, is_manufacturer: e.currentTarget.checked })}
                />
                <Checkbox
                    label="Client"
                    checked={detailsForm.is_client}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDetailsForm({ ...detailsForm, is_client: e.currentTarget.checked })}
                />
            </Group>

            <Group justify="flex-end">
                <Button leftSection={<IconDeviceFloppy size={16} />} onClick={handleSaveDetails}>
                    Save Changes
                </Button>
            </Group>
        </Tabs.Panel>
    );
}
