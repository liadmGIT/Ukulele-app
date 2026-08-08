import { STANDARD_TUNING, midiToFrequency } from '@/music/notes';

import { PitchDetector } from '../pitch';

import {
  DEFAULT_SAMPLE_RATE,
  centsBetween,
  missingFundamentalish,
  noise,
  pluck,
  silence,
  tone,
} from './signals';

const detector = new PitchDetector({ sampleRate: DEFAULT_SAMPLE_RATE });

/** A tuner is useful at ±5 cents; anything looser is visible as a wrong needle. */
const TOLERANCE_CENTS = 5;

describe('PitchDetector', () => {
  it('finds the frequency of a pure sine within 5 cents', () => {
    for (const frequency of [261.63, 329.63, 392.0, 440.0, 523.25, 880.0]) {
      const result = detector.detect(tone({ frequency, durationSeconds: 0.05 }));
      expect(result.frequency).not.toBeNull();
      expect(Math.abs(centsBetween(result.frequency!, frequency))).toBeLessThan(TOLERANCE_CENTS);
    }
  });

  it('finds every open string of a ukulele in standard tuning', () => {
    for (const string of STANDARD_TUNING) {
      const expected = midiToFrequency(string.midi);
      const result = detector.detect(pluck(expected, 0.06));

      expect(result.frequency).not.toBeNull();
      expect(Math.abs(centsBetween(result.frequency!, expected))).toBeLessThan(TOLERANCE_CENTS);
      expect(result.clarity).toBeGreaterThan(0.8);
    }
  });

  it('reports the fundamental, not a harmonic, when an overtone is louder', () => {
    // The trap an FFT-peak tuner falls into: the second harmonic dominates, and
    // a peak-picker would call this an octave too high.
    const frequency = 293.66; // D4
    const result = detector.detect(missingFundamentalish(frequency, 0.08));

    expect(result.frequency).not.toBeNull();
    expect(Math.abs(centsBetween(result.frequency!, frequency))).toBeLessThan(TOLERANCE_CENTS);
  });

  it('does not drop an octave on a harmonically rich pluck', () => {
    const frequency = 392.0; // open G
    const result = detector.detect(pluck(frequency, 0.08));

    expect(result.frequency).not.toBeNull();
    // A sub-harmonic error would land near 196 Hz.
    expect(result.frequency!).toBeGreaterThan(frequency * 0.75);
  });

  it('tracks a string that is deliberately out of tune', () => {
    for (const offsetCents of [-40, -14, -3, 7, 25, 45]) {
      const target = 440 * 2 ** (offsetCents / 1200);
      const result = detector.detect(pluck(target, 0.06));

      expect(result.frequency).not.toBeNull();
      const measured = centsBetween(result.frequency!, 440);
      expect(Math.abs(measured - offsetCents)).toBeLessThan(TOLERANCE_CENTS);
    }
  });

  it('reports silence rather than guessing', () => {
    const result = detector.detect(silence(0.05));
    expect(result.frequency).toBeNull();
    expect(result.clarity).toBe(0);
  });

  it('reports low clarity for noise instead of a confident wrong answer', () => {
    const result = detector.detect(noise(0.05, 0.3));
    // Noise may or may not cross the threshold, but it must never look certain.
    if (result.frequency !== null) {
      expect(result.clarity).toBeLessThan(0.9);
    }
  });

  it('stays accurate when the signal is quiet', () => {
    const quiet = tone({ frequency: 440, durationSeconds: 0.06, amplitude: 0.02 });
    const result = detector.detect(quiet);

    expect(result.frequency).not.toBeNull();
    expect(Math.abs(centsBetween(result.frequency!, 440))).toBeLessThan(TOLERANCE_CENTS);
  });

  it('is unaffected by a constant DC offset from the microphone', () => {
    const samples = tone({ frequency: 349.23, durationSeconds: 0.06 });
    for (let i = 0; i < samples.length; i += 1) samples[i]! += 0.2;

    const result = detector.detect(samples);
    expect(result.frequency).not.toBeNull();
    expect(Math.abs(centsBetween(result.frequency!, 349.23))).toBeLessThan(TOLERANCE_CENTS);
  });

  it('allocates nothing per frame once constructed', () => {
    // A tuner runs this ten times a second for minutes at a time; a fresh
    // buffer each frame would make the garbage collector audible.
    const frame = pluck(440, 0.06);
    const first = detector.detect(frame);
    const second = detector.detect(frame);
    expect(second.frequency).toBeCloseTo(first.frequency!, 6);
  });
});
