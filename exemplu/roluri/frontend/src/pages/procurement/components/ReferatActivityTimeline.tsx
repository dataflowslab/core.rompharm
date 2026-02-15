import { Timeline, Text, Accordion } from '@mantine/core';

interface ReferatActivityTimelineProps {
  referat: {
    created_at: string;
    created_by: string;
    stare: string;
    submitted_at?: string;
    submitted_by?: string;
    approved_at?: string;
    status_updated_at?: string;
    status_updated_by?: string;
    motiv?: string;
  };
  signatures?: Array<{
    user_id: string;
    username: string;
    signed_at: string;
    signature: string;
  }>;
}

export function ReferatActivityTimeline({ referat, signatures = [] }: ReferatActivityTimelineProps) {
  // Calculate active step
  let activeStep = 0;
  if (referat.stare === 'Aprobat') activeStep = 10;
  else if (referat.stare === 'Respins' || referat.stare === 'Anulat') activeStep = 10;
  else if (signatures.length > 0) activeStep = 2 + signatures.length;
  else if (referat.stare === 'Trimis spre aprobare') activeStep = 1;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ro-RO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Accordion defaultValue="jurnal" variant="separated">
      <Accordion.Item value="jurnal">
        <Accordion.Control>Jurnal activitate</Accordion.Control>
        <Accordion.Panel>
          <Timeline active={activeStep} bulletSize={24} lineWidth={2}>
            {/* Created */}
            <Timeline.Item title="Document creat" color="blue">
              <Text size="xs" c="dimmed">
                {formatDate(referat.created_at)}
              </Text>
              <Text size="xs" c="dimmed">
                de {referat.created_by}
              </Text>
            </Timeline.Item>

            {/* Submitted */}
            {referat.stare !== 'În lucru' && (
              <Timeline.Item title="Trimis spre aprobare" color="cyan">
                <Text size="xs" c="dimmed">
                  {referat.submitted_at ? formatDate(referat.submitted_at) : 'N/A'}
                </Text>
                {referat.submitted_by && (
                  <Text size="xs" c="dimmed">
                    de {referat.submitted_by}
                  </Text>
                )}
              </Timeline.Item>
            )}

            {/* Signatures */}
            {signatures.map((sig, idx) => (
              <Timeline.Item key={idx} title="Semnat" color="green">
                <Text size="xs" c="dimmed">
                  {formatDate(sig.signed_at)}
                </Text>
                <Text size="xs" c="dimmed">
                  de {sig.username}
                </Text>
                <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                  Hash: {sig.signature.substring(0, 16)}...
                </Text>
              </Timeline.Item>
            ))}

            {/* Approved */}
            {referat.stare === 'Aprobat' && (
              <Timeline.Item title="Referat aprobat" color="green">
                <Text size="xs" c="dimmed">
                  {referat.approved_at ? formatDate(referat.approved_at) : 'N/A'}
                </Text>
              </Timeline.Item>
            )}

            {/* Rejected */}
            {referat.stare === 'Respins' && (
              <Timeline.Item title="Referat respins" color="red">
                <Text size="xs" c="dimmed">
                  {referat.status_updated_at ? formatDate(referat.status_updated_at) : 'N/A'}
                </Text>
                {referat.status_updated_by && (
                  <Text size="xs" c="dimmed">
                    de {referat.status_updated_by}
                  </Text>
                )}
                {referat.motiv && (
                  <Text size="xs" c="red" mt={4}>
                    Motiv: {referat.motiv}
                  </Text>
                )}
              </Timeline.Item>
            )}

            {/* Cancelled */}
            {referat.stare === 'Anulat' && (
              <Timeline.Item title="Referat anulat" color="gray">
                <Text size="xs" c="dimmed">
                  {referat.status_updated_at ? formatDate(referat.status_updated_at) : 'N/A'}
                </Text>
                {referat.status_updated_by && (
                  <Text size="xs" c="dimmed">
                    de {referat.status_updated_by}
                  </Text>
                )}
                {referat.motiv && (
                  <Text size="xs" c="dimmed" mt={4}>
                    Motiv: {referat.motiv}
                  </Text>
                )}
              </Timeline.Item>
            )}
          </Timeline>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
