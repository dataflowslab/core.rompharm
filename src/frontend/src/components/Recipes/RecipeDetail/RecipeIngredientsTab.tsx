import { Paper, Group, Title, Button, Table, Text, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { IconPlus, IconChevronDown, IconChevronRight, IconEdit, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Recipe, RecipeItem } from '../../../types/recipes';

interface RecipeIngredientsTabProps {
    recipe: Recipe;
    expandedGroups: Set<number>;
    toggleGroup: (index: number) => void;
    onAddIngredient: () => void;
    onEditItem: (item: RecipeItem, index: number, altIndex?: number) => void;
    onDeleteItem: (index: number) => void;
    onAddAlternative: (index: number) => void;
    onDeleteAlternative: (groupIndex: number, altIndex: number) => void;
}

export function RecipeIngredientsTab({
    recipe,
    expandedGroups,
    toggleGroup,
    onAddIngredient,
    onEditItem,
    onDeleteItem,
    onAddAlternative,
    onDeleteAlternative,
}: RecipeIngredientsTabProps) {
    const { t } = useTranslation();

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    const renderItemRow = (item: RecipeItem, index: number) => {
        const isGroup = item.type === 2;
        const isExpired = item.fin && new Date(item.fin) < new Date();
        const isActive = !isExpired && (!item.start || new Date(item.start) <= new Date());
        const isExpanded = expandedGroups.has(index);

        const rows = [];

        // Main row
        rows.push(
            <Table.Tr
                key={`main-${index}`}
                style={{
                    backgroundColor: isExpired ? '#f5f5f5' : (isActive ? '#f0fdf4' : 'transparent'),
                    opacity: isExpired ? 0.6 : 1,
                    cursor: isGroup ? 'pointer' : 'default'
                }}
                onClick={() => isGroup && toggleGroup(index)}
            >
                <Table.Td>
                    <Group gap="xs">
                        {isGroup && (
                            <ActionIcon size="sm" variant="subtle" color="gray">
                                {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                            </ActionIcon>
                        )}
                        {isGroup ? (
                            <Text fw={500}>
                                {t('Alternative Group')} ({item.items?.length || 0} {t('items')})
                            </Text>
                        ) : (
                            <Text>{item.part_detail?.name || `Product ${item.id}`}</Text>
                        )}
                    </Group>
                    {item.notes && (
                        <Text size="xs" c="dimmed" mt={4} ml={isGroup ? 28 : 0}>
                            {item.notes}
                        </Text>
                    )}
                </Table.Td>
                <Table.Td>
                    <Badge color={isGroup ? 'blue' : 'gray'}>
                        {isGroup ? t('Alternatives') : t('Single')}
                    </Badge>
                </Table.Td>
                <Table.Td>{isGroup ? '-' : item.q}</Table.Td>
                <Table.Td>{formatDate(item.start)}</Table.Td>
                <Table.Td>{formatDate(item.fin)}</Table.Td>
                <Table.Td>
                    <Badge color={item.mandatory ? 'green' : 'gray'}>
                        {item.mandatory ? t('Yes') : t('No')}
                    </Badge>
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Group gap="xs">
                        {!isGroup && (
                            <ActionIcon
                                color="blue"
                                variant="subtle"
                                onClick={() => onEditItem(item, index)}
                                title={t('Edit')}
                            >
                                <IconEdit size={16} />
                            </ActionIcon>
                        )}
                        {isGroup && (
                            <ActionIcon
                                color="green"
                                variant="subtle"
                                onClick={() => onAddAlternative(index)}
                                title={t('Add Alternative')}
                            >
                                <IconPlus size={16} />
                            </ActionIcon>
                        )}
                        <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() => onDeleteItem(index)}
                            title={t('Delete')}
                        >
                            <IconTrash size={16} />
                        </ActionIcon>
                    </Group>
                </Table.Td>
            </Table.Tr>
        );

        // Subrows for alternatives (if group is expanded)
        if (isGroup && isExpanded && item.items) {
            item.items.forEach((alt, altIndex) => {
                const altExpired = alt.fin && new Date(alt.fin) < new Date();
                const altActive = !altExpired && (!alt.start || new Date(alt.start) <= new Date());

                rows.push(
                    <Table.Tr
                        key={`alt-${index}-${altIndex}`}
                        style={{
                            backgroundColor: altExpired ? '#f8f8f8' : (altActive ? '#f7fef9' : '#fafafa'),
                            opacity: altExpired ? 0.5 : 0.9
                        }}
                    >
                        <Table.Td style={{ paddingLeft: '48px' }}>
                            <Text size="sm">↳ {alt.part_detail?.name || `Product ${alt.id}`}</Text>
                            {alt.notes && (
                                <Text size="xs" c="dimmed" mt={2}>
                                    {alt.notes}
                                </Text>
                            )}
                        </Table.Td>
                        <Table.Td>
                            <Badge size="sm" color="gray" variant="outline">{t('Alternative')}</Badge>
                        </Table.Td>
                        <Table.Td>{alt.q}</Table.Td>
                        <Table.Td><Text size="sm">{formatDate(alt.start)}</Text></Table.Td>
                        <Table.Td><Text size="sm">{formatDate(alt.fin)}</Text></Table.Td>
                        <Table.Td>-</Table.Td>
                        <Table.Td>
                            <Group gap="xs">
                                <ActionIcon
                                    color="blue"
                                    variant="subtle"
                                    size="sm"
                                    onClick={() => onEditItem(alt, index, altIndex)}
                                    title={t('Edit Alternative')}
                                >
                                    <IconEdit size={14} />
                                </ActionIcon>
                                <ActionIcon
                                    color="red"
                                    variant="subtle"
                                    size="sm"
                                    onClick={() => onDeleteAlternative(index, altIndex)}
                                    title={t('Delete Alternative')}
                                >
                                    <IconTrash size={14} />
                                </ActionIcon>
                            </Group>
                        </Table.Td>
                    </Table.Tr>
                );
            });
        }

        return rows;
    };

    return (
        <Paper withBorder mt="md">
            <Group justify="space-between" p="md" style={{ borderBottom: '1px solid #dee2e6' }}>
                <Title order={4}>{t('Ingredients')}</Title>
                <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={onAddIngredient}
                >
                    {t('Add Ingredient')}
                </Button>
            </Group>

            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>{t('Description')}</Table.Th>
                        <Table.Th>{t('Type')}</Table.Th>
                        <Table.Th>{t('Quantity')}</Table.Th>
                        <Table.Th>{t('Start Date')}</Table.Th>
                        <Table.Th>{t('End Date')}</Table.Th>
                        <Table.Th>{t('Mandatory')}</Table.Th>
                        <Table.Th style={{ width: '120px' }}>{t('Actions')}</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {recipe.items.length === 0 ? (
                        <Table.Tr>
                            <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                                <Text c="dimmed">{t('No ingredients added yet')}</Text>
                            </Table.Td>
                        </Table.Tr>
                    ) : (
                        // Sort items: active first (green), then expired (gray) at the end
                        [...recipe.items]
                            .map((item, originalIndex) => ({ item, originalIndex }))
                            .sort((a, b) => {
                                const aExpired = a.item.fin && new Date(a.item.fin) < new Date();
                                const bExpired = b.item.fin && new Date(b.item.fin) < new Date();
                                if (aExpired && !bExpired) return 1;  // a expired, move to end
                                if (!aExpired && bExpired) return -1; // b expired, move to end
                                return 0; // keep original order
                            })
                            .map(({ item, originalIndex }) => renderItemRow(item, originalIndex))
                    )}
                </Table.Tbody>
            </Table>
        </Paper>
    );
}
