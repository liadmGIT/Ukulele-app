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
