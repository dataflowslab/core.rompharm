import { AppShell, Burger, Group, Image, Text, Button, Drawer, Stack, NavLink, Select } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLogout, IconHome, IconShoppingCart, IconTruckDelivery, IconBox, IconLanguage, IconClipboardList } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

interface Config {
    company_name: string;
    company_logo: string;
}

export function MobileLayout() {
    const { username, logout } = useAuth();
    const { t, i18n } = useTranslation();
    const [opened, { toggle, close }] = useDisclosure();
    const [config, setConfig] = useState<Config | null>(null);
    const [language, setLanguage] = useState<string>(i18n.language || 'en');
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/api/config/')
            .then((response) => setConfig(response.data))
            .catch((error) => console.error('Failed to load config:', error));
    }, []);

    const handleLogout = () => {
        logout();
    };

    const handleLanguageChange = (value: string | null) => {
        if (value) {
            setLanguage(value);
            i18n.changeLanguage(value);
        }
    };

    const menuItems = [
        { label: t('Dashboard'), icon: IconHome, link: '/mobile/dashboard' },
        { label: t('Requests'), icon: IconClipboardList, link: '/mobile/requests' },
        { label: t('Procurement'), icon: IconShoppingCart, link: '/mobile/procurement' },
        { label: t('Sales'), icon: IconTruckDelivery, link: '/mobile/sales' },
        { label: t('Inventory'), icon: IconBox, link: '/mobile/inventory' },
    ];

    return (
        <AppShell
            header={{ height: 60 }}
            padding="md"
        >
            <AppShell.Header style={{ backgroundColor: '#e8f3fc' }}>
                <Group h="100%" px="md" justify="space-between">
                    <Group>
                        <Burger opened={opened} onClick={toggle} size="sm" />
                        <Image
                            src={config?.company_logo || '/media/img/logo.svg'}
                            alt={config?.company_name || 'DataFlows Core'}
                            h={32}
                            w="auto"
                            fit="contain"
                            onClick={() => navigate('/mobile/dashboard')}
                            style={{ cursor: 'pointer' }}
                        />
                    </Group>
                    <Select
                        value={language}
                        onChange={handleLanguageChange}
                        data={[
                            { value: 'en', label: t('English') },
                            { value: 'ro', label: t('Rom??n??') },
                        ]}
                        leftSection={<IconLanguage size={16} />}
                        w={120}
                        size="xs"
                    />
                </Group>
            </AppShell.Header>

            <Drawer
                opened={opened}
                onClose={close}
                title={config?.company_name || 'Menu'}
                padding="md"
                size="75%"
            >
                <Stack gap="sm">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.link}
                            label={item.label}
                            leftSection={<item.icon size={20} stroke={1.5} />}
                            active={location.pathname.startsWith(item.link)}
                            onClick={() => {
                                navigate(item.link);
                                close();
                            }}
                            variant="light"
                        />
                    ))}

                    <Stack gap={2} mt="md">
                        <Text size="xs" c="dimmed">{t('Logged in as')}</Text>
                        <Text fw={700}>{username}</Text>
                    </Stack>

                    <Button
                        color="red"
                        variant="light"
                        fullWidth
                        leftSection={<IconLogout size={16} />}
                        onClick={handleLogout}
                        mt="xl"
                    >
                        {t('Logout')}
                    </Button>
                </Stack>
            </Drawer>

            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    );
}
