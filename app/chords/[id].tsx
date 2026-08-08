import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { getChordById } from '@/content';
import { getChordMastery } from '@/db/mastery';
import { CHORD_QUALITIES, type ChordQuality } from '@/music/chords';
import { STANDARD_TUNING } from '@/music/notes';
import { ChordDiagram } from '@/ui/ChordDiagram';
import { Card } from '@/ui/components/Card';
import { MasteryDots } from '@/ui/components/MasteryDots';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

export default function ChordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  const chord = useMemo(() => (id ? getChordById(id) : undefined), [id]);
  const mastery = useMemo(() => (id ? getChordMastery(id) : null), [id]);

  if (!chord) {
    return (
      <Screen>
        <Text>{t('common.loading')}</Text>
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
});
