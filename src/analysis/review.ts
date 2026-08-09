import type { PerformanceMetrics } from './metrics';

/**
 * Turning metrics into something worth reading.
 *
 * Rule-based and deterministic rather than generated: the same performance
 * always produces the same review, every claim traces to a measured number, and
 * it costs nothing and works on a plane. Notes are emitted as an id plus
 * parameters rather than as finished text, so the review stored with a
 * recording still renders in whichever language the learner is using months
 * later, and rewording a rule does not invalidate the history.
 *
 * Two things this deliberately will not do:
 *
 * - **Invent praise.** The positive note is chosen from things that actually
 *   went well. When nothing did, it says something true instead of something
 *   nice, because a learner who is told everything is great and can hear that
 *   it is not will stop believing the app.
 * - **Say more than three things.** A list of eight faults is not feedback, it
 *   is discouragement. The notes are ranked and cut.
 */

export type ReviewNoteKind = 'timing' | 'dynamics' | 'completion' | 'positive';

export type ReviewNote = {
  /** Rule id; the i18n key is `review.<id>`. */
  id: string;
  kind: ReviewNoteKind;
  /** Higher is more important. Used to rank, then cut to three. */
  severity: number;
  params: Record<string, string | number>;
};

export type Review = {
  /** i18n key for the one-line verdict. */
  headlineId: string;
  score: number;
  /** At most three, most important first. */
  notes: ReviewNote[];
  positive: ReviewNote;
};

export const MAX_NOTES = 3;

type Rule = (metrics: PerformanceMetrics, toleranceMs: number) => ReviewNote | null;

// ------------------------------------------------------------ suggestions --

const TIMING_RULES: Rule[] = [
  // Drift first: "you sped up" and "you played early" call for different
  // advice, and reporting the wrong one sends the learner after a fault they
  // do not have.
  (metrics) => {
    const { tendency, driftMsPerStrum } = metrics.timing;
    if (tendency !== 'rushing') return null;

    const totalMs = Math.abs(driftMsPerStrum) * Math.max(1, metrics.playedCount - 1);
    return {
      id: 'spedUp',
      kind: 'timing',
      severity: 80,
      params: { totalMs: Math.round(totalMs) },
    };
  },

  (metrics) => {
    const { tendency, driftMsPerStrum } = metrics.timing;
    if (tendency !== 'dragging') return null;

    const totalMs = Math.abs(driftMsPerStrum) * Math.max(1, metrics.playedCount - 1);
    return {
      id: 'slowedDown',
      kind: 'timing',
      severity: 78,
      params: { totalMs: Math.round(totalMs) },
    };
  },

  (metrics, toleranceMs) => {
    const { meanSignedMs, tendency } = metrics.timing;
    if (tendency !== 'steady') return null;
    if (meanSignedMs > -toleranceMs * 0.6) return null;

    return {
      id: 'consistentlyEarly',
      kind: 'timing',
      severity: 70,
      params: { ms: Math.round(Math.abs(meanSignedMs)) },
    };
  },

  (metrics, toleranceMs) => {
    const { meanSignedMs, tendency } = metrics.timing;
    if (tendency !== 'steady') return null;
    if (meanSignedMs < toleranceMs * 0.6) return null;

    return {
      id: 'consistentlyLate',
      kind: 'timing',
      severity: 68,
      params: { ms: Math.round(meanSignedMs) },
    };
  },

  (metrics, toleranceMs) => {
    const { standardDeviationMs } = metrics.timing;
    if (standardDeviationMs <= toleranceMs) return null;

    return {
      id: 'uneven',
      kind: 'timing',
      severity: 74,
      params: { ms: Math.round(standardDeviationMs) },
    };
  },
];

const DYNAMICS_RULES: Rule[] = [
  (metrics) => {
    const { applicable, accentContrast } = metrics.dynamics;
    if (!applicable || accentContrast >= 1.5) return null;

    return { id: 'noDynamics', kind: 'dynamics', severity: 60, params: {} };
  },

  (metrics) => {
    const { applicable, accentCorrelation } = metrics.dynamics;
    if (!applicable || accentCorrelation >= -0.15) return null;

    return { id: 'accentsInverted', kind: 'dynamics', severity: 66, params: {} };
  },
];

const COMPLETION_RULES: Rule[] = [
  (metrics) => {
    if (metrics.completionRatio >= 0.5 || metrics.expectedCount === 0) return null;

    return {
      id: 'stopped',
      kind: 'completion',
      severity: 100,
      params: { played: metrics.playedCount, expected: metrics.expectedCount },
    };
  },

  (metrics) => {
    if (metrics.missedCount === 0 || metrics.completionRatio < 0.5) return null;

    return {
      id: 'missedStrums',
      kind: 'completion',
      severity: 85,
      params: { count: metrics.missedCount },
    };
  },

  (metrics) => {
    if (metrics.extraCount === 0) return null;

    return {
      id: 'extraStrums',
      kind: 'completion',
      severity: 64,
      params: { count: metrics.extraCount },
    };
  },
];

