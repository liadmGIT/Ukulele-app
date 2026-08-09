import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getChordById, getStrumPatternById } from '@/content';
import { ChordDiagram } from '@/ui/ChordDiagram';
import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { PatternPlayerCard } from '@/ui/PatternPlayerCard';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

/** Easy, common chords to try a pattern over. */
const PRACTICE_CHORD_IDS = ['C-maj', 'A-min', 'F-maj', 'G-maj', 'C-dom7', 'D-min'];

export default function PatternDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  const [chordId, setChordId] = useState(PRACTICE_CHORD_IDS[0]!);

  const pattern = useMemo(() => (id ? getStrumPatternById(id) : undefined), [id]);
  const chord = useMemo(() => getChordById(chordId), [chordId]);
  const chords = useMemo(
    () => PRACTICE_CHORD_IDS.map((chordKey) => getChordById(chordKey)).filter(Boolean),
    [],
  );

  if (!pattern) {
    return (
      <Screen>
        <Text>{t('common.loading')}</Text>
      </Screen>
    );
  }

  const shape = chord?.shapes[0];
  const title = i18n.language === 'he' ? pattern.nameHe : pattern.nameEn;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen>
        <PatternPlayerCard
          pattern={pattern}
          frets={shape?.frets ?? [0, 0, 0, 3]}
          chordName={chord?.nameEn}
        />

        <Card>
          <Text variant="label" tone="muted">
            {t('patterns.chooseChord')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chordRow}>
              {chords.map((option) => {
                if (!option) return null;
                const active = option.id === chordId;
                const optionShape = option.shapes[0];

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setChordId(option.id)}
                    style={[
                      styles.chordTile,
                      {
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                        backgroundColor: active ? theme.colors.surfaceAlt : 'transparent',
                      },
                    ]}
                  >
                    <Text variant="label">{option.nameEn}</Text>
                    {optionShape && (
                      <ChordDiagram shape={optionShape} size={62} showFingers={false} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Card>

        <Card>
          <Text variant="label" tone="muted">
            {t('patterns.legend')}
          </Text>
          {[
            'patterns.legendDown',
            'patterns.legendUp',
            'patterns.legendRest',
            'patterns.legendMuted',
            'patterns.legendStrong',
            'patterns.legendSoft',
          ].map((key) => (
            <Text key={key} variant="caption" tone="muted">
              • {t(key)}
            </Text>
          ))}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  chordRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  chordTile: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
