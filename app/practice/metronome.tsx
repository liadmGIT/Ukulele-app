import { Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useMetronome } from '@/audio/useMetronome';
import type { GridOptions, TimeSignature } from '@/music/grid';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { musicalRow } from '@/ui/direction';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

const MIN_BPM = 40;
const MAX_BPM = 208;

const TIME_SIGNATURES: readonly TimeSignature[] = [
  { beatsPerBar: 4, beatUnit: 4 },
  { beatsPerBar: 3, beatUnit: 4 },
  { beatsPerBar: 6, beatUnit: 8 },
];

export default function MetronomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  const [bpm, setBpm] = useState(80);
  const [signatureIndex, setSignatureIndex] = useState(0);
  const [countInBars, setCountInBars] = useState(0);

  const timeSignature = TIME_SIGNATURES[signatureIndex]!;

  const options = useMemo<GridOptions>(
    () => ({ bpm, timeSignature, bars: 4, countInBars, subdivision: 8 }),
    [bpm, timeSignature, countInBars],
  );

  const { isRunning, currentBeat, toggle } = useMetronome(options, true);

  const adjust = (delta: number) =>
    setBpm((value) => Math.max(MIN_BPM, Math.min(MAX_BPM, value + delta)));

  return (
    <>
      <Stack.Screen options={{ title: t('metronome.title') }} />
      <Screen>
        <Card style={styles.tempoCard}>
          <Text variant="display" style={styles.bpm}>
            {bpm}
          </Text>
          <Text variant="label" tone="muted">
            {t('practice.bpm')}
          </Text>

          <View style={[styles.tempoControls, musicalRow]}>
            {[-10, -1, 1, 10].map((delta) => (
              <Pressable
                key={delta}
                onPress={() => adjust(delta)}
                style={({ pressed }) => [
                  styles.tempoButton,
                  {
                    backgroundColor: theme.colors.surfaceAlt,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text variant="label">{delta > 0 ? `+${delta}` : delta}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card style={styles.beatsCard}>
          <View style={[styles.beats, musicalRow]}>
            {Array.from({ length: timeSignature.beatsPerBar }, (_, index) => {
              const lit = isRunning && currentBeat?.beat === index;
              const isDownbeat = index === 0;

              return (
                <View
                  key={index}
                  style={[
                    styles.beatDot,
                    {
                      backgroundColor: lit
                        ? isDownbeat
                          ? theme.colors.accent
                          : theme.colors.primary
                        : theme.colors.border,
                      transform: [{ scale: lit ? 1.15 : 1 }],
                    },
                  ]}
                />
              );
            })}
          </View>
          {currentBeat?.isCountIn && (
            <Text variant="caption" tone="muted">
              {t('practice.countIn')}
            </Text>
          )}
        </Card>

        <Card>
          <Text variant="label" tone="muted">
            {t('metronome.timeSignature')}
          </Text>
          <View style={styles.row}>
            {TIME_SIGNATURES.map((signature, index) => {
              const active = index === signatureIndex;
              return (
                <Pressable
                  key={`${signature.beatsPerBar}/${signature.beatUnit}`}
                  onPress={() => setSignatureIndex(index)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.colors.primary : 'transparent',
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text variant="label" tone={active ? 'inverse' : 'default'}>
                    {signature.beatsPerBar}/{signature.beatUnit}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card>
          <Text variant="label" tone="muted">
            {t('metronome.countIn')}
          </Text>
          <View style={styles.row}>
            {[0, 1, 2].map((bars) => {
              const active = bars === countInBars;
              return (
                <Pressable
                  key={bars}
                  onPress={() => setCountInBars(bars)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.colors.primary : 'transparent',
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text variant="label" tone={active ? 'inverse' : 'default'}>
                    {bars === 0 ? t('metronome.noCountIn') : t('metronome.countInBars', { count: bars })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Button title={isRunning ? t('metronome.stop') : t('metronome.start')} onPress={toggle} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  tempoCard: { alignItems: 'center', gap: spacing.xs },
  bpm: { fontSize: 64, lineHeight: 72 },
  tempoControls: { gap: spacing.sm, marginTop: spacing.md },
  tempoButton: {
    minWidth: 62,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  beatsCard: { alignItems: 'center', gap: spacing.md },
  // Beats advance through the bar left to right in every language.
  beats: { gap: spacing.md, alignItems: 'center' },
  beatDot: { width: 22, height: 22, borderRadius: 11 },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
