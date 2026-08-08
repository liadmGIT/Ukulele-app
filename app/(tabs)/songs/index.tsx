import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';

export default function SongsScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <Card>
        <Text variant="heading">{t('songs.playableNow')}</Text>
      </Card>
    </Screen>
  );
}
