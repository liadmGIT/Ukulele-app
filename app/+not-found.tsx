import { Link, Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { spacing } from '@/ui/theme';

/**
 * Where an unmatched route lands.
 *
 * Without this file expo-router shows its own "Unmatched Route" screen — in
 * English, styled like a developer tool, inside an app whose every other screen
 * is Hebrew. Reachable from any stale link, and from any typo in a deep link.
 */
export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('common.notFound') }} />
      <Screen>
        <Card>
          <View style={styles.body}>
            <Text variant="heading">{t('common.notFound')}</Text>
            <Text variant="body" tone="muted">
              {t('common.notFoundBody')}
            </Text>
            <Link href="/" style={styles.link}>
              <Text variant="label" tone="primary">
                {t('common.goBack')}
              </Text>
            </Link>
          </View>
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  link: { paddingVertical: spacing.sm },
});
