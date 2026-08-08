import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';

export default function ProgressScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <Card>
        <Text variant="heading">{t('progress.masteryLevel')}</Text>
      </Card>
      <Card>
        <Text variant="heading">{t('progress.practiceMinutes')}</Text>
      </Card>
      <Card>
        <Text variant="heading">{t('progress.recordings')}</Text>
      </Card>
    </Screen>
  );
}
