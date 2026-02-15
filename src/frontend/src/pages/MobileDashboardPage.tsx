import { SimpleGrid, Paper, Text, ThemeIcon, Group, Title, Container } from '@mantine/core';
import { IconShoppingCart, IconTruckDelivery, IconBox, IconClipboardList } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function MobileDashboardPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const modules = [
        {
            title: t('Requests'),
            description: t('Transfers, Approvals'),
            icon: IconClipboardList,
            color: 'indigo',
            link: '/mobile/requests'
        },
        {
            title: t('Procurement'),
            description: t('Orders, Receiving'),
            icon: IconShoppingCart,
            color: 'blue',
            link: '/mobile/procurement'
        },
        // Placeholders for future modules
        {
            title: t('Sales'),
            description: t('Orders, Picking'),
            icon: IconTruckDelivery,
            color: 'green',
            link: '/mobile/sales'
        },
        {
            title: t('Inventory'),
            description: t('Stock, Transfers'),
            icon: IconBox,
            color: 'orange',
            link: '/mobile/inventory'
        }
    ];

    return (
        <Container size="xs" p={0}>
            <Title order={3} mb="lg">{t('Mobile Dashboard')}</Title>

            <SimpleGrid cols={1} spacing="md">
                {modules.map((item) => (
                    <Paper
                        key={item.title}
                        withBorder
                        p="md"
                        radius="md"
                        onClick={() => navigate(item.link)}
                        style={{ cursor: 'pointer' }}
                    >
                        <Group>
                            <ThemeIcon size="xl" radius="md" variant="light" color={item.color}>
                                <item.icon size={24} stroke={1.5} />
                            </ThemeIcon>
                            <div style={{ flex: 1 }}>
                                <Text fw={600} size="lg">{item.title}</Text>
                                <Text size="sm" c="dimmed">{item.description}</Text>
                            </div>
                        </Group>
                    </Paper>
                ))}
            </SimpleGrid>
        </Container>
    );
}
