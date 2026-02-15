/**
 * Custom hook for managing approval flows in procurement documents
 * Handles fetching, signing, canceling, and reverting approval flows
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import { notifications } from '@mantine/notifications';

export interface ApprovalOfficer {
  type?: 'user' | 'role';
  reference?: string;
  action?: 'must_sign' | 'can_sign';
  user_id?: string;
  username?: string;
  role?: string;
  must_sign?: boolean;
  is_signed?: boolean;
  is_primary?: boolean;
  substitute_for?: string;
  substitute_for_name?: string;
}

export interface ApprovalStep {
  order?: number;
  title?: string;
  mandatory?: boolean;
  min_signatures?: number;
  signed_count?: number;
  is_completed?: boolean;
  officers: ApprovalOfficer[];
}

export interface ApprovalSignature {
  user_id: string;
  username: string;
  email: string;
  signed_at: string;
  signature_type: string;
  notes?: string;
  signature_hash: string;
}

export interface ApprovalFlow {
  _id: string;
  object_type: string;  // procurement_docfunda_a, _b, _c
  object_source: string;  // procurement_docfunda
  object_id: string;
  name: string;
  description: string;
  officers: ApprovalOfficer[];
  steps?: ApprovalStep[];
  min_signatures: number;
  signatures: ApprovalSignature[];
  is_completed: boolean;
  can_sign: boolean;
  signing_context?: {
    step_order?: number;
    step_title?: string;
    requires_confirmation?: boolean;
    signed_for_name?: string;
    signed_for_user_id?: string;
  };
  can_sign_officers: ApprovalOfficer[];
  created_at: string;
  created_by: string;
  updated_at: string;
  completed_at?: string;
}

interface UseApprovalFlowsOptions {
  docType: string;  // fundamentare, contract, etc.
  docId: string;
  autoLoad?: boolean;
  autoCreate?: boolean;
}

export function useApprovalFlows({ docType, docId, autoLoad = true, autoCreate = true }: UseApprovalFlowsOptions) {
  const [flows, setFlows] = useState<ApprovalFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [hasAttemptedCreate, setHasAttemptedCreate] = useState(false);

  // Load approval flows
  const loadFlows = useCallback(async () => {
    if (!docId) return;

    try {
      setLoading(true);
      const response = await api.get(`/api/procurement/approval/${docType}/${docId}/approval-flows`);
      setFlows(response.data);
    } catch (error: any) {
      console.error('Failed to load approval flows:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-au putut încărca fluxurile de aprobare',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [docType, docId]);

  // Create approval flows from templates
  const createFlows = useCallback(async () => {
    if (!docId) return;

    try {
      setLoading(true);
      const response = await api.post(`/api/procurement/approval/${docType}/${docId}/create-approval-flows`);
      
      notifications.show({
        title: 'Succes',
        message: response.data.message || 'Fluxuri de aprobare create',
        color: 'green',
      });

      await loadFlows();
      return response.data;
    } catch (error: any) {
      console.error('Failed to create approval flows:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-au putut crea fluxurile de aprobare',
        color: 'red',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [docType, docId, loadFlows]);

  // Sign a document
  const signDocument = useCallback(async (flowType: string, notes?: string, substituteConfirmed?: boolean) => {
    if (!docId) return;

    try {
      setSigning(true);
      const response = await api.post(
        `/api/procurement/approval/${docType}/${docId}/sign/${flowType}`,
        {
          notes: notes || '',
          signature_type: 'approval',
          substitute_confirmed: substituteConfirmed === true
        }
      );

      notifications.show({
        title: 'Succes',
        message: response.data.message || 'Document semnat cu succes',
        color: 'green',
      });

      await loadFlows();
      return response.data;
    } catch (error: any) {
      console.error('Failed to sign document:', error);
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : (detail?.message || 'Nu s-a putut semna documentul');
      notifications.show({
        title: 'Eroare',
        message,
        color: 'red',
      });
      throw error;
    } finally {
      setSigning(false);
    }
  }, [docType, docId, loadFlows]);

  // Remove signature (admin only)
  const removeSignature = useCallback(async (flowType: string, userId: string) => {
    if (!docId) return;

    try {
      const response = await api.delete(
        `/api/procurement/approval/${docType}/${docId}/signature/${flowType}/${userId}`
      );

      notifications.show({
        title: 'Succes',
        message: response.data.message || 'Semnătură ștearsă',
        color: 'green',
      });

      await loadFlows();
      return response.data;
    } catch (error: any) {
      console.error('Failed to remove signature:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut șterge semnătura',
        color: 'red',
      });
      throw error;
    }
  }, [docType, docId, loadFlows]);

  // Cancel document
  const cancelDocument = useCallback(async (reason: string) => {
    if (!docId) return;

    try {
      setCanceling(true);
      const response = await api.post(
        `/api/procurement/approval/${docType}/${docId}/cancel`,
        { reason }
      );

      notifications.show({
        title: 'Succes',
        message: response.data.message || 'Document anulat',
        color: 'green',
      });

      await loadFlows();
      return response.data;
    } catch (error: any) {
      console.error('Failed to cancel document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut anula documentul',
        color: 'red',
      });
      throw error;
    } finally {
      setCanceling(false);
    }
  }, [docType, docId, loadFlows]);

  // Revert to section
  const revertToSection = useCallback(async (section: 'a' | 'b', reason: string) => {
    if (!docId) return;

    try {
      setReverting(true);
      const response = await api.post(
        `/api/procurement/approval/${docType}/${docId}/revert/${section}`,
        { reason }
      );

      notifications.show({
        title: 'Succes',
        message: response.data.message || `Revenit la secțiunea ${section.toUpperCase()}`,
        color: 'green',
      });

      await loadFlows();
      return response.data;
    } catch (error: any) {
      console.error('Failed to revert document:', error);
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut reveni la secțiunea anterioară',
        color: 'red',
      });
      throw error;
    } finally {
      setReverting(false);
    }
  }, [docType, docId, loadFlows]);

  // Get flow by type
  const getFlowByType = useCallback((flowType: string): ApprovalFlow | undefined => {
    return flows.find((flow) =>
      flow.object_type === `procurement_${docType}_${flowType}` ||
      flow.object_type === `${docType}_${flowType}` ||
      flow.object_type === flowType
    );
  }, [flows, docType]);

  // Check if user can sign a specific flow
  const canSignFlow = useCallback((flowType: string): boolean => {
    const flow = getFlowByType(flowType);
    return flow?.can_sign || false;
  }, [getFlowByType]);

  // Check if flow is completed
  const isFlowCompleted = useCallback((flowType: string): boolean => {
    const flow = getFlowByType(flowType);
    return flow?.is_completed || false;
  }, [getFlowByType]);

  // Get signatures count for a flow
  const getSignaturesCount = useCallback((flowType: string): number => {
    const flow = getFlowByType(flowType);
    return flow?.signatures.length || 0;
  }, [getFlowByType]);

  // Auto-load flows on mount
  useEffect(() => {
    if (autoLoad && docId) {
      loadFlows();
    }
  }, [autoLoad, docId, loadFlows]);

  useEffect(() => {
    if (!autoCreate || !autoLoad || !docId || loading) {
      return;
    }

    if (flows.length === 0 && !hasAttemptedCreate) {
      setHasAttemptedCreate(true);
      createFlows().catch(() => {});
    }
  }, [autoCreate, autoLoad, docId, loading, flows.length, hasAttemptedCreate, createFlows]);

  return {
    flows,
    loading,
    signing,
    canceling,
    reverting,
    loadFlows,
    createFlows,
    signDocument,
    removeSignature,
    cancelDocument,
    revertToSection,
    getFlowByType,
    canSignFlow,
    isFlowCompleted,
    getSignaturesCount,
  };
}
