import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { IN_TUNE_CENTS } from '@/music/tuner';

import { useTheme } from './ThemeProvider';

/** Cents at the ends of the dial. Wider than this and the needle is useless. */
const RANGE_CENTS = 50;
const SWEEP_DEGREES = 120;

type TunerNeedleProps = {
  /** Signed cents from the target, or null when there is no reading. */
  cents: number | null;
  inTune: boolean;
  size?: number;
};

/**
 * An arc dial with a needle, rather than a moving bar.
 *
 * A dial reads at a glance while both hands are on the instrument — the learner
 * is turning a peg and looking sideways at the phone, not studying a number.
 */
export function TunerNeedle({ cents, inTune, size = 260 }: TunerNeedleProps) {
  const theme = useTheme();

  const width = size;
  const height = size * 0.62;
  const cx = width / 2;
  const cy = height * 0.95;
  const radius = height * 0.78;

  const clamped = cents === null ? 0 : Math.max(-RANGE_CENTS, Math.min(RANGE_CENTS, cents));
  const angle = (clamped / RANGE_CENTS) * (SWEEP_DEGREES / 2);

  const needleColor = cents === null
    ? theme.colors.border
    : inTune
      ? theme.colors.success
      : theme.colors.accent;

  const pointOnArc = (degrees: number, r: number) => {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(radians), y: cy + r * Math.sin(radians) };
  };

  const arcStart = pointOnArc(-SWEEP_DEGREES / 2, radius);
  const arcEnd = pointOnArc(SWEEP_DEGREES / 2, radius);

  // The in-tune band, drawn as a wider stroke so it reads as a target zone.
  const toleranceAngle = (IN_TUNE_CENTS / RANGE_CENTS) * (SWEEP_DEGREES / 2);
  const bandStart = pointOnArc(-toleranceAngle, radius);
  const bandEnd = pointOnArc(toleranceAngle, radius);

  const needleTip = pointOnArc(angle, radius * 0.9);

  return (
    <View accessibilityRole="image">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={`M ${arcStart.x} ${arcStart.y} A ${radius} ${radius} 0 0 1 ${arcEnd.x} ${arcEnd.y}`}
          stroke={theme.colors.border}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />

        <Path
          d={`M ${bandStart.x} ${bandStart.y} A ${radius} ${radius} 0 0 1 ${bandEnd.x} ${bandEnd.y}`}
          stroke={theme.colors.success}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
          opacity={inTune ? 1 : 0.35}
        />

        {[-50, -25, 0, 25, 50].map((tick) => {
          const tickAngle = (tick / RANGE_CENTS) * (SWEEP_DEGREES / 2);
          const outer = pointOnArc(tickAngle, radius - 6);
          const inner = pointOnArc(tickAngle, radius - (tick === 0 ? 20 : 14));
          const label = pointOnArc(tickAngle, radius - 34);

          return (
            <G key={tick}>
              <Line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={tick === 0 ? theme.colors.text : theme.colors.border}
                strokeWidth={tick === 0 ? 3 : 2}
                strokeLinecap="round"
              />
              {tick !== 0 && (
                <SvgText
                  x={label.x}
                  y={label.y + 4}
                  fill={theme.colors.textMuted}
                  fontSize={11}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {tick > 0 ? `+${tick}` : tick}
                </SvgText>
              )}
            </G>
          );
        })}

        <Line
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke={needleColor}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <Circle cx={cx} cy={cy} r={7} fill={needleColor} />
      </Svg>
    </View>
  );
}
