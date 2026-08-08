import chordsJson from '@content/chords.json';

import { chordLibrarySchema, type Chord, type ChordLibrary } from './schemas';

let library: ChordLibrary | null = null;

/**
 * The bundled chord library, validated once on first access.
 *
 * Content is shipped as JSON rather than read from SQLite because it never
 * changes at runtime; SQLite only holds a copy of it so that user progress can
 * be joined against it in a single query.
 */
export function getChordLibrary(): ChordLibrary {
  if (!library) {
    library = chordLibrarySchema.parse(chordsJson);
  }
  return library;
}

export function getChords(): Chord[] {
  return getChordLibrary().chords;
}

export function getChordById(id: string): Chord | undefined {
  return getChords().find((chord) => chord.id === id);
}

/** Case-insensitive match on the chord name and any alternate spelling. */
export function searchChords(query: string): Chord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return getChords();

  return getChords().filter((chord) => {
    if (chord.nameEn.toLowerCase().startsWith(needle)) return true;
    return chord.aliases.some((alias) => alias.toLowerCase().startsWith(needle));
  });
}

export type { Chord, ChordShapeData, ChordLibrary } from './schemas';
