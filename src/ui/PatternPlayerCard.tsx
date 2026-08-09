import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePatternPlayer } from '@/audio/usePatternPlayer';
import type { StrumPattern } from '@/content';

import { Button } from './components/Button';
import { Card } from './components/Card';
import { Text } from './components/Text';
import { musicalRow } from './direction';
import { RhythmStrip } from './RhythmStrip';
import { radius, spacing } from './theme';
import { useTheme } from './ThemeProvider';

/**
 * A playable strum pattern: the strip, a play button, and the practice tempo.
 *
 * Shared by the pattern browser and the chord detail screen, and the same
 * component the song player will use in M5.
 */

/**
 * Practice speeds as a fraction of the written tempo.
 *
 * Chips rather than a continuous slider: a learner is holding an instrument
 * with both hands and glancing at the screen, and hitting a precise slider
 * position in that state is genuinely hard. These are also the speeds anyone
 * actually practises at.
 */
const TEMPO_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1] as const;

const DEFAULT_BPM = 100;

type PatternPlayerCardProps = {
  pattern: StrumPattern;
  /** Chord to strum, in diagram order (G C E A). Defaults to C major. */
  frets?: readonly number[];
  chordName?: string;
  bpm?: number;
  stripWidth?: number;
};

export function PatternPlayerCard({
  pattern,
  frets = [0, 0, 0, 3],
  chordName,
  bpm = DEFAULT_BPM,
  stripWidth = 300,
}: PatternPlayerCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  const [tempoFraction, setTempoFraction] = useState(1);
  const [withClick, setWithClick] = useState(true);

  const { isPlaying, activeStep, toggle } = usePatternPlayer({
    steps: pattern.steps,
    frets,
    bpm,
    timeSignature: pattern.timeSignature,
    subdivision: pattern.subdivision,
    countInBars: 1,
    tempoFraction,
    withClick,
  });

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="heading">
            {i18n.language === 'he' ? pattern.nameHe : pattern.nameEn}
          </Text>
          <Text variant="caption" tone="muted">
            {pattern.timeSignature.beatsPerBar}/{pattern.timeSignature.beatUnit}
            {chordName ? ` · ${chordName}` : ''} · {Math.round(bpm * tempoFraction)} {t('practice.bpm')}
          </Text>
        </View>
      </View>

      <View style={[styles.stripRow, musicalRow]}>
        <RhythmStrip
          steps={pattern.steps}
          timeSignature={pattern.timeSignature}
          subdivision={pattern.subdivision}
          activeStep={activeStep}
          width={stripWidth}
        />
      </View>

      <Text variant="caption" tone="muted">
        {i18n.language === 'he' ? pattern.descriptionHe : pattern.descriptionEn}
      </Text>

      <Text variant="label" tone="muted">
        {t('patterns.tempo')}
      </Text>
      <View style={[styles.chips, musicalRow]}>
        {TEMPO_STEPS.map((fraction) => {
          const active = fraction === tempoFraction;
          return (
            <Pressable
              key={fraction}
              onPress={() => setTempoFraction(fraction)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.colors.primary : 'transparent',
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <Text variant="caption" tone={active ? 'inverse' : 'muted'}>
                {Math.round(fraction * 100)}%
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.controls}>
        <Button
          title={isPlaying ? t('patterns.stop') : t('patterns.play')}
          onPress={toggle}
          style={styles.grow}
        />
        <Pressable
          onPress={() => setWithClick((value) => !value)}
          style={[
            styles.chip,
            styles.clickToggle,
            {
              backgroundColor: withClick ? theme.colors.surfaceAlt : 'transparent',
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text variant="caption" tone={withClick ? 'default' : 'muted'}>
            {t('patterns.click')}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { gap: 2, flexShrink: 1 },
  // The strip depicts time, so it never mirrors under RTL.
  stripRow: { justifyContent: 'center', marginVertical: spacing.sm },
  chips: { gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    // 44pt is Apple's minimum, and these are the controls a learner reaches for
    // with an instrument in their hands — tempo, pattern, filter. At the old
    // ~28pt they were a coin toss.
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  grow: { flex: 1 },
  clickToggle: { paddingVertical: spacing.md },
});
