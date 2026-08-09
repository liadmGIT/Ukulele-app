import { DEFAULT_SAMPLE_RATE } from '@/dsp/__tests__/signals';
import { renderTake, type StrumSpec } from '@/dsp/__tests__/takes';
import { buildGrid, COMMON_TIME } from '@/music/grid';
import { parseStrumPattern } from '@/music/strum';

import { analyseTake } from '../performance';

/**
 * End-to-end tests of the listening engine.
 *
 * Each fixture is a performance with a known flaw — rushing, dragging, flat
 * dynamics, a dropped strum — and the assertion is that the analysis names that
 * flaw and not a different one. This is what makes the feedback trustworthy:
 * without it, a review is just plausible-sounding text.
 */

const sampleRate = DEFAULT_SAMPLE_RATE;
const BPM = 120;
const ALL_DOWNS = parseStrumPattern('D D D D');
const ACCENTED = parseStrumPattern('D! d D d');

/** One bar of quarter notes at 120 BPM, no count-in: strums at 0, 0.5, 1.0, 1.5. */
function quarterGrid(bars = 4) {
  return buildGrid({
    bpm: BPM,
    timeSignature: COMMON_TIME,
    subdivision: 4,
    countInBars: 0,
    bars,
  });
}

/** Repeats a one-bar pattern across the whole grid. */
function repeat(steps: ReturnType<typeof parseStrumPattern>, bars: number) {
  return Array.from({ length: bars }, () => steps).flat();
}

function analyse(strums: StrumSpec[], steps = repeat(ALL_DOWNS, 4), bars = 4) {
  const lastTime = strums.length > 0 ? strums[strums.length - 1]!.time : 0;
  const take = renderTake(strums, { durationSeconds: lastTime + 1.5, sampleRate });

  return analyseTake({
    samples: take.samples,
    sampleRate,
    steps,
    grid: quarterGrid(bars),
  });
}

/** Strums exactly on the grid, optionally shifted by a constant. */
function onGrid(count: number, offsetSeconds = 0, amplitude = 0.7): StrumSpec[] {
  return Array.from({ length: count }, (_, index) => ({
    time: index * 0.5 + offsetSeconds,
    amplitude,
  }));
}

describe('analyseTake — a performance played correctly', () => {
  const analysis = analyse(onGrid(16));

  it('finds every strum', () => {
    expect(analysis.metrics.playedCount).toBe(16);
    expect(analysis.metrics.missedCount).toBe(0);
    expect(analysis.metrics.extraCount).toBe(0);
  });

  it('reports the timing as accurate', () => {
    expect(analysis.metrics.timing.meanAbsoluteMs).toBeLessThan(12);
    expect(analysis.metrics.timing.withinToleranceRatio).toBe(1);
    expect(analysis.metrics.timing.score).toBeGreaterThan(85);
  });

  it('reports no tendency to rush or drag', () => {
    expect(analysis.metrics.timing.tendency).toBe('steady');
  });

  it('scores it highly overall', () => {
    expect(analysis.metrics.overallScore).toBeGreaterThan(80);
  });
});

describe('analyseTake — timing faults', () => {
  it('catches playing consistently early', () => {
    const analysis = analyse(onGrid(16, -0.04));

    expect(analysis.metrics.timing.meanSignedMs).toBeLessThan(-25);
    expect(analysis.metrics.timing.meanAbsoluteMs).toBeGreaterThan(25);
  });

  it('catches playing consistently late', () => {
    const analysis = analyse(onGrid(16, 0.04));
    expect(analysis.metrics.timing.meanSignedMs).toBeGreaterThan(25);
  });

  it('distinguishes speeding up from simply being early', () => {
    // The whole point of measuring drift separately: this take starts dead on
    // the beat and gradually runs away. "You rushed" and "you sped up" call for
    // completely different advice.
    const strums: StrumSpec[] = [];
    let time = 0;
    for (let index = 0; index < 16; index += 1) {
      strums.push({ time });
      time += 0.5 - 0.008; // 8 ms early each strum
    }

    const analysis = analyse(strums);
    expect(analysis.metrics.timing.tendency).toBe('rushing');
    expect(analysis.metrics.timing.driftMsPerStrum).toBeLessThan(-4);
  });

  it('catches slowing down', () => {
    const strums: StrumSpec[] = [];
    let time = 0;
    for (let index = 0; index < 16; index += 1) {
      strums.push({ time });
      time += 0.5 + 0.008;
    }

    const analysis = analyse(strums);
    expect(analysis.metrics.timing.tendency).toBe('dragging');
    expect(analysis.metrics.timing.driftMsPerStrum).toBeGreaterThan(4);
  });

  it('calls a constant offset steady rather than drifting', () => {
    const analysis = analyse(onGrid(16, 0.035));
    expect(analysis.metrics.timing.tendency).toBe('steady');
  });

  it('separates unsteadiness from inaccuracy', () => {
    // Alternating early and late by the same amount averages to zero error but
    // is not steady playing, and the score has to notice.
    const strums = Array.from({ length: 16 }, (_, index) => ({
      time: index * 0.5 + (index % 2 === 0 ? -0.035 : 0.035),
    }));

    const analysis = analyse(strums);
    expect(Math.abs(analysis.metrics.timing.meanSignedMs)).toBeLessThan(15);
    expect(analysis.metrics.timing.standardDeviationMs).toBeGreaterThan(25);
  });
});

