import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { typography } from '../theme';
import { useTheme } from '../ThemeProvider';

type Variant = keyof typeof typography;
type Tone = 'default' | 'muted' | 'primary' | 'danger' | 'inverse';

export type TextProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
};

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const theme = useTheme();

  const color =
    tone === 'muted'
      ? theme.colors.textMuted
      : tone === 'primary'
        ? theme.colors.primary
        : tone === 'danger'
          ? theme.colors.danger
          : tone === 'inverse'
            ? theme.colors.textInverse
            : theme.colors.text;

  // `writingDirection: 'auto'` keeps mixed Hebrew/English strings (chord names
  // inside Hebrew sentences) from reordering incorrectly.
  const base: TextStyle = {
    ...(typography[variant] as TextStyle),
    color,
    writingDirection: 'auto',
  };

  return <RNText style={[base, style]} {...rest} />;
}
