import type { Subdivision, TimeSignature } from '@/music/grid';
import { buildSongTimeline, type SongTimeline } from '@/music/song';
import { parseStrumPattern, type StrumStep } from '@/music/strum';
import chordsJson from '@content/chords.json';
import songsJson from '@content/songs.json';
import patternsJson from '@content/strum-patterns.json';


import {
  chordLibrarySchema,
  songLibrarySchema,
  strumPatternLibrarySchema,
  type Chord,
  type ChordLibrary,
  type SongData,
  type StrumPatternData,
} from './schemas';

let chordLibrary: ChordLibrary | null = null;

/**
 * The bundled content, validated once on first access.
 *
 * Content ships as JSON rather than being read from SQLite because it never
 * changes at runtime; SQLite only holds a copy so that user progress can be
 * joined against it in a single query.
 */
export function getChordLibrary(): ChordLibrary {
  if (!chordLibrary) {
    chordLibrary = chordLibrarySchema.parse(chordsJson);
  }
  return chordLibrary;
}

export function getChords(): Chord[] {
  return getChordLibrary().chords;
}

export function getChordById(id: string): Chord | undefined {
  return getChords().find((chord) => chord.id === id);
}

/**
 * Case-insensitive match on either name and any alternate spelling.
 *
 * The Hebrew name is searched too. The placeholder above the box is Hebrew, so
 * a Hebrew learner typing what it invites them to type used to get an empty
 * list — and, until this screen gained an empty state, a blank white page with
 * nothing explaining why.
 */
export function searchChords(query: string): Chord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return getChords();

  return getChords().filter((chord) => {
    if (chord.nameEn.toLowerCase().startsWith(needle)) return true;
    if (chord.nameHe.toLowerCase().startsWith(needle)) return true;
    return chord.aliases.some((alias) => alias.toLowerCase().startsWith(needle));
  });
}

// ---------------------------------------------------------- strum patterns --

/**
 * A pattern with its notation already parsed.
 *
 * Parsing happens once at load rather than per render: the strip redraws on
 * every playhead move, and re-parsing a string each time would be wasted work
 * on the exact frames that need to be smooth.
 */
export type StrumPattern = Omit<StrumPatternData, 'beatsPerBar' | 'beatUnit'> & {
  timeSignature: TimeSignature;
  subdivision: Subdivision;
  steps: StrumStep[];
};

let strumPatterns: StrumPattern[] | null = null;

export function getStrumPatterns(): StrumPattern[] {
  if (!strumPatterns) {
    const library = strumPatternLibrarySchema.parse(patternsJson);

    strumPatterns = library.patterns.map((pattern) => {
      const { beatsPerBar, beatUnit, ...rest } = pattern;
      return {
        ...rest,
        timeSignature: { beatsPerBar, beatUnit },
        subdivision: pattern.subdivision as Subdivision,
        steps: parseStrumPattern(pattern.notation),
      };
    });
  }

  return strumPatterns;
}

export function getStrumPatternById(id: string): StrumPattern | undefined {
  return getStrumPatterns().find((pattern) => pattern.id === id);
}

/** Patterns a learner at this level can reasonably attempt, easiest first. */
export function getStrumPatternsUpToDifficulty(maxDifficulty: number): StrumPattern[] {
  return getStrumPatterns()
    .filter((pattern) => pattern.difficulty <= maxDifficulty)
    .sort((a, b) => a.difficulty - b.difficulty);
}

// ------------------------------------------------------------------ songs --

/** A song with its chart already flattened into timed bars. */
export type Song = SongData & { timeline: SongTimeline };

let songs: Song[] | null = null;

export function getSongs(): Song[] {
  if (!songs) {
    const library = songLibrarySchema.parse(songsJson);
    songs = library.songs.map((song) => ({ ...song, timeline: buildSongTimeline(song) }));
  }
  return songs;
}

export function getSongById(id: string): Song | undefined {
  return getSongs().find((song) => song.id === id);
}

/** Distinct chords a song needs. */
export function songChordIds(song: Song): string[] {
  return song.timeline.chordIds;
}

export type { Chord, ChordShapeData, ChordLibrary, SongData, StrumPatternData } from './schemas';
