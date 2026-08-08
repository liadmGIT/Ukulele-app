import {
  STANDARD_TUNING,
  centsFromNearestNote,
  formatPitchClass,
  midiToFrequency,
  type UkuleleString,
} from './notes';

/**
 * Turning a detected frequency into something a learner can act on.
 *
 * Pure functions over a frequency, so the needle's behaviour is testable
 * without a microphone.
 */

/** Within this many cents counts as in tune — the usual tolerance for a tuner. */
export const IN_TUNE_CENTS = 5;

/**
 * How far from an open string we will still name that string.
 *
 * The four strings sit at C4, E4, G4, A4, so the widest gap between neighbours
 * is four semitones and nothing inside the instrument's open range is ever more
 * than 200 cents from the nearest one. 250 therefore names a string for any
 * plausible reading — including a badly slack string that is a whole tone flat,
 * which is exactly when a beginner most needs to be told which peg to turn —
 * while still giving up on something far outside the range.
 */
const STRING_MATCH_CENTS = 250;

export type TuningDirection = 'flat' | 'sharp' | 'in-tune';

export type TuningReading = {
  frequency: number;
  /** Nearest equal-tempered note, for the chromatic readout. */
  midi: number;
  noteName: string;
  octave: number;
  /** Signed cents from that chromatic note. */
  cents: number;
  /** The open string being tuned, when the reading is close enough to name one. */
  string: UkuleleString | null;
  /**
   * Signed cents from that open string — what the needle points at. Null when
   * no string is in range, in which case the needle falls back to `cents`.
   */
  centsFromString: number | null;
  /** True when the reading is on its target string and within tolerance. */
  inTune: boolean;
  /**
   * Which way to turn the peg. Measured against the target string when there is
   * one, so it stays meaningful for a string that is a whole semitone out —
   * where the nearest *chromatic* note would misleadingly read "in tune".
   */
  direction: TuningDirection;
};

export function analyseTuning(frequency: number): TuningReading {
  const { midi, cents } = centsFromNearestNote(frequency);
  const octave = Math.floor(midi / 12) - 1;

  const string = nearestOpenString(frequency);
  const centsFromString = string ? centsBetweenFrequencies(frequency, midiToFrequency(string.midi)) : null;

  const offset = centsFromString ?? cents;

  return {
    frequency,
    midi,
    noteName: formatPitchClass(midi % 12),
    octave,
    cents,
    string,
    centsFromString,
    inTune: string !== null && Math.abs(offset) <= IN_TUNE_CENTS,
    direction: Math.abs(offset) <= IN_TUNE_CENTS ? 'in-tune' : offset < 0 ? 'flat' : 'sharp',
  };
}

/** Signed cents from `reference` to `frequency`. */
export function centsBetweenFrequencies(frequency: number, reference: number): number {
  return 1200 * Math.log2(frequency / reference);
}

/**
 * The open string a frequency is closest to, or null when it is far outside the
 * instrument's open range.
 *
 * Compared in cents rather than hertz: the strings are not evenly spaced in
 * hertz, so a hertz comparison biases every reading towards the lower string.
 */
export function nearestOpenString(frequency: number): UkuleleString | null {
  if (frequency <= 0) return null;

  let best: UkuleleString | null = null;
  let bestDistance = Infinity;

  for (const string of STANDARD_TUNING) {
    const distance = Math.abs(centsBetweenFrequencies(frequency, midiToFrequency(string.midi)));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = string;
    }
  }

  return bestDistance <= STRING_MATCH_CENTS ? best : null;
}

/** Target frequency for an open string, for the reference-tone playback. */
export function stringFrequency(string: UkuleleString): number {
  return midiToFrequency(string.midi);
}
