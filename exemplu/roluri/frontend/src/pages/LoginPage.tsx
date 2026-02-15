import { useEffect, useState } from 'react';
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
  Image,
  Box,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const storedDomain = localStorage.getItem('auth_domain') || '';
    if (storedDomain) {
      setDomain(storedDomain);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password, domain);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      
      let errorMessage = t('Invalid credentials. Please check your username and password.');
      
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
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'url(/web/backgrounds/main_bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        position: 'relative',
      }}
    >
      {/* Overlay for better readability */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.4)',
          zIndex: 0,
        }}
      />

      <Container size="xs" style={{ position: 'relative', zIndex: 1 }}>
        <Paper shadow="md" p="xl" radius="md" withBorder style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
          {/* Logo */}
          <Box mb="lg">
            <Image
              src="/media/img/logo.svg"
              alt="DataFlows"
              width={100}
              fit="contain"
            />
          </Box>

          <Title order={2} mb="lg">
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
              label={t('Domain')}
              placeholder={t('Enter domain')}
              value={domain}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDomain(value);
                localStorage.setItem('auth_domain', value);
              }}
              required
              description={t('Database will be: dataflows_{domain}')}
            />

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
    </Box>
  );
}
