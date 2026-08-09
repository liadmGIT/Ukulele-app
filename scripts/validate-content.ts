/**
 * Validates everything in `content/` against its schema and against music
 * theory. Run in CI so bad content can never reach a learner.
 *
 * Usage: npm run validate:content
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { chordLibrarySchema, strumPatternLibrarySchema } from '../src/content/schemas';
import { validateShape, type ChordQuality } from '../src/music/chords';
import { stepsPerBar, type Subdivision } from '../src/music/grid';
import { StrumNotationError, formatStrumPattern, parseStrumPattern } from '../src/music/strum';

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

function validateStrumPatterns(): number {
  const raw = readFileSync(resolve(process.cwd(), 'content/strum-patterns.json'), 'utf8');
  const parsed = strumPatternLibrarySchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push(`strum-patterns.json ${issue.path.join('.')}: ${issue.message}`);
    }
    return 0;
  }

  const seen = new Set<string>();
  const notations = new Map<string, string>();

  for (const pattern of parsed.data.patterns) {
    if (seen.has(pattern.id)) problems.push(`Duplicate pattern id "${pattern.id}"`);
    seen.add(pattern.id);

    let steps;
    try {
      steps = parseStrumPattern(pattern.notation);
    } catch (error) {
      const detail = error instanceof StrumNotationError ? error.message : String(error);
      problems.push(`${pattern.id}: ${detail}`);
      continue;
    }

    const perBar = stepsPerBar(
      { beatsPerBar: pattern.beatsPerBar, beatUnit: pattern.beatUnit },
      pattern.subdivision as Subdivision,
    );

    if (steps.length % perBar !== 0) {
      problems.push(
        `${pattern.id}: ${steps.length} steps is not a whole number of bars ` +
          `(${pattern.beatsPerBar}/${pattern.beatUnit} at ${pattern.subdivision}ths is ${perBar} per bar)`,
      );
    }

    // A pattern that survives a round trip is one the app will redisplay
    // exactly as it was authored.
    const canonical = formatStrumPattern(steps);
    if (canonical !== pattern.notation.trim().replace(/\s+/g, ' ')) {
      problems.push(`${pattern.id}: notation "${pattern.notation}" is not canonical — write "${canonical}"`);
    }

    const duplicate = notations.get(canonical);
    if (duplicate) {
      problems.push(`${pattern.id} has the same notation as ${duplicate}: "${canonical}"`);
    }
    notations.set(canonical, pattern.id);
  }

  return parsed.data.patterns.length;
}

function main(): void {
  const chordCount = validateChords();
  const patternCount = validateStrumPatterns();

  if (problems.length > 0) {
    console.error(`\n✖ Content validation failed with ${problems.length} problem(s):\n`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(`✓ Content valid — ${chordCount} chords, ${patternCount} strum patterns`);
}

main();
