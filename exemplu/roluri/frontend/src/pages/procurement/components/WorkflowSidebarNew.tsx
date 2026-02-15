/**
 * WorkflowSidebarNew - New workflow sidebar using ApprovalFlowBox components
 * Replaces old WorkflowSidebar with approval flows system
 */
import { Stack, Text, Paper } from '@mantine/core';
import { ApprovalFlowBox } from './ApprovalFlowBox';
import { useApprovalFlows } from '../hooks/useApprovalFlows';
import { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { notifications } from '@mantine/notifications';

interface WorkflowSidebarNewProps {
  document: {
    _id: string;
    stare: string;
    stare_id?: string;
  };
  onEditA?: () => void;
  onEditB?: () => void;
  onEditC?: () => void;
  onRefresh?: () => void;
}

export function WorkflowSidebarNew({
  document: doc,
  onEditA,
  onEditB,
  onEditC,
  onRefresh,
}: WorkflowSidebarNewProps) {
  const {
    flows,
    loading,
    signing,
    canceling,
    reverting,
    loadFlows,
    createFlows,
    signDocument,
    cancelDocument,
    revertToSection,
    getFlowByType,
    canSignFlow,
    isFlowCompleted,
  } = useApprovalFlows({
    docType: 'docfunda',
    docId: doc._id,
    autoLoad: true,
  });

  // NOTE: Flows are created automatically in backend when document is created
  // No need to create them here on frontend

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
  const flowC = getFlowByType('c');

  const isFlowACompleted = isFlowCompleted('a');
  const isFlowBCompleted = isFlowCompleted('b');
  const isFlowCCompleted = isFlowCompleted('c');

  // Check if document is canceled (stare_id = Anulat)
  const STATUS_ANULAT = '696bd199e77d73555314a9b8';
  const isDocumentCanceled = doc.stare_id === STATUS_ANULAT || doc.stare === 'Anulat';

  const canEditA = !isFlowACompleted && !isDocumentCanceled;
  const canEditB = isFlowACompleted && !isFlowBCompleted && !isDocumentCanceled;
  const canEditC = isFlowBCompleted && !isFlowCCompleted && !isDocumentCanceled;

  const handleSignA = async (notes?: string, substituteConfirmed?: boolean) => {
    await signDocument('a', notes, substituteConfirmed);
    if (onRefresh) onRefresh();
  };

  const handleSignB = async (notes?: string, substituteConfirmed?: boolean) => {
    await signDocument('b', notes, substituteConfirmed);
    if (onRefresh) onRefresh();
  };

  const handleSignC = async (notes?: string, substituteConfirmed?: boolean) => {
    await signDocument('c', notes, substituteConfirmed);
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

  const handleRevertToB = async (reason: string) => {
    await revertToSection('b', reason);
    if (onRefresh) onRefresh();
  };

  const downloadXml = async (pas: 'a' | 'b' | 'c') => {
    try {
      const response = await api.get(
        `/api/procurement/fundamentare/${doc._id}/download-xml`,
        {
          params: { pas, forcedownload: 1 },
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', `fundamentare_${doc._id}_pas_${pas}.xml`);
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

  const handleDownloadC = () => {
    downloadXml('c');
  };

  const handleDownloadPdf = () => undefined;
  const disablePdfDownload = true;

  if (loading && flows.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text size="sm" c="dimmed">Se încarcă workflow...</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      <Text fw={700} size="sm">Workflow Aprobare</Text>

      {/* Punctul A */}
      <ApprovalFlowBox
        title="Punctul A"
        flow={flowA}
        canEdit={canEditA}
        canSign={!isDocumentCanceled && canSignFlow('a')}
        canCancel={!isDocumentCanceled && !isFlowACompleted && canSignFlow('a')}
        canRevert={false}
        isActive={!isFlowACompleted}
        onEdit={onEditA}
        onSign={handleSignA}
        onCancel={handleCancelDocument}
        onDownloadXml={handleDownloadA}
        onDownloadPdf={handleDownloadPdf}
        downloadPdfDisabled={disablePdfDownload}
        signing={signing}
        canceling={canceling}
        reverting={reverting}
      />

      {/* Punctul B */}
      <ApprovalFlowBox
        title="Punctul B"
        flow={flowB}
        canEdit={canEditB}
        canSign={!isDocumentCanceled && canSignFlow('b')}
        canCancel={!isDocumentCanceled && !isFlowBCompleted && canSignFlow('b')}
        canRevert={!isDocumentCanceled && isFlowACompleted && canSignFlow('b')}
        isActive={isFlowACompleted && !isFlowBCompleted}
        onEdit={onEditB}
        onSign={handleSignB}
        onCancel={handleCancelDocument}
        onRevert={handleRevertToA}
        onDownloadXml={handleDownloadB}
        onDownloadPdf={handleDownloadPdf}
        downloadPdfDisabled={disablePdfDownload}
        signing={signing}
        canceling={canceling}
        reverting={reverting}
      />

      {/* Punctul C */}
      <ApprovalFlowBox
        title="Punctul C"
        flow={flowC}
        canEdit={canEditC}
        canSign={!isDocumentCanceled && canSignFlow('c')}
        canCancel={!isDocumentCanceled && !isFlowCCompleted && canSignFlow('c')}
        canRevert={false}
        canRevertToA={!isDocumentCanceled && isFlowBCompleted && canSignFlow('c')}
        canRevertToB={!isDocumentCanceled && isFlowBCompleted && canSignFlow('c')}
        isActive={isFlowBCompleted && !isFlowCCompleted}
        onEdit={onEditC}
        onSign={handleSignC}
        onCancel={handleCancelDocument}
        onRevertToA={handleRevertToA}
        onRevertToB={handleRevertToB}
        onDownloadXml={handleDownloadC}
        onDownloadPdf={handleDownloadPdf}
        downloadPdfDisabled={disablePdfDownload}
        signing={signing}
        canceling={canceling}
        reverting={reverting}
      />
    </Stack>
  );
}
