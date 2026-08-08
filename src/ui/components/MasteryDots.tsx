import React from 'react';
import { StyleSheet, View } from 'react-native';

import { MAX_MASTERY_LEVEL } from '@/db/mastery';

import { useTheme } from '../ThemeProvider';

type MasteryDotsProps = {
  level: number;
  size?: number;
};

/** Five dots filled up to the learner's mastery level for a chord or song. */
export function MasteryDots({ level, size = 7 }: MasteryDotsProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(MAX_MASTERY_LEVEL, Math.round(level)));

  return (
    <View
      style={styles.row}
      accessibilityLabel={`${clamped} / ${MAX_MASTERY_LEVEL}`}
      accessibilityRole="progressbar"
    >
      {Array.from({ length: MAX_MASTERY_LEVEL }, (_, index) => (
        <View
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor:
              index < clamped ? theme.colors.mastery[clamped] ?? theme.colors.primary : theme.colors.border,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3, alignItems: 'center' },
});
