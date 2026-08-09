import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { getStrumPatterns } from '@/content';
import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { musicalRow } from '@/ui/direction';
import { RhythmStrip } from '@/ui/RhythmStrip';
import { spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

export default function PatternsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const patterns = getStrumPatterns();
  const isHebrew = i18n.language === 'he';

  return (
    <>
      <Stack.Screen options={{ title: t('patterns.title') }} />
      <Screen>
        <Text variant="body" tone="muted">
          {t('patterns.subtitle')}
        </Text>

        {patterns.map((pattern) => (
          <Card key={pattern.id} onPress={() => router.push(`/practice/patterns/${pattern.id}`)}>
            <View style={styles.header}>
              <Text variant="heading">{isHebrew ? pattern.nameHe : pattern.nameEn}</Text>
              <View style={[styles.pips, musicalRow]}>
                {Array.from({ length: 5 }, (_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.pip,
                      {
                        backgroundColor:
                          index < pattern.difficulty ? theme.colors.accent : theme.colors.border,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            <View style={[styles.stripRow, musicalRow]}>
              <RhythmStrip
                steps={pattern.steps}
                timeSignature={pattern.timeSignature}
                subdivision={pattern.subdivision}
                width={280}
                showCounting={false}
              />
            </View>

            <Text variant="caption" tone="muted">
              {isHebrew ? pattern.descriptionHe : pattern.descriptionEn}
            </Text>
          </Card>
        ))}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pips: { gap: 3 },
  pip: { width: 12, height: 5, borderRadius: 3 },
  // Time runs left to right regardless of the interface direction.
  stripRow: { justifyContent: 'center', marginTop: spacing.xs },
});
