import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { getChordById, getStrumPatternsUpToDifficulty } from '@/content';
import { getChordMastery } from '@/db/mastery';
import { CHORD_QUALITIES, type ChordQuality } from '@/music/chords';
import { STANDARD_TUNING } from '@/music/notes';
import { ChordDiagram } from '@/ui/ChordDiagram';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { MasteryDots } from '@/ui/components/MasteryDots';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { musicalRow } from '@/ui/direction';
import { PatternPlayerCard } from '@/ui/PatternPlayerCard';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

export default function ChordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const chord = useMemo(() => (id ? getChordById(id) : undefined), [id]);
  const mastery = useMemo(() => (id ? getChordMastery(id) : null), [id]);

  // Only patterns a beginner can actually attempt — the point here is to play
  // the chord in time, not to take on a sixteenth-note funk groove.
  const patterns = useMemo(() => getStrumPatternsUpToDifficulty(3), []);
  const [patternIndex, setPatternIndex] = useState(0);

  if (!chord) {
    return (
      <Screen>
        <Card>
          <Text variant="heading">{t('common.notFound')}</Text>
          <Text variant="body" tone="muted">
            {t('common.notFoundBody')}
          </Text>
        </Card>
      </Screen>
    );
  }

  const shape = chord.shapes[0];
  const quality = CHORD_QUALITIES[chord.quality as ChordQuality];
  const qualityLabel = i18n.language === 'he' ? quality.labelHe : quality.labelEn;

  return (
    <>
      <Stack.Screen options={{ title: chord.nameEn }} />
      <Screen>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="display">{chord.nameEn}</Text>
            <Text variant="body" tone="muted">
              {qualityLabel}
            </Text>
            <MasteryDots level={mastery?.level ?? 0} />
          </View>
          {shape && <ChordDiagram shape={shape} size={150} showStringLabels />}
        </View>

        {/*
          The only route by which a chord's mastery can ever move. Without it
          the record screen offered four hardcoded chords and the other 81 were
          frozen at level 0 for good — which in turn kept almost every song in
          the library permanently locked, since songs unlock from chord level.
        */}
        <Button
          title={t('chords.practice')}
          onPress={() => router.push(`/practice/record?chordId=${chord.id}`)}
        />

        <Card>
          <Text variant="label" tone="muted">
            {t('chords.difficulty')}
          </Text>
          <View style={styles.pips}>
            {Array.from({ length: 5 }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.pip,
                  {
                    backgroundColor:
                      index < chord.difficulty ? theme.colors.accent : theme.colors.border,
                  },
                ]}
              />
            ))}
          </View>
        </Card>

        <Card>
          <Text variant="label" tone="muted">
            {i18n.language === 'he' ? 'תווים באקורד' : 'Notes in this chord'}
          </Text>
          <Text variant="mono">{chord.notes.join(' · ')}</Text>
        </Card>

        {shape && (
          <Card>
            <Text variant="label" tone="muted">
              {i18n.language === 'he' ? 'מיתר אחר מיתר' : 'String by string'}
            </Text>
            {STANDARD_TUNING.map((string) => {
              const fret = shape.frets[string.index] ?? 0;
              const finger = shape.fingers[string.index] ?? 0;
              const description =
                fret < 0
                  ? i18n.language === 'he'
                    ? 'לא מנגנים'
                    : 'Do not play'
                  : fret === 0
                    ? t('chords.openStrings')
                    : `${i18n.language === 'he' ? 'סריג' : 'Fret'} ${fret}${
                        finger ? ` · ${t('chords.fingers')} ${finger}` : ''
                      }`;

              return (
                <View key={string.index} style={styles.stringRow}>
                  <Text variant="mono">{string.label}</Text>
                  <Text variant="body" tone="muted">
                    {description}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {chord.aliases.length > 0 && (
          <Text variant="caption" tone="muted">
            {i18n.language === 'he' ? 'נקרא גם' : 'Also written'}: {chord.aliases.join(', ')}
          </Text>
        )}

        <Text variant="heading">{t('patterns.strumThisChord')}</Text>

        <View style={[styles.patternChips, musicalRow]}>
          {patterns.map((option, index) => {
            const active = index === patternIndex;
            return (
              <Pressable
                key={option.id}
                onPress={() => setPatternIndex(index)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.colors.primary : 'transparent',
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text variant="caption" tone={active ? 'inverse' : 'muted'}>
                  {i18n.language === 'he' ? option.nameHe : option.nameEn}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {patterns[patternIndex] && shape && (
          <PatternPlayerCard
            pattern={patterns[patternIndex]}
            frets={shape.frets}
            chordName={chord.nameEn}
          />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  headerText: { gap: spacing.sm, flexShrink: 1 },
  pips: { flexDirection: 'row', gap: spacing.xs },
  pip: { width: 26, height: 6, borderRadius: 3 },
  stringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  patternChips: { gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
