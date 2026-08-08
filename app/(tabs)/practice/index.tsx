import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';

export default function PracticeScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <Card>
        <Text variant="heading">{t('practice.tuner')}</Text>
      </Card>
      <Card>
        <Text variant="heading">{t('practice.metronome')}</Text>
      </Card>
      <Card>
        <Text variant="heading">{t('practice.chordChangeDrill')}</Text>
      </Card>
    </Screen>
  );
}
