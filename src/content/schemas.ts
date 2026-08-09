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
