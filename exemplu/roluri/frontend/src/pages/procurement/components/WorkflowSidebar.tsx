import { Paper, Stack, Text, Group, Badge, Button, Loader, Tooltip, ActionIcon } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import {
  IconAlertCircle,
  IconCheck,
  IconDownload,
  IconUpload,
  IconTrash,
  IconEdit,
  IconFile,
  IconX,
  IconRefresh,
  IconPlayerSkipForward,
} from '@tabler/icons-react';
import { api } from '../../../services/api';
import { PdfSignatureBadge } from './PdfSignatureBadge';

interface WorkflowSidebarProps {
  document: {
    _id?: string;
    stare: string;
    error?: string;
    pdf_path?: string;
    pdf_hash?: string;
    pdf_a_signed_hash?: string;
    pdf_a_signed_path?: string;
    pdf_b_path?: string;
    pdf_b_hash?: string;
    pdf_b_signed_hash?: string;
    pdf_b_signed_path?: string;
    stare_b?: string;
    error_b?: string;
    rezultat_ordonator?: 'Aprobat' | 'Anulat' | 'Respins';
    motiv_ordonator?: string;
    pdf_ordonator_signed_hash?: string;
    pdf_ordonator_signed_path?: string;
    pdf_final_signed_hash?: string;
    pdf_final_signed_path?: string;
    finalizat?: boolean;
  };
  uploading: boolean;
  uploadingB: boolean;
  uploadingOrdonator: boolean;
  uploadingFinal: boolean;
  onCasuta1Click: () => void;
  onEditClick: () => void;
  onSignedPdfUpload: (files: File[]) => void;
  onDeleteSignedPdf: () => void;
  onCasuta3Click: () => void;
  onEditSectionBClick: () => void;
  onSignedPdfBUpload: (files: File[]) => void;
  onDeleteSignedPdfB: () => void;
  onCasuta5Click: () => void;
  onOrdonatorSignedPdfUpload: (files: File[]) => void;
  onCasuta6Click: () => void;
  onFinalSignedPdfUpload: (files: File[]) => void;
  onRefresh?: () => void;
  onSkipStep?: (stepType: string) => void;
}

