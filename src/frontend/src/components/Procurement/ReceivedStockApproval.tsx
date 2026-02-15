import { Paper, Title, Stack, Select, Textarea, Button, Text, Group, ActionIcon } from '@mantine/core';
import { IconSignature, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../utils/dateFormat';
import { ApprovalFlow } from '../../types/procurement';

interface ReceivedStockApprovalProps {
    approvalFlow: ApprovalFlow | null;
    targetStateId: string;
    setTargetStateId: (value: string) => void;
    availableStates: { value: string; label: string }[];
    refusalComments: string;
    setRefusalComments: (value: string) => void;
    onSign: () => void;
    onRemoveSignature: (userId: string, username: string) => void;
    signing: boolean;
    canModifyStock: boolean;
}

export function ReceivedStockApproval({
    approvalFlow,
    targetStateId,
    setTargetStateId,
    availableStates,
    refusalComments,
    setRefusalComments,
    onSign,
    onRemoveSignature,
    signing,
    canModifyStock
}: ReceivedStockApprovalProps) {
    const { t } = useTranslation();
    const hasSignatures = approvalFlow && approvalFlow.signatures && approvalFlow.signatures.length > 0;

    return (
        <Paper p="md" withBorder>
            <Title order={5} mb="md">{t('Approval')}</Title>

            {!hasSignatures ? (
                <Stack gap="sm">
                    <Select
                        label={t('Target State')}
                        placeholder={t('Select state')}
                        value={targetStateId}
                        onChange={(value) => {
                            setTargetStateId(value || '');
                        }}
                        data={availableStates}
                        required
                    />

                    {(() => {
                        const selectedState = availableStates.find(s => s.value === targetStateId);
                        const isRefused = selectedState?.label?.toLowerCase().includes('refused') ||
                            selectedState?.label?.toLowerCase().includes('refuz');
                        return isRefused ? (
                            <Textarea
                                label={t('Comments')}
                                placeholder={t('Please provide a reason for refusal')}
                                value={refusalComments}
                                onChange={(e) => setRefusalComments(e.currentTarget.value)}
                                required
                                minRows={3}
                                error={!refusalComments ? t('Comments are required for refusal') : undefined}
                            />
                        ) : null;
                    })()}

                    <Button
                        leftSection={<IconSignature size={16} />}
                        onClick={onSign}
                        loading={signing}
                        fullWidth
                        color="blue"
                    >
                        {t('Sign')}
                    </Button>
                </Stack>
            ) : (
                <Stack gap="sm">
                    <Text size="sm" fw={500}>{t('Signatures')}</Text>
                    {approvalFlow?.signatures.map((sig) => (
                        <Group key={sig.user_id} justify="space-between">
                            <div>
                                <Text size="sm">{sig.user_name || sig.username}</Text>
                                <Text size="xs" c="dimmed">{formatDateTime(sig.signed_at)}</Text>
                            </div>
                            {canModifyStock && (
                                <ActionIcon
                                    color="red"
                                    variant="subtle"
                                    onClick={() => onRemoveSignature(sig.user_id, sig.user_name || sig.username)}
                                    title={t('Remove')}
                                >
                                    <IconTrash size={16} />
                                </ActionIcon>
                            )}
                        </Group>
                    ))}
                </Stack>
            )}
        </Paper>
    );
}
