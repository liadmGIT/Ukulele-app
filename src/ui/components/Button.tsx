import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { radius, spacing } from '../theme';
import { useTheme } from '../ThemeProvider';

import { Text } from './Text';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';

  const base: ViewStyle = {
    backgroundColor: isPrimary ? theme.colors.primary : 'transparent',
    borderColor: isPrimary ? theme.colors.primary : theme.colors.border,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        base,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text variant="label" tone={isPrimary ? 'inverse' : 'default'}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
});
