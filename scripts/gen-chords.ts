/**
 * Builds `content/chords.json` from the curated fingerings in
 * `scripts/data/chord-shapes.ts`.
 *
 * Every shape is checked against its chord spelling before it is written, so a
 * wrong diagram fails the build rather than reaching a learner.
 *
 * Usage: npm run gen:chords
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { chordLibrarySchema, type Chord } from '../src/content/schemas';
import {
  CHORD_QUALITIES,
  assignFingers,
  chordName,
  chordTones,
  shapeDifficulty,
  validateShape,
  type ChordQuality,
} from '../src/music/chords';
import { parsePitchClass } from '../src/music/notes';

import { CHORD_SHAPES } from './data/chord-shapes';

const LIBRARY_VERSION = 1;
const QUALITY_ORDER = Object.keys(CHORD_QUALITIES) as ChordQuality[];

// npm scripts always run from the project root.
const outputPath = resolve(process.cwd(), 'content/chords.json');

function buildChords(): Chord[] {
  const failures: string[] = [];
  const seen = new Set<string>();

  const chords = CHORD_SHAPES.map((source, index): Chord => {
    const name = chordName(source.root, source.quality);
    const id = `${source.root}-${source.quality}`;

    if (seen.has(id)) failures.push(`Duplicate chord id "${id}"`);
    seen.add(id);

    const check = validateShape(source.root, source.quality, source.frets);
    if (!check.valid) failures.push(check.reason);

    const fingers = assignFingers(source.frets, source.barre);
    const difficulty = shapeDifficulty({ frets: source.frets, barre: source.barre });
    const highestFret = Math.max(...source.frets);
    const category = source.barre ? 'barre' : highestFret >= 5 ? 'extended' : 'open';

    // The chord's own spelling (root first), not the order the strings sound,
    // so the detail screen reads like a chord chart.
    const notes = chordTones(source.root, source.quality);

    return {
      id,
      nameEn: name,
      // Chord names are written in Latin letters in Hebrew charts too, so the
      // two are intentionally identical rather than transliterated.
      nameHe: name,
      root: source.root,
      quality: source.quality,
      aliases: source.aliases ?? [],
      notes,
      shapes: [
        {
          frets: source.frets,
          fingers,
          barre: source.barre ?? null,
          baseFret: 1,
        },
      ],
      difficulty,
      category,
      sortOrder: index,
    };
  });

  if (failures.length > 0) {
    console.error(`\n✖ ${failures.length} invalid chord shape(s):\n`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  return chords.sort((a, b) => {
    const rootDelta = parsePitchClass(a.root) - parsePitchClass(b.root);
    if (rootDelta !== 0) return rootDelta;
    return (
      QUALITY_ORDER.indexOf(a.quality as ChordQuality) -
      QUALITY_ORDER.indexOf(b.quality as ChordQuality)
    );
  });
}

function main(): void {
  const chords = buildChords().map((chord, index) => ({ ...chord, sortOrder: index }));
  const library = chordLibrarySchema.parse({
    version: LIBRARY_VERSION,
    tuning: 'GCEA-high-G',
    chords,
  });

  writeFileSync(outputPath, `${JSON.stringify(library, null, 2)}\n`, 'utf8');

  const byCategory = chords.reduce<Record<string, number>>((acc, chord) => {
    acc[chord.category] = (acc[chord.category] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`✓ Wrote ${chords.length} chords to content/chords.json`);
  console.log(`  categories: ${JSON.stringify(byCategory)}`);
  console.log('  every shape verified to spell its chord');
}

main();
