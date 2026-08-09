import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

type Tool = {
  key: string;
  titleKey: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  href?: string;
  descriptionHe: string;
  descriptionEn: string;
};

const TOOLS: readonly Tool[] = [
  {
    key: 'tuner',
    titleKey: 'practice.tuner',
    icon: 'tune-vertical',
    href: '/practice/tuner',
    descriptionHe: 'כוון את האוקולילי לפני כל תרגול',
    descriptionEn: 'Tune up before every session',
  },
  {
    key: 'metronome',
    titleKey: 'practice.metronome',
    icon: 'metronome',
    href: '/practice/metronome',
    descriptionHe: 'שמור על קצב יציב',
    descriptionEn: 'Keep a steady beat',
  },
  {
    key: 'patterns',
    titleKey: 'patterns.title',
    icon: 'gesture-swipe-vertical',
    href: '/practice/patterns',
    descriptionHe: 'מטה, מעלה, שקט או עמום — וכמה חזק',
    descriptionEn: 'Down, up, silent or muted — and how hard',
  },
  {
    key: 'record',
    titleKey: 'record.title',
    icon: 'microphone-outline',
    href: '/practice/record',
    descriptionHe: 'נגן, ונשמע איפה התזמון והעוצמה שלך',
    descriptionEn: 'Play, and hear how your timing and dynamics did',
  },
  {
    key: 'drill',
    titleKey: 'practice.chordChangeDrill',
    icon: 'swap-horizontal',
    descriptionHe: 'בקרוב — כמה מעברים בדקה?',
    descriptionEn: 'Coming soon — how many changes per minute?',
  },
];

export default function PracticeScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  return (
    <Screen>
      {TOOLS.map((tool) => (
        <Card
          key={tool.key}
          onPress={tool.href ? () => router.push(tool.href as never) : undefined}
          style={tool.href ? undefined : styles.disabled}
        >
          <View style={styles.row}>
            <MaterialCommunityIcons
              name={tool.icon}
              size={28}
              color={tool.href ? theme.colors.primary : theme.colors.textMuted}
            />
            <View style={styles.text}>
              <Text variant="heading">{t(tool.titleKey)}</Text>
              <Text variant="caption" tone="muted">
                {i18n.language === 'he' ? tool.descriptionHe : tool.descriptionEn}
              </Text>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  text: { flex: 1, gap: 2 },
  disabled: { opacity: 0.55 },
});
