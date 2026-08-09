import { detectOnsets, type Onset } from '@/dsp/onset';
import { buildGrid, type GridOptions, type PracticeGrid } from '@/music/grid';
import type { StrumStep } from '@/music/strum';
import { patternBars } from '@/music/strum';

import { alignToGrid, type Alignment } from './alignment';
import { computePerformanceMetrics, TIMING_TOLERANCES_MS, type PerformanceMetrics } from './metrics';

/**
 * The whole analysis, end to end: a recording in, a judgement out.
 *
 * Kept as one pure function over `Float32Array` so a complete take can be run
 * in CI against fixtures with known answers — the alternative being to judge it
 * by ear on a device, which is not a test.
 */

export type AnalyseTakeOptions = {
  samples: Float32Array;
  sampleRate: number;
  steps: readonly StrumStep[];
  /** The grid the metronome played. */
  grid: PracticeGrid;
  /**
   * Seconds between the audio clock and the recording. Measured by the
   * calibration flow; see `alignment.ts` for why guessing it is not an option.
   */
  latencySeconds?: number;
  /** Mastery level 0-5, which sets how tight the timing tolerance is. */
  level?: number;
};

export type TakeAnalysis = {
  metrics: PerformanceMetrics;
  alignment: Alignment;
  onsets: Onset[];
  toleranceMs: number;
  grid: PracticeGrid;
};

export function analyseTake({
  samples,
  sampleRate,
  steps,
  grid,
  latencySeconds = 0,
  level = 0,
}: AnalyseTakeOptions): TakeAnalysis {
  const toleranceMs =
    TIMING_TOLERANCES_MS[Math.max(0, Math.min(TIMING_TOLERANCES_MS.length - 1, level))] ??
    TIMING_TOLERANCES_MS[0];

  const { onsets } = detectOnsets(samples, { sampleRate });

  const alignment = alignToGrid(onsets, grid, steps, { latencySeconds });
  const metrics = computePerformanceMetrics(alignment, toleranceMs);

  return { metrics, alignment, onsets, toleranceMs, grid };
}

/**
 * Convenience for the common case: build the grid from the same options the
 * pattern player used, so the analysis cannot disagree with what was heard.
 */
export function gridForPattern(
  steps: readonly StrumStep[],
  options: Omit<GridOptions, 'bars'>,
): PracticeGrid {
  return buildGrid({
    ...options,
    bars: patternBars(
      steps,
      options.timeSignature ?? { beatsPerBar: 4, beatUnit: 4 },
      options.subdivision ?? 8,
    ),
  });
}
