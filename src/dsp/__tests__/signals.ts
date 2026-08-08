/**
 * Synthetic signal generators for DSP tests.
 *
 * This is what makes the audio work provable rather than a matter of opinion:
 * every fixture has a known ground truth — an exact frequency, an exact onset
 * time, an exact amplitude — so a test can assert how far the detector was off
 * instead of asserting that it produced something.
 */

export const DEFAULT_SAMPLE_RATE = 44100;

export type ToneOptions = {
  frequency: number;
  durationSeconds: number;
  sampleRate?: number;
  amplitude?: number;
  /** Relative levels of harmonics 1, 2, 3… A single `[1]` is a pure sine. */
  harmonics?: readonly number[];
  /** Exponential decay in seconds; omit for a sustained tone. */
  decaySeconds?: number;
  phase?: number;
};

/** A tone with optional harmonics and decay. */
export function tone({
  frequency,
  durationSeconds,
  sampleRate = DEFAULT_SAMPLE_RATE,
  amplitude = 0.5,
  harmonics = [1],
  decaySeconds,
  phase = 0,
}: ToneOptions): Float32Array {
  const length = Math.round(durationSeconds * sampleRate);
  const samples = new Float32Array(length);
  const normalisation = harmonics.reduce((sum, level) => sum + Math.abs(level), 0) || 1;

  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    let value = 0;

    for (let h = 0; h < harmonics.length; h += 1) {
      const level = harmonics[h]!;
      if (level === 0) continue;
      value += level * Math.sin(2 * Math.PI * frequency * (h + 1) * t + phase);
    }

    value /= normalisation;
    if (decaySeconds !== undefined) value *= Math.exp(-t / decaySeconds);
    samples[i] = value * amplitude;
  }

  return samples;
}

/**
 * A plucked-string-ish tone: strong fundamental, decaying harmonic series.
 *
 * Closer to a real ukulele than a sine, and specifically the case where a naive
 * FFT-peak detector reports the wrong octave.
 */
export function pluck(
  frequency: number,
  durationSeconds: number,
  sampleRate = DEFAULT_SAMPLE_RATE,
): Float32Array {
  return tone({
    frequency,
    durationSeconds,
    sampleRate,
    amplitude: 0.6,
    harmonics: [1, 0.6, 0.4, 0.25, 0.15, 0.1],
    decaySeconds: 1.2,
  });
}

/**
 * A tone whose second harmonic is louder than its fundamental — the classic
 * octave-error trap for pitch detectors.
 */
export function missingFundamentalish(
  frequency: number,
  durationSeconds: number,
  sampleRate = DEFAULT_SAMPLE_RATE,
): Float32Array {
  return tone({
    frequency,
    durationSeconds,
    sampleRate,
    amplitude: 0.5,
    harmonics: [0.4, 1, 0.7, 0.3],
  });
}

export function silence(
  durationSeconds: number,
  sampleRate = DEFAULT_SAMPLE_RATE,
): Float32Array {
  return new Float32Array(Math.round(durationSeconds * sampleRate));
}

/** Deterministic pseudo-random noise, so failures are reproducible. */
export function noise(
  durationSeconds: number,
  amplitude = 0.05,
  sampleRate = DEFAULT_SAMPLE_RATE,
  seed = 12345,
): Float32Array {
  const length = Math.round(durationSeconds * sampleRate);
  const samples = new Float32Array(length);
  let state = seed;

  for (let i = 0; i < length; i += 1) {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    samples[i] = ((state >>> 0) / 0xffffffff - 0.5) * 2 * amplitude;
  }

  return samples;
}

/** Adds `b` into `a` in place, starting at `offset` samples. */
export function mixInto(a: Float32Array, b: Float32Array, offset = 0): Float32Array {
  for (let i = 0; i < b.length; i += 1) {
    const index = offset + i;
    if (index >= a.length) break;
    a[index]! += b[i]!;
  }
  return a;
}

/** Cents between two frequencies; 100 cents is one semitone. */
export function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(a / b);
}
