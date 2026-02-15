/**
 * ActivityTimelineNew - Activity timeline using approval flows system
 * Shows document creation, signatures, reverts, and cancellations
 */
import { Timeline, Text, Accordion, Badge, Stack } from '@mantine/core';
import { IconCheck, IconAlertCircle, IconX } from '@tabler/icons-react';
import { useApprovalFlows } from '../hooks/useApprovalFlows';
import { useEffect, useState } from 'react';

interface ActivityTimelineNewProps {
  document: {
    _id: string;
    created_at: string;
    created_by: string;
    stare_id?: string;
    cancelled_at?: string;
    cancelled_by?: string;
    cancel_reason?: string;
    reverted_at?: string;
    reverted_by?: string;
    revert_reason?: string;
  };
}

interface TimelineEvent {
  type: 'created' | 'signed_a' | 'signed_b' | 'signed_c' | 'reverted' | 'cancelled';
  title: string;
  timestamp: string;
  user: string;
  details?: string;
  color: string;
  icon?: React.ReactNode;
}

export function ActivityTimelineNew({ document }: ActivityTimelineNewProps) {
  // Detect document type from URL or document structure
  const docType = window.location.pathname.includes('/ordonantare/') ? 'ordonantari' : 'docfunda';
  
  const {
    flows,
    loading,
    loadFlows,
    getFlowByType,
    isFlowCompleted,
  } = useApprovalFlows({
    docType,
    docId: document._id,
    autoLoad: true,
  });

  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    if (!loading && flows.length > 0) {
      const timelineEvents: TimelineEvent[] = [];

      // Document created
      timelineEvents.push({
        type: 'created',
        title: 'Document creat',
        timestamp: document.created_at,
        user: document.created_by,
        color: 'blue',
      });

      // Punctul A signatures
      const flowA = getFlowByType('a');
      if (flowA && flowA.signatures && flowA.signatures.length > 0) {
        flowA.signatures.forEach((sig) => {
          timelineEvents.push({
            type: 'signed_a',
            title: 'Pct A semnat',
            timestamp: sig.signed_at,
            user: sig.username,
            details: sig.notes || undefined,
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        });
      }

      // Punctul B signatures
      const flowB = getFlowByType('b');
      if (flowB && flowB.signatures && flowB.signatures.length > 0) {
        flowB.signatures.forEach((sig) => {
          timelineEvents.push({
            type: 'signed_b',
            title: 'Pct B semnat',
            timestamp: sig.signed_at,
            user: sig.username,
            details: sig.notes || undefined,
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        });
      }

      // Punctul C signatures
      const flowC = getFlowByType('c');
      if (flowC && flowC.signatures && flowC.signatures.length > 0) {
        flowC.signatures.forEach((sig) => {
          timelineEvents.push({
            type: 'signed_c',
            title: 'Pct C semnat',
            timestamp: sig.signed_at,
            user: sig.username,
            details: sig.notes || undefined,
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        });
      }

      // Revert event
      if (document.reverted_at && document.reverted_by) {
        timelineEvents.push({
          type: 'reverted',
          title: 'Revenire la secțiune anterioară',
          timestamp: document.reverted_at,
          user: document.reverted_by,
          details: document.revert_reason,
          color: 'orange',
          icon: <IconAlertCircle size={16} />,
        });
      }

      // Cancelled event
      if (document.cancelled_at && document.cancelled_by) {
        timelineEvents.push({
          type: 'cancelled',
          title: 'Document anulat',
          timestamp: document.cancelled_at,
          user: document.cancelled_by,
          details: document.cancel_reason,
          color: 'red',
          icon: <IconX size={16} />,
        });
      }

      // Sort by timestamp (newest first for display, but Timeline shows oldest first)
      timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      setEvents(timelineEvents);
    }
  }, [flows, loading, document, getFlowByType]);

  // Calculate active step (last event)
  const activeStep = events.length - 1;

  if (loading) {
    return (
      <Accordion defaultValue="jurnal" variant="separated">
        <Accordion.Item value="jurnal">
          <Accordion.Control>Jurnal activitate</Accordion.Control>
          <Accordion.Panel>
            <Text size="sm" c="dimmed">Se încarcă...</Text>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    );
  }

  return (
    <Accordion defaultValue="jurnal" variant="separated">
      <Accordion.Item value="jurnal">
        <Accordion.Control>Jurnal activitate</Accordion.Control>
        <Accordion.Panel>
          <Timeline active={activeStep} bulletSize={24} lineWidth={2}>
            {events.map((event, index) => (
              <Timeline.Item
                key={index}
                title={event.title}
                color={event.color}
                bullet={event.icon}
              >
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    {new Date(event.timestamp).toLocaleString('ro-RO', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  <Text size="xs" c="dimmed">
                    de {event.user}
                  </Text>
                  {event.details && (
                    <Text size="xs" c="dimmed" fs="italic">
                      {event.details}
                    </Text>
                  )}
                  {event.type === 'signed_a' && (
                    <Badge size="xs" color="green" variant="light">
                      Punctul A completat
                    </Badge>
                  )}
                  {event.type === 'signed_b' && (
                    <Badge size="xs" color="green" variant="light">
                      Punctul B completat
                    </Badge>
                  )}
                  {event.type === 'signed_c' && (
                    <Badge size="xs" color="green" variant="light">
                      Punctul C completat
                    </Badge>
                  )}
                </Stack>
              </Timeline.Item>
            ))}
          </Timeline>

          {events.length === 1 && (
            <Text size="xs" c="dimmed" ta="center" mt="md">
              Documentul așteaptă semnături
            </Text>
          )}
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
