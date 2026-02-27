import { Paper, Group, Text, Grid, Stack, Badge, Divider } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { SalesOrder } from '../../../services/sales';
import { DocumentGenerator } from '../../Common/DocumentGenerator';
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { salesService } from '../../../services/sales';

interface SalesDetailsTabProps {
    order: SalesOrder;
    approvalFlow?: any | null;
    documentTemplate?: string;
    onRefresh?: () => void;
}

export function SalesDetailsTab({ order, approvalFlow, documentTemplate, onRefresh }: SalesDetailsTabProps) {
    const { t } = useTranslation();

    const approvalStatus = approvalFlow?.status || 'pending';
    const getApprovalColor = (status: string) => {
        switch (status) {
            case 'approved': return 'green';
            case 'in_progress': return 'blue';
            default: return 'gray';
        }
    };

    const handleSign = async () => {
        if (!approvalFlow?._id) {
            notifications.show({ title: t('Error'), message: t('Approval flow missing'), color: 'red' });
            return;
        }
        try {
            await salesService.signApprovalFlow(approvalFlow._id);
            notifications.show({ title: t('Success'), message: t('Signed'), color: 'green' });
            onRefresh?.();
        } catch (err: any) {
            console.error(err);
            notifications.show({ title: t('Error'), message: err.response?.data?.detail || t('Failed to sign'), color: 'red' });
        }
    };

    return (
        <Grid gutter="md">
            <Grid.Col span={4}>
                <Stack gap="md">
                    <Paper shadow="sm" p="md" withBorder>
                        <Text fw={600} mb="sm">{t('Documents')}</Text>
                        {documentTemplate ? (
                            <DocumentGenerator
                                objectId={order._id}
                                templateCodes={[documentTemplate]}
                                templateNames={{ [documentTemplate]: t('Sales Order') }}
                            />
                        ) : (
                            <Text size="sm" c="dimmed">{t('No template configured')}</Text>
                        )}
                    </Paper>

                    <Paper shadow="sm" p="md" withBorder>
                        <Group justify="space-between" mb="sm">
                            <Text fw={600}>{t('Approval')}</Text>
                            <Badge color={getApprovalColor(approvalStatus)}>{approvalStatus}</Badge>
                        </Group>
                        {approvalFlow?.signatures?.length ? (
                            <Stack gap="xs">
                                {approvalFlow.signatures.map((sig: any, idx: number) => (
                                    <Group key={idx} justify="space-between">
                                        <Text size="sm">{sig.username}</Text>
                                        <Text size="xs" c="dimmed">
                                            {sig.signed_at ? new Date(sig.signed_at).toLocaleString() : ''}
                                        </Text>
                                    </Group>
                                ))}
                            </Stack>
                        ) : (
                            <Text size="sm" c="dimmed">{t('No signatures yet')}</Text>
                        )}
                        {approvalStatus !== 'approved' && (
                            <Button mt="sm" size="xs" onClick={handleSign} variant="filled">
                                {t('Sign / Approve')}
                            </Button>
                        )}
                    </Paper>
                </Stack>
            </Grid.Col>

            <Grid.Col span={8}>
                <Paper shadow="sm" p="md" withBorder>
                    <Group grow>
                        <div>
                            <Text size="sm" c="dimmed">{t('Reference')}</Text>
                            <Text fw={500}>{order.reference}</Text>
                        </div>
                        <div>
                            <Text size="sm" c="dimmed">{t('Customer')}</Text>
                            <Text fw={500}>{order.customer_detail?.name || order.customer || 'Unknown'}</Text>
                        </div>
                        <div>
                            <Text size="sm" c="dimmed">{t('Customer Reference')}</Text>
                            <Text fw={500}>{(order as any).customer_reference || '-'}</Text>
                        </div>
                    </Group>

                    <Group grow mt="md">
                        <div>
                            <Text size="sm" c="dimmed">{t('Issue Date')}</Text>
                            <Text>{order.issue_date || '-'}</Text>
                        </div>
                        <div>
                            <Text size="sm" c="dimmed">{t('Target Date')}</Text>
                            <Text>{order.target_date || '-'}</Text>
                        </div>
                        <div>
                            <Text size="sm" c="dimmed">{t('Destination')}</Text>
                            <Text>{(order as any).destination_detail?.name || '-'}</Text>
                        </div>
                    </Group>

                    <Group grow mt="md">
                        <div>
                            <Text size="sm" c="dimmed">{t('Currency')}</Text>
                            <Text>{(order as any).currency || 'EUR'}</Text>
                        </div>
                        <div>
                            <Text size="sm" c="dimmed">{t('Total Price')}</Text>
                            <Text fw={700} size="lg">{order.total_price || '-'}</Text>
                        </div>
                        <div>
                            <Text size="sm" c="dimmed">{t('Shipment Date')}</Text>
                            <Text>{order.shipment_date || '-'}</Text>
                        </div>
                    </Group>

                    {order.description && (
                        <div style={{ marginTop: '1rem' }}>
                            <Divider mb="xs" />
                            <Text size="sm" c="dimmed">{t('Description')}</Text>
                            <Text>{order.description}</Text>
                        </div>
                    )}

                    {order.notes && (
                        <div style={{ marginTop: '1rem' }}>
                            <Divider mb="xs" />
                            <Text size="sm" c="dimmed">{t('Notes')}</Text>
                            <Text>{order.notes}</Text>
                        </div>
                    )}
                </Paper>
            </Grid.Col>
        </Grid>
    );
}
