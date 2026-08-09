import { pluckedString } from '../karplus';

import { DEFAULT_SAMPLE_RATE, mixInto, noise } from './signals';

/**
 * Synthetic performances with known ground truth.
 *
 * This is what makes the listening engine provable rather than a matter of
 * opinion: every fixture knows exactly when each strum happened and how loud it
 * was, so a test can assert how far the analysis was off instead of asserting
 * that it produced something.
 */

export type SynthesisedTake = {
  samples: Float32Array;
  /** Ground truth: when each strum actually happened, in seconds. */
  onsetTimes: number[];
  /** Ground truth: the relative loudness of each strum, 0..1. */
  amplitudes: number[];
  sampleRate: number;
};

export type StrumSpec = {
  time: number;
  amplitude?: number;
  /** Damped "chnk" rather than a ringing chord. */
  muted?: boolean;
};

/** C major on a re-entrant ukulele: G4, C4, E4, C5. */
const C_MAJOR_FREQUENCIES = [392.0, 261.63, 329.63, 523.25];

/**
 * Renders a series of strums at exact times.
 *
 * Real plucked strings rather than clicks, and chords that ring into each
 * other, because that overlap is precisely what a naive amplitude-threshold
 * detector fails on.
 */
export function renderTake(
  strums: readonly StrumSpec[],
  {
    durationSeconds,
    sampleRate = DEFAULT_SAMPLE_RATE,
    noiseAmplitude = 0.0015,
    stringSpreadSeconds = 0.012,
  }: {
    durationSeconds: number;
    sampleRate?: number;
    noiseAmplitude?: number;
    stringSpreadSeconds?: number;
  },
): SynthesisedTake {
  const samples = noise(durationSeconds, noiseAmplitude, sampleRate, 4242);

  strums.forEach((strum, index) => {
    const amplitude = strum.amplitude ?? 0.7;

    C_MAJOR_FREQUENCIES.forEach((frequency, stringIndex) => {
      const note = pluckedString({
        frequency,
        sampleRate,
        durationSeconds: strum.muted ? 0.12 : 1.6,
        decaySeconds: strum.muted ? 0.05 : 1.4,
        amplitude: (amplitude / C_MAJOR_FREQUENCIES.length) * 1.6,
        seed: 17 + index * 7 + stringIndex,
      });

      const offset = Math.round((strum.time + stringIndex * stringSpreadSeconds) * sampleRate);
      mixInto(samples, note, offset);
    });
  });

  return {
    samples,
    onsetTimes: strums.map((strum) => strum.time),
    amplitudes: strums.map((strum) => strum.amplitude ?? 0.7),
    sampleRate,
  };
}

/** An evenly spaced take: `count` strums, `interval` seconds apart. */
export function steadyTake(
  count: number,
  interval: number,
  startTime = 0.3,
  options: { amplitude?: number; sampleRate?: number } = {},
): SynthesisedTake {
  const strums = Array.from({ length: count }, (_, index) => ({
    time: startTime + index * interval,
    amplitude: options.amplitude ?? 0.7,
  }));

  return renderTake(strums, {
    durationSeconds: startTime + count * interval + 1,
    sampleRate: options.sampleRate,
  });
}

/**
 * A take that speeds up: each strum lands `driftPerStrum` seconds earlier than
 * the one before would suggest. Negative values drag instead.
 */
export function driftingTake(
  count: number,
  interval: number,
  driftPerStrum: number,
  startTime = 0.3,
): SynthesisedTake {
  let time = startTime;
  const strums: StrumSpec[] = [];

  for (let index = 0; index < count; index += 1) {
    strums.push({ time });
    time += interval - driftPerStrum;
  }

  return renderTake(strums, { durationSeconds: time + 1 });
}
