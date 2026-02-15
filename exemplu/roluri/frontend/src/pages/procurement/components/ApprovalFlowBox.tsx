/**
 * ApprovalFlowBox - Component for displaying approval flow status and actions
 * Used for Punctul A, B, C in procurement documents
 */
import { Paper, Stack, Text, Button, Group, Badge, Table, Divider, Modal, Textarea, Checkbox } from '@mantine/core';
import { useState } from 'react';
import { IconCheck, IconClock, IconX, IconEdit, IconDownload, IconAlertCircle } from '@tabler/icons-react';
import { ApprovalFlow } from '../hooks/useApprovalFlows';

interface ApprovalFlowBoxProps {
  title: string;  // "Punctul A", "Punctul B", "Punctul C"
  flow: ApprovalFlow | undefined;
  canEdit: boolean;
  canSign: boolean;
  canCancel: boolean;
  canRevert: boolean;
  canRevertToA?: boolean;  // Only for Punctul C
  canRevertToB?: boolean;  // Only for Punctul C
  isActive: boolean;
  onEdit?: () => void;
  onSign?: (notes?: string, substituteConfirmed?: boolean) => void;
  onCancel?: (reason: string) => void;
  onRevert?: (reason: string) => void;
  onRevertToA?: (reason: string) => void;  // Revert to A
  onRevertToB?: (reason: string) => void;  // Revert to B
  onDownload?: () => void;
  onDownloadXml?: () => void;
  onDownloadPdf?: () => void;
  downloadPdfDisabled?: boolean;
  signing?: boolean;
  canceling?: boolean;
  reverting?: boolean;
}

