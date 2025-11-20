import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Paper,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Alert,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      
      let errorMessage = t('Invalid InvenTree credentials. Please check your username and password.');
      
      if (err.response) {
        errorMessage = err.response.data?.detail || err.response.data?.message || `${t('Error')}: ${err.response.status}`;
      } else if (err.request) {
        errorMessage = t('Cannot connect to server. Please check if the backend is running.');
      } else {
        errorMessage = err.message || t('Error');
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <Container size="xs" mt={100}>
      <Paper shadow="md" p="xl" radius="md" withBorder>
        <Title order={2} ta="center" mb="lg">
          {t('Login')}
        </Title>

        <form onSubmit={handleSubmit}>
          <Stack>
            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                title={t('Error')}
                color="red"
              >
                {error}
              </Alert>
            )}

            <TextInput
              label={t('Username')}
              placeholder={t('Enter your username')}
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              required
            />

            <PasswordInput
              label={t('Password')}
              placeholder={t('Enter your password')}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />

            <Button type="submit" fullWidth loading={loading}>
              {t('Login')}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
