import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Paper,
  Title,
  Text,
  Loader,
  Alert,
  Button,
  Stack,
  Badge,
  Modal,
  Table,
  Group,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCheck, IconLock } from '@tabler/icons-react';
import { JsonForms } from '@jsonforms/react';
import { api } from '../services/api';
import { mantineRenderers } from '../components/JsonForms';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAuth } from '../context/AuthContext';

interface FormData {
  id: string;
  slug: string;
  title: string;
  description?: string;
  json_schema: any;
  ui_schema: any;
  is_public: boolean;
}

export function FormPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, name } = useAuth();
  const [form, setForm] = useState<FormData | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [confirmModalOpened, setConfirmModalOpened] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const isMobile = useIsMobile();

  // Sanitize URL params
  const sanitizeValue = (value: string, type: string): any => {
    // Remove any HTML tags
    const cleanValue = value.replace(/<[^>]*>/g, '');
    
    // Type conversion based on schema
    switch (type) {
      case 'number':
      case 'integer':
        const num = Number(cleanValue);
        return isNaN(num) ? undefined : num;
      case 'boolean':
        return cleanValue.toLowerCase() === 'true';
      case 'array':
        try {
          return JSON.parse(cleanValue);
        } catch {
          return cleanValue.split(',').map(v => v.trim());
        }
      default:
        return cleanValue;
    }
  };

  useEffect(() => {
    if (!slug) return;

    api
      .get(`/api/forms/${slug}`)
      .then((response) => {
        setForm(response.data);
        
        // Pre-populate form with URL params and user data
        const initialData: any = {};
        const properties = response.data.json_schema.properties || {};
        
        // Pre-populate from URL params
        searchParams.forEach((value, key) => {
          if (properties[key]) {
            const fieldType = properties[key].type;
            initialData[key] = sanitizeValue(value, fieldType);
          }
        });
        
        // Pre-populate 'name' field with logged-in user's name if exists and not already set
        if (isAuthenticated && name && properties['name'] && !initialData['name']) {
          initialData['name'] = name;
        }
        
        if (Object.keys(initialData).length > 0) {
          setFormData(initialData);
        }
        
        setLoading(false);
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          setAuthRequired(true);
          setError(t('Authentication required for this form'));
        } else {
          setError(err.response?.data?.detail || t('Failed to load form'));
        }
        setLoading(false);
      });
  }, [slug, t, searchParams, isAuthenticated, name]);

  const openConfirmModal = () => {
    setConfirmModalOpened(true);
  };

  const handleConfirmSubmit = async () => {
    if (!form) return;

    setConfirmModalOpened(false);
    setSubmitting(true);
    setSubmitSuccess(false);
    setSubmitError('');
    
    try {
      await api.post('/api/data/', {
        form_id: form.id,
        data: formData,
      });

      setSubmitSuccess(true);
      
      notifications.show({
        title: t('Success'),
        message: t('Form submitted successfully!'),
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      // Reset form
      setFormData({});
      
      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      if (err.response?.status === 401) {
        setSubmitError(t('Authentication required. Please login to submit this form.'));
        notifications.show({
          title: t('Authentication Required'),
          message: t('Please login to submit this form'),
          color: 'orange',
          icon: <IconLock size={16} />,
        });
        navigate('/login');
      } else {
        const errorMsg = err.response?.data?.detail || t('Failed to submit form. Please try again.');
        setSubmitError(errorMsg);
        notifications.show({
          title: t('Error'),
          message: errorMsg,
          color: 'red',
          icon: <IconAlertCircle size={16} />,
        });
        
        // Scroll to top to show error message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getFieldLabel = (propertyKey: string): string => {
    if (!form) return propertyKey;
    const property = form.json_schema.properties?.[propertyKey];
    return property?.title || propertyKey;
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? t('Yes') : t('No');
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getSummaryData = () => {
    if (!form || !formData) return [];
    
    const properties = form.json_schema.properties || {};
    return Object.keys(properties).map(key => ({
      label: getFieldLabel(key),
      value: formatValue(formData[key]),
    }));
  };

  if (loading) {
    return (
      <Container size="md" mt={50}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{t('Loading form...')}</Text>
        </Stack>
      </Container>
    );
  }

  if (authRequired) {
    return (
      <Container size="md" mt={50}>
        <Alert
          icon={<IconLock size={16} />}
          title={t('Authentication Required')}
          color="orange"
        >
          <Stack gap="md">
            <Text>{t('This is a protected form. You need to login to access it.')}</Text>
            <Button onClick={() => navigate('/login')} leftSection={<IconLock size={16} />}>
              {t('Login')}
            </Button>
          </Stack>
        </Alert>
      </Container>
    );
  }

  if (error || !form) {
    return (
      <Container size="md" mt={50}>
        <Alert
          icon={<IconAlertCircle size={16} />}
          title={t('Error')}
          color="red"
        >
          {error || t('Form not found')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="md" mt={isMobile ? 10 : 30} px={isMobile ? 'xs' : 'md'}>
      <Paper shadow="sm" p={isMobile ? 'md' : 'xl'} radius="md" withBorder>
        <Stack>
          <div>
            <Stack gap="xs">
              <Title order={isMobile ? 3 : 2}>{form.title}</Title>
              {!form.is_public && (
                <Badge color="orange" leftSection={<IconLock size={12} />}>
                  {t('Protected Form')}
                </Badge>
              )}
            </Stack>
            {form.description && (
              <Text c="dimmed" mt="xs" size={isMobile ? 'sm' : 'md'}>
                {form.description}
              </Text>
            )}
            
            {/* Success Alert */}
            {submitSuccess && (
              <Alert
                icon={<IconCheck size={16} />}
                color="green"
                withCloseButton
                onClose={() => setSubmitSuccess(false)}
                mt="md"
              >
                {t('Cererea a fost înregistrată')}
              </Alert>
            )}
            
            {/* Error Alert */}
            {submitError && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="red"
                withCloseButton
                onClose={() => setSubmitError('')}
                mt="md"
              >
                {submitError}
              </Alert>
            )}
          </div>

          <JsonForms
            schema={form.json_schema}
            uischema={form.ui_schema}
            data={formData}
            renderers={mantineRenderers}
            onChange={({ data }) => setFormData(data)}
            validationMode="ValidateAndShow"
          />

          <Button
            onClick={openConfirmModal}
            loading={submitting}
            size={isMobile ? 'md' : 'lg'}
            fullWidth
          >
            {t('Submit')}
          </Button>
        </Stack>
      </Paper>

      {/* Confirmation Modal */}
      <Modal
        opened={confirmModalOpened}
        onClose={() => setConfirmModalOpened(false)}
        title={t('Confirm Submission')}
        size="lg"
        fullScreen={isMobile}
      >
        <Stack>
          <Text size="sm" c="dimmed">
            {t('Confirmi trimiterea formularului în forma actuală?')}
          </Text>

          <Paper withBorder p="md" radius="md">
            <Title order={5} mb="md">{t('Form Summary')}</Title>
            <Table striped highlightOnHover>
              <Table.Tbody>
                {getSummaryData().map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td fw={500} w="40%">{item.label}</Table.Td>
                    <Table.Td>{item.value}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => setConfirmModalOpened(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              loading={submitting}
            >
              {t('Confirm')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
