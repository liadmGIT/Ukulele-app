import { frettedMidi, midiToFrequency, STANDARD_TUNING } from './notes';
import type { StrumDirection } from './strum';

/**
 * Turning a chord shape into the notes a strum actually sounds.
 */

/** Time between adjacent strings within one stroke. */
export const DEFAULT_STRUM_SPREAD_SECONDS = 0.012;

export type StrumNote = {
  stringIndex: number;
  midi: number;
  frequency: number;
  /** Delay from the start of the stroke, in seconds. */
  offsetSeconds: number;
};

/**
 * The notes of one stroke, in the order the hand strikes them.
 *
 * The order is **physical string order** — index 0→3 for a down-stroke, 3→0 for
 * an up-stroke — and deliberately *not* pitch order. On a re-entrant high-G
 * ukulele the 4th string (G4) is pitched above the C and E strings, so a
 * down-stroke does not ascend in pitch.
 *
 * That same fact is why the app never grades strum direction from audio: the
 * usual trick of inferring direction from the order the strings sound assumes a
 * monotonic pitch sweep, which this tuning simply does not produce.
 */
export function strumNotes(
  frets: readonly number[],
  direction: Exclude<StrumDirection, 'rest'>,
  spreadSeconds = DEFAULT_STRUM_SPREAD_SECONDS,
): StrumNote[] {
  const sounding = STANDARD_TUNING.map((string) => ({
    stringIndex: string.index,
    fret: frets[string.index] ?? 0,
  })).filter((entry) => entry.fret >= 0); // negative = muted, not struck

  const ordered = direction === 'D' ? sounding : [...sounding].reverse();

  return ordered.map((entry, position) => {
    const midi = frettedMidi(entry.stringIndex, entry.fret);
    return {
      stringIndex: entry.stringIndex,
      midi,
      frequency: midiToFrequency(midi),
      offsetSeconds: position * spreadSeconds,
    };
  });
}

/** Every distinct pitch a shape can sound, for pre-rendering the synth. */
export function shapeMidiNotes(frets: readonly number[]): number[] {
  const notes = new Set<number>();

  STANDARD_TUNING.forEach((string) => {
    const fret = frets[string.index] ?? 0;
    if (fret < 0) return;
    notes.add(frettedMidi(string.index, fret));
  });

  return [...notes].sort((a, b) => a - b);
}

/** Total time from the first string to the last within one stroke. */
export function strumDurationSeconds(
  frets: readonly number[],
  spreadSeconds = DEFAULT_STRUM_SPREAD_SECONDS,
): number {
  const sounding = frets.filter((fret) => fret >= 0).length;
  return Math.max(0, sounding - 1) * spreadSeconds;
}
