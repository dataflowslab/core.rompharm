import { Grid, Paper, Title, Group, Loader, Text, Table, Badge, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Recipe } from '../../../types/recipes';

interface RecipeJournalTabProps {
    recipe: Recipe;
    logs: any[];
    revisions: any[];
    displayLogsLoading: boolean;
    onNavigateRevision: (revId: string) => void;
}

export function RecipeJournalTab({
    recipe,
    logs,
    revisions,
    displayLogsLoading,
    onNavigateRevision,
}: RecipeJournalTabProps) {
    const { t } = useTranslation();

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    return (
        <>
            <Grid mt="md" gutter="md">
                {/* 2/3 - Logs Table */}
                <Grid.Col span={8}>
                    <Paper withBorder>
                        <Title order={5} p="md" style={{ borderBottom: '1px solid #dee2e6' }}>
                            {t('Change History')}
                        </Title>
                        {displayLogsLoading ? (
                            <Group justify="center" p="xl">
                                <Loader size="sm" />
                            </Group>
                        ) : logs.length === 0 ? (
                            <Text c="dimmed" p="md" ta="center">{t('No changes recorded yet')}</Text>
                        ) : (
                            <Table>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>{t('Date')}</Table.Th>
                                        <Table.Th>{t('Action')}</Table.Th>
                                        <Table.Th>{t('User')}</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {logs.map((log) => (
                                        <Table.Tr key={log._id}>
                                            <Table.Td><Text size="sm">{formatDate(log.timestamp)}</Text></Table.Td>
                                            <Table.Td><Badge>{log.action}</Badge></Table.Td>
                                            <Table.Td><Text size="sm">{log.user}</Text></Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        )}
                    </Paper>
                </Grid.Col>

                {/* 1/3 - Revisions List */}
                <Grid.Col span={4}>
                    <Paper withBorder>
                        <Title order={5} p="md" style={{ borderBottom: '1px solid #dee2e6' }}>
                            {t('Revisions')}
                        </Title>
                        <Stack gap="xs" p="md">
                            {revisions.map((rev) => (
                                <Paper
                                    key={rev._id}
                                    p="sm"
                                    withBorder
                                    style={{
                                        cursor: 'pointer',
                                        backgroundColor: rev.is_current ? '#e7f5ff' : 'transparent'
                                    }}
                                    onClick={() => onNavigateRevision(rev._id)}
                                >
                                    <Group justify="space-between">
                                        <Text fw={500}>Rev {rev.rev}</Text>
                                        {rev.is_current && <Badge color="blue" size="sm">{t('Current')}</Badge>}
                                    </Group>
                                    <Text size="xs" c="dimmed">{formatDate(rev.rev_date)}</Text>
                                    <Text size="xs" c="dimmed">{rev.updated_by}</Text>
                                </Paper>
                            ))}
                        </Stack>
                    </Paper>
                </Grid.Col>
            </Grid>

            {/* Recipe Info */}
            <Paper p="md" withBorder mt="md">
                <Stack gap="xs">
                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                            {t('Created')}:
                        </Text>
                        <Text size="sm">
                            {formatDate(recipe.created_at)} {t('by')} {recipe.created_by}
                        </Text>
                    </Group>
                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                            {t('Updated')}:
                        </Text>
                        <Text size="sm">
                            {formatDate(recipe.updated_at)} {t('by')} {recipe.updated_by}
                        </Text>
                    </Group>
                </Stack>
            </Paper>
        </>
    );
}
