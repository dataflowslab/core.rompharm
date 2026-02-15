import { Timeline, Text, Alert, Accordion } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface ActivityTimelineProps {
  document: {
    created_at: string;
    created_by: string;
    stare: string;
    error?: string;
    pdf_path?: string;
    pdf_a_signed_path?: string;
    stare_b?: string;
    error_b?: string;
    pdf_b_path?: string;
    pdf_b_signed_path?: string;
    rezultat_ordonator?: string;
    pdf_ordonator_signed_path?: string;
    pdf_final_signed_path?: string;
    finalizat?: boolean;
  };
}

export function ActivityTimeline({ document }: ActivityTimelineProps) {
  // Calculate active step
  let activeStep = 0;
  if (document.finalizat) activeStep = 10;
  else if (document.pdf_final_signed_path) activeStep = 9;
  else if (document.pdf_ordonator_signed_path) activeStep = 8;
  else if (document.rezultat_ordonator) activeStep = 7;
  else if (document.pdf_b_signed_path) activeStep = 6;
  else if (document.pdf_b_path) activeStep = 5;
  else if (document.stare_b === 'Compilare') activeStep = 4;
  else if (document.pdf_a_signed_path) activeStep = 3;
  else if (document.pdf_path) activeStep = 2;
  else if (document.stare === 'Compilare') activeStep = 1;

  return (
    <Accordion defaultValue="jurnal" variant="separated">
      <Accordion.Item value="jurnal">
        <Accordion.Control>Jurnal activitate</Accordion.Control>
        <Accordion.Panel>
          <Timeline active={activeStep} bulletSize={24} lineWidth={2}>
            <Timeline.Item title="Document creat">
              <Text size="xs" c="dimmed">
                {new Date(document.created_at).toLocaleString('ro-RO')}
              </Text>
              <Text size="xs" c="dimmed">
                de {document.created_by}
              </Text>
            </Timeline.Item>

            {(document.stare === 'Compilare' || document.pdf_path || document.stare === 'Finalizat' || document.stare === 'Eroare') && (
              <Timeline.Item 
                title={document.stare === 'Eroare' ? 'Eroare la procesare Pct A' : 'Pct A completat'} 
                color={document.stare === 'Eroare' ? 'red' : (document.pdf_path ? 'green' : 'blue')}
              >
                <Text size="xs" c="dimmed">
                  {document.stare === 'Eroare' 
                    ? (document.error || 'A apărut o eroare la procesare')
                    : (document.pdf_path ? 'Secțiunea A generată cu succes' : 'Se procesează...')}
                </Text>
              </Timeline.Item>
            )}

            {document.pdf_a_signed_path && (
              <Timeline.Item title="Fișier Pct A încărcat" color="green">
                <Text size="xs" c="dimmed">
                  PDF semnat Secțiunea A încărcat
                </Text>
              </Timeline.Item>
            )}

            {(document.stare_b === 'Compilare' || document.pdf_b_path || document.stare_b === 'Finalizat' || document.stare_b === 'Eroare') && (
              <Timeline.Item 
                title={document.stare_b === 'Eroare' ? 'Eroare la procesare Pct B' : 'Pct B completat'} 
                color={document.stare_b === 'Eroare' ? 'red' : (document.pdf_b_path ? 'green' : 'blue')}
              >
                <Text size="xs" c="dimmed">
                  {document.stare_b === 'Eroare' 
                    ? (document.error_b || 'A apărut o eroare la procesare')
                    : (document.pdf_b_path ? 'Secțiunea B generată cu succes' : 'Se procesează...')}
                </Text>
              </Timeline.Item>
            )}

            {document.pdf_b_signed_path && (
              <Timeline.Item title="Fișier Pct B încărcat" color="green">
                <Text size="xs" c="dimmed">
                  PDF semnat Secțiunea B încărcat
                </Text>
              </Timeline.Item>
            )}

            {document.rezultat_ordonator && (
              <Timeline.Item 
                title={`Decizie ordonator: ${document.rezultat_ordonator}`} 
                color={document.rezultat_ordonator === 'Aprobat' ? 'green' : (document.rezultat_ordonator === 'Respins' ? 'red' : 'orange')}
              >
                <Text size="xs" c="dimmed">
                  Ordonatorul a luat decizia: {document.rezultat_ordonator}
                </Text>
              </Timeline.Item>
            )}

            {document.pdf_ordonator_signed_path && (
              <Timeline.Item title="Fișier ordonator încărcat" color="green">
                <Text size="xs" c="dimmed">
                  PDF semnat de ordonator încărcat
                </Text>
              </Timeline.Item>
            )}

            {document.pdf_final_signed_path && (
              <Timeline.Item title="Fișier final încărcat" color="green">
                <Text size="xs" c="dimmed">
                  PDF final semnat încărcat
                </Text>
              </Timeline.Item>
            )}

            {document.finalizat && (
              <Timeline.Item title="Document finalizat" color="green">
                <Text size="xs" c="dimmed">
                  Documentul a fost finalizat cu succes
                </Text>
              </Timeline.Item>
            )}
          </Timeline>

          {(document.error || document.error_b) && (
            <Alert icon={<IconAlertCircle size={16} />} title="Eroare" color="red" mt="md">
              {document.error || document.error_b}
            </Alert>
          )}
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
