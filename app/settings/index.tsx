import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { getHapticsEnabled, setHapticsEnabled } from '@/db/settings';
import { changeLanguage, SUPPORTED_LANGUAGES, type Language } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

/**
 * Settings.
 *
 * The language switch existed and worked from the first milestone, and was
 * unreachable: `changeLanguage` had no call sites, so the language was decided
 * once by the device locale at first launch and could never be changed. The
 * whole `settings.*` block of both translation files was dead text.
 */
export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const [haptics, setHaptics] = useState(() => getHapticsEnabled());
  const [restartNeeded, setRestartNeeded] = useState(false);

  const current = i18n.language as Language;

  const pick = async (language: Language) => {
    if (language === current) return;
    // True when the writing direction has to flip. iOS applies that only on the
    // next launch, so the honest thing is to say so rather than leave the
    // learner staring at a half-mirrored screen wondering what broke.
    const needsRestart = await changeLanguage(language);
    setRestartNeeded(needsRestart);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <Screen>
        <Card>
          <Text variant="label" tone="muted">
            {t('settings.language')}
          </Text>

          <View style={styles.options}>
            {SUPPORTED_LANGUAGES.map((language) => {
              const active = language === current;
              return (
                <Pressable
                  key={language}
                  onPress={() => void pick(language)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: active ? theme.colors.primary : 'transparent',
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text variant="label" tone={active ? 'inverse' : 'default'}>
                    {language === 'he' ? t('settings.hebrew') : t('settings.english')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {restartNeeded && (
            <Text variant="caption" tone="danger">
              {t('settings.languageRestart')}
            </Text>
          )}
        </Card>

        <Card>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text variant="label">{t('settings.haptics')}</Text>
              <Text variant="caption" tone="muted">
                {t('settings.hapticsDescription')}
              </Text>
            </View>
            <Switch
              value={haptics}
              onValueChange={(next) => {
                setHaptics(next);
                setHapticsEnabled(next);
              }}
              trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
            />
          </View>
        </Card>

        <Card>
          <Text variant="label">{t('settings.micCalibration')}</Text>
          <Text variant="caption" tone="muted">
            {t('settings.calibrateDescription')}
          </Text>
          <Button
            title={t('calibration.start')}
            variant="secondary"
            onPress={() => router.push('/settings/calibrate')}
          />
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  option: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
});
