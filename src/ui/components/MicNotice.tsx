import React from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import type { MicrophoneStatus } from '@/audio/microphone';
import { spacing } from '@/ui/theme';

import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

/**
 * What to show when the microphone is not available.
 *
 * iOS asks for microphone permission exactly once. After a refusal every later
 * request resolves "denied" without showing anything, so a "grant permission"
 * button that re-requests is a button that does nothing — the only route back
 * is the Settings app. Offering anything else strands the learner on a screen
 * whose whole purpose is listening to them.
 */
export function MicNotice({ status }: { status: MicrophoneStatus }) {
  const { t } = useTranslation();

  if (status !== 'denied' && status !== 'error') return null;

  const denied = status === 'denied';

  return (
    <Card>
      <View style={styles.body}>
        <Text variant="heading" tone="danger">
          {denied ? t('common.micDenied') : t('common.micError')}
        </Text>
        {denied && (
          <>
            <Text variant="body" tone="muted">
              {t('common.micDeniedBody')}
            </Text>
            <Button title={t('common.micOpenSettings')} onPress={() => void Linking.openSettings()} />
          </>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
});
