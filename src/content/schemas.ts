import { z } from 'zod';

import { CHORD_QUALITIES } from '@/music/chords';

const fretArray = z.tuple([
  z.number().int().min(-1).max(15),
  z.number().int().min(-1).max(15),
  z.number().int().min(-1).max(15),
  z.number().int().min(-1).max(15),
]);

const fingerArray = z.tuple([
  z.number().int().min(0).max(4),
  z.number().int().min(0).max(4),
  z.number().int().min(0).max(4),
  z.number().int().min(0).max(4),
]);

export const chordShapeSchema = z.object({
  frets: fretArray,
  fingers: fingerArray,
  barre: z
    .object({
      fret: z.number().int().min(1).max(15),
      fromString: z.number().int().min(0).max(3),
      toString: z.number().int().min(0).max(3),
    })
    .nullable(),
  baseFret: z.number().int().min(1).max(12),
});

export const chordSchema = z.object({
  id: z.string().min(1),
  nameEn: z.string().min(1),
  nameHe: z.string().min(1),
  root: z.string().min(1),
  quality: z.enum(Object.keys(CHORD_QUALITIES) as [string, ...string[]]),
  aliases: z.array(z.string()),
  notes: z.array(z.string()).min(3),
  shapes: z.array(chordShapeSchema).min(1),
  difficulty: z.number().int().min(1).max(5),
  category: z.enum(['open', 'barre', 'extended']),
  sortOrder: z.number().int().min(0),
});

export const chordLibrarySchema = z.object({
  version: z.number().int().min(1),
  tuning: z.literal('GCEA-high-G'),
  chords: z.array(chordSchema).min(1),
});

export type Chord = z.infer<typeof chordSchema>;
export type ChordShapeData = z.infer<typeof chordShapeSchema>;
export type ChordLibrary = z.infer<typeof chordLibrarySchema>;

export const strumPatternSchema = z.object({
  id: z.string().min(1),
  nameEn: z.string().min(1),
  nameHe: z.string().min(1),
  beatsPerBar: z.number().int().min(1).max(12),
  beatUnit: z.union([z.literal(4), z.literal(8)]),
  subdivision: z.union([z.literal(4), z.literal(8), z.literal(16)]),
  /** Compact notation — see `src/music/strum.ts` for the grammar. */
  notation: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  descriptionEn: z.string().min(1),
  descriptionHe: z.string().min(1),
});

export const strumPatternLibrarySchema = z.object({
  version: z.number().int().min(1),
  patterns: z.array(strumPatternSchema).min(1),
});

export type StrumPatternData = z.infer<typeof strumPatternSchema>;
export type StrumPatternLibrary = z.infer<typeof strumPatternLibrarySchema>;

/**
 * A chord and how long it lasts, in beats.
 *
 * `cueWord` is the one concession to following along by ear — the syllable a
 * chord change lands on. It is capped at two words and, per `CONTENT.md`, is
 * only populated for public-domain material. Modern songs navigate by section
 * and bar number instead. Enforcing the cap here rather than by convention is
 * what stops a lyric sheet accumulating two words at a time.
 */
export const songMeasureSchema = z.object({
  chordId: z.string().min(1),
  beats: z.number().int().min(1).max(16),
  cueWord: z
    .string()
    .trim()
    .refine((value) => value.split(/\s+/).length <= 2, {
      message: 'A cue word may be at most two words — see CONTENT.md',
    })
    .optional(),
});

export const songSectionSchema = z.object({
  kind: z.enum(['intro', 'verse', 'prechorus', 'chorus', 'bridge', 'instrumental', 'outro']),
  /** Distinguishes "Verse 1" from "Verse 2" when a song repeats a section. */
  label: z.string().optional(),
  /** Overrides the song's default strum pattern for this section. */
  patternId: z.string().optional(),
  measures: z.array(songMeasureSchema).min(1),
});

export const songSchema = z.object({
  id: z.string().min(1),
  titleHe: z.string().min(1),
  titleEn: z.string().min(1),
  artistHe: z.string().min(1),
  artistEn: z.string().min(1),
  language: z.enum(['he', 'en']),
  songKey: z.string().min(1),
  bpm: z.number().int().min(40).max(220),
  beatsPerBar: z.number().int().min(2).max(12),
  beatUnit: z.union([z.literal(4), z.literal(8)]),
  difficulty: z.number().int().min(1).max(5),
  defaultPatternId: z.string().min(1),
  sections: z.array(songSectionSchema).min(1),
  /** Where the arrangement came from; arrangements of a song vary. */
  source: z.string().min(1),
  /**
   * Public-domain works may carry cue words. Everything else is chords and
   * structure only.
   */
  publicDomain: z.boolean(),
});

export const songLibrarySchema = z.object({
  version: z.number().int().min(1),
  songs: z.array(songSchema).min(1),
});

export type SongMeasureData = z.infer<typeof songMeasureSchema>;
export type SongSectionData = z.infer<typeof songSectionSchema>;
export type SongData = z.infer<typeof songSchema>;
export type SongLibrary = z.infer<typeof songLibrarySchema>;
