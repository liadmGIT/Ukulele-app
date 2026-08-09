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
  /** i18n key; these used to be Hebrew and English literals sitting in this file. */
  descriptionKey: string;
};

const TOOLS: readonly Tool[] = [
  {
    key: 'tuner',
    descriptionKey: 'practice.toolTunerDescription',
    titleKey: 'practice.tuner',
    icon: 'tune-vertical',
    href: '/practice/tuner',
  },
  {
    key: 'metronome',
    descriptionKey: 'practice.toolMetronomeDescription',
    titleKey: 'practice.metronome',
    icon: 'metronome',
    href: '/practice/metronome',
  },
  {
    key: 'patterns',
    descriptionKey: 'practice.toolPatternsDescription',
    titleKey: 'patterns.title',
    icon: 'gesture-swipe-vertical',
    href: '/practice/patterns',
  },
  {
    key: 'record',
    descriptionKey: 'practice.toolRecordDescription',
    titleKey: 'record.title',
    icon: 'microphone-outline',
    href: '/practice/record',
  },
  {
    key: 'drill',
    descriptionKey: 'practice.toolDrillDescription',
    titleKey: 'practice.chordChangeDrill',
    icon: 'swap-horizontal',
    href: '/practice/drill',
  },
  {
    key: 'settings',
    descriptionKey: 'practice.toolSettingsDescription',
    titleKey: 'settings.title',
    icon: 'cog-outline',
    href: '/settings',
  },
];

export default function PracticeScreen() {
  const { t } = useTranslation();
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
                {t(tool.descriptionKey)}
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
