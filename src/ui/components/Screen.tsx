import React, { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

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
  const base: ViewStyle = { backgroundColor: theme.colors.background };

  if (!scroll) {
    return <View style={[styles.flex, base, contentStyle]}>{children}</View>;
  }

  return (
    <ScrollView
      style={[styles.flex, base]}
      contentContainerStyle={[styles.content, contentStyle]}
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
