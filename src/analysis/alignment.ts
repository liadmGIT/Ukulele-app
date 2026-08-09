import type { Onset } from '@/dsp/onset';
import type { PracticeGrid, StepMark } from '@/music/grid';
import type { StrumStep } from '@/music/strum';

/**
 * Matching what was played against what was asked for.
 *
 * This is the step the whole listening engine turns on, and it is only
 * tractable because the app drives the metronome: the expected time of every
 * strum is *known*, not inferred. Working out where the beat was from a
 * beginner's uneven playing is a research problem; measuring the distance from
 * each onset to a known grid is arithmetic.
 */

export type MatchedStep = {
  mark: StepMark;
  step: StrumStep;
  /** The onset that was matched to it, if any. */
  onset: Onset | null;
  /** Signed seconds: negative means played early (rushing). */
  deviationSeconds: number | null;
};

export type Alignment = {
  /** One entry per expected strum, in order. */
  matches: MatchedStep[];
  /** Onsets that matched no expected strum — extra strums the learner added. */
  extras: Onset[];
  /** Expected strums with no onset near them. */
  missedCount: number;
  playedCount: number;
  expectedCount: number;
};

export type AlignOptions = {
  /**
   * How far from an expected step an onset may be and still count as that
   * step. Half a step is the natural limit — beyond it the onset is closer to
   * the neighbour and calling it late rather than early would be arbitrary.
   */
  toleranceSeconds?: number;
  /**
   * Latency between the audio clock and the recording, in seconds. Subtracted
   * from every onset before matching.
   *
   * This matters more than its size suggests: an uncorrected constant delay is
   * indistinguishable from the learner consistently playing late, so the app
   * would confidently report a fault that belongs to the hardware. It is
   * measured once by the calibration flow rather than guessed.
   */
  latencySeconds?: number;
};

/**
 * Aligns detected onsets to the grid's expected strums.
 *
 * Greedy nearest-match in time order, which is correct here because both
 * sequences are monotonic and the tolerance is under half a step: no onset can
 * be nearest to a step that an earlier onset has a better claim to.
 */
export function alignToGrid(
  onsets: readonly Onset[],
  grid: PracticeGrid,
  steps: readonly StrumStep[],
  options: AlignOptions = {},
): Alignment {
  const { latencySeconds = 0 } = options;
  const tolerance = options.toleranceSeconds ?? grid.stepSeconds / 2;

  // Only steps that ask for a strum are expected; a rest has nothing to match.
  const expected = grid.steps
    .map((mark, index) => ({ mark, step: steps[index % steps.length] }))
    .filter((entry): entry is { mark: StepMark; step: StrumStep } => {
      return entry.step !== undefined && entry.step.dir !== 'rest';
    });

  const corrected = onsets.map((onset) => ({
    onset,
    time: onset.time - latencySeconds,
  }));

  const matches: MatchedStep[] = expected.map(({ mark, step }) => ({
    mark,
    step,
    onset: null,
    deviationSeconds: null,
  }));

  const used = new Set<number>();

  matches.forEach((match, index) => {
    let bestOnset = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < corrected.length; i += 1) {
      if (used.has(i)) continue;

      const distance = Math.abs(corrected[i]!.time - match.mark.time);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestOnset = i;
      }
    }

    if (bestOnset >= 0 && bestDistance <= tolerance) {
      used.add(bestOnset);
      matches[index]!.onset = corrected[bestOnset]!.onset;
      matches[index]!.deviationSeconds = corrected[bestOnset]!.time - match.mark.time;
    }
  });

  const extras = corrected.filter((_, index) => !used.has(index)).map((entry) => entry.onset);
  const playedCount = matches.filter((match) => match.onset !== null).length;

  return {
    matches,
    extras,
    missedCount: matches.length - playedCount,
    playedCount,
    expectedCount: matches.length,
  };
}

/**
 * Estimates the constant offset between a take and the grid.
 *
 * Used by the microphone calibration flow, where the recording is of the app's
 * own metronome and any offset is by definition latency rather than a mistake.
 * It is deliberately *not* applied to a learner's performance: subtracting the
 * mean deviation there would erase the very "you are consistently rushing"
 * finding the review exists to report.
 */
export function estimateConstantOffset(
  onsets: readonly Onset[],
  expectedTimes: readonly number[],
  searchWindowSeconds = 0.25,
): number | null {
  if (onsets.length === 0 || expectedTimes.length === 0) return null;

  const deviations: number[] = [];

  for (const time of expectedTimes) {
    let best = Infinity;
    for (const onset of onsets) {
      const delta = onset.time - time;
      if (Math.abs(delta) < Math.abs(best)) best = delta;
    }
    if (Number.isFinite(best) && Math.abs(best) <= searchWindowSeconds) {
      deviations.push(best);
    }
  }

  if (deviations.length === 0) return null;

  // Median rather than mean: one misfired detection should not move the
  // calibration that every future measurement depends on.
  const sorted = [...deviations].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
