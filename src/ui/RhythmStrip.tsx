import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Subdivision, TimeSignature } from '@/music/grid';
import { countingSyllables, describeStep, type StrumStep } from '@/music/strum';

import { useTheme } from './ThemeProvider';

/**
 * The strum pattern, drawn.
 *
 * Every step shows all four things the guide has to convey at once: which way
 * the hand moves, whether it strikes, whether the strings ring or are damped,
 * and how hard. Force is carried by weight and fill rather than by a label,
 * so the pattern can be read at a glance while playing.
 *
 * Left to right, always. Like the chord diagram this depicts something physical
 * — the passage of time — so it must not mirror in Hebrew, and its container
 * uses `musicalRow` for the same reason.
 */

type RhythmStripProps = {
  steps: readonly StrumStep[];
  timeSignature: TimeSignature;
  subdivision: Subdivision;
  /** Index of the step currently sounding, or null when stopped. */
  activeStep?: number | null;
  width?: number;
  showCounting?: boolean;
};

export function RhythmStrip({
  steps,
  timeSignature,
  subdivision,
  activeStep = null,
  width = 320,
  showCounting = true,
}: RhythmStripProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const count = Math.max(1, steps.length);
  const slot = width / count;
  const arrowHeight = Math.min(slot * 1.5, 46);
  const countingHeight = showCounting ? 20 : 0;
  const height = arrowHeight + countingHeight + 16;

  const syllables = countingSyllables(timeSignature, subdivision);
  const perBar = syllables.length;

  const centreOf = (index: number) => slot * (index + 0.5);
  const top = 8;
  const bottom = top + arrowHeight;

  return (
    <View accessibilityRole="image">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Bar lines, so a two-bar pattern reads as two bars. */}
        {Array.from({ length: Math.floor(count / perBar) }, (_, bar) => bar)
          .filter((bar) => bar > 0)
          .map((bar) => (
            <Line
              key={`bar-${bar}`}
              x1={slot * bar * perBar}
              y1={top - 4}
              x2={slot * bar * perBar}
              y2={bottom + 4}
              stroke={theme.colors.border}
              strokeWidth={1.5}
            />
          ))}

        {steps.map((step, index) => {
          const x = centreOf(index);
          const active = activeStep === index;
          const label = describeStep(step)
            .map((key) => t(key))
            .join(', ');

          return (
            <G key={index} accessibilityLabel={label}>
              {active && (
                <Rect
                  x={slot * index + 1}
                  y={top - 6}
                  width={slot - 2}
                  height={arrowHeight + 12}
                  rx={6}
                  fill={theme.colors.primary}
                  opacity={0.16}
                />
              )}
              <StepGlyph
                step={step}
                x={x}
                top={top}
                bottom={bottom}
                slot={slot}
                active={active}
                theme={theme}
              />
            </G>
          );
        })}

        {showCounting &&
          steps.map((_, index) => {
            const isBeat = index % (perBar / timeSignature.beatsPerBar) === 0;
            return (
              <SvgText
                key={`count-${index}`}
                x={centreOf(index)}
                y={height - 4}
                fill={activeStep === index ? theme.colors.primary : theme.colors.textMuted}
                fontSize={12}
                fontWeight={isBeat ? '700' : '500'}
                textAnchor="middle"
              >
                {syllables[index % perBar] ?? ''}
              </SvgText>
            );
          })}
      </Svg>
    </View>
  );
}

function StepGlyph({
  step,
  x,
  top,
  bottom,
  slot,
  active,
  theme,
}: {
  step: StrumStep;
  x: number;
  top: number;
  bottom: number;
  slot: number;
  active: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const { colors } = theme;

  // A rest is drawn as a faint tick rather than left blank: the learner has to
  // see that the step exists and is deliberately silent, otherwise the pattern
  // reads as though it had fewer steps than it does.
  if (step.dir === 'rest') {
    const middle = (top + bottom) / 2;
    return (
      <Line
        x1={x - slot * 0.16}
        y1={middle}
        x2={x + slot * 0.16}
        y2={middle}
        stroke={colors.border}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    );
  }

  const strong = step.accent === 'strong';
  const soft = step.accent === 'soft';

  const stroke = active ? colors.primary : strong ? colors.text : colors.textMuted;
  const strokeWidth = strong ? 3.5 : soft ? 1.6 : 2.4;
  const opacity = soft ? 0.65 : 1;

  const head = slot * (strong ? 0.24 : 0.19);
  const down = step.dir === 'D';

  // Arrows point the way the hand moves: down-strokes point down.
  const tailY = down ? top : bottom;
  const tipY = down ? bottom : top;
  const headY = down ? bottom - head : top + head;

  return (
    <G opacity={opacity}>
      <Line
        x1={x}
        y1={tailY}
        x2={x}
        y2={tipY}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d={`M ${x - head * 0.6} ${headY} L ${x} ${tipY} L ${x + head * 0.6} ${headY}`}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {step.muted && (
        <G>
          <Line
            x1={x - head * 0.7}
            y1={(top + bottom) / 2 - head * 0.7}
            x2={x + head * 0.7}
            y2={(top + bottom) / 2 + head * 0.7}
            stroke={colors.danger}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1={x - head * 0.7}
            y1={(top + bottom) / 2 + head * 0.7}
            x2={x + head * 0.7}
            y2={(top + bottom) / 2 - head * 0.7}
            stroke={colors.danger}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </G>
      )}
    </G>
  );
}
