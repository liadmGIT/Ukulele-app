import { accentGain, type StrumAccent } from '@/music/strum';

import type { Alignment } from './alignment';

/**
 * Turning an alignment into numbers a review can be written from.
 *
 * Per the brief, two dimensions are scored: **timing** and **dynamics**.
 * Everything here is a pure function of the alignment, so a review is
 * reproducible and every rule that reads these numbers is testable.
 */

/** Timing tolerance by level: generous for a beginner, tight for level 5. */
export const TIMING_TOLERANCES_MS = [50, 45, 40, 35, 30, 25] as const;

export type TimingMetrics = {
  /** Mean absolute deviation in milliseconds. */
  meanAbsoluteMs: number;
  /** Signed mean: negative means early overall. */
  meanSignedMs: number;
  /** Spread of the deviations — how steady the playing was. */
  standardDeviationMs: number;
  /** Fraction of played strums inside the tolerance, 0..1. */
  withinToleranceRatio: number;
  /**
   * Milliseconds gained per strum over the take. Negative means speeding up.
   * This is the slope of a least-squares line through the deviations, which is
   * what separates "rushed the whole way through" from "started fine, then ran
   * away" — advice that differs completely.
   */
  driftMsPerStrum: number;
  /** Whether that drift is large enough to be worth mentioning. */
  tendency: 'rushing' | 'dragging' | 'steady';
  /** 0..100. */
  score: number;
};

export type DynamicsMetrics = {
  /**
   * How well the measured loudness tracks the pattern's intended accents,
   * -1..1. This is a correlation, so it is indifferent to overall volume — a
   * quiet performance with the right shape scores as well as a loud one.
   */
  accentCorrelation: number;
  /**
   * Measured loudest-to-softest ratio. Near 1 means every strum was hit
   * identically, which is the classic beginner failure the score exists to
   * catch.
   */
  accentContrast: number;
  /** The contrast the pattern asks for, for comparison. */
  intendedContrast: number;
  /** True when the pattern has no dynamics to speak of, so there is nothing to score. */
  patternIsFlat: boolean;
  /** 0..100. */
  score: number;
};

export type PerformanceMetrics = {
  timing: TimingMetrics;
  dynamics: DynamicsMetrics;
  /** Fraction of expected strums that were played at all, 0..1. */
  completionRatio: number;
  missedCount: number;
  extraCount: number;
  playedCount: number;
  expectedCount: number;
  /** 0..100, combining the above. */
  overallScore: number;
};

export function computeTimingMetrics(
  alignment: Alignment,
  toleranceMs: number = TIMING_TOLERANCES_MS[0],
): TimingMetrics {
  const deviations = alignment.matches
    .map((match) => match.deviationSeconds)
    .filter((value): value is number => value !== null)
    .map((seconds) => seconds * 1000);

  if (deviations.length === 0) {
    return {
      meanAbsoluteMs: 0,
      meanSignedMs: 0,
      standardDeviationMs: 0,
      withinToleranceRatio: 0,
      driftMsPerStrum: 0,
      tendency: 'steady',
      score: 0,
    };
  }

  const meanSignedMs = mean(deviations);
  const meanAbsoluteMs = mean(deviations.map(Math.abs));
  const standardDeviationMs = Math.sqrt(mean(deviations.map((d) => (d - meanSignedMs) ** 2)));
  const withinToleranceRatio =
    deviations.filter((d) => Math.abs(d) <= toleranceMs).length / deviations.length;

  const driftMsPerStrum = deviations.length >= 4 ? leastSquaresSlope(deviations) : 0;

  // A whole tolerance-width of drift across ten strums is the point at which
  // it stops being noise and starts being a habit worth naming.
  const driftThreshold = toleranceMs / 10;
  const tendency =
    driftMsPerStrum < -driftThreshold
      ? 'rushing'
      : driftMsPerStrum > driftThreshold
        ? 'dragging'
        : 'steady';

  // Accuracy is what the learner feels; steadiness is what makes them sound
  // musical. Weighted towards accuracy but not exclusively.
  const accuracyScore = clamp01(1 - meanAbsoluteMs / (toleranceMs * 2)) * 100;
  const steadinessScore = clamp01(1 - standardDeviationMs / (toleranceMs * 2)) * 100;
  const score = Math.round(accuracyScore * 0.6 + steadinessScore * 0.4);

  return {
    meanAbsoluteMs,
    meanSignedMs,
    standardDeviationMs,
    withinToleranceRatio,
    driftMsPerStrum,
    tendency,
    score,
  };
}

