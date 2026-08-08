import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';

export default function TodayScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <Text variant="display">{t('today.title')}</Text>
      <Text variant="body" tone="muted">
        {t('today.subtitle')}
      </Text>

      <Card>
        <Text variant="body" tone="muted">
          {t('today.emptyState')}
        </Text>
        <Button title={t('today.startSession')} onPress={() => {}} />
      </Card>
    </Screen>
  );
}
