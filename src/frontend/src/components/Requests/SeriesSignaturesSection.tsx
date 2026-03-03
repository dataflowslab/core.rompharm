import { Title, Button, Group, Text, Table, Badge, Stack } from '@mantine/core';
import { IconSignature } from '@tabler/icons-react';
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

interface SeriesSignaturesSectionProps {
  canSign: boolean;
  isCompleted: boolean;
  canSignOfficers: ApprovalOfficer[];
  minSignatures: number;
  signatures: ApprovalSignature[];
  onSign: () => void;
  signing: boolean;
}

export function SeriesSignaturesSection({
  canSign,
  isCompleted,
  canSignOfficers,
  minSignatures,
  signatures,
  onSign,
  signing
}: SeriesSignaturesSectionProps) {
  const { t } = useTranslation();

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={5}>{t('Signatures')}</Title>
        <Button
          size="xs"
          leftSection={<IconSignature size={14} />}
          onClick={onSign}
          loading={signing}
          disabled={!canSign || isCompleted}
        >
          {t('Sign')}
        </Button>
      </Group>

      {canSignOfficers.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {t('Optional Approvers')} ({t('Minimum')}: {minSignatures})
          </Text>
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Signer')}</Table.Th>
                <Table.Th>{t('Status')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {canSignOfficers.map((officer, index) => {
                let hasSigned = false;
                if (officer.type === 'role') {
                  hasSigned = signatures.length > 0;
                } else {
                  hasSigned = signatures.some(s => s.user_id === officer.reference);
                }

                const displayName = officer.type === 'role'
                  ? `role: ${officer.reference}`
                  : (officer.username || officer.reference);

                return (
                  <Table.Tr key={index}>
                    <Table.Td>{displayName}</Table.Td>
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
        </Stack>
      )}

      {signatures.length > 0 ? (
        <Stack gap="xs">
          <Text size="sm" fw={500}>{t('Signed by')}</Text>
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('User')}</Table.Th>
                <Table.Th>{t('Date')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {signatures.map((signature, index) => (
                <Table.Tr key={index}>
                  <Table.Td>{signature.user_name || signature.username}</Table.Td>
                  <Table.Td>{formatDate(signature.signed_at)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      ) : (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          {t('No signatures yet')}
        </Text>
      )}
    </Stack>
  );
}