// --------------------------------------------------------------- positives --

/**
 * Candidates for the one encouraging note, best first.
 *
 * The last entry always matches, so there is always something honest to say —
 * even if it is only that the learner finished the take.
 */
/**
 * Below this, a take was abandoned rather than played, and praising how it went
 * is praising a fragment.
 *
 * `withinToleranceRatio` is computed over the strums that were *played*, so six
 * well-timed strums out of thirty-two used to produce "excellent timing — 100%
 * on the beat" printed directly underneath "you stopped after 6 of 32". Both
 * numbers were true and the pairing was a lie.
 */
const ENOUGH_PLAYED_TO_PRAISE = 0.5;

const POSITIVE_RULES: Rule[] = [
  (metrics) => {
    if (metrics.completionRatio < ENOUGH_PLAYED_TO_PRAISE) return null;
    if (metrics.timing.withinToleranceRatio < 0.9 || metrics.playedCount < 4) return null;
    return {
      id: 'greatTiming',
      kind: 'positive',
      severity: 0,
      params: { percent: Math.round(metrics.timing.withinToleranceRatio * 100) },
    };
  },

  (metrics) => {
    const { applicable, accentCorrelation, score } = metrics.dynamics;
    if (metrics.completionRatio < ENOUGH_PLAYED_TO_PRAISE) return null;
    if (metrics.playedCount < 4) return null;
    if (!applicable || accentCorrelation < 0.6 || score < 65) return null;
    return { id: 'greatDynamics', kind: 'positive', severity: 0, params: {} };
  },

  (metrics) => {
    if (metrics.completionRatio < ENOUGH_PLAYED_TO_PRAISE) return null;
    if (metrics.timing.tendency !== 'steady' || metrics.timing.standardDeviationMs > 35) {
      return null;
    }
    if (metrics.playedCount < 4) return null;
    return { id: 'steadyTempo', kind: 'positive', severity: 0, params: {} };
  },

  (metrics) => {
    if (metrics.missedCount > 0 || metrics.expectedCount === 0) return null;
    return { id: 'playedEverything', kind: 'positive', severity: 0, params: {} };
  },

  (metrics) => {
    if (metrics.playedCount === 0) return null;
    return {
      id: 'keptGoing',
      kind: 'positive',
      severity: 0,
      params: { count: metrics.playedCount },
    };
  },

  // Nothing was played at all. Saying so plainly beats inventing a compliment.
  () => ({ id: 'nothingHeard', kind: 'positive', severity: 0, params: {} }),
];

// ----------------------------------------------------------------- review --

export function generateReview(
  metrics: PerformanceMetrics,
  toleranceMs: number,
): Review {
  const notes = [...COMPLETION_RULES, ...TIMING_RULES, ...DYNAMICS_RULES]
    .map((rule) => rule(metrics, toleranceMs))
    .filter((note): note is ReviewNote => note !== null)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, MAX_NOTES);

  const positive = choosePositive(metrics, toleranceMs);

  return {
    headlineId: headlineFor(metrics),
    score: metrics.overallScore,
    notes,
    positive,
  };
}

/**
 * The single encouraging note.
 *
 * Nothing played is handled before the rules run rather than inside them. The
 * rules read individual metrics, and a metrics object describing a silent
 * recording can still carry leftover-looking values for dimensions that were
 * never measured — praising the dynamics of a take with no strums in it would
 * be the most damaging thing this module could say.
 */
function choosePositive(metrics: PerformanceMetrics, toleranceMs: number): ReviewNote {
  const nothingHeard: ReviewNote = {
    id: 'nothingHeard',
    kind: 'positive',
    severity: 0,
    params: {},
  };

  if (metrics.playedCount === 0) return nothingHeard;

  return (
    POSITIVE_RULES.map((rule) => rule(metrics, toleranceMs)).find(
      (note): note is ReviewNote => note !== null,
    ) ?? nothingHeard
  );
}

function headlineFor(metrics: PerformanceMetrics): string {
  if (metrics.playedCount === 0) return 'headlineNothing';
  if (metrics.overallScore >= 85) return 'headlineExcellent';
  if (metrics.overallScore >= 70) return 'headlineGood';
  if (metrics.overallScore >= 50) return 'headlineGettingThere';
  return 'headlineKeepGoing';
}

/** i18n key for a note. */
export function reviewNoteKey(note: ReviewNote): string {
  return `review.${note.id}`;
}

export function reviewHeadlineKey(review: Review): string {
  return `review.${review.headlineId}`;
}
