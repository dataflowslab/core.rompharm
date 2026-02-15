import { useState } from 'react';
import { Stack, Button, Group } from '@mantine/core';
import { FormSectionB } from './components/FormSectionB';

interface SectionBFormProps {
  onSubmit: (formData: any) => void;
  onCancel: () => void;
  initialData?: any;
}

export function SectionBForm({ onSubmit, onCancel, initialData = {} }: SectionBFormProps) {
  const [formData, setFormData] = useState({
    checkboxPropuneriInregistrate: initialData.checkboxPropuneriInregistrate || false,
    tabel3: initialData.tabel3 || [],
    checkboxNuSauRezervat: initialData.checkboxNuSauRezervat || false,
    creditAngajament: initialData.creditAngajament || '',
    creditBugetar: initialData.creditBugetar || '',
    checkboxCrediteleInsuficiente: initialData.checkboxCrediteleInsuficiente || false,
    checkboxIntrucat: initialData.checkboxIntrucat || false,
    intrucatMotiv: initialData.intrucatMotiv || '',
  });

  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; url: string }>>(
    initialData.uploadedFiles || []
  );

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileUpload = (files: File[]) => {
    // Handle file upload
    const newFiles = files.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileDelete = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    onSubmit({
      ...formData,
      uploadedFiles,
    });
  };

  return (
    <Stack gap="md">
      <FormSectionB
        formData={formData}
        onChange={handleChange}
        onFileUpload={handleFileUpload}
        uploadedFiles={uploadedFiles}
        onFileDelete={handleFileDelete}
      />

      <Group justify="flex-end" mt="xl">
        <Button variant="subtle" onClick={onCancel}>
          Anulează
        </Button>
        <Button onClick={handleSubmit}>Salvează</Button>
      </Group>
    </Stack>
  );
}
