import { formatPitchClass, frettedMidi, parsePitchClass, spellNote } from './notes';

/**
 * Chord qualities the app ships, each defined by its intervals in semitones
 * above the root, plus which of those a voicing is *required* to contain.
 *
 * Four-note chords may drop the fifth — that is standard practice and the only
 * way many of these fit on four strings — but they may never drop the third or
 * the seventh, which are what give the chord its identity.
 */
export type ChordQuality = keyof typeof CHORD_QUALITIES;

type QualityDefinition = {
  /** Every interval the chord is allowed to contain. */
  intervals: readonly number[];
  /**
   * Letter-names above the root for each interval, parallel to `intervals`.
   * A third is 2 letters up, a seventh is 6 — this is what makes the chord
   * spell as `E G Bb D` instead of `E G A# D`.
   */
  letterSteps: readonly number[];
  /** Intervals a voicing must contain to be considered a valid spelling. */
  required: readonly number[];
  /** Suffix appended to the root, e.g. `m7` in `Am7`. */
  suffix: string;
  suffixHe: string;
  labelEn: string;
  labelHe: string;
};

export const CHORD_QUALITIES = {
  maj: {
    intervals: [0, 4, 7],
    letterSteps: [0, 2, 4],
    required: [0, 4, 7],
    suffix: '',
    suffixHe: '',
    labelEn: 'Major',
    labelHe: 'מז׳ור',
  },
  min: {
    intervals: [0, 3, 7],
    letterSteps: [0, 2, 4],
    required: [0, 3, 7],
    suffix: 'm',
    suffixHe: 'm',
    labelEn: 'Minor',
    labelHe: 'מינור',
  },
  dom7: {
    intervals: [0, 4, 7, 10],
    letterSteps: [0, 2, 4, 6],
    required: [0, 4, 10],
    suffix: '7',
    suffixHe: '7',
    labelEn: 'Dominant 7th',
    labelHe: 'שביעי דומיננטי',
  },
  min7: {
    intervals: [0, 3, 7, 10],
    letterSteps: [0, 2, 4, 6],
    required: [0, 3, 10],
    suffix: 'm7',
    suffixHe: 'm7',
    labelEn: 'Minor 7th',
    labelHe: 'מינור שביעי',
  },
  maj7: {
    intervals: [0, 4, 7, 11],
    letterSteps: [0, 2, 4, 6],
    required: [0, 4, 11],
    suffix: 'maj7',
    suffixHe: 'maj7',
    labelEn: 'Major 7th',
    labelHe: 'מז׳ור שביעי',
  },
  sus2: {
    intervals: [0, 2, 7],
    letterSteps: [0, 1, 4],
    required: [0, 2, 7],
    suffix: 'sus2',
    suffixHe: 'sus2',
    labelEn: 'Suspended 2nd',
    labelHe: 'סוספנד 2',
  },
  sus4: {
    intervals: [0, 5, 7],
    letterSteps: [0, 3, 4],
    required: [0, 5, 7],
    suffix: 'sus4',
    suffixHe: 'sus4',
    labelEn: 'Suspended 4th',
    labelHe: 'סוספנד 4',
  },
  dim7: {
    intervals: [0, 3, 6, 9],
    letterSteps: [0, 2, 4, 5],
    required: [0, 3, 6],
    suffix: 'dim7',
    suffixHe: 'dim7',
    labelEn: 'Diminished 7th',
    labelHe: 'מוקטן שביעי',
  },
  aug: {
    intervals: [0, 4, 8],
    letterSteps: [0, 2, 4],
    required: [0, 4, 8],
    suffix: 'aug',
    suffixHe: 'aug',
    labelEn: 'Augmented',
    labelHe: 'מוגדל',
  },
  maj6: {
    intervals: [0, 4, 7, 9],
    letterSteps: [0, 2, 4, 5],
    required: [0, 4, 9],
    suffix: '6',
    suffixHe: '6',
    labelEn: 'Major 6th',
    labelHe: 'מז׳ור שישי',
  },
  min7b5: {
    intervals: [0, 3, 6, 10],
    letterSteps: [0, 2, 4, 6],
    required: [0, 3, 6, 10],
    suffix: 'm7b5',
    suffixHe: 'm7b5',
    labelEn: 'Half-diminished',
    labelHe: 'חצי מוקטן',
  },
  add9: {
    intervals: [0, 2, 4, 7],
    letterSteps: [0, 1, 2, 4],
    required: [0, 2, 4, 7],
    suffix: 'add9',
    suffixHe: 'add9',
    labelEn: 'Added 9th',
    labelHe: 'עם תשיעית',
  },
} as const satisfies Record<string, QualityDefinition>;

/** A fingering: fret per string in diagram order (G C E A). -1 means muted. */
export type ChordShape = {
  frets: readonly [number, number, number, number];
  /** Finger per string, 1-4; 0 where the string is open or muted. */
  fingers: readonly [number, number, number, number];
  barre?: { fret: number; fromString: number; toString: number };
  /** First fret drawn in the diagram; > 1 for shapes high up the neck. */
  baseFret: number;
};

