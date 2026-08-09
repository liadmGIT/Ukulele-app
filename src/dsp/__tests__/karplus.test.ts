import { STANDARD_TUNING, midiToFrequency } from '@/music/notes';

import { applyFades, mutedPluck, pluckedString } from '../karplus';
import { rms } from '../level';
import { PitchDetector } from '../pitch';

import { DEFAULT_SAMPLE_RATE, centsBetween } from './signals';

const sampleRate = DEFAULT_SAMPLE_RATE;
const detector = new PitchDetector({ sampleRate });

/** Analyses a window from just after the attack, where the note has settled. */
function detectPitch(samples: Float32Array, offsetSeconds = 0.05): number | null {
  const start = Math.round(offsetSeconds * sampleRate);
  return detector.detect(samples.subarray(start, start + 4096)).frequency;
}

describe('pluckedString', () => {
  it('sounds at the frequency it was asked for', () => {
    // The synthesiser is checked by the pitch detector — two independent pieces
    // of DSP confirming each other. A wrong delay-line length would put the
    // whole app's chord playback out of tune with its own tuner.
    for (const frequency of [261.63, 329.63, 392.0, 440.0, 523.25, 659.26]) {
      const note = pluckedString({ frequency, sampleRate, durationSeconds: 0.4 });
      const detected = detectPitch(note);

      expect(detected).not.toBeNull();
      expect(Math.abs(centsBetween(detected!, frequency))).toBeLessThan(10);
    }
  });

  it('is in tune on every open ukulele string', () => {
    for (const string of STANDARD_TUNING) {
      const frequency = midiToFrequency(string.midi);
      const note = pluckedString({ frequency, sampleRate, durationSeconds: 0.4 });
      const detected = detectPitch(note);

      expect(detected).not.toBeNull();
      expect(Math.abs(centsBetween(detected!, frequency))).toBeLessThan(10);
    }
  });

  it('stays in tune high up the neck, where integer delay lines fail', () => {
    // Around 900 Hz the delay line is only ~49 samples long, so rounding it to
    // a whole number would be audibly sharp. This is what the all-pass is for.
    for (const frequency of [784, 880, 988]) {
      const note = pluckedString({ frequency, sampleRate, durationSeconds: 0.3 });
      const detected = detectPitch(note, 0.03);

      expect(detected).not.toBeNull();
      expect(Math.abs(centsBetween(detected!, frequency))).toBeLessThan(15);
    }
  });

  it('decays', () => {
    const note = pluckedString({ frequency: 440, sampleRate, durationSeconds: 1.5 });
    const head = rms(note, 0, 4410);
    const tail = rms(note, note.length - 4410, 4410);

    expect(head).toBeGreaterThan(0);
    expect(tail).toBeLessThan(head * 0.5);
  });

  it('decays faster when asked to', () => {
    const long = pluckedString({ frequency: 440, sampleRate, durationSeconds: 1, decaySeconds: 3 });
    const short = pluckedString({ frequency: 440, sampleRate, durationSeconds: 1, decaySeconds: 0.3 });

    const at = (samples: Float32Array) => rms(samples, Math.round(0.5 * sampleRate), 4410);
    expect(at(short)).toBeLessThan(at(long));
  });

  it('roughly honours the requested 60 dB decay time', () => {
    const decaySeconds = 0.5;
    const note = pluckedString({ frequency: 440, sampleRate, durationSeconds: 1, decaySeconds });

    const head = rms(note, 0, 2205);
    const atDecay = rms(note, Math.round(decaySeconds * sampleRate), 2205);

    // -60 dB is a thousandth. The loop filter bleeds high partials off faster
    // than the fundamental, so the real figure lands under the target; assert
    // the order of magnitude rather than a precise ratio.
    expect(atDecay).toBeLessThan(head / 100);
  });

  it('scales with amplitude', () => {
    const quiet = pluckedString({ frequency: 440, sampleRate, durationSeconds: 0.3, amplitude: 0.2 });
    const loud = pluckedString({ frequency: 440, sampleRate, durationSeconds: 0.3, amplitude: 0.9 });

    expect(rms(loud)).toBeGreaterThan(rms(quiet) * 3);
  });

  it('stays inside the valid sample range', () => {
    for (const frequency of [261.63, 440, 880]) {
      const note = pluckedString({ frequency, sampleRate, durationSeconds: 0.5, amplitude: 1 });

      let loudest = 0;
      for (let i = 0; i < note.length; i += 1) {
        const magnitude = Math.abs(note[i]!);
        if (magnitude > loudest) loudest = magnitude;
      }
      expect(loudest).toBeLessThanOrEqual(1);
    }
  });

  it('carries no DC offset', () => {
    // A biased excitation would leave a constant offset ringing for the whole
    // life of the note, and four of those stacked in a chord would clip.
    const note = pluckedString({ frequency: 329.63, sampleRate, durationSeconds: 0.5 });
    let sum = 0;
    for (let i = 0; i < note.length; i += 1) sum += note[i]!;

    expect(Math.abs(sum / note.length)).toBeLessThan(0.001);
  });

  it('is deterministic for a given seed and varies with it', () => {
    const a = pluckedString({ frequency: 440, sampleRate, durationSeconds: 0.1, seed: 7 });
    const b = pluckedString({ frequency: 440, sampleRate, durationSeconds: 0.1, seed: 7 });
    const c = pluckedString({ frequency: 440, sampleRate, durationSeconds: 0.1, seed: 8 });

    expect([...a]).toEqual([...b]);
    expect([...a]).not.toEqual([...c]);
  });

  it('rejects nonsensical input', () => {
    expect(() => pluckedString({ frequency: 0, sampleRate, durationSeconds: 0.1 })).toThrow();
    expect(() => pluckedString({ frequency: 440, sampleRate: 0, durationSeconds: 0.1 })).toThrow();
  });

  it('returns silence rather than noise above its useful range', () => {
    const note = pluckedString({ frequency: 20000, sampleRate, durationSeconds: 0.1 });
    expect(rms(note)).toBe(0);
  });
});

