import type { ChordQuality } from '../../src/music/chords';

/**
 * Curated ukulele fingerings, in diagram order **G C E A** (standard re-entrant
 * high-G tuning). Frets are absolute; 0 is an open string, -1 would be muted.
 *
 * These are hand-picked because the *standard taught fingering* matters — an
 * algorithm will happily produce a technically-correct voicing that no teacher
 * would ever show a beginner. Correctness of the notes is then proved by
 * `validateShape`, which every entry here is run through by
 * `npm run validate:content`.
 */
export type ChordShapeSource = {
  root: string;
  quality: ChordQuality;
  frets: [number, number, number, number];
  barre?: { fret: number; fromString: number; toString: number };
  /** Alternate spellings a user might search for, e.g. `A#m` for `Bbm`. */
  aliases?: string[];
};

export const CHORD_SHAPES: readonly ChordShapeSource[] = [
  // ------------------------------------------------------------- major ----
  { root: 'C', quality: 'maj', frets: [0, 0, 0, 3] },
  {
    root: 'Db',
    quality: 'maj',
    frets: [1, 1, 1, 4],
    barre: { fret: 1, fromString: 0, toString: 2 },
    aliases: ['C#'],
  },
  { root: 'D', quality: 'maj', frets: [2, 2, 2, 0] },
  {
    root: 'Eb',
    quality: 'maj',
    frets: [3, 3, 3, 1],
    barre: { fret: 3, fromString: 0, toString: 2 },
    aliases: ['D#'],
  },
  {
    root: 'E',
    quality: 'maj',
    frets: [4, 4, 4, 2],
    barre: { fret: 4, fromString: 0, toString: 2 },
  },
  { root: 'F', quality: 'maj', frets: [2, 0, 1, 0] },
  { root: 'F#', quality: 'maj', frets: [3, 1, 2, 1], aliases: ['Gb'] },
  { root: 'G', quality: 'maj', frets: [0, 2, 3, 2] },
  { root: 'Ab', quality: 'maj', frets: [5, 3, 4, 3], aliases: ['G#'] },
  { root: 'A', quality: 'maj', frets: [2, 1, 0, 0] },
  {
    root: 'Bb',
    quality: 'maj',
    frets: [3, 2, 1, 1],
    barre: { fret: 1, fromString: 2, toString: 3 },
    aliases: ['A#'],
  },
  {
    root: 'B',
    quality: 'maj',
    frets: [4, 3, 2, 2],
    barre: { fret: 2, fromString: 2, toString: 3 },
  },

  // ------------------------------------------------------------- minor ----
  {
    root: 'C',
    quality: 'min',
    frets: [0, 3, 3, 3],
    barre: { fret: 3, fromString: 1, toString: 3 },
  },
  {
    root: 'C#',
    quality: 'min',
    frets: [1, 1, 0, 4],
    barre: { fret: 1, fromString: 0, toString: 1 },
    aliases: ['Dbm'],
  },
  { root: 'D', quality: 'min', frets: [2, 2, 1, 0] },
  { root: 'Eb', quality: 'min', frets: [3, 3, 2, 1], aliases: ['D#m'] },
  { root: 'E', quality: 'min', frets: [0, 4, 3, 2] },
  { root: 'F', quality: 'min', frets: [1, 0, 1, 3] },
  { root: 'F#', quality: 'min', frets: [2, 1, 2, 0], aliases: ['Gbm'] },
  { root: 'G', quality: 'min', frets: [0, 2, 3, 1] },
  { root: 'G#', quality: 'min', frets: [1, 3, 4, 2], aliases: ['Abm'] },
  { root: 'A', quality: 'min', frets: [2, 0, 0, 0] },
  {
    root: 'Bb',
    quality: 'min',
    frets: [3, 1, 1, 1],
    barre: { fret: 1, fromString: 1, toString: 3 },
    aliases: ['A#m'],
  },
  {
    root: 'B',
    quality: 'min',
    frets: [4, 2, 2, 2],
    barre: { fret: 2, fromString: 1, toString: 3 },
  },

  // ------------------------------------------------------- dominant 7th ----
  { root: 'C', quality: 'dom7', frets: [0, 0, 0, 1] },
  {
    root: 'Db',
    quality: 'dom7',
    frets: [1, 1, 1, 2],
    barre: { fret: 1, fromString: 0, toString: 2 },
    aliases: ['C#7'],
  },
  { root: 'D', quality: 'dom7', frets: [2, 2, 2, 3] },
  {
    root: 'Eb',
    quality: 'dom7',
    frets: [3, 3, 3, 4],
    barre: { fret: 3, fromString: 0, toString: 2 },
    aliases: ['D#7'],
  },
  { root: 'E', quality: 'dom7', frets: [1, 2, 0, 2] },
  { root: 'F', quality: 'dom7', frets: [2, 3, 1, 0] },
  { root: 'F#', quality: 'dom7', frets: [3, 4, 2, 4], aliases: ['Gb7'] },
  { root: 'G', quality: 'dom7', frets: [0, 2, 1, 2] },
  { root: 'Ab', quality: 'dom7', frets: [1, 3, 2, 3], aliases: ['G#7'] },
  { root: 'A', quality: 'dom7', frets: [0, 1, 0, 0] },
  {
    root: 'Bb',
    quality: 'dom7',
    frets: [1, 2, 1, 1],
    barre: { fret: 1, fromString: 0, toString: 3 },
    aliases: ['A#7'],
  },
  {
    root: 'B',
    quality: 'dom7',
    frets: [2, 3, 2, 2],
    barre: { fret: 2, fromString: 0, toString: 3 },
  },

  // ---------------------------------------------------------- minor 7th ----
  { root: 'A', quality: 'min7', frets: [0, 0, 0, 0] },
  {
    root: 'B',
    quality: 'min7',
    frets: [2, 2, 2, 2],
    barre: { fret: 2, fromString: 0, toString: 3 },
  },
  {
    root: 'C',
    quality: 'min7',
    frets: [3, 3, 3, 3],
    barre: { fret: 3, fromString: 0, toString: 3 },
  },
  {
    root: 'C#',
    quality: 'min7',
    frets: [1, 1, 0, 2],
    barre: { fret: 1, fromString: 0, toString: 1 },
    aliases: ['Dbm7'],
  },
  { root: 'D', quality: 'min7', frets: [2, 2, 1, 3] },
  { root: 'Eb', quality: 'min7', frets: [3, 3, 2, 4], aliases: ['D#m7'] },
  { root: 'E', quality: 'min7', frets: [0, 2, 0, 2] },
  { root: 'F', quality: 'min7', frets: [1, 3, 1, 3] },
  { root: 'F#', quality: 'min7', frets: [2, 4, 2, 4], aliases: ['Gbm7'] },
  { root: 'G', quality: 'min7', frets: [0, 2, 1, 1] },
  { root: 'G#', quality: 'min7', frets: [1, 3, 2, 2], aliases: ['Abm7'] },
  {
    root: 'Bb',
    quality: 'min7',
    frets: [1, 1, 1, 1],
    barre: { fret: 1, fromString: 0, toString: 3 },
    aliases: ['A#m7'],
  },

  // ---------------------------------------------------------- major 7th ----
  { root: 'C', quality: 'maj7', frets: [0, 0, 0, 2] },
  { root: 'D', quality: 'maj7', frets: [2, 2, 2, 4] },
  { root: 'E', quality: 'maj7', frets: [1, 3, 0, 2] },
  { root: 'F', quality: 'maj7', frets: [2, 4, 1, 3] },
  { root: 'G', quality: 'maj7', frets: [0, 2, 2, 2] },
  { root: 'A', quality: 'maj7', frets: [1, 1, 0, 0] },
  { root: 'Bb', quality: 'maj7', frets: [3, 2, 1, 0], aliases: ['A#maj7'] },
  { root: 'B', quality: 'maj7', frets: [4, 3, 2, 1] },

  // -------------------------------------------------------------- sus4 ----
  { root: 'C', quality: 'sus4', frets: [0, 0, 1, 3] },
  { root: 'D', quality: 'sus4', frets: [0, 2, 3, 0] },
  { root: 'E', quality: 'sus4', frets: [4, 4, 5, 2] },
  { root: 'F', quality: 'sus4', frets: [3, 0, 1, 1] },
  { root: 'G', quality: 'sus4', frets: [0, 2, 3, 3] },
  { root: 'A', quality: 'sus4', frets: [2, 2, 0, 0] },
  { root: 'Bb', quality: 'sus4', frets: [3, 3, 1, 1], aliases: ['A#sus4'] },

  // -------------------------------------------------------------- sus2 ----
  { root: 'C', quality: 'sus2', frets: [0, 2, 3, 3] },
  { root: 'D', quality: 'sus2', frets: [2, 2, 0, 0] },
  { root: 'F', quality: 'sus2', frets: [0, 0, 1, 3] },
  { root: 'G', quality: 'sus2', frets: [0, 2, 3, 0] },
  { root: 'A', quality: 'sus2', frets: [2, 4, 5, 2] },

  // ---------------------------------------------------------- major 6th ----
  { root: 'C', quality: 'maj6', frets: [0, 0, 0, 0] },
  {
    root: 'D',
    quality: 'maj6',
    frets: [2, 2, 2, 2],
    barre: { fret: 2, fromString: 0, toString: 3 },
  },
  { root: 'F', quality: 'maj6', frets: [2, 2, 1, 3] },
  { root: 'G', quality: 'maj6', frets: [0, 2, 0, 2] },
  { root: 'A', quality: 'maj6', frets: [2, 4, 2, 4] },

  // ----------------------------------------------------- diminished 7th ----
  { root: 'C', quality: 'dim7', frets: [2, 3, 2, 3] },
  { root: 'D', quality: 'dim7', frets: [1, 2, 1, 2] },
  { root: 'E', quality: 'dim7', frets: [0, 1, 0, 1] },

  // --------------------------------------------------------- augmented ----
  { root: 'C', quality: 'aug', frets: [1, 0, 0, 3] },
  { root: 'F', quality: 'aug', frets: [2, 1, 1, 0] },
  { root: 'G', quality: 'aug', frets: [0, 3, 3, 2] },
  { root: 'A', quality: 'aug', frets: [2, 1, 1, 4] },

  // ----------------------------------------------------- half-diminished ----
  { root: 'E', quality: 'min7b5', frets: [0, 2, 0, 1] },
  { root: 'A', quality: 'min7b5', frets: [2, 3, 3, 3] },
  { root: 'B', quality: 'min7b5', frets: [2, 2, 1, 2] },

  // -------------------------------------------------------------- add9 ----
  { root: 'C', quality: 'add9', frets: [0, 2, 0, 3] },
  { root: 'F', quality: 'add9', frets: [0, 0, 1, 0] },
];
