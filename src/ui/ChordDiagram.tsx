import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import type { ChordShapeData } from '@/content/schemas';
import { STANDARD_TUNING } from '@/music/notes';

import { useTheme } from './ThemeProvider';

const STRING_COUNT = 4;
const FRET_COUNT = 5;

type ChordDiagramProps = {
  shape: ChordShapeData;
  /** Overall width in points; height follows from it. */
  size?: number;
  showFingers?: boolean;
  showStringLabels?: boolean;
};

/**
 * Renders a ukulele chord grid.
 *
 * Strings are always drawn G-C-E-A left to right, and the diagram is never
 * mirrored for RTL — a chord chart is a picture of the instrument, not text,
 * and flipping it in Hebrew would teach the shape backwards.
 */
export function ChordDiagram({
  shape,
  size = 132,
  showFingers = true,
  showStringLabels = false,
}: ChordDiagramProps) {
  const theme = useTheme();

  const padding = size * 0.16;
  const gridWidth = size - padding * 2;
  const stringGap = gridWidth / (STRING_COUNT - 1);
  const fretGap = stringGap * 0.92;
  const gridHeight = fretGap * FRET_COUNT;
  const height = gridHeight + padding * 2;

  const stringX = (index: number) => padding + index * stringGap;
  /** Centre of `fret` (1-based) relative to the drawn window. */
  const fretCenterY = (fret: number) => padding + (fret - shape.baseFret + 0.5) * fretGap;

  const nutY = padding;
  const isOpenPosition = shape.baseFret === 1;
  const dotRadius = stringGap * 0.32;

  const { colors } = theme;

  return (
    <View accessibilityRole="image">
      <Svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
        {/* Nut: thick when the shape sits at the top of the neck. */}
        <Line
          x1={padding}
          y1={nutY}
          x2={padding + gridWidth}
          y2={nutY}
          stroke={colors.text}
          strokeWidth={isOpenPosition ? 4 : 1.5}
          strokeLinecap="round"
        />

        {Array.from({ length: FRET_COUNT }, (_, i) => i + 1).map((fret) => (
          <Line
            key={`fret-${fret}`}
            x1={padding}
            y1={nutY + fret * fretGap}
            x2={padding + gridWidth}
            y2={nutY + fret * fretGap}
            stroke={colors.border}
            strokeWidth={1.5}
          />
        ))}

        {Array.from({ length: STRING_COUNT }, (_, i) => i).map((index) => (
          <Line
            key={`string-${index}`}
            x1={stringX(index)}
            y1={nutY}
            x2={stringX(index)}
            y2={nutY + gridHeight}
            stroke={colors.border}
            strokeWidth={1.5}
          />
        ))}

        {/* Fret number label for shapes that start further up the neck. */}
        {!isOpenPosition && (
          <SvgText
            x={padding - stringGap * 0.45}
            y={fretCenterY(shape.baseFret) + dotRadius * 0.4}
            fill={colors.textMuted}
            fontSize={dotRadius * 1.1}
            fontWeight="600"
            textAnchor="middle"
          >
            {shape.baseFret}
          </SvgText>
        )}

        {shape.barre && (
          <Rect
            x={stringX(shape.barre.fromString) - dotRadius}
            y={fretCenterY(shape.barre.fret) - dotRadius}
            width={
              stringX(shape.barre.toString) - stringX(shape.barre.fromString) + dotRadius * 2
            }
            height={dotRadius * 2}
            rx={dotRadius}
            fill={colors.primary}
          />
        )}

        {shape.frets.map((fret, index) => {
          const x = stringX(index);

          if (fret < 0) {
            const armLength = dotRadius * 0.6;
            const y = nutY - dotRadius * 0.9;
            return (
              <G key={`mark-${index}`}>
                <Line
                  x1={x - armLength}
                  y1={y - armLength}
                  x2={x + armLength}
                  y2={y + armLength}
                  stroke={colors.textMuted}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <Line
                  x1={x - armLength}
                  y1={y + armLength}
                  x2={x + armLength}
                  y2={y - armLength}
                  stroke={colors.textMuted}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </G>
            );
          }

          if (fret === 0) {
            return (
              <Circle
                key={`mark-${index}`}
                cx={x}
                cy={nutY - dotRadius * 0.9}
                r={dotRadius * 0.55}
                stroke={colors.textMuted}
                strokeWidth={2}
                fill="none"
              />
            );
          }

          const coveredByBarre =
            shape.barre !== null &&
            shape.barre.fret === fret &&
            index >= shape.barre.fromString &&
            index <= shape.barre.toString;

          const finger = shape.fingers[index] ?? 0;

          return (
            <G key={`mark-${index}`}>
              {!coveredByBarre && (
                <Circle cx={x} cy={fretCenterY(fret)} r={dotRadius} fill={colors.primary} />
              )}
              {showFingers && finger > 0 && (
                <SvgText
                  x={x}
                  y={fretCenterY(fret) + dotRadius * 0.38}
                  fill={colors.onPrimary}
                  fontSize={dotRadius * 1.15}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {finger}
                </SvgText>
              )}
            </G>
          );
        })}

        {showStringLabels &&
          STANDARD_TUNING.map((string) => (
            <SvgText
              key={`label-${string.index}`}
              x={stringX(string.index)}
              y={nutY + gridHeight + padding * 0.7}
              fill={colors.textMuted}
              fontSize={dotRadius * 0.95}
              fontWeight="600"
              textAnchor="middle"
            >
              {string.name}
            </SvgText>
          ))}
      </Svg>
    </View>
  );
}