export function chordName(root: string, quality: ChordQuality): string {
  return `${root}${CHORD_QUALITIES[quality].suffix}`;
}

/** The pitch classes a chord is spelled from. */
export function chordPitchClasses(root: string, quality: ChordQuality): number[] {
  const rootPc = parsePitchClass(root);
  return CHORD_QUALITIES[quality].intervals.map((i) => (rootPc + i) % 12);
}

/**
 * The chord's tones, correctly spelled and in chord order (root first).
 *
 * `chordTones('E', 'min7b5')` → `['E', 'G', 'Bb', 'D']`.
 */
export function chordTones(root: string, quality: ChordQuality): string[] {
  const rootPc = parsePitchClass(root);
  const { intervals, letterSteps } = CHORD_QUALITIES[quality];
  return intervals.map((interval, i) =>
    spellNote(root, letterSteps[i] ?? 0, (rootPc + interval) % 12),
  );
}

/** The pitch classes a fingering actually sounds. */
export function shapePitchClasses(frets: readonly number[]): number[] {
  const classes = new Set<number>();
  frets.forEach((fret, stringIndex) => {
    if (fret < 0) return; // muted
    classes.add(frettedMidi(stringIndex, fret) % 12);
  });
  return [...classes].sort((a, b) => a - b);
}

export type ShapeValidation =
  | { valid: true }
  | { valid: false; reason: string; extra: string[]; missing: string[] };

/**
 * Checks that a fingering actually spells the chord it claims to.
 *
 * This exists because a wrong chord diagram is the worst bug this app could
 * ship — a beginner has no way to know the app is wrong, and will train the
 * mistake in. Every shape is run through this in `npm run validate:content`.
 */
export function validateShape(
  root: string,
  quality: ChordQuality,
  frets: readonly number[],
): ShapeValidation {
  const rootPc = parsePitchClass(root);
  const definition = CHORD_QUALITIES[quality];
  const allowed = new Set(definition.intervals.map((i) => (rootPc + i) % 12));
  const required = definition.required.map((i) => (rootPc + i) % 12);
  const sounded = new Set(shapePitchClasses(frets));

  const preferFlats = root.includes('b');
  const extra = [...sounded].filter((pc) => !allowed.has(pc));
  const missing = required.filter((pc) => !sounded.has(pc));

  if (extra.length === 0 && missing.length === 0) return { valid: true };

  const extraNames = extra.map((pc) => formatPitchClass(pc, preferFlats));
  const missingNames = missing.map((pc) => formatPitchClass(pc, preferFlats));
  const parts: string[] = [];
  if (extraNames.length) parts.push(`sounds ${extraNames.join(', ')} which is not in the chord`);
  if (missingNames.length) parts.push(`is missing ${missingNames.join(', ')}`);

  return {
    valid: false,
    reason: `${chordName(root, quality)} ${parts.join(' and ')}`,
    extra: extraNames,
    missing: missingNames,
  };
}

/**
 * Assigns fingers to a fingering.
 *
 * Lowest fret gets the lowest finger, which is how these shapes are actually
 * taught. Barred strings all share the barring finger.
 */
export function assignFingers(
  frets: readonly [number, number, number, number],
  barre?: ChordShape['barre'],
): [number, number, number, number] {
  const fingers: [number, number, number, number] = [0, 0, 0, 0];

  const barredIndices = new Set<number>();
  if (barre) {
    for (let i = barre.fromString; i <= barre.toString; i += 1) {
      if (frets[i] === barre.fret) {
        barredIndices.add(i);
        fingers[i] = 1;
      }
    }
  }

  const remaining = frets
    .map((fret, index) => ({ fret, index }))
    .filter(({ fret, index }) => fret > 0 && !barredIndices.has(index))
    .sort((a, b) => a.fret - b.fret || a.index - b.index);

  let next = barredIndices.size > 0 ? 2 : 1;
  for (const { index } of remaining) {
    fingers[index] = Math.min(next, 4);
    next += 1;
  }

  return fingers;
}

/**
 * Difficulty 1-5, derived from what the hand actually has to do rather than
 * hand-assigned, so it stays consistent across the whole library.
 */
export function shapeDifficulty(shape: Pick<ChordShape, 'frets' | 'barre'>): 1 | 2 | 3 | 4 | 5 {
  const fretted = shape.frets.filter((f) => f > 0);
  const highest = Math.max(0, ...shape.frets);
  const span = fretted.length > 0 ? highest - Math.min(...fretted) : 0;

  let score = fretted.length; // 0-4 fingers down
  if (shape.barre) score += 2;
  if (span >= 3) score += 1;
  if (highest >= 5) score += 1;

  if (score <= 1) return 1;
  if (score <= 2) return 2;
  if (score <= 4) return 3;
  if (score <= 6) return 4;
  return 5;
}
