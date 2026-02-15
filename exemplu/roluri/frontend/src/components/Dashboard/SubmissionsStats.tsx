import { useEffect, useState } from 'react';
import { Paper, Text, Group, Stack, Loader, SimpleGrid } from '@mantine/core';
import { IconFileText, IconCalendar, IconCalendarWeek } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface Stats {
  total: number;
  last_30_days: number;
  last_7_days: number;
}

export function SubmissionsStats() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/api/data/submissions/stats')
      .then((response) => {
        setStats(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load stats:', error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Paper shadow="sm" p="md" radius="md" withBorder>
        <Stack align="center">
          <Loader size="sm" />
        </Stack>
      </Paper>
    );
  }

  if (!stats) {
    return null;
  }

  const cards = [
    {
      title: t('Total Submissions'),
      value: stats.total,
      icon: IconFileText,
      color: 'blue',
      filter: 'all',
    },
    {
      title: t('Submissions (30 days)'),
      value: stats.last_30_days,
      icon: IconCalendar,
      color: 'green',
      filter: '30days',
    },
    {
      title: t('Submissions (7 days)'),
      value: stats.last_7_days,
      icon: IconCalendarWeek,
      color: 'orange',
      filter: '7days',
    },
  ];

  return (
    <SimpleGrid cols={isMobile ? 1 : 3} spacing="md">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Paper
            key={card.filter}
            shadow="sm"
            p="lg"
            radius="md"
            withBorder
            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onClick={() => navigate(`/submissions?filter=${card.filter}`)}
          >
            <Group justify="space-between" align="flex-start">
              <Stack gap="xs" style={{ flex: 1 }}>
                <Text size="sm" c="dimmed" fw={500}>
                  {card.title}
                </Text>
                <Text size="xl" fw={700} c={card.color}>
                  {card.value}
                </Text>
              </Stack>
              <Icon size={40} stroke={1.5} color={`var(--mantine-color-${card.color}-6)`} />
            </Group>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}
