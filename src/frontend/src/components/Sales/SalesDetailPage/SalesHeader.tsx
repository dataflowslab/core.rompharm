import { Paper, Group, Title, Text, Badge, Button } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SalesOrder } from '../../../services/sales';

interface SalesHeaderProps {
    order: SalesOrder;
    statuses: any[];
    onStatusChange: (status: string | null) => void;
    issueAction?: () => void;
    completeAction?: () => void;
    isCompleted?: boolean;
}

export function SalesHeader({ order, statuses, onStatusChange, issueAction, completeAction, isCompleted }: SalesHeaderProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const getStatusColor = (status: number) => {
        switch (status) {
            case 10: return 'yellow'; // Pending
            case 20: return 'blue';   // In Progress
            case 30: return 'green';  // Shipped
            case 40: return 'red';    // Cancelled
            case 50: return 'gray';   // Lost
            case 60: return 'orange'; // Returned
            default: return 'gray';
        }
    };

    return (
        <>
            <Button
                leftSection={<IconArrowLeft size={16} />}
                variant="subtle"
                onClick={() => navigate('/sales')}
                mb="md"
            >
                {t('Back to Sales Orders')}
            </Button>

            <Paper shadow="sm" p="md" mb="md">
                <Group justify="space-between" mb="md">
                    <div>
                        <Title order={2}>{order.reference}</Title>
                        <Text size="sm" c="dimmed">
                            {t('Customer')}: {order.customer_detail?.name || order.customer || 'Unknown'}
                        </Text>
                    </div>
                    <Group>
                        <Badge size="lg" color={order.state_detail?.color || getStatusColor(order.status)}>
                            {order.state_detail?.name || order.status_text || t('Status')}
                        </Badge>
                        {issueAction && (
                            <Button color="green" variant="filled" onClick={issueAction}>
                                {t('Issue')}
                            </Button>
                        )}
                        {completeAction && !isCompleted && (
                            <Button color="teal" variant="outline" onClick={completeAction}>
                                {t('Complete')}
                            </Button>
                        )}
                    </Group>
                </Group>
            </Paper>
        </>
    );
}
