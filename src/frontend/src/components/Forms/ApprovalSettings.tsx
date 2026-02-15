import { useState, useEffect } from 'react';
import {
    Stack,
    Table,
    Button,
    Group,
    Select,
    ActionIcon,
    NumberInput,
    Checkbox,
    Text,
    Alert,
    Paper,
} from '@mantine/core';
import { IconPlus, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { notifications } from '@mantine/notifications';

interface User {
    id: string;
    _id?: string;
    username: string;
    firstname?: string;
    lastname?: string;
}

interface ApprovalUser {
    user_id: string;
    username: string;
}

export interface ApprovalSettingsData {
    enabled: boolean;
    min_signatures: number;
    can_sign: ApprovalUser[];
    must_sign: ApprovalUser[];
}

interface ApprovalSettingsProps {
    value: ApprovalSettingsData;
    onChange: (value: ApprovalSettingsData) => void;
}

export function ApprovalSettings({ value, onChange }: ApprovalSettingsProps) {
    const { t } = useTranslation();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<'can_sign' | 'must_sign'>('can_sign');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const response = await api.get('/api/users/');
            setUsers(response.data.results || response.data); // Handle both wrapped and unwrapped responses
        } catch (error) {
            notifications.show({
                title: t('Error'),
                message: t('Failed to load users'),
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleEnabledChange = (checked: boolean) => {
        onChange({
            ...value,
            enabled: checked,
        });
    };

    const handleMinSignaturesChange = (val: number | string) => {
        onChange({
            ...value,
            min_signatures: typeof val === 'number' ? val : parseInt(val) || 1,
        });
    };

    const handleAddUser = () => {
        if (!selectedUser) return;

        const user = users.find(u => u.id === selectedUser || u._id === selectedUser);
        if (!user) return;

        const approvalUser: ApprovalUser = {
            user_id: user.id || user._id || '',
            username: user.username,
        };

        // Check if user already exists in either list
        const existsInCanSign = value.can_sign.some(u => u.user_id === approvalUser.user_id);
        const existsInMustSign = value.must_sign.some(u => u.user_id === approvalUser.user_id);

        if (existsInCanSign || existsInMustSign) {
            notifications.show({
                title: t('Warning'),
                message: t('User already added'),
                color: 'yellow',
            });
            return;
        }

        if (selectedRole === 'can_sign') {
            onChange({
                ...value,
                can_sign: [...value.can_sign, approvalUser],
            });
        } else {
            onChange({
                ...value,
                must_sign: [...value.must_sign, approvalUser],
            });
        }

        setSelectedUser(null);
    };

    const handleRemoveUser = (userId: string, role: 'can_sign' | 'must_sign') => {
        if (role === 'can_sign') {
            onChange({
                ...value,
                can_sign: value.can_sign.filter(u => u.user_id !== userId),
            });
        } else {
            onChange({
                ...value,
                must_sign: value.must_sign.filter(u => u.user_id !== userId),
            });
        }
    };

    const getUserOptions = () => {
        return users.map(user => ({
            value: user.id || user._id || '',
            label: user.firstname && user.lastname
                ? `${user.firstname} ${user.lastname} (${user.username})`
                : user.username,
        }));
    };

    return (
        <Stack>
            <Checkbox
                label={t('Enable Approval Workflow')}
                description={t('Require signatures before submission can be approved')}
                checked={value.enabled}
                onChange={(e) => handleEnabledChange(e.currentTarget.checked)}
            />

            {value.enabled && (
                <>
                    <NumberInput
                        label={t('Minimum Number of Signatures')}
                        description={t('Minimum signatures required for approval')}
                        value={value.min_signatures}
                        onChange={handleMinSignaturesChange}
                        min={1}
                        max={20}
                        required
                    />

                    <Paper p="md" withBorder>
                        <Stack>
                            <Text fw={500}>{t('Add Signers')}</Text>
                            <Group>
                                <Select
                                    placeholder={t('Select user')}
                                    data={getUserOptions()}
                                    value={selectedUser}
                                    onChange={setSelectedUser}
                                    searchable
                                    style={{ flex: 1 }}
                                    disabled={loading}
                                />
                                <Select
                                    data={[
                                        { value: 'can_sign', label: t('Can Sign') },
                                        { value: 'must_sign', label: t('Must Sign') },
                                    ]}
                                    value={selectedRole}
                                    onChange={(val) => setSelectedRole(val as 'can_sign' | 'must_sign')}
                                    style={{ width: 150 }}
                                />
                                <Button
                                    leftSection={<IconPlus size={16} />}
                                    onClick={handleAddUser}
                                    disabled={!selectedUser}
                                >
                                    {t('Add')}
                                </Button>
                            </Group>
                        </Stack>
                    </Paper>

                    {(value.can_sign.length > 0 || value.must_sign.length > 0) && (
                        <Paper p="md" withBorder>
                            <Stack>
                                <Text fw={500}>{t('Signers')}</Text>
                                <Table>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>{t('User')}</Table.Th>
                                            <Table.Th>{t('Role')}</Table.Th>
                                            <Table.Th>{t('Actions')}</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {value.must_sign.map((user) => (
                                            <Table.Tr key={`must-${user.user_id}`}>
                                                <Table.Td>{user.username}</Table.Td>
                                                <Table.Td>
                                                    <Text c="red" fw={500}>{t('Must Sign')}</Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <ActionIcon
                                                        color="red"
                                                        variant="subtle"
                                                        onClick={() => handleRemoveUser(user.user_id, 'must_sign')}
                                                    >
                                                        <IconTrash size={16} />
                                                    </ActionIcon>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                        {value.can_sign.map((user) => (
                                            <Table.Tr key={`can-${user.user_id}`}>
                                                <Table.Td>{user.username}</Table.Td>
                                                <Table.Td>
                                                    <Text c="blue" fw={500}>{t('Can Sign')}</Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <ActionIcon
                                                        color="red"
                                                        variant="subtle"
                                                        onClick={() => handleRemoveUser(user.user_id, 'can_sign')}
                                                    >
                                                        <IconTrash size={16} />
                                                    </ActionIcon>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </Stack>
                        </Paper>
                    )}

                    {value.enabled && value.can_sign.length === 0 && value.must_sign.length === 0 && (
                        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
                            {t('No signers configured. Add at least one signer to enable approval workflow.')}
                        </Alert>
                    )}
                </>
            )}
        </Stack>
    );
}
