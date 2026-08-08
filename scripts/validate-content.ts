/**
 * Validates everything in `content/` against its schema and against music
 * theory. Run in CI so bad content can never reach a learner.
 *
 * Usage: npm run validate:content
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { chordLibrarySchema } from '../src/content/schemas';
import { validateShape, type ChordQuality } from '../src/music/chords';

const problems: string[] = [];

function validateChords(): number {
  const raw = readFileSync(resolve(process.cwd(), 'content/chords.json'), 'utf8');
  const parsed = chordLibrarySchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push(`chords.json ${issue.path.join('.')}: ${issue.message}`);
    }
    return 0;
  }

  const library = parsed.data;
  const seen = new Set<string>();

  for (const chord of library.chords) {
    if (seen.has(chord.id)) problems.push(`Duplicate chord id "${chord.id}"`);
    seen.add(chord.id);

    for (const shape of chord.shapes) {
      const result = validateShape(chord.root, chord.quality as ChordQuality, shape.frets);
      if (!result.valid) problems.push(result.reason);

      shape.frets.forEach((fret, index) => {
        const finger = shape.fingers[index] ?? 0;
        if (fret <= 0 && finger !== 0) {
          problems.push(`${chord.nameEn}: string ${index} is not fretted but has finger ${finger}`);
        }
        if (fret > 0 && finger === 0) {
          problems.push(`${chord.nameEn}: string ${index} is fretted but has no finger assigned`);
        }
      });
    }
  }

  return library.chords.length;
}

function main(): void {
  const chordCount = validateChords();

  if (problems.length > 0) {
    console.error(`\n✖ Content validation failed with ${problems.length} problem(s):\n`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(`✓ Content valid — ${chordCount} chords`);
}

main();
