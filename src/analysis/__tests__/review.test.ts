import i18next from 'i18next';

import en from '@/i18n/locales/en.json';
import he from '@/i18n/locales/he.json';

import type { PerformanceMetrics } from '../metrics';
import { MAX_NOTES, generateReview, reviewHeadlineKey, reviewNoteKey } from '../review';

/**
 * Golden tests for the review.
 *
 * Two things are checked: that the right *rule* fires for a given performance,
 * and that it renders to the exact text a learner will read, in both languages.
 * The second half matters because a review is the app's only voice — a broken
 * placeholder or a missing Hebrew string would reach the user as gibberish and
 * nothing else would catch it.
 */

const translator = i18next.createInstance();
beforeAll(async () => {
  await translator.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en }, he: { translation: he } },
    interpolation: { escapeValue: false },
  });
});

function render(key: string, params: Record<string, unknown>, language: 'en' | 'he'): string {
  return translator.getFixedT(language)(key, params) as string;
}

/** A metrics object that is fine in every respect, for tests to spoil. */
function goodMetrics(overrides: Partial<PerformanceMetrics> = {}): PerformanceMetrics {
  return {
    timing: {
      meanAbsoluteMs: 8,
      meanSignedMs: 1,
      standardDeviationMs: 10,
      withinToleranceRatio: 1,
      driftMsPerStrum: 0,
      tendency: 'steady',
      score: 92,
      ...overrides.timing,
    },
    dynamics: {
      accentCorrelation: 0.8,
      accentContrast: 2.6,
      intendedContrast: 2.9,
      patternIsFlat: false,
      score: 85,
      ...overrides.dynamics,
    },
    completionRatio: 1,
    missedCount: 0,
    extraCount: 0,
    playedCount: 16,
    expectedCount: 16,
    overallScore: 90,
    ...overrides,
  };
}

const TOLERANCE_MS = 50;
const review = (metrics: PerformanceMetrics) => generateReview(metrics, TOLERANCE_MS);
const ids = (metrics: PerformanceMetrics) => review(metrics).notes.map((note) => note.id);

describe('rule selection', () => {
  it('finds nothing to complain about in a good performance', () => {
    expect(ids(goodMetrics())).toEqual([]);
  });

  it('names speeding up rather than being early', () => {
    const notes = ids(
      goodMetrics({
        timing: { ...goodMetrics().timing, tendency: 'rushing', driftMsPerStrum: -8 },
      }),
    );
    expect(notes).toContain('spedUp');
    expect(notes).not.toContain('consistentlyEarly');
  });

  it('names being early rather than speeding up when the tempo is steady', () => {
    const notes = ids(
      goodMetrics({
        timing: { ...goodMetrics().timing, meanSignedMs: -38, tendency: 'steady' },
      }),
    );
    expect(notes).toContain('consistentlyEarly');
    expect(notes).not.toContain('spedUp');
  });

  it('names slowing down and being late separately', () => {
    expect(
      ids(goodMetrics({ timing: { ...goodMetrics().timing, tendency: 'dragging', driftMsPerStrum: 9 } })),
    ).toContain('slowedDown');

    expect(
      ids(goodMetrics({ timing: { ...goodMetrics().timing, meanSignedMs: 40 } })),
    ).toContain('consistentlyLate');
  });

  it('calls out unsteady playing', () => {
    expect(
      ids(goodMetrics({ timing: { ...goodMetrics().timing, standardDeviationMs: 70 } })),
    ).toContain('uneven');
  });

  it('calls out flat dynamics', () => {
    expect(
      ids(goodMetrics({ dynamics: { ...goodMetrics().dynamics, accentContrast: 1.1 } })),
    ).toContain('noDynamics');
  });

  it('says nothing about dynamics when the pattern has none', () => {
    const notes = ids(
      goodMetrics({
        dynamics: { ...goodMetrics().dynamics, patternIsFlat: true, accentContrast: 1.0 },
      }),
    );
    expect(notes).not.toContain('noDynamics');
    expect(notes).not.toContain('accentsInverted');
  });

  it('calls out inverted accents', () => {
    expect(
      ids(goodMetrics({ dynamics: { ...goodMetrics().dynamics, accentCorrelation: -0.5 } })),
    ).toContain('accentsInverted');
  });

  it('counts missed and extra strums', () => {
    expect(ids(goodMetrics({ missedCount: 3, playedCount: 13, completionRatio: 13 / 16 }))).toContain(
      'missedStrums',
    );
    expect(ids(goodMetrics({ extraCount: 2 }))).toContain('extraStrums');
  });

  it('treats an abandoned take as one problem, not many', () => {
    const notes = ids(
      goodMetrics({ playedCount: 4, missedCount: 12, completionRatio: 0.25, overallScore: 20 }),
    );
    expect(notes).toContain('stopped');
    expect(notes).not.toContain('missedStrums');
  });

  it('never says more than three things', () => {
    const everything = goodMetrics({
      timing: {
        meanAbsoluteMs: 90,
        meanSignedMs: -80,
        standardDeviationMs: 95,
        withinToleranceRatio: 0.1,
        driftMsPerStrum: -12,
        tendency: 'rushing',
        score: 10,
      },
      dynamics: {
        accentCorrelation: -0.8,
        accentContrast: 1.05,
        intendedContrast: 2.9,
        patternIsFlat: false,
        score: 5,
      },
      missedCount: 4,
      extraCount: 5,
      playedCount: 12,
      completionRatio: 0.75,
      overallScore: 12,
    });

    expect(review(everything).notes.length).toBeLessThanOrEqual(MAX_NOTES);
  });

  it('puts the most important problem first', () => {
    const metrics = goodMetrics({
      timing: { ...goodMetrics().timing, standardDeviationMs: 70 },
      missedCount: 4,
      playedCount: 12,
      completionRatio: 0.75,
      extraCount: 3,
    });

    expect(review(metrics).notes[0]!.id).toBe('missedStrums');
  });
});

