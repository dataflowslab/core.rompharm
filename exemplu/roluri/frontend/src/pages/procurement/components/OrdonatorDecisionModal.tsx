import { Modal, Stack, Select, Textarea, Button, Group } from '@mantine/core';
import { useState } from 'react';

interface OrdonatorDecisionModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: { rezultat: string; motiv?: string }) => void;
}

export function OrdonatorDecisionModal({ opened, onClose, onSubmit }: OrdonatorDecisionModalProps) {
  const [rezultat, setRezultat] = useState<string>('');
  const [motiv, setMotiv] = useState('');

  const handleSubmit = () => {
    if (!rezultat) return;
    onSubmit({ rezultat, motiv: rezultat !== 'Aprobat' ? motiv : undefined });
    setRezultat('');
    setMotiv('');
    onClose();
  };

  const handleClose = () => {
    setRezultat('');
    setMotiv('');
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Decizie Ordonator" centered>
      <Stack gap="md">
        <Select
          label="Rezultat"
          placeholder="Selectează rezultatul"
          data={[
            { value: 'Aprobat', label: 'Aprobat' },
            { value: 'Anulat', label: 'Anulat' },
            { value: 'Respins', label: 'Respins' },
          ]}
          value={rezultat}
          onChange={(value) => setRezultat(value || '')}
          required
        />

        {(rezultat === 'Anulat' || rezultat === 'Respins') && (
          <Textarea
            label="Motiv"
            placeholder="Introduceți motivul..."
            value={motiv}
            onChange={(e) => setMotiv(e.target.value)}
            minRows={4}
            required
          />
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose}>
            Anulează
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!rezultat || ((rezultat === 'Anulat' || rezultat === 'Respins') && !motiv)}
          >
            Salvează
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