describe('analyseTake — missing and extra strums', () => {
  it('notices dropped strums', () => {
    const strums = onGrid(16).filter((_, index) => index !== 5 && index !== 11);
    const analysis = analyse(strums);

    expect(analysis.metrics.playedCount).toBe(14);
    expect(analysis.metrics.missedCount).toBe(2);
    expect(analysis.metrics.completionRatio).toBeCloseTo(14 / 16, 5);
  });

  it('notices strums that were not asked for', () => {
    const strums = [...onGrid(16), { time: 0.25 }, { time: 1.25 }].sort(
      (a, b) => a.time - b.time,
    );
    const analysis = analyse(strums);

    expect(analysis.metrics.extraCount).toBe(2);
  });

  it('refuses to reward a take that is mostly missing', () => {
    const analysis = analyse(onGrid(16).slice(0, 4));
    // Four perfectly timed strums out of sixteen is not a good performance.
    expect(analysis.metrics.overallScore).toBeLessThan(45);
  });

  it('handles a take with no playing at all', () => {
    const analysis = analyse([]);

    expect(analysis.metrics.playedCount).toBe(0);
    expect(analysis.metrics.missedCount).toBe(16);
    expect(analysis.metrics.overallScore).toBe(0);
  });
});

describe('analyseTake — dynamics', () => {
  const steps = repeat(ACCENTED, 4);

  /** Strums whose loudness follows the pattern's intended accents. */
  function withAccents(strong: number, soft: number): StrumSpec[] {
    return Array.from({ length: 16 }, (_, index) => ({
      time: index * 0.5,
      amplitude: index % 2 === 0 ? strong : soft,
    }));
  }

  it('rewards accents in the right places', () => {
    const analysis = analyse(withAccents(0.9, 0.3), steps);

    expect(analysis.metrics.dynamics.accentCorrelation).toBeGreaterThan(0.7);
    expect(analysis.metrics.dynamics.score).toBeGreaterThan(70);
  });

  it('catches every strum being hit identically', () => {
    // The classic beginner failure: the pattern asks for loud and soft, the
    // learner plays it all at one volume.
    const analysis = analyse(withAccents(0.7, 0.7), steps);

    expect(analysis.metrics.dynamics.accentContrast).toBeLessThan(1.6);
    expect(analysis.metrics.dynamics.score).toBeLessThan(60);
  });

  it('catches accents landing on the wrong strums', () => {
    const inverted = Array.from({ length: 16 }, (_, index) => ({
      time: index * 0.5,
      amplitude: index % 2 === 0 ? 0.3 : 0.9,
    }));

    const analysis = analyse(inverted, steps);
    expect(analysis.metrics.dynamics.accentCorrelation).toBeLessThan(0);
  });

  it('is indifferent to overall volume', () => {
    // A quiet performance with the right shape is a good performance.
    const loud = analyse(withAccents(0.9, 0.3), steps);
    const quiet = analyse(withAccents(0.25, 0.08), steps);

    expect(quiet.metrics.dynamics.score).toBeGreaterThan(loud.metrics.dynamics.score - 20);
  });

  it('does not grade dynamics on a pattern that has none', () => {
    // "D D D D" asks for no accents, so there is nothing to get wrong.
    const analysis = analyse(onGrid(16));

    expect(analysis.metrics.dynamics.patternIsFlat).toBe(true);
    expect(analysis.metrics.dynamics.score).toBe(100);
  });
});

describe('analyseTake — latency', () => {
  it('corrects for a known recording delay', () => {
    // Everything arrives 30 ms late because of the hardware, not the player.
    const analysis = analyseTake({
      samples: renderTake(onGrid(16, 0.03), { durationSeconds: 9, sampleRate }).samples,
      sampleRate,
      steps: repeat(ALL_DOWNS, 4),
      grid: quarterGrid(4),
      latencySeconds: 0.03,
    });

    expect(Math.abs(analysis.metrics.timing.meanSignedMs)).toBeLessThan(12);
    expect(analysis.metrics.timing.withinToleranceRatio).toBe(1);
  });

  it('blames the player when the delay is not accounted for', () => {
    // The same recording without calibration: the app would report a fault
    // that belongs to the hardware. This is why calibration exists.
    const analysis = analyse(onGrid(16, 0.03));
    expect(analysis.metrics.timing.meanSignedMs).toBeGreaterThan(18);
  });
});

describe('analyseTake — rests', () => {
  it('expects nothing on a rest', () => {
    const steps = repeat(parseStrumPattern('D - D -'), 4);
    // Only the strums on beats 1 and 3 of each bar.
    const strums = Array.from({ length: 8 }, (_, index) => ({ time: index * 1.0 }));

    const analysis = analyse(strums, steps);
    expect(analysis.metrics.expectedCount).toBe(8);
    expect(analysis.metrics.playedCount).toBe(8);
    expect(analysis.metrics.missedCount).toBe(0);
  });

  it('counts a strum played during a rest as extra', () => {
    const steps = repeat(parseStrumPattern('D - D -'), 4);
    const strums = Array.from({ length: 16 }, (_, index) => ({ time: index * 0.5 }));

    const analysis = analyse(strums, steps);
    expect(analysis.metrics.extraCount).toBeGreaterThan(0);
  });
});
