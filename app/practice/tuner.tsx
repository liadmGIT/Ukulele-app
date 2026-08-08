import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useTuner } from '@/audio/useTuner';
import { STANDARD_TUNING } from '@/music/notes';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { musicalRow } from '@/ui/direction';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';
import { TunerNeedle } from '@/ui/TunerNeedle';

/** Below this input level the reading is unreliable and we say so. */
const QUIET_LEVEL = 0.01;

export default function TunerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [active, setActive] = useState(true);

  const { reading, status, level } = useTuner(active);

  const cents = reading?.centsFromString ?? reading?.cents ?? null;
  const inTune = reading?.inTune ?? false;

  const statusText = (() => {
    if (status === 'denied') return t('tuner.permissionNeeded');
    if (status === 'error') return t('tuner.micError');
    if (!reading) return level > QUIET_LEVEL ? t('tuner.listening') : t('tuner.playAString');
    if (inTune) return t('tuner.inTune');
    return reading.direction === 'flat' ? t('tuner.flat') : t('tuner.sharp');
  })();

  const statusTone = inTune ? theme.colors.success : theme.colors.text;

  return (
    <>
      <Stack.Screen options={{ title: t('tuner.title') }} />
      <Screen>
        <Card style={styles.dial}>
          <Text variant="display" style={{ color: statusTone, fontSize: 56, lineHeight: 64 }}>
            {reading ? reading.noteName : '–'}
          </Text>

          <TunerNeedle cents={cents} inTune={inTune} />

          <Text variant="heading" style={{ color: statusTone }}>
            {statusText}
          </Text>

          <Text variant="caption" tone="muted">
            {reading && cents !== null
              ? `${cents > 0 ? '+' : ''}${cents.toFixed(0)} ${t('tuner.cents')}`
              : ' '}
          </Text>
        </Card>

        <Card>
          <Text variant="label" tone="muted">
            {t('tuner.strings')}
          </Text>
          <View style={[styles.strings, musicalRow]}>
            {STANDARD_TUNING.map((string) => {
              const isTarget = reading?.string?.index === string.index;
              const settled = isTarget && inTune;

              return (
                <View
                  key={string.index}
                  style={[
                    styles.string,
                    {
                      backgroundColor: settled
                        ? theme.colors.success
                        : isTarget
                          ? theme.colors.surfaceAlt
                          : 'transparent',
                      borderColor: isTarget ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text variant="heading" tone={settled ? 'inverse' : 'default'}>
                    {string.name}
                  </Text>
                  <Text variant="caption" tone={settled ? 'inverse' : 'muted'}>
                    {string.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        {status === 'denied' && (
          <Button title={t('tuner.grantPermission')} onPress={() => setActive(false)} />
        )}
        {status === 'denied' && !active && (
          <Button title={t('common.retry')} onPress={() => setActive(true)} variant="secondary" />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  dial: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  // Order is fixed to the instrument, not the reading direction.
  strings: { gap: spacing.sm },
  string: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
});
