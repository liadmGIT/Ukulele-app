/**
 * Note and tuning primitives.
 *
 * The app targets standard **re-entrant high-G GCEA** tuning only. That detail
 * matters well beyond the tuner: the 4th string (G4) is pitched *above* the C4
 * and E4 strings, so a strum is not monotonic in pitch. Anything that reasons
 * about string order must read the actual MIDI numbers here rather than assume
 * low-to-high.
 */

export const PITCH_CLASS_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export type PitchClassName = (typeof PITCH_CLASS_NAMES)[number];

/** Flat spellings, used when a chord's root is a flat (Bb, Eb, Ab, Db, Gb). */
export const FLAT_NAMES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

const NOTE_LETTER_TO_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Parses a note name such as `C`, `F#`, `Bb`, `Ab` into a pitch class 0-11. */
export function parsePitchClass(name: string): number {
  const letter = name[0]?.toUpperCase();
  if (letter === undefined) {
    throw new Error(`Empty note name`);
  }
  const base = NOTE_LETTER_TO_SEMITONE[letter];
  if (base === undefined) {
    throw new Error(`Unknown note letter in "${name}"`);
  }

  let semitone = base;
  for (const accidental of name.slice(1)) {
    if (accidental === '#') semitone += 1;
    else if (accidental === 'b') semitone -= 1;
    else throw new Error(`Unknown accidental "${accidental}" in "${name}"`);
  }

  return ((semitone % 12) + 12) % 12;
}

/** Renders a pitch class, using flat spellings when the context calls for it. */
export function formatPitchClass(pitchClass: number, preferFlats = false): string {
  const index = ((pitchClass % 12) + 12) % 12;
  const name = preferFlats ? FLAT_NAMES[index] : PITCH_CLASS_NAMES[index];
  if (name === undefined) throw new Error(`Invalid pitch class ${pitchClass}`);
  return name;
}

export const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

/**
 * Spells the note that is `letterSteps` letter-names above `root` and sounds at
 * `targetPitchClass`, adding whatever accidental that requires.
 *
 * This is why `Em7b5` reads `E G Bb D` rather than `E G A# D`: a seventh chord's
 * seventh has to be spelled on the seventh letter, no matter which enharmonic
 * name happens to be more common in isolation.
 */
export function spellNote(root: string, letterSteps: number, targetPitchClass: number): string {
  const rootLetter = root[0]?.toUpperCase() as (typeof NOTE_LETTERS)[number] | undefined;
  if (!rootLetter) throw new Error(`Empty root "${root}"`);

  const rootLetterIndex = NOTE_LETTERS.indexOf(rootLetter);
  if (rootLetterIndex < 0) throw new Error(`Unknown root letter in "${root}"`);

  const letterIndex = (rootLetterIndex + letterSteps) % 7;
  const letter = NOTE_LETTERS[letterIndex]!;
  const natural = LETTER_SEMITONES[letterIndex]!;

  // Shortest signed distance from the natural letter to the target, in [-6, 6].
  let delta = (((targetPitchClass - natural) % 12) + 12) % 12;
  if (delta > 6) delta -= 12;

  const accidental = delta > 0 ? '#'.repeat(delta) : 'b'.repeat(-delta);
  return `${letter}${accidental}`;
}

export type UkuleleString = {
  /** 0 = the G string, drawn leftmost in a chord diagram. */
  index: 0 | 1 | 2 | 3;
  name: PitchClassName;
  /** MIDI note number of the open string. */
  midi: number;
  label: string;
};

/** Standard re-entrant high-G tuning, in chord-diagram order (G C E A). */
export const STANDARD_TUNING: readonly UkuleleString[] = [
  { index: 0, name: 'G', midi: 67, label: 'G4' },
  { index: 1, name: 'C', midi: 60, label: 'C4' },
  { index: 2, name: 'E', midi: 64, label: 'E4' },
  { index: 3, name: 'A', midi: 69, label: 'A4' },
] as const;

export const A4_FREQUENCY_HZ = 440;
const A4_MIDI = 69;

export function midiToFrequency(midi: number): number {
  return A4_FREQUENCY_HZ * 2 ** ((midi - A4_MIDI) / 12);
}

export function frequencyToMidi(frequency: number): number {
  return 12 * Math.log2(frequency / A4_FREQUENCY_HZ) + A4_MIDI;
}

/** Signed distance in cents from `frequency` to the nearest equal-tempered note. */
export function centsFromNearestNote(frequency: number): { midi: number; cents: number } {
  const exact = frequencyToMidi(frequency);
  const midi = Math.round(exact);
  return { midi, cents: (exact - midi) * 100 };
}

/** MIDI note produced by stopping `string` at `fret` (0 = open). */
export function frettedMidi(stringIndex: number, fret: number): number {
  const string = STANDARD_TUNING[stringIndex];
  if (!string) throw new Error(`Invalid string index ${stringIndex}`);
  return string.midi + fret;
}
