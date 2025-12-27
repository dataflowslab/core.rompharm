import { Title, Button, Group, Text, Table, Badge, ActionIcon } from '@mantine/core';
import { IconSignature, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface ApprovalOfficer {
  type: string;
  reference: string;
  username: string;
  action: string;
}

interface ApprovalSignature {
  user_id: string;
  username: string;
  user_name?: string;
  signed_at: string;
  signature_hash: string;
}

interface SignaturesSectionProps {
  canSign: boolean;
  isCompleted: boolean;
  canSignOfficers: ApprovalOfficer[];
  minSignatures: number;
  signatures: ApprovalSignature[];
  isStaff: boolean;
  onSign: () => void;
  onRemoveSignature: (userId: string, username: string) => void;
  signing: boolean;
}

export function SignaturesSection({
  canSign,
  isCompleted,
  canSignOfficers,
  minSignatures,
  signatures,
  isStaff,
  onSign,
  onRemoveSignature,
  signing
}: SignaturesSectionProps) {
  const { t } = useTranslation();

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={5}>{t('Signatures')}</Title>
        {canSign && !isCompleted && (
          <Button
            leftSection={<IconSignature size={16} />}
            onClick={onSign}
            loading={signing}
          >
            {t('Sign')}
          </Button>
        )}
      </Group>

      {/* Optional Approvers */}
      {canSignOfficers.length > 0 && (
        <>
          <Text size="sm" fw={500} mb="xs">
            {t('Optional Approvers')} ({t('Minimum')}: {minSignatures})
          </Text>
          <Table striped withTableBorder withColumnBorders mb="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('User')}</Table.Th>
                <Table.Th>{t('Status')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {canSignOfficers.map((officer, index) => {
                const hasSigned = signatures.some(s => s.user_id === officer.reference);
                return (
                  <Table.Tr key={index}>
                    <Table.Td>{officer.username}</Table.Td>
                    <Table.Td>
                      <Badge color={hasSigned ? 'green' : 'gray'} size="sm">
                        {hasSigned ? t('Signed') : t('Pending')}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </>
      )}

      {/* Signatures List */}
      {signatures.length > 0 && (
        <>
          <Text size="sm" fw={500} mb="xs">{t('Signed by')}</Text>
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('User')}</Table.Th>
                <Table.Th>{t('Date')}</Table.Th>
                {isStaff && <Table.Th style={{ width: '40px' }}></Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {signatures.map((signature, index) => (
                <Table.Tr key={index}>
                  <Table.Td>{signature.user_name || signature.username}</Table.Td>
                  <Table.Td>{formatDate(signature.signed_at)}</Table.Td>
                  {isStaff && (
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        size="sm"
                        onClick={() => onRemoveSignature(signature.user_id, signature.username)}
                        title={t('Remove')}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {signatures.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          {t('No signatures yet')}
        </Text>
      )}
    </>
  );
}