export function WorkflowSidebar({
  document,
  uploading,
  uploadingB,
  uploadingOrdonator,
  uploadingFinal,
  onCasuta1Click,
  onEditClick,
  onSignedPdfUpload,
  onDeleteSignedPdf,
  onCasuta3Click,
  onEditSectionBClick,
  onSignedPdfBUpload,
  onDeleteSignedPdfB,
  onCasuta5Click,
  onOrdonatorSignedPdfUpload,
  onCasuta6Click,
  onFinalSignedPdfUpload,
  onRefresh,
}: WorkflowSidebarProps) {
  const getSignatureEndpoint = (hash?: string) => {
    if (!hash) {
      return undefined;
    }
    if (hash.startsWith('SKIPPED_OFFLINE')) {
      return undefined;
    }
    return `/api/procurement/files/${hash}/signature`;
  };

  return (
    <Paper withBorder p="md">
      <Text fw={700} mb="md">Workflow</Text>
      <Stack gap="sm">
        {/* Casuta 1: Completează Pct A */}
        <Paper 
          withBorder 
          p="sm" 
          style={{ 
            cursor: document.pdf_a_signed_path || document.stare === 'Compilare' ? 'not-allowed' : 'pointer',
            opacity: document.pdf_a_signed_path ? 0.6 : 1,
            backgroundColor: document.stare === 'Eroare' ? '#fff5f5' : 
                           (document.stare === 'Compilare' || (document.stare === 'Finalizat' && document.pdf_path && !document.pdf_a_signed_path)) ? '#e7f5ff' : 
                           undefined,
          }} 
          onClick={document.stare === 'Compilare' ? undefined : onCasuta1Click}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>1. Completează Pct A</Text>
              
              {/* Status badges */}
              {document.pdf_a_signed_path && (
                <Tooltip label="Blocat - PDF semnat încărcat în Casuta 2. Șterge PDF-ul semnat pentru a putea edita.">
                  <Badge color="gray" size="sm" style={{ cursor: 'help' }}>Blocat</Badge>
                </Tooltip>
              )}
              
              {document.stare === 'Compilare' && !document.pdf_a_signed_path && (
                <Group gap="xs">
                  <Tooltip label="Documentul este în curs de procesare la pdfRest. Vă rugăm așteptați...">
                    <Badge color="blue" size="sm" style={{ cursor: 'help' }}>În compilare</Badge>
                  </Tooltip>
                  {onRefresh && (
                    <Tooltip label="Reîmprospătează pentru a verifica dacă procesarea s-a finalizat">
                      <ActionIcon 
                        size="sm" 
                        variant="subtle" 
                        color="blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRefresh();
                        }}
                      >
                        <IconRefresh size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              )}
              
              {document.stare === 'Eroare' && !document.pdf_a_signed_path && (
                <Tooltip label={`Eroare: ${document.error || 'Eroare la procesare'}. Click pe butonul Editează pentru a corecta și retrimite.`}>
                  <Badge color="red" size="sm" style={{ cursor: 'help' }}>Eroare</Badge>
                </Tooltip>
              )}
              
              {document.stare === 'Finalizat' && document.pdf_path && document.pdf_a_signed_path && (
                <Tooltip label="Secțiunea A completată cu succes. PDF-ul semnat a fost încărcat.">
                  <Badge color="green" size="sm" leftSection={<IconCheck size={12} />} style={{ cursor: 'help' }}>
                    Completat
                  </Badge>
                </Tooltip>
              )}
            </Group>
            
            {/* Action buttons based on state */}
            {document.stare === 'Compilare' && (
              <Text size="xs" c="dimmed" ta="center" py="xs">
                Se procesează documentul...
              </Text>
            )}
            
            {document.stare === 'Eroare' && !document.pdf_a_signed_path && (
              <Button 
                size="xs" 
                variant="light" 
                color="red"
                leftSection={<IconEdit size={14} />}
                fullWidth
                onClick={(e) => {
                  e.stopPropagation();
                  onEditClick();
                }}
              >
                Editează și retrimite
              </Button>
            )}
            
            {document.stare === 'Finalizat' && document.pdf_path && !document.pdf_a_signed_path && (
              <Group gap="xs">
                <Button 
                  size="xs" 
                  variant="subtle" 
                  leftSection={<IconEdit size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditClick();
                  }}
                  style={{ flex: 1 }}
                >
                  Modifică
                </Button>
                <Button 
                  size="xs" 
                  variant="light" 
                  color="green"
                  leftSection={<IconDownload size={14} />}
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const response = await api.get(document.pdf_path, {
                        responseType: 'blob'
                      });
                      const blob = new Blob([response.data], { type: 'application/pdf' });
                      const url = window.URL.createObjectURL(blob);
                      const link = window.document.createElement('a');
                      link.href = url;
                      // Extract document ID from pdf_path (last part of URL)
                      const docId = document.pdf_path?.split('/').pop() || 'document';
                      link.download = `fundamentare-${docId}.pdf`;
                      window.document.body.appendChild(link);
                      link.click();
                      window.URL.revokeObjectURL(url);
                      window.document.body.removeChild(link);
                    } catch (error) {
                      console.error('Download error:', error);
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  Descarcă
                </Button>
              </Group>
            )}
            
            {document.stare === 'Finalizat' && document.pdf_path && document.pdf_a_signed_path && (
              <Text size="xs" c="green" ta="center" py="xs">
                ✓ Secțiunea completată
              </Text>
            )}
            
            {!document.stare || document.stare === 'Draft' && (
              <Button 
                size="xs" 
                variant="light" 
                leftSection={<IconEdit size={14} />}
                fullWidth
                onClick={(e) => {
                  e.stopPropagation();
                  onEditClick();
                }}
              >
                Completează formularul
              </Button>
            )}
          </Stack>
        </Paper>

        {/* Casuta 2: Încarcă Pct A semnat */}
        <Paper 
          withBorder 
          p="sm" 
          style={{ 
            opacity: document.pdf_path && document.stare === 'Finalizat' ? 1 : 0.5,
            cursor: document.pdf_path && document.stare === 'Finalizat' ? 'default' : 'not-allowed',
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>2. Încarcă Pct A semnat</Text>
              {!document.pdf_path && (
                <Badge color="gray" size="sm">Inactiv</Badge>
              )}
            </Group>
            
            {document.pdf_path && document.stare === 'Finalizat' && !document.pdf_a_signed_path && (
              <Dropzone
                onDrop={onSignedPdfUpload}
                accept={['application/pdf']}
                maxSize={10 * 1024 * 1024}
                loading={uploading}
                multiple={false}
              >
                <Group justify="center" gap="xs" style={{ minHeight: 60, pointerEvents: 'none' }}>
                  <Dropzone.Accept>
                    <IconUpload size={24} stroke={1.5} />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <IconX size={24} stroke={1.5} />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <IconFile size={24} stroke={1.5} />
                  </Dropzone.Idle>
                  <div>
                    <Text size="xs" inline>
                      Încarcă PDF semnat
                    </Text>
                    <Text size="xs" c="dimmed" inline mt={4}>
                      Max 10MB
                    </Text>
                  </div>
                </Group>
              </Dropzone>
            )}
            
            {document.pdf_a_signed_path && (
              <Group gap="xs">
                <Button 
                  size="xs" 
                  variant="light" 
                  color="green"
                  leftSection={<IconDownload size={14} />}
                  onClick={async () => {
                    try {
                      const response = await api.get(`/api/procurement/files/${document.pdf_a_signed_hash}`, {
                        responseType: 'blob'
                      });
                      const blob = new Blob([response.data], { type: 'application/pdf' });
                      const url = window.URL.createObjectURL(blob);
                      const link = window.document.createElement('a');
                      link.href = url;
                      link.download = `fundamentare-A-signed-${document.pdf_a_signed_hash}.pdf`;
                      window.document.body.appendChild(link);
                      link.click();
                      window.URL.revokeObjectURL(url);
                      window.document.body.removeChild(link);
                    } catch (error) {
                      console.error('Download error:', error);
                    }
                  }}
                >
                  Descarcă semnat
                </Button>
                <PdfSignatureBadge endpoint={getSignatureEndpoint(document.pdf_a_signed_hash)} />
                <ActionIcon 
                  size="sm" 
                  color="red" 
                  variant="subtle"
                  onClick={onDeleteSignedPdf}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            )}
          </Stack>
        </Paper>

        {/* Casuta 3: Completează Pct B */}
        <Paper 
          withBorder 
          p="sm" 
          style={{ 
            cursor: document.pdf_a_signed_path && !document.pdf_b_signed_path && document.stare_b !== 'Compilare' ? 'pointer' : 'not-allowed',
            opacity: document.pdf_a_signed_path ? (document.pdf_b_signed_path ? 0.6 : 1) : 0.5,
            backgroundColor: document.stare_b === 'Eroare' ? '#fff5f5' : 
                           (document.stare_b === 'Compilare' || (document.stare_b === 'Finalizat' && document.pdf_b_path && !document.pdf_b_signed_path)) ? '#e7f5ff' : 
                           undefined,
          }} 
          onClick={document.pdf_a_signed_path && document.stare_b !== 'Compilare' ? onCasuta3Click : undefined}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>3. Completează Pct B</Text>
              
              {!document.pdf_a_signed_path && (
                <Badge color="gray" size="sm">Inactiv</Badge>
              )}
              
              {document.pdf_a_signed_path && document.pdf_b_signed_path && (
                <Tooltip label="Blocat - PDF semnat încărcat în Casuta 4.">
                  <Badge color="gray" size="sm" style={{ cursor: 'help' }}>Blocat</Badge>
                </Tooltip>
              )}
              
              {document.stare_b === 'Compilare' && !document.pdf_b_signed_path && (
                <Group gap="xs">
                  <Tooltip label="Documentul Secțiunea B este în curs de procesare la pdfRest.">
                    <Badge color="blue" size="sm" style={{ cursor: 'help' }}>În compilare</Badge>
                  </Tooltip>
                  {onRefresh && (
                    <Tooltip label="Reîmprospătează pentru a verifica dacă procesarea s-a finalizat">
                      <ActionIcon 
                        size="sm" 
                        variant="subtle" 
                        color="blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRefresh();
                        }}
                      >
                        <IconRefresh size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              )}
              
              {document.stare_b === 'Eroare' && !document.pdf_b_signed_path && (
                <Tooltip label={`Eroare: ${document.error_b || 'Eroare la procesare'}. Click pe butonul Editează pentru a corecta și retrimite.`}>
                  <Badge color="red" size="sm" style={{ cursor: 'help' }}>Eroare</Badge>
                </Tooltip>
              )}
              
              {document.stare_b === 'Finalizat' && document.pdf_b_path && document.pdf_b_signed_path && (
                <Tooltip label="Secțiunea B completată cu succes. PDF-ul semnat a fost încărcat.">
                  <Badge color="green" size="sm" leftSection={<IconCheck size={12} />} style={{ cursor: 'help' }}>
                    Completat
                  </Badge>
                </Tooltip>
              )}
            </Group>
            
            {document.stare_b === 'Compilare' && (
              <Text size="xs" c="dimmed" ta="center" py="xs">
                Se procesează documentul...
              </Text>
            )}
            
            {document.pdf_a_signed_path && document.stare_b === 'Eroare' && !document.pdf_b_signed_path && (
              <Button 
                size="xs" 
                variant="light" 
                color="red"
                leftSection={<IconEdit size={14} />}
                fullWidth
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSectionBClick();
                }}
              >
                Editează și retrimite
              </Button>
            )}
            
            {document.pdf_a_signed_path && document.stare_b === 'Finalizat' && document.pdf_b_path && !document.pdf_b_signed_path && (
              <Group gap="xs">
                <Button 
                  size="xs" 
                  variant="subtle" 
                  leftSection={<IconEdit size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditSectionBClick();
                  }}
                  style={{ flex: 1 }}
                >
                  Modifică
                </Button>
                <Button 
                  size="xs" 
                  variant="light" 
                  color="green"
                  leftSection={<IconDownload size={14} />}
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const response = await api.get(document.pdf_b_path, {
                        responseType: 'blob'
                      });
                      const blob = new Blob([response.data], { type: 'application/pdf' });
                      const url = window.URL.createObjectURL(blob);
                      const link = window.document.createElement('a');
                      link.href = url;
                      const docId = document.pdf_b_path?.split('/').pop() || 'document';
                      link.download = `fundamentare-B-${docId}.pdf`;
                      window.document.body.appendChild(link);
                      link.click();
                      window.URL.revokeObjectURL(url);
                      window.document.body.removeChild(link);
                    } catch (error) {
                      console.error('Download error:', error);
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  Descarcă
                </Button>
              </Group>
            )}
            
            {document.stare_b === 'Finalizat' && document.pdf_b_path && document.pdf_b_signed_path && (
              <Text size="xs" c="green" ta="center" py="xs">
                ✓ Secțiunea completată
              </Text>
            )}
            
            {document.pdf_a_signed_path && !document.stare_b && (
              <Button 
                size="xs" 
                variant="light" 
                leftSection={<IconEdit size={14} />}
                fullWidth
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSectionBClick();
                }}
              >
                Completează
              </Button>
            )}
          </Stack>
        </Paper>

        {/* Casuta 4: Încarcă Pct B semnat */}
        <Paper 
          withBorder 
          p="sm" 
          style={{ 
            opacity: document.pdf_b_path && document.stare_b === 'Finalizat' ? 1 : 0.5,
            cursor: document.pdf_b_path && document.stare_b === 'Finalizat' ? 'default' : 'not-allowed',
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>4. Încarcă Pct B semnat</Text>
              {!document.pdf_b_path && (
                <Badge color="gray" size="sm">Inactiv</Badge>
              )}
            </Group>
            
            {document.pdf_b_path && document.stare_b === 'Finalizat' && !document.pdf_b_signed_path && (
              <Dropzone
                onDrop={onSignedPdfBUpload}
                accept={['application/pdf']}
                maxSize={10 * 1024 * 1024}
                loading={uploadingB}
                multiple={false}
              >
                <Group justify="center" gap="xs" style={{ minHeight: 60, pointerEvents: 'none' }}>
                  <Dropzone.Accept>
                    <IconUpload size={24} stroke={1.5} />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <IconX size={24} stroke={1.5} />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <IconFile size={24} stroke={1.5} />
                  </Dropzone.Idle>
                  <div>
                    <Text size="xs" inline>
                      Încarcă PDF semnat
                    </Text>
                    <Text size="xs" c="dimmed" inline mt={4}>
                      Max 10MB
                    </Text>
                  </div>
                </Group>
              </Dropzone>
            )}
            
            {document.pdf_b_signed_path && (
              <Group gap="xs">
                <Button 
                  size="xs" 
                  variant="light" 
                  color="green"
                  leftSection={<IconDownload size={14} />}
                  onClick={() => window.open(`/api/procurement/files/${document.pdf_b_signed_hash}`, '_blank')}
                >
                  Descarcă semnat
                </Button>
                <PdfSignatureBadge endpoint={getSignatureEndpoint(document.pdf_b_signed_hash)} />
                <ActionIcon 
                  size="sm" 
                  color="red" 
                  variant="subtle"
                  onClick={onDeleteSignedPdfB}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            )}
          </Stack>
        </Paper>

        {/* Casuta 5: Analiză ordonator */}
        <Paper 
          withBorder 
          p="sm" 
          style={{ 
            opacity: document.pdf_b_signed_path ? 1 : 0.5,
            backgroundColor: document.rezultat_ordonator ? '#e7f5ff' : undefined,
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>5. Analiză ordonator</Text>
              
              {!document.pdf_b_signed_path && (
                <Badge color="gray" size="sm">Inactiv</Badge>
              )}
              
              {document.rezultat_ordonator && (
                <Badge 
                  color={
                    document.rezultat_ordonator === 'Aprobat' ? 'green' : 
                    document.rezultat_ordonator === 'Respins' ? 'red' : 'orange'
                  } 
                  size="sm"
                >
                  {document.rezultat_ordonator}
                </Badge>
              )}
            </Group>
            
            {document.pdf_b_signed_path && (
              <Stack gap="xs">
                {/* Download PDF B semnat */}
                <Group gap="xs">
                  <Button 
                    size="xs" 
                    variant="light" 
                    color="green"
                    leftSection={<IconDownload size={14} />}
                    onClick={() => window.open(`/${document.pdf_b_signed_path}`, '_blank')}
                  >
                    Descarcă
                  </Button>
                  <PdfSignatureBadge endpoint={getSignatureEndpoint(document.pdf_b_signed_hash)} />
                </Group>
                
                {/* Dropzone pentru upload PDF semnat */}
                {!document.pdf_ordonator_signed_path && (
                  <Dropzone
                    onDrop={onOrdonatorSignedPdfUpload}
                    accept={['application/pdf']}
                    maxSize={10 * 1024 * 1024}
                    loading={uploadingOrdonator}
                    multiple={false}
                  >
                    <Group justify="center" gap="xs" style={{ minHeight: 50, pointerEvents: 'none' }}>
                      <Dropzone.Accept>
                        <IconUpload size={20} stroke={1.5} />
                      </Dropzone.Accept>
                      <Dropzone.Reject>
                        <IconX size={20} stroke={1.5} />
                      </Dropzone.Reject>
                      <Dropzone.Idle>
                        <IconFile size={20} stroke={1.5} />
                      </Dropzone.Idle>
                      <Text size="xs" inline>Încarcă PDF semnat</Text>
                    </Group>
                  </Dropzone>
                )}
                
                {document.pdf_ordonator_signed_path && (
                  <Group gap="xs">
                    <Button 
                      size="xs" 
                      variant="light" 
                      color="blue"
                      leftSection={<IconDownload size={14} />}
                      onClick={() => window.open(document.pdf_ordonator_signed_path, '_blank')}
                    >
                      Descarcă PDF semnat
                    </Button>
                    <PdfSignatureBadge endpoint={getSignatureEndpoint(document.pdf_ordonator_signed_hash)} />
                  </Group>
                )}
                
                {/* Buton pentru a deschide modal-ul de decizie */}
                {!document.rezultat_ordonator && (
                  <Button 
                    size="xs" 
                    variant="filled" 
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      onCasuta5Click();
                    }}
                  >
                    Salvează decizie
                  </Button>
                )}
                
                {document.rezultat_ordonator && (
                  <Text size="xs" c="dimmed" ta="center">
                    Decizie salvată: {document.rezultat_ordonator}
                  </Text>
                )}
              </Stack>
            )}
          </Stack>
        </Paper>

        {/* Casuta 6: Validare finală */}
        <Paper 
          withBorder 
          p="sm" 
          style={{ 
            opacity: document.rezultat_ordonator === 'Aprobat' && !document.finalizat ? 1 : 0.5,
            cursor: document.rezultat_ordonator === 'Aprobat' && !document.finalizat ? 'pointer' : 'not-allowed',
            backgroundColor: document.finalizat ? '#d3f9d8' : undefined,
          }} 
          onClick={document.rezultat_ordonator === 'Aprobat' && !document.finalizat ? onCasuta6Click : undefined}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>6. Validare finală</Text>
              
              {document.rezultat_ordonator !== 'Aprobat' && (
                <Badge color="gray" size="sm">Inactiv</Badge>
              )}
              
              {document.finalizat && (
                <Badge color="green" size="sm" leftSection={<IconCheck size={12} />}>
                  Finalizat
                </Badge>
              )}
            </Group>
            
            {document.rezultat_ordonator === 'Aprobat' && !document.pdf_final_signed_path && (
              <Dropzone
                onDrop={onFinalSignedPdfUpload}
                accept={['application/pdf']}
                maxSize={10 * 1024 * 1024}
                loading={uploadingFinal}
                multiple={false}
              >
                <Group justify="center" gap="xs" style={{ minHeight: 60, pointerEvents: 'none' }}>
                  <Dropzone.Accept>
                    <IconUpload size={24} stroke={1.5} />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <IconX size={24} stroke={1.5} />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <IconFile size={24} stroke={1.5} />
                  </Dropzone.Idle>
                  <div>
                    <Text size="xs" inline>
                      Încarcă PDF final semnat
                    </Text>
                    <Text size="xs" c="dimmed" inline mt={4}>
                      Max 10MB
                    </Text>
                  </div>
                </Group>
              </Dropzone>
            )}
            
            {document.pdf_final_signed_path && (
              <Group gap="xs">
                <Button 
                  size="xs" 
                  variant="light" 
                  color="green"
                  leftSection={<IconDownload size={14} />}
                  onClick={() => window.open(`/${document.pdf_final_signed_path}`, '_blank')}
                >
                  Descarcă
                </Button>
                <PdfSignatureBadge endpoint={getSignatureEndpoint(document.pdf_final_signed_hash)} />
              </Group>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  );
}
