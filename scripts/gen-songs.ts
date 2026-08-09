/**
 * Builds `content/songs.json` from the compact arrangements in
 * `scripts/data/songs.ts`.
 *
 * Every chord name is resolved against the shipped chord library, so a song can
 * never reference a chord the app cannot draw, and every section is checked to
 * be a whole number of bars.
 *
 * Usage: npm run gen:songs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  chordLibrarySchema,
  songLibrarySchema,
  type SongData,
  type SongMeasureData,
} from '../src/content/schemas';

import { SONGS, type SectionSource } from './data/songs';

const LIBRARY_VERSION = 1;
const outputPath = resolve(process.cwd(), 'content/songs.json');

const failures: string[] = [];

/** Chord display name (and every alias) to the id the app stores. */
function buildChordIndex(): Map<string, string> {
  const raw = readFileSync(resolve(process.cwd(), 'content/chords.json'), 'utf8');
  const library = chordLibrarySchema.parse(JSON.parse(raw));

  const index = new Map<string, string>();
  for (const chord of library.chords) {
    index.set(chord.nameEn, chord.id);
    for (const alias of chord.aliases) {
      if (!index.has(alias)) index.set(alias, chord.id);
    }
  }
  return index;
}

const chordIndex = buildChordIndex();

/**
 * Expands one bar into measures.
 *
 * `'F G'` splits the bar evenly; `'C:3 G:1'` gives the beats explicitly. A bar
 * whose beats do not add up to the time signature is rejected rather than
 * padded — silently stretching a chord would put the whole song out of step
 * with the metronome from that point on.
 */
function expandBar(
  bar: string,
  beatsPerBar: number,
  songId: string,
  barNumber: number,
): SongMeasureData[] {
  const tokens = bar.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    failures.push(`${songId}: bar ${barNumber} is empty`);
    return [];
  }

  const explicit = tokens.some((token) => token.includes(':'));
  const measures: SongMeasureData[] = [];
  let total = 0;

  for (const token of tokens) {
    const [name, beatsText] = token.split(':');
    if (!name) continue;

    const chordId = chordIndex.get(name);
    if (!chordId) {
      failures.push(`${songId}: bar ${barNumber} uses unknown chord "${name}"`);
      continue;
    }

    const beats = beatsText
      ? Number.parseInt(beatsText, 10)
      : Math.floor(beatsPerBar / tokens.length);

    if (!Number.isInteger(beats) || beats < 1) {
      failures.push(`${songId}: bar ${barNumber} has an invalid beat count in "${token}"`);
      continue;
    }

    measures.push({ chordId, beats });
    total += beats;
  }

  if (total !== beatsPerBar) {
    failures.push(
      `${songId}: bar ${barNumber} "${bar}" totals ${total} beats, expected ${beatsPerBar}` +
        (explicit ? '' : ' — split it explicitly with chord:beats'),
    );
  }

  return measures;
}

function expandSection(
  section: SectionSource,
  beatsPerBar: number,
  songId: string,
  publicDomain: boolean,
) {
  const bars = section.bars.split('|').map((bar) => bar.trim());

  if (section.cues && !publicDomain) {
    failures.push(`${songId}: cue words are only permitted on public-domain songs`);
  }
  if (section.cues && section.cues.length !== bars.length) {
    failures.push(
      `${songId}: section "${section.kind}" has ${section.cues.length} cues for ${bars.length} bars`,
    );
  }

  const measures: SongMeasureData[] = [];

  bars.forEach((bar, index) => {
    const expanded = expandBar(bar, beatsPerBar, songId, index + 1);
    const cue = section.cues?.[index]?.trim();

    // The cue belongs to the bar, so it attaches to the bar's first chord.
    expanded.forEach((measure, position) => {
      measures.push(position === 0 && cue ? { ...measure, cueWord: cue } : measure);
    });
  });

  return {
    kind: section.kind,
    ...(section.label ? { label: section.label } : {}),
    ...(section.patternId ? { patternId: section.patternId } : {}),
    measures,
  };
}

function buildSongs(): SongData[] {
  const seen = new Set<string>();

  return SONGS.map((source): SongData => {
    if (seen.has(source.id)) failures.push(`Duplicate song id "${source.id}"`);
    seen.add(source.id);

    const beatsPerBar = source.beatsPerBar ?? 4;
    const beatUnit = source.beatUnit ?? 4;

    return {
      id: source.id,
      titleHe: source.titleHe,
      titleEn: source.titleEn,
      artistHe: source.artistHe,
      artistEn: source.artistEn,
      language: source.language,
      songKey: source.songKey,
      bpm: source.bpm,
      beatsPerBar,
      beatUnit,
      difficulty: source.difficulty,
      defaultPatternId: source.defaultPatternId,
      source: source.source,
      publicDomain: source.publicDomain,
      sections: source.sections.map((section) =>
        expandSection(section, beatsPerBar, source.id, source.publicDomain),
      ),
    };
  });
}

function main(): void {
  const songs = buildSongs();

  if (failures.length > 0) {
    console.error(`\n✖ ${failures.length} problem(s) in the song sources:\n`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  const library = songLibrarySchema.parse({ version: LIBRARY_VERSION, songs });
  writeFileSync(outputPath, `${JSON.stringify(library, null, 2)}\n`, 'utf8');

  const chordCounts = songs.map(
    (song) => new Set(song.sections.flatMap((s) => s.measures.map((m) => m.chordId))).size,
  );
  const byLanguage = songs.reduce<Record<string, number>>((acc, song) => {
    acc[song.language] = (acc[song.language] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`✓ Wrote ${songs.length} songs to content/songs.json`);
  console.log(`  languages: ${JSON.stringify(byLanguage)}`);
  console.log(
    `  chords per song: min ${Math.min(...chordCounts)}, max ${Math.max(...chordCounts)}`,
  );
}

main();
