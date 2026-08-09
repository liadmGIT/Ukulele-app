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
  /** Which chord is strummed. Defaults to C major. */
  chord?: ChordName;
};

/**
 * Chord voicings as they sound on a re-entrant ukulele, in string order
 * (G C E A). Used to render takes that actually change chord, which is what
 * the chord-change drill has to be able to tell apart from repeated strums.
 */
export const CHORD_VOICINGS = {
  /** C major: G4, C4, E4, C5. */
  C: [392.0, 261.63, 329.63, 523.25],
  /** F major: A4, C4, F4, A4. */
  F: [440.0, 261.63, 349.23, 440.0],
  /** A minor: A4, C4, E4, A4. */
  Am: [440.0, 261.63, 329.63, 440.0],
  /** G major: G4, D4, G4, B4. */
  G: [392.0, 293.66, 392.0, 493.88],
} as const;

export type ChordName = keyof typeof CHORD_VOICINGS;

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
    const voicing = CHORD_VOICINGS[strum.chord ?? 'C'];

    voicing.forEach((frequency, stringIndex) => {
      const note = pluckedString({
        frequency,
        sampleRate,
        durationSeconds: strum.muted ? 0.12 : 1.6,
        decaySeconds: strum.muted ? 0.05 : 1.4,
        amplitude: (amplitude / voicing.length) * 1.6,
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

/**
 * Strums alternating between two chords, for the chord-change drill.
 *
 * @param changeEvery how many strums between chord changes. 1 alternates on
 * every strum; a large number renders a take where the learner froze on one
 * chord, which must count as no changes at all.
 */
export function alternatingTake(
  count: number,
  interval: number,
  chords: readonly ChordName[] = ['C', 'F'],
  changeEvery = 1,
  startTime = 0.3,
): SynthesisedTake {
  const strums: StrumSpec[] = Array.from({ length: count }, (_, index) => ({
    time: startTime + index * interval,
    chord: chords[Math.floor(index / changeEvery) % chords.length]!,
  }));

  return renderTake(strums, { durationSeconds: startTime + count * interval + 1 });
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