/**
 * Below this spread between the loudest and softest intended strum, a pattern
 * has no dynamics worth grading.
 */
const FLAT_PATTERN_CONTRAST = 1.2;

export function computeDynamicsMetrics(alignment: Alignment): DynamicsMetrics {
  const played = alignment.matches.filter(
    (match): match is typeof match & { onset: NonNullable<typeof match.onset> } => {
      return match.onset !== null;
    },
  );

  const intended = played.map((match) => accentGain(match.step.accent as StrumAccent));
  const measured = played.map((match) => match.onset.peakAmplitude);

  const intendedContrast = ratio(intended);
  const patternIsFlat = intendedContrast < FLAT_PATTERN_CONTRAST;

  if (played.length < 3) {
    return {
      accentCorrelation: 0,
      accentContrast: 1,
      intendedContrast,
      patternIsFlat,
      score: 0,
    };
  }

  const accentContrast = ratio(measured);
  const accentCorrelation = correlation(intended, measured);

  if (patternIsFlat) {
    // Nothing to grade: the pattern asks for every strum to be the same. Full
    // marks rather than a meaningless correlation of near-constant values.
    return { accentCorrelation, accentContrast, intendedContrast, patternIsFlat, score: 100 };
  }

  // Correlation says the accents are in the right places; contrast says they
  // are actually different from each other. Both are needed: a performance can
  // track the shape faintly and still sound flat.
  const shapeScore = clamp01((accentCorrelation + 1) / 2) * 100;
  const contrastScore = clamp01((accentContrast - 1) / (intendedContrast - 1)) * 100;
  const score = Math.round(shapeScore * 0.6 + contrastScore * 0.4);

  return { accentCorrelation, accentContrast, intendedContrast, patternIsFlat, score };
}

export function computePerformanceMetrics(
  alignment: Alignment,
  toleranceMs: number = TIMING_TOLERANCES_MS[0],
): PerformanceMetrics {
  const timing = computeTimingMetrics(alignment, toleranceMs);
  const dynamics = computeDynamicsMetrics(alignment);

  const completionRatio =
    alignment.expectedCount === 0 ? 0 : alignment.playedCount / alignment.expectedCount;

  // Completion gates the rest. Playing four of twenty strums beautifully in
  // time is not a good performance, and a score that said otherwise would be
  // actively misleading.
  const overallScore = Math.round(
    (timing.score * 0.55 + dynamics.score * 0.25 + completionRatio * 100 * 0.2) *
      clamp01(completionRatio + 0.15),
  );

  return {
    timing,
    dynamics,
    completionRatio,
    missedCount: alignment.missedCount,
    extraCount: alignment.extras.length,
    playedCount: alignment.playedCount,
    expectedCount: alignment.expectedCount,
    overallScore: Math.max(0, Math.min(100, overallScore)),
  };
}

// ------------------------------------------------------------------ maths --

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Loudest-to-softest ratio, guarding against a zero denominator. */
function ratio(values: readonly number[]): number {
  if (values.length === 0) return 1;
  const loudest = Math.max(...values);
  const softest = Math.min(...values);
  if (softest <= 1e-6) return loudest > 1e-6 ? Infinity : 1;
  return loudest / softest;
}

/** Slope of the least-squares line through the values, per index step. */
function leastSquaresSlope(values: readonly number[]): number {
  const n = values.length;
  const meanIndex = (n - 1) / 2;
  const meanValue = mean(values);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i += 1) {
    const dx = i - meanIndex;
    numerator += dx * (values[i]! - meanValue);
    denominator += dx * dx;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

/** Pearson correlation; 0 when either series is constant. */
function correlation(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;

  const meanA = mean(a.slice(0, n));
  const meanB = mean(b.slice(0, n));

  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;

  for (let i = 0; i < n; i += 1) {
    const da = a[i]! - meanA;
    const db = b[i]! - meanB;
    covariance += da * db;
    varianceA += da * da;
    varianceB += db * db;
  }

  if (varianceA <= 1e-12 || varianceB <= 1e-12) return 0;
  return covariance / Math.sqrt(varianceA * varianceB);
}