describe('the positive note', () => {
  it('praises timing when the timing was good', () => {
    expect(review(goodMetrics()).positive.id).toBe('greatTiming');
  });

  it('finds something true to say about a poor take', () => {
    const positive = review(
      goodMetrics({
        timing: {
          meanAbsoluteMs: 90,
          meanSignedMs: -80,
          standardDeviationMs: 95,
          withinToleranceRatio: 0.1,
          driftMsPerStrum: -12,
          tendency: 'rushing',
          score: 10,
        },
        dynamics: {
          accentCorrelation: -0.8,
          accentContrast: 1.05,
          intendedContrast: 2.9,
          patternIsFlat: false,
          score: 5,
        },
        overallScore: 15,
      }),
    ).positive;

    // Everything measurable went badly, so the honest positive is that the
    // learner played the whole thing — not a fabricated compliment.
    expect(positive.id).toBe('playedEverything');
  });

  it('does not pretend when nothing was played', () => {
    const metrics = goodMetrics({
      playedCount: 0,
      missedCount: 16,
      completionRatio: 0,
      overallScore: 0,
    });

    expect(review(metrics).positive.id).toBe('nothingHeard');
    expect(review(metrics).headlineId).toBe('headlineNothing');
  });

  it('always produces exactly one', () => {
    for (const metrics of [
      goodMetrics(),
      goodMetrics({ playedCount: 0, completionRatio: 0 }),
      goodMetrics({ playedCount: 2, expectedCount: 16, completionRatio: 0.125 }),
    ]) {
      expect(review(metrics).positive).toBeDefined();
    }
  });
});

describe('headlines', () => {
  it.each([
    [95, 'headlineExcellent'],
    [85, 'headlineExcellent'],
    [75, 'headlineGood'],
    [55, 'headlineGettingThere'],
    [20, 'headlineKeepGoing'],
  ])('scores %i as %s', (overallScore, expected) => {
    expect(review(goodMetrics({ overallScore })).headlineId).toBe(expected);
  });
});

describe('rendered text', () => {
  it('renders the rushing note in both languages with the number filled in', () => {
    const note = review(
      goodMetrics({
        timing: { ...goodMetrics().timing, tendency: 'rushing', driftMsPerStrum: -3 },
        playedCount: 16,
      }),
    ).notes.find((entry) => entry.id === 'spedUp')!;

    expect(render(reviewNoteKey(note), note.params, 'en')).toBe(
      'You started well but sped up — by the end you were about 45 ms ahead of the beat. ' +
        'Try counting out loud the whole way through.',
    );

    const hebrew = render(reviewNoteKey(note), note.params, 'he');
    expect(hebrew).toContain('45');
    expect(hebrew).toContain('האצת');
  });

  it('renders counts correctly', () => {
    const note = review(
      goodMetrics({ missedCount: 3, playedCount: 13, completionRatio: 13 / 16 }),
    ).notes.find((entry) => entry.id === 'missedStrums')!;

    expect(render(reviewNoteKey(note), note.params, 'en')).toBe(
      'You missed 3 strums. Slow down, and keep the hand moving through the rests.',
    );
  });

  it('renders a headline in both languages', () => {
    const result = review(goodMetrics());
    expect(render(reviewHeadlineKey(result), {}, 'en')).toBe('Excellent!');
    expect(render(reviewHeadlineKey(result), {}, 'he')).toBe('מצוין!');
  });

  it('leaves no placeholder unfilled, for any rule, in either language', () => {
    // Guards the failure that would reach the user as gibberish: a rule whose
    // parameters do not match its string.
    const cases: PerformanceMetrics[] = [
      goodMetrics(),
      goodMetrics({ timing: { ...goodMetrics().timing, tendency: 'rushing', driftMsPerStrum: -8 } }),
      goodMetrics({ timing: { ...goodMetrics().timing, tendency: 'dragging', driftMsPerStrum: 8 } }),
      goodMetrics({ timing: { ...goodMetrics().timing, meanSignedMs: -40 } }),
      goodMetrics({ timing: { ...goodMetrics().timing, meanSignedMs: 40 } }),
      goodMetrics({ timing: { ...goodMetrics().timing, standardDeviationMs: 70 } }),
      goodMetrics({ dynamics: { ...goodMetrics().dynamics, accentContrast: 1.1 } }),
      goodMetrics({ dynamics: { ...goodMetrics().dynamics, accentCorrelation: -0.6 } }),
      goodMetrics({ missedCount: 3, playedCount: 13, completionRatio: 13 / 16 }),
      goodMetrics({ extraCount: 2 }),
      goodMetrics({ playedCount: 3, missedCount: 13, completionRatio: 3 / 16 }),
      goodMetrics({ playedCount: 0, missedCount: 16, completionRatio: 0 }),
    ];

    const seen = new Set<string>();

    for (const metrics of cases) {
      const result = review(metrics);

      for (const note of [...result.notes, result.positive]) {
        seen.add(note.id);

        for (const language of ['en', 'he'] as const) {
          const text = render(reviewNoteKey(note), note.params, language);

          expect(text).not.toContain('{{');
          expect(text).not.toBe(reviewNoteKey(note));
          expect(text.length).toBeGreaterThan(10);
        }
      }
    }

    // Every rule the app can emit was exercised above.
    expect(seen.size).toBeGreaterThanOrEqual(12);
  });
});