export function ApprovalFlowBox({
  title,
  flow,
  canEdit,
  canSign,
  canCancel,
  canRevert,
  canRevertToA = false,
  canRevertToB = false,
  isActive,
  onEdit,
  onSign,
  onCancel,
  onRevert,
  onRevertToA,
  onRevertToB,
  onDownload,
  onDownloadXml,
  onDownloadPdf,
  downloadPdfDisabled = false,
  signing = false,
  canceling = false,
  reverting = false,
}: ApprovalFlowBoxProps) {
  const [signModalOpened, setSignModalOpened] = useState(false);
  const [cancelModalOpened, setCancelModalOpened] = useState(false);
  const [revertModalOpened, setRevertModalOpened] = useState(false);
  const [revertToAModalOpened, setRevertToAModalOpened] = useState(false);
  const [revertToBModalOpened, setRevertToBModalOpened] = useState(false);
  const [signNotes, setSignNotes] = useState('');
  const [substituteConfirmed, setSubstituteConfirmed] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [revertReason, setRevertReason] = useState('');
  const [revertToAReason, setRevertToAReason] = useState('');
  const [revertToBReason, setRevertToBReason] = useState('');
  const useCompactDownloads = Boolean(onDownloadXml || onDownloadPdf);
  const steps = flow?.steps && flow.steps.length > 0
    ? [...flow.steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];
  const fallbackOfficers = flow?.can_sign_officers || [];
  const requiresSubstituteConfirm = Boolean(flow?.signing_context?.requires_confirmation);
  const signedForName = flow?.signing_context?.signed_for_name;

  const handleSign = () => {
    if (onSign) {
      onSign(signNotes, substituteConfirmed);
      setSignModalOpened(false);
      setSignNotes('');
      setSubstituteConfirmed(false);
    }
  };

  const handleCancel = () => {
    if (onCancel && cancelReason.trim()) {
      onCancel(cancelReason);
      setCancelModalOpened(false);
      setCancelReason('');
    }
  };

  const handleRevert = () => {
    if (onRevert && revertReason.trim()) {
      onRevert(revertReason);
      setRevertModalOpened(false);
      setRevertReason('');
    }
  };

  const handleRevertToA = () => {
    if (onRevertToA && revertToAReason.trim()) {
      onRevertToA(revertToAReason);
      setRevertToAModalOpened(false);
      setRevertToAReason('');
    }
  };

  const handleRevertToB = () => {
    if (onRevertToB && revertToBReason.trim()) {
      onRevertToB(revertToBReason);
      setRevertToBModalOpened(false);
      setRevertToBReason('');
    }
  };

  const getStatusBadge = () => {
    if (!flow) {
      return (
        <Badge color="gray" variant="light" leftSection={<IconClock size={14} />}>
          Inactiv
        </Badge>
      );
    }

    if (flow.is_completed) {
      return (
        <Badge color="green" variant="filled" leftSection={<IconCheck size={14} />}>
          Completat
        </Badge>
      );
    }

    return (
      <Badge color="blue" variant="light" leftSection={<IconClock size={14} />}>
        În așteptare
      </Badge>
    );
  };

  return (
    <>
      <Paper 
        withBorder 
        p="md" 
        style={{ 
          opacity: isActive ? 1 : 0.6,
          borderColor: flow?.is_completed ? '#51cf66' : undefined,
          borderWidth: flow?.is_completed ? 2 : 1,
        }}
      >
        <Stack gap="md">
          {/* Header */}
          <Group justify="space-between">
            <Text fw={700} size="lg">{title}</Text>
            {getStatusBadge()}
          </Group>

          {flow && (
            <>
              <Divider />

              {/* Description */}
              {flow.description && (
                <Text size="sm" c="dimmed">{flow.description}</Text>
              )}

              {/* Officers who can sign - only show if not completed */}
              {!flow.is_completed && (steps.length > 0 || fallbackOfficers.length > 0) && (
                <Stack gap="xs">
                  <Text size="sm" fw={600}>Pot semna:</Text>
                  {steps.length > 0 ? (
                    <Stack gap="sm">
                      {steps.map((step, stepIndex) => (
                        <Stack gap="xs" key={`${step.order ?? 0}-${stepIndex}`}>
                          {step.title && (
                            <Text size="sm" fw={600}>{step.title}</Text>
                          )}
                          <Table size="xs">
                            <Table.Tbody>
                              {(step.officers || []).map((officer, idx) => {
                                const hasSigned = officer.is_signed ?? flow.signatures.some(
                                  sig => sig.user_id === officer.user_id || sig.username === officer.username
                                );
                                return (
                                  <Table.Tr key={`${stepIndex}-${idx}`}>
                                    <Table.Td>
                                      <Group gap="xs">
                                        {hasSigned ? (
                                          <IconCheck size={16} color="green" />
                                        ) : (
                                          <IconClock size={16} color="gray" />
                                        )}
                                        <Text size="sm">
                                          {officer.username || officer.role}
                                          {officer.must_sign && <Text span c="red"> *</Text>}
                                        </Text>
                                      </Group>
                                    </Table.Td>
                                    <Table.Td>
                                      {hasSigned ? (
                                        <Badge color="green" size="xs">Semnat</Badge>
                                      ) : (
                                        <Badge color="gray" size="xs">??n a??teptare</Badge>
                                      )}
                                    </Table.Td>
                                  </Table.Tr>
                                );
                              })}
                            </Table.Tbody>
                          </Table>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Table size="xs">
                      <Table.Tbody>
                        {fallbackOfficers.map((officer, idx) => {
                          const hasSigned = officer.is_signed ?? flow.signatures.some(
                            sig => sig.user_id === officer.user_id || sig.username === officer.username
                          );
                          return (
                            <Table.Tr key={idx}>
                              <Table.Td>
                                <Group gap="xs">
                                  {hasSigned ? (
                                    <IconCheck size={16} color="green" />
                                  ) : (
                                    <IconClock size={16} color="gray" />
                                  )}
                                  <Text size="sm">
                                    {officer.username || officer.role}
                                    {officer.must_sign && <Text span c="red"> *</Text>}
                                  </Text>
                                </Group>
                              </Table.Td>
                              <Table.Td>
                                {hasSigned ? (
                                  <Badge color="green" size="xs">Semnat</Badge>
                                ) : (
                                  <Badge color="gray" size="xs">??n a??teptare</Badge>
                                )}
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  )}
                  <Text size="xs" c="dimmed">
                    * Semn??tur?? obligatorie | Minim {flow.min_signatures} semn??turi necesare
                  </Text>
                </Stack>
              )}

              {/* Signatures */}
              {flow.signatures && flow.signatures.length > 0 && (
                <Stack gap="xs">
                  <Text size="sm" fw={600}>Semnături ({flow.signatures.length}):</Text>
                  <Table size="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Utilizator</Table.Th>
                      <Table.Th>Note</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {flow.signatures.map((sig, idx) => (
                      <Table.Tr key={idx}>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm">{sig.username}</Text>
                            <Text size="xs" c="dimmed">
                              {new Date(sig.signed_at).toLocaleString('ro-RO')}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs">{sig.notes || '-'}</Text>
                        </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Stack>
              )}

              <Divider />

              {/* Actions */}
              <Stack gap="xs">
                {/* Edit and Download buttons on same line */}
                {(canEdit || onDownload || onDownloadXml || onDownloadPdf) && (
                  <Group gap="xs" wrap={useCompactDownloads ? 'nowrap' : 'wrap'} grow={!useCompactDownloads}>
                    {canEdit && onEdit && (
                      <Button
                        size={useCompactDownloads ? 'xs' : undefined}
                        variant="light"
                        leftSection={<IconEdit size={16} />}
                        onClick={onEdit}
                      >
                        Modifică
                      </Button>
                    )}
                    {(onDownloadXml || onDownloadPdf) ? (
                      <>
                        {onDownloadXml && (
                          <Button
                            size="xs"
                            variant="light"
                            color="green"
                            leftSection={<IconDownload size={16} />}
                            onClick={onDownloadXml}
                          >
                            XML
                          </Button>
                        )}
                        {onDownloadPdf && (
                          <Button
                            size="xs"
                            variant="light"
                            color="gray"
                            leftSection={<IconDownload size={16} />}
                            onClick={onDownloadPdf}
                            disabled={downloadPdfDisabled}
                          >
                            PDF
                          </Button>
                        )}
                      </>
                    ) : (
                      onDownload && (
                        <Button
                          variant="light"
                          color="green"
                          leftSection={<IconDownload size={16} />}
                          onClick={onDownload}
                        >
                          Descarcă
                        </Button>
                      )
                    )}
                  </Group>
                )}

                {/* Sign button */}
                {canSign && !flow.is_completed && onSign && (
                  <Button
                    fullWidth
                    color="green"
                    leftSection={<IconCheck size={16} />}
                    onClick={() => setSignModalOpened(true)}
                    loading={signing}
                  >
                    Semnează
                  </Button>
                )}

                {/* Revert and Cancel buttons */}
                {(canRevert || canRevertToA || canRevertToB || canCancel) && (
                  <Stack gap="xs">
                    {/* Reverificare buttons for Punctul C */}
                    {(canRevertToA || canRevertToB) && (
                      <Group grow>
                        {canRevertToA && onRevertToA && (
                          <Button
                            variant="light"
                            color="orange"
                            leftSection={<IconAlertCircle size={16} />}
                            onClick={() => setRevertToAModalOpened(true)}
                            loading={reverting}
                          >
                            Reverificare A
                          </Button>
                        )}
                        {canRevertToB && onRevertToB && (
                          <Button
                            variant="light"
                            color="orange"
                            leftSection={<IconAlertCircle size={16} />}
                            onClick={() => setRevertToBModalOpened(true)}
                            loading={reverting}
                          >
                            Reverificare B
                          </Button>
                        )}
                      </Group>
                    )}
                    
                    {/* Single Revert button for other sections */}
                    {canRevert && onRevert && !canRevertToA && !canRevertToB && (
                      <Button
                        fullWidth
                        variant="light"
                        color="orange"
                        leftSection={<IconAlertCircle size={16} />}
                        onClick={() => setRevertModalOpened(true)}
                        loading={reverting}
                      >
                        Reverificare
                      </Button>
                    )}
                    
                    {/* Cancel button */}
                    {canCancel && onCancel && (
                      <Button
                        fullWidth
                        variant="light"
                        color="red"
                        leftSection={<IconX size={16} />}
                        onClick={() => setCancelModalOpened(true)}
                        loading={canceling}
                      >
                        Anulează
                      </Button>
                    )}
                  </Stack>
                )}
              </Stack>
            </>
          )}

          {!flow && (
            <Text size="sm" c="dimmed" ta="center">
              Fluxul de aprobare nu este disponibil
            </Text>
          )}
        </Stack>
      </Paper>

      {/* Sign Modal */}
      <Modal
        opened={signModalOpened}
        onClose={() => {
          setSignModalOpened(false);
          setSubstituteConfirmed(false);
        }}
        title="Semneaz? document"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Confirma?i c? dori?i s? semna?i acest document?
          </Text>
          {requiresSubstituteConfirm && (
            <Stack gap="xs">
              <Text size="sm">
                Confirm ca am fost imputernicit(a) pentru a semna in locul lui {signedForName || 'utilizator principal'}.
              </Text>
              <Checkbox
                label="Confirm"
                checked={substituteConfirmed}
                onChange={(event) => setSubstituteConfirmed(event.currentTarget.checked)}
              />
            </Stack>
          )}
          <Textarea
            label="Note (op?ional)"
            placeholder="Adaug? note despre semn?tur?..."
            value={signNotes}
            onChange={(e) => setSignNotes(e.target.value)}
            rows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setSignModalOpened(false)}>
              Anuleaz?
            </Button>
            <Button color="green" onClick={handleSign} loading={signing} disabled={requiresSubstituteConfirm && !substituteConfirmed}>
              Confirm? semn?tura
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        opened={cancelModalOpened}
        onClose={() => setCancelModalOpened(false)}
        title="Anulează document"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="red">
            Atenție! Anularea documentului este o acțiune permanentă.
          </Text>
          <Textarea
            label="Motiv anulare *"
            placeholder="Introduceți motivul anulării..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            required
            error={cancelReason.trim() === '' ? 'Motivul este obligatoriu' : null}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setCancelModalOpened(false)}>
              Renunță
            </Button>
            <Button 
              color="red" 
              onClick={handleCancel} 
              loading={canceling}
              disabled={cancelReason.trim() === ''}
            >
              Confirmă anularea
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Revert Modal */}
      <Modal
        opened={revertModalOpened}
        onClose={() => setRevertModalOpened(false)}
        title="Reverificare"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="orange">
            Documentul va reveni la secțiunea anterioară și semnăturile ulterioare vor fi șterse.
          </Text>
          <Textarea
            label="Motiv reverificare *"
            placeholder="Introduceți motivul reverificării..."
            value={revertReason}
            onChange={(e) => setRevertReason(e.target.value)}
            rows={3}
            required
            error={revertReason.trim() === '' ? 'Motivul este obligatoriu' : null}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setRevertModalOpened(false)}>
              Renunță
            </Button>
            <Button 
              color="orange" 
              onClick={handleRevert} 
              loading={reverting}
              disabled={revertReason.trim() === ''}
            >
              Confirmă reverificarea
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Revert to A Modal */}
      <Modal
        opened={revertToAModalOpened}
        onClose={() => setRevertToAModalOpened(false)}
        title="Reverificare A"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="orange">
            Documentul va reveni la status <strong>Semnat A</strong> și semnăturile de la Punctul B și C vor fi șterse.
          </Text>
          <Textarea
            label="Motiv reverificare *"
            placeholder="Introduceți motivul reverificării..."
            value={revertToAReason}
            onChange={(e) => setRevertToAReason(e.target.value)}
            rows={3}
            required
            error={revertToAReason.trim() === '' ? 'Motivul este obligatoriu' : null}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setRevertToAModalOpened(false)}>
              Renunță
            </Button>
            <Button 
              color="orange" 
              onClick={handleRevertToA} 
              loading={reverting}
              disabled={revertToAReason.trim() === ''}
            >
              Confirmă reverificarea
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Revert to B Modal */}
      <Modal
        opened={revertToBModalOpened}
        onClose={() => setRevertToBModalOpened(false)}
        title="Reverificare B"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="orange">
            Documentul va reveni la status <strong>Semnat B</strong> și semnăturile de la Punctul C vor fi șterse.
          </Text>
          <Textarea
            label="Motiv reverificare *"
            placeholder="Introduceți motivul reverificării..."
            value={revertToBReason}
            onChange={(e) => setRevertToBReason(e.target.value)}
            rows={3}
            required
            error={revertToBReason.trim() === '' ? 'Motivul este obligatoriu' : null}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setRevertToBModalOpened(false)}>
              Renunță
            </Button>
            <Button 
              color="orange" 
              onClick={handleRevertToB} 
              loading={reverting}
              disabled={revertToBReason.trim() === ''}
            >
              Confirmă reverificarea
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
