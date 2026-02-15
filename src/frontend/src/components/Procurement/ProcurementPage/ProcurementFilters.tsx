import { Grid, TextInput, Select } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconSearch } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { OrderState } from '../../../types/procurement';

interface ProcurementFiltersProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    statusFilter: string | null;
    setStatusFilter: (status: string | null) => void;
    dateFrom: Date | null;
    setDateFrom: (date: Date | null) => void;
    dateTo: Date | null;
    setDateTo: (date: Date | null) => void;
    orderStates: OrderState[];
}

export function ProcurementFilters({
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    orderStates,
}: ProcurementFiltersProps) {
    const { t } = useTranslation();

    return (
        <Grid mb="md" align="flex-end">
            <Grid.Col span={{ base: 12, md: 3.6 }}>
                <TextInput
                    placeholder={t('Search by reference, supplier, description...')}
                    leftSection={<IconSearch size={16} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </Grid.Col>

            <Grid.Col span={{ base: 6, md: 2.4 }}>
                <Select
                    placeholder={t('Choose state...')}
                    data={orderStates.map(s => ({ value: s._id, label: s.name }))}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    clearable
                />
            </Grid.Col>

            <Grid.Col span={{ base: 6, md: 1.8 }}>
                <DatePickerInput
                    placeholder={t('From')}
                    value={dateFrom}
                    onChange={setDateFrom}
                    clearable
                />
            </Grid.Col>

            <Grid.Col span={{ base: 6, md: 1.8 }}>
                <DatePickerInput
                    placeholder={t('To')}
                    value={dateTo}
                    onChange={setDateTo}
                    clearable
                />
            </Grid.Col>

            <Grid.Col span={{ base: 6, md: 2.4 }}>
                {/* Reserved for future filters */}
            </Grid.Col>
        </Grid>
    );
}
