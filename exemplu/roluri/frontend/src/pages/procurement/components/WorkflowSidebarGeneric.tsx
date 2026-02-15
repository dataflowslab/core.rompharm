/**
 * WorkflowSidebarGeneric - Generic workflow sidebar for simple approval flows
 * Uses approval flows system without A/B/C assumptions.
 */
import { Stack, Text, Paper } from '@mantine/core';
import { ApprovalFlowBox } from './ApprovalFlowBox';
import { useApprovalFlows } from '../hooks/useApprovalFlows';

interface WorkflowSidebarGenericProps {
  document: {
    _id: string;
    stare?: string;
    stare_id?: string;
  };
  docType: string;
  title?: string;
  onRefresh?: () => void;
  autoCreate?: boolean;
}

export function WorkflowSidebarGeneric({
  document,
  docType,
  title = 'Workflow Aprobare',
  onRefresh,
  autoCreate = true,
}: WorkflowSidebarGenericProps) {
  const {
    flows,
    loading,
    signing,
    canceling,
    loadFlows,
    signDocument,
    cancelDocument,
  } = useApprovalFlows({
    docType,
    docId: document._id,
    autoLoad: true,
    autoCreate,
  });

  const handleSign = async (flowType: string, notes?: string, substituteConfirmed?: boolean) => {
    await signDocument(flowType, notes, substituteConfirmed);
    if (onRefresh) onRefresh();
  };

  const handleCancelDocument = async (reason: string) => {
    await cancelDocument(reason);
    if (onRefresh) onRefresh();
  };

  if (loading && flows.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text size="sm" c="dimmed">Se încarcă workflow...</Text>
      </Paper>
    );
  }

  if (!loading && flows.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text size="sm" c="dimmed">Nu există fluxuri de aprobare</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      <Text fw={700} size="sm">{title}</Text>
      {flows.map((flow) => (
        <ApprovalFlowBox
          key={flow._id}
          title={flow.name || flow.object_type}
          flow={flow}
          canEdit={false}
          canSign={flow.can_sign}
          canCancel={!flow.is_completed && flow.can_sign}
          canRevert={false}
          isActive={!flow.is_completed}
          onSign={(notes, substituteConfirmed) => handleSign(flow.object_type, notes, substituteConfirmed)}
          onCancel={handleCancelDocument}
          signing={signing}
          canceling={canceling}
        />
      ))}
    </Stack>
  );
}
