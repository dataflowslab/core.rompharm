import { useEffect, useState } from 'react';
import { Badge, Tooltip } from '@mantine/core';
import { IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';
import { api } from '../../../services/api';

interface PdfSignatureInfo {
  is_pdf: boolean;
  is_signed: boolean;
  signature_count: number;
  signer_names?: string[];
}

interface PdfSignatureBadgeProps {
  endpoint?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function PdfSignatureBadge({ endpoint, size = 'xs' }: PdfSignatureBadgeProps) {
  const [info, setInfo] = useState<PdfSignatureInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!endpoint) {
      return;
    }

    let active = true;

    const fetchInfo = async () => {
      try {
        setLoading(true);
        setHasError(false);
        const response = await api.get(endpoint);
        if (!active) return;
        setInfo(response.data);
      } catch (error) {
        if (!active) return;
        setHasError(true);
        setInfo(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchInfo();

    return () => {
      active = false;
    };
  }, [endpoint]);

  if (!endpoint) {
    return null;
  }

  if (loading) {
    return (
      <Badge size={size} color="gray" variant="light">
        Verificare...
      </Badge>
    );
  }

  if (hasError || !info) {
    return (
      <Badge size={size} color="gray" variant="light" leftSection={<IconAlertCircle size={12} />}>
        N/A
      </Badge>
    );
  }

  if (!info.is_pdf) {
    return (
      <Badge size={size} color="gray" variant="light" leftSection={<IconAlertCircle size={12} />}>
        N/A
      </Badge>
    );
  }

  const label = info.is_signed ? 'Semnat' : 'Nesemnat';
  const color = info.is_signed ? 'green' : 'gray';
  const icon = info.is_signed ? <IconCheck size={12} /> : <IconX size={12} />;

      let tooltipLabel = `Semnaturi: ${info.signature_count}`;
      if (info.signer_names && info.signer_names.length > 0) {
    tooltipLabel += `; Semnatari: ${info.signer_names.join(', ')}`;
      }

  const badge = (
    <Badge size={size} color={color} variant="light" leftSection={icon}>
      {label}
    </Badge>
  );

  if (info.is_signed) {
    return (
      <Tooltip label={tooltipLabel} withArrow>
        {badge}
      </Tooltip>
    );
  }

  return badge;
}
