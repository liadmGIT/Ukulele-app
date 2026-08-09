import { detectOnsets } from '../onset';

import { DEFAULT_SAMPLE_RATE, silence } from './signals';
import { renderTake, steadyTake } from './takes';

const sampleRate = DEFAULT_SAMPLE_RATE;

/**
 * How close a detected onset must be to the truth.
 *
 * The app reports timing against a ±50 ms beginner tolerance, so the detector's
 * own error has to be a small fraction of that or the score is measuring the
 * detector rather than the learner.
 */
const TOLERANCE_MS = 12;

function detect(samples: Float32Array) {
  return detectOnsets(samples, { sampleRate }).onsets;
}

/** Pairs each true onset with the nearest detection, in milliseconds. */
function errorsMs(detected: number[], truth: number[]): number[] {
  return truth.map((time) => {
    const nearest = detected.reduce(
      (best, candidate) => (Math.abs(candidate - time) < Math.abs(best - time) ? candidate : best),
      Infinity,
    );
    return (nearest - time) * 1000;
  });
}

describe('detectOnsets', () => {
  it('finds every strum in an evenly spaced take', () => {
    const take = steadyTake(8, 0.5);
    const onsets = detect(take.samples);

    expect(onsets).toHaveLength(take.onsetTimes.length);
  });

  it('places each onset within 12 ms of the truth', () => {
    const take = steadyTake(8, 0.5);
    const errors = errorsMs(
      detect(take.samples).map((onset) => onset.time),
      take.onsetTimes,
    );

    for (const error of errors) {
      expect(Math.abs(error)).toBeLessThan(TOLERANCE_MS);
    }
  });

  it('carries no systematic bias', () => {
    // A constant offset would be indistinguishable from the learner playing
    // consistently early, and would silently corrupt every timing score.
    const take = steadyTake(10, 0.4);
    const errors = errorsMs(
      detect(take.samples).map((onset) => onset.time),
      take.onsetTimes,
    );

    const mean = errors.reduce((sum, error) => sum + error, 0) / errors.length;
    expect(Math.abs(mean)).toBeLessThan(6);
  });

  it('separates fast strums at a realistic tempo', () => {
    // Eighth notes at 120 BPM are 250 ms apart; sixteenths are 125 ms.
    const take = steadyTake(12, 0.125);
    expect(detect(take.samples)).toHaveLength(12);
  });

  it('hears a new strum over a chord that is still ringing', () => {
    // The case a plain amplitude threshold cannot handle: the second strum is
    // quieter than the first one's still-decaying tail.
    const take = renderTake(
      [
        { time: 0.3, amplitude: 0.9 },
        { time: 0.55, amplitude: 0.35 },
        { time: 0.8, amplitude: 0.35 },
      ],
      { durationSeconds: 2.5 },
    );

    const onsets = detect(take.samples);
    expect(onsets).toHaveLength(3);

    for (const error of errorsMs(onsets.map((o) => o.time), take.onsetTimes)) {
      expect(Math.abs(error)).toBeLessThan(TOLERANCE_MS);
    }
  });

  it('counts one onset per strum, not one per string', () => {
    // A strum spreads its four strings over about 12 ms. Each string is its own
    // transient, and they must fuse into a single event.
    const take = renderTake([{ time: 0.4 }], { durationSeconds: 1.5, stringSpreadSeconds: 0.018 });
    expect(detect(take.samples)).toHaveLength(1);
  });

  it('finds nothing in silence', () => {
    expect(detect(silence(2))).toHaveLength(0);
  });

  it('finds nothing in a quiet room', () => {
    const take = renderTake([], { durationSeconds: 2, noiseAmplitude: 0.002 });
    expect(detect(take.samples)).toHaveLength(0);
  });

  it('reports louder strums with a higher peak amplitude', () => {
    const take = renderTake(
      [
        { time: 0.3, amplitude: 0.25 },
        { time: 0.8, amplitude: 0.9 },
        { time: 1.3, amplitude: 0.25 },
      ],
      { durationSeconds: 2.5 },
    );

    const onsets = detect(take.samples);
    expect(onsets).toHaveLength(3);
    expect(onsets[1]!.peakAmplitude).toBeGreaterThan(onsets[0]!.peakAmplitude * 1.8);
    expect(onsets[1]!.peakAmplitude).toBeGreaterThan(onsets[2]!.peakAmplitude * 1.8);
  });

  it('detects a quiet take as reliably as a loud one', () => {
    // The threshold is a multiple of the local median, so playing softly must
    // not change how many strums are found.
    const loud = steadyTake(6, 0.5, 0.3, { amplitude: 0.9 });
    const quiet = steadyTake(6, 0.5, 0.3, { amplitude: 0.12 });

    expect(detect(loud.samples)).toHaveLength(6);
    expect(detect(quiet.samples)).toHaveLength(6);
  });

  it('hears muted strokes as onsets', () => {
    const take = renderTake(
      [
        { time: 0.3 },
        { time: 0.55, muted: true },
        { time: 0.8 },
        { time: 1.05, muted: true },
      ],
      { durationSeconds: 2.5 },
    );

    expect(detect(take.samples)).toHaveLength(4);
  });

  it('returns onsets in time order', () => {
    const onsets = detect(steadyTake(8, 0.3).samples);
    for (let i = 1; i < onsets.length; i += 1) {
      expect(onsets[i]!.time).toBeGreaterThan(onsets[i - 1]!.time);
    }
  });

  it('copes with a recording shorter than one analysis frame', () => {
    const result = detectOnsets(new Float32Array(512), { sampleRate });
    expect(result.onsets).toEqual([]);
  });
});
