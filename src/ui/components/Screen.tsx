import React, { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme';
import { useTheme } from '../ThemeProvider';

type ScreenProps = {
  children: ReactNode;
  /** Set false for screens that manage their own scrolling (lists, players). */
  scroll?: boolean;
  contentStyle?: ViewStyle;
};

export function Screen({ children, scroll = true, contentStyle }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const base: ViewStyle = { backgroundColor: theme.colors.background };

  /**
   * Room for the home indicator.
   *
   * Every screen used a flat 16pt bottom padding, which on a notched iPhone put
   * the song player's Play button underneath the indicator — the one control
   * you reach for while holding an instrument, on the one screen that does not
   * scroll out of the way.
   */
  const bottom = Math.max(insets.bottom, spacing.lg);

  if (!scroll) {
    return (
      // The inset comes last so a screen's own padding cannot overwrite it.
      <View style={[styles.flex, base, contentStyle, { paddingBottom: bottom }]}>{children}</View>
    );
  }

  return (
    <ScrollView
      style={[styles.flex, base]}
      contentContainerStyle={[styles.content, contentStyle, { paddingBottom: bottom + spacing.xxl }]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
});