describe('mutedPluck', () => {
  it('dies away far faster than a ringing note', () => {
    const ringing = pluckedString({ frequency: 261.63, sampleRate, durationSeconds: 0.5 });
    const muted = mutedPluck({ frequency: 261.63, sampleRate, durationSeconds: 0.5 });

    const at200ms = (samples: Float32Array) => rms(samples, Math.round(0.2 * sampleRate), 2205);
    expect(at200ms(muted)).toBeLessThan(at200ms(ringing) * 0.2);
  });

  it('still has an audible attack', () => {
    const muted = mutedPluck({ frequency: 261.63, sampleRate, durationSeconds: 0.3 });
    expect(rms(muted, 0, 1000)).toBeGreaterThan(0.01);
  });
});

describe('applyFades', () => {
  it('silences the very first and last samples', () => {
    const note = applyFades(
      pluckedString({ frequency: 440, sampleRate, durationSeconds: 0.2 }),
      sampleRate,
    );

    // Signed zero: the fade multiplies by 0, which can yield -0.
    expect(note[0]).toBeCloseTo(0, 12);
    expect(note[note.length - 1]).toBeCloseTo(0, 12);
  });

  it('leaves the body of the note alone', () => {
    const original = pluckedString({ frequency: 440, sampleRate, durationSeconds: 0.3 });
    const middle = original[Math.round(0.15 * sampleRate)]!;

    const faded = applyFades(original, sampleRate);
    expect(faded[Math.round(0.15 * sampleRate)]).toBe(middle);
  });

  it('copes with a note shorter than the fade', () => {
    const tiny = new Float32Array(4).fill(1);
    expect(() => applyFades(tiny, sampleRate)).not.toThrow();
  });
});
