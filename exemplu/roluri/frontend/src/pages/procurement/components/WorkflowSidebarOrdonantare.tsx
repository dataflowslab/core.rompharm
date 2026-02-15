/**
 * WorkflowSidebarOrdonantare - Workflow sidebar for ordonanțare (2 steps: A and B)
 */
import { Stack, Text, Paper } from '@mantine/core';
import { ApprovalFlowBox } from './ApprovalFlowBox';
import { useApprovalFlows } from '../hooks/useApprovalFlows';
import { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { notifications } from '@mantine/notifications';

interface WorkflowSidebarOrdonantareProps {
  document: {
    _id: string;
    stare: string;
    stare_id?: string;
  };
  onRefresh?: () => void;
}

export function WorkflowSidebarOrdonantare({
  document: doc,
  onRefresh,
}: WorkflowSidebarOrdonantareProps) {
  const {
    flows,
    loading,
    signing,
    canceling,
    reverting,
    signDocument,
    cancelDocument,
    revertToSection,
    getFlowByType,
    canSignFlow,
    isFlowCompleted,
  } = useApprovalFlows({
    docType: 'ordonantari',
    docId: doc._id,
    autoLoad: true,
  });

  // Track previous completion state to avoid infinite refresh loop
  const [previousCompletionState, setPreviousCompletionState] = useState<string>('');

  // Refresh parent only when a flow just completed (not on every render)
  useEffect(() => {
    if (onRefresh && flows.length > 0) {
      // Create a signature of completion states
      const completionSignature = flows
        .map(f => `${f.object_type}:${f.is_completed}`)
        .sort()
        .join('|');
      
      // Only refresh if completion state actually changed
      if (completionSignature !== previousCompletionState && previousCompletionState !== '') {
        // Check if any flow just became completed
        const anyCompleted = flows.some(f => f.is_completed);
        if (anyCompleted) {
          onRefresh();
        }
      }
      
      setPreviousCompletionState(completionSignature);
    }
  }, [flows, onRefresh, previousCompletionState]);

  const flowA = getFlowByType('a');
  const flowB = getFlowByType('b');

  const isFlowACompleted = isFlowCompleted('a');
  const isFlowBCompleted = isFlowCompleted('b');

  const handleSignA = async (notes?: string, substituteConfirmed?: boolean) => {
    await signDocument('a', notes, substituteConfirmed);
    if (onRefresh) onRefresh();
  };

  const handleSignB = async (notes?: string, substituteConfirmed?: boolean) => {
    await signDocument('b', notes, substituteConfirmed);
    if (onRefresh) onRefresh();
  };

  const handleCancelDocument = async (reason: string) => {
    await cancelDocument(reason);
    if (onRefresh) onRefresh();
  };

  const handleRevertToA = async (reason: string) => {
    await revertToSection('a', reason);
    if (onRefresh) onRefresh();
  };

  const downloadXml = async (pas: 'a' | 'b') => {
    try {
      const response = await api.get(
        `/api/procurement/ordonantare/${doc._id}/download-xml`,
        {
          params: { pas, forcedownload: 1 },
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ordonantare_${doc._id}_pas_${pas}.xml`);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download XML:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut descărca XML-ul',
        color: 'red',
      });
    }
  };

  const handleDownloadA = () => {
    downloadXml('a');
  };

  const handleDownloadB = () => {
    downloadXml('b');
  };

  if (loading && flows.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text size="sm" c="dimmed">Se încarcă workflow...</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      <Paper withBorder p="xs">
        <Text fw={700} size="sm">Workflow Aprobare</Text>
      </Paper>

      {/* Punctul A */}
      <ApprovalFlowBox
        title="Punctul A"
        flow={flowA}
        canEdit={false}
        canSign={canSignFlow('a')}
        canCancel={!isFlowACompleted && canSignFlow('a')}
        canRevert={false}
        isActive={!isFlowACompleted}
        onSign={handleSignA}
        onCancel={handleCancelDocument}
        onDownload={handleDownloadA}
        signing={signing}
        canceling={canceling}
        reverting={reverting}
      />

      {/* Punctul B */}
      <ApprovalFlowBox
        title="Punctul B"
        flow={flowB}
        canEdit={false}
        canSign={canSignFlow('b')}
        canCancel={!isFlowBCompleted && canSignFlow('b')}
        canRevert={isFlowACompleted && canSignFlow('b')}
        isActive={isFlowACompleted && !isFlowBCompleted}
        onSign={handleSignB}
        onCancel={handleCancelDocument}
        onRevert={handleRevertToA}
        onDownload={handleDownloadB}
        signing={signing}
        canceling={canceling}
        reverting={reverting}
      />
    </Stack>
  );
}
