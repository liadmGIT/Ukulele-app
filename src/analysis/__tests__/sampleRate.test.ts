import { renderTake, type StrumSpec } from '@/dsp/__tests__/takes';
import { buildGrid, COMMON_TIME } from '@/music/grid';
import { parseStrumPattern } from '@/music/strum';

import { estimateConstantOffset } from '../alignment';
import { analyseTake } from '../performance';

/**
 * The sample rate a take was recorded at is part of the take.
 *
 * Every iPhone records at 48 kHz. The app used to analyse those samples as
 * though they were 44.1 kHz, which stretches every measured time by 8.8% —
 * enough that a metronome-perfect performance is reported as one that falls
 * further behind with every strum. Nothing caught it because every test
 * generated and analysed audio at the same assumed rate.
 *
 * These tests deliberately record at one rate and check both the right answer
 * and the wrong one, so the assumption can never quietly come back.
 */

const DEVICE_RATE = 48000;
const ASSUMED_RATE = 44100;
const BPM = 120;
const ALL_DOWNS = parseStrumPattern('D D D D');

function quarterGrid(bars = 4) {
  return buildGrid({
    bpm: BPM,
    timeSignature: COMMON_TIME,
    subdivision: 4,
    countInBars: 0,
    bars,
  });
}

/** Sixteen strums exactly on the beat, at 120 BPM: 0, 0.5, 1.0 … */
const PERFECT: StrumSpec[] = Array.from({ length: 16 }, (_, index) => ({
  time: index * 0.5,
  amplitude: 0.7,
}));

function analyseAt(sampleRate: number) {
  const take = renderTake(PERFECT, { durationSeconds: 9, sampleRate: DEVICE_RATE });

  return analyseTake({
    samples: take.samples,
    sampleRate,
    steps: Array.from({ length: 4 }, () => ALL_DOWNS).flat(),
    grid: quarterGrid(4),
  });
}

describe('analysing a take at the rate it was actually recorded', () => {
  const correct = analyseAt(DEVICE_RATE);

  it('calls a metronome-perfect take steady', () => {
    expect(correct.metrics.timing.tendency).toBe('steady');
  });

  it('measures it as accurate', () => {
    expect(correct.metrics.timing.meanAbsoluteMs).toBeLessThan(25);
  });

  it('hears every strum', () => {
    expect(correct.metrics.playedCount).toBe(correct.metrics.expectedCount);
  });
});

describe('analysing the same take at the wrong rate', () => {
  const correct = analyseAt(DEVICE_RATE);
  const wrong = analyseAt(ASSUMED_RATE);

  it('turns a flawless performance into a mediocre score', () => {
    // The measured numbers: 97 read correctly, 44 read as 44.1 kHz. The same
    // audio, the same playing, less than half the score. This is what the bug
    // cost, and it is why the rate travels with the samples now.
    expect(correct.metrics.overallScore).toBeGreaterThan(90);
    expect(wrong.metrics.overallScore).toBeLessThan(60);
  });

  it('reports timing error an order of magnitude larger than it is', () => {
    expect(correct.metrics.timing.meanAbsoluteMs).toBeLessThan(10);
    expect(wrong.metrics.timing.meanAbsoluteMs).toBeGreaterThan(80);
  });

  it('loses strums that were played, and hears ones that were not', () => {
    // Drift past half a step stops looking like a late strum and starts looking
    // like a missing one plus an unexplained extra.
    expect(correct.metrics.missedCount).toBe(0);
    expect(wrong.metrics.missedCount).toBeGreaterThan(0);
    expect(wrong.metrics.extraCount).toBeGreaterThan(0);
  });
});

describe('estimateConstantOffset', () => {
  const onsetsAt = (times: number[]) =>
    times.map((time) => ({ time, strength: 1, peakAmplitude: 0.5 }));

  it('measures a constant delay', () => {
    const expected = [0, 0.5, 1, 1.5];
    const result = estimateConstantOffset(onsetsAt([0.08, 0.58, 1.08, 1.58]), expected);

    expect(result?.offsetSeconds).toBeCloseTo(0.08, 3);
    expect(result?.matchedCount).toBe(4);
  });

  it('will not let one detection answer for every click', () => {
    // A single stray onset used to be matched to all four expected times,
    // producing four identical "measurements" and a confident result. The
    // calibration it produced then biased every future take.
    const result = estimateConstantOffset(onsetsAt([0.08]), [0, 0.5, 1, 1.5]);

    expect(result?.matchedCount).toBe(1);
  });

  it('is null when nothing lands near a click', () => {
    expect(estimateConstantOffset(onsetsAt([5, 6]), [0, 0.5])).toBeNull();
  });
});
