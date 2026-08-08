/**
 * Amplitude measurement. Pure functions over `Float32Array` so they can be
 * tested against synthetic signals without a device or an audio graph.
 */

/** Root-mean-square amplitude of a frame, in the range 0..1. */
export function rms(samples: Float32Array, start = 0, length = samples.length - start): number {
  const end = Math.min(samples.length, start + length);
  if (end <= start) return 0;

  let sum = 0;
  for (let i = start; i < end; i += 1) {
    const sample = samples[i]!;
    sum += sample * sample;
  }
  return Math.sqrt(sum / (end - start));
}

/** Largest absolute sample in a frame. */
export function peak(samples: Float32Array, start = 0, length = samples.length - start): number {
  const end = Math.min(samples.length, start + length);
  let max = 0;
  for (let i = start; i < end; i += 1) {
    const magnitude = Math.abs(samples[i]!);
    if (magnitude > max) max = magnitude;
  }
  return max;
}

const SILENCE_DBFS = -120;

/** Converts a 0..1 amplitude to dBFS, with a floor instead of -Infinity. */
export function amplitudeToDbfs(amplitude: number): number {
  if (amplitude <= 0) return SILENCE_DBFS;
  return Math.max(SILENCE_DBFS, 20 * Math.log10(amplitude));
}

export function dbfsToAmplitude(dbfs: number): number {
  return 10 ** (dbfs / 20);
}

/**
 * Removes DC offset in place.
 *
 * Phone microphones commonly carry a small constant bias, which would otherwise
 * skew both the RMS envelope and the pitch detector's difference function.
 */
export function removeDcOffset(samples: Float32Array): Float32Array {
  if (samples.length === 0) return samples;

  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i]!;
  const mean = sum / samples.length;

  if (mean !== 0) {
    for (let i = 0; i < samples.length; i += 1) samples[i]! -= mean;
  }
  return samples;
}
