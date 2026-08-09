import { getChordLibrary, getSongs, getStrumPatterns } from '@/content';

import { MIGRATIONS } from '../migrations';
import type { ContentBundle } from '../types';

import { TestDatabase } from './sqliteAdapter';

/**
 * Updating the shipped content must never cost the learner their progress.
 *
 * The old code emptied each content table before refilling it. With foreign
 * keys on — and a `chord_mastery` row created for every chord on the very first
 * seed — those deletes could not succeed. A fresh install was fine because the
 * tables were empty, so the failure was invisible until the *second* content
 * version, at which point `syncContent` threw during startup on every launch
 * and the app could not be opened at all. The only recovery is deleting the
 * app, which erases every level, streak and recording.
 *
 * These tests run the real driver's SQL against a real SQLite database, because
 * the whole bug was that the shipped statements could not execute.
 */

// The driver reaches for expo-sqlite, which has no business in a unit test.
// Node's own SQLite stands in, so the statements under test are the shipped
// ones rather than an imitation of them.
const database = { current: null as TestDatabase | null };

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => database.current,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SqliteDriver } = require('../sqliteDriver') as typeof import('../sqliteDriver');

function freshDriver() {
  database.current = new TestDatabase();
  return new SqliteDriver();
}

function bundle(overrides: Partial<ContentBundle> = {}): ContentBundle {
  return {
    chords: getChordLibrary().chords,
    patterns: getStrumPatterns().map((pattern) => ({
      id: pattern.id,
      nameEn: pattern.nameEn,
      nameHe: pattern.nameHe,
      beatsPerBar: pattern.timeSignature.beatsPerBar,
      beatUnit: pattern.timeSignature.beatUnit as 4 | 8,
      subdivision: pattern.subdivision,
      notation: pattern.notation,
      difficulty: pattern.difficulty,
      descriptionEn: pattern.descriptionEn,
      descriptionHe: pattern.descriptionHe,
    })),
    songs: getSongs().map((song) => ({ ...song, chordIds: song.timeline.chordIds })),
    ...overrides,
  };
}

describe('migrations', () => {
  it('run to the current version on a fresh database', () => {
    freshDriver();

    const row = database.current!.getFirstSync<{ user_version: number }>('PRAGMA user_version;');
    expect(row?.user_version).toBe(MIGRATIONS.length);
  });

  it('do not run again on the next launch', () => {
    freshDriver();
    // A second driver over the same database is what happens on every launch
    // after the first.
    expect(() => new SqliteDriver()).not.toThrow();
  });
});

describe('updating the shipped content', () => {
  it('seeds a fresh install', () => {
    const driver = freshDriver();
    driver.replaceContent(bundle());

    expect(driver.getAllChordMastery().length).toBe(getChordLibrary().chords.length);
  });

  it('can be applied twice, which is what used to brick the app', () => {
    const driver = freshDriver();
    driver.replaceContent(bundle());

    // The second call is the one that threw "FOREIGN KEY constraint failed",
    // at module scope, on every launch, forever.
    expect(() => driver.replaceContent(bundle())).not.toThrow();
  });

  it('keeps every level, streak and recording across an update', () => {
    const driver = freshDriver();
    driver.replaceContent(bundle());

    const practisedAt = Date.UTC(2026, 2, 1);
    driver.updateChordMastery('C-maj', {
      chordId: 'C-maj',
      level: 4,
      bestChangesPerMinute: 62,
      sessionsPractised: 9,
      lastPractisedAt: practisedAt,
    });
    driver.recordPracticeMinutes(practisedAt, 12);
    driver.saveDrillResult({
      id: 'drill-1',
      createdAt: practisedAt,
      chordA: 'C-maj',
      chordB: 'A-min',
      changes: 40,
      durationMs: 60_000,
      changesPerMinute: 40,
    });

    // A later content version: one more chord than before.
    driver.replaceContent(bundle());

    const mastery = driver.getChordMastery('C-maj');
    expect(mastery?.level).toBe(4);
    expect(mastery?.sessionsPractised).toBe(9);
    expect(mastery?.lastPractisedAt).toBe(practisedAt);
    expect(driver.listDrillResults(5)).toHaveLength(1);
    expect(driver.practiceMinutesSince(practisedAt - 1)).toEqual([
      { day: expect.any(Number), minutes: 12 },
    ]);
  });

  it('picks up genuinely new content', () => {
    const driver = freshDriver();
    const base = bundle();

    // A smaller, self-consistent bundle: fewer chords and no songs to reference
    // the missing ones. An inconsistent bundle is rejected by the content
    // validator long before it reaches storage.
    driver.replaceContent({ chords: base.chords.slice(0, 10), patterns: base.patterns, songs: [] });
    expect(driver.getAllChordMastery()).toHaveLength(10);

    driver.replaceContent(base);
    expect(driver.getAllChordMastery()).toHaveLength(base.chords.length);
  });

  it('drops progress only for content that has actually gone away', () => {
    const driver = freshDriver();
    const base = bundle();
    driver.replaceContent(base);

    driver.updateChordMastery('C-maj', {
      chordId: 'C-maj',
      level: 3,
      bestChangesPerMinute: 0,
      sessionsPractised: 3,
      lastPractisedAt: Date.now(),
    });

    // A bundle without any of the songs, so no song_chords row protects a
    // chord from being pruned, and without the chord itself.
    const withoutC = base.chords.filter((chord) => chord.id !== 'C-maj');
    driver.replaceContent({ chords: withoutC, patterns: base.patterns, songs: [] });

    expect(driver.getChordMastery('C-maj')).toBeNull();
    expect(driver.getChordMastery('A-min')).not.toBeNull();
  });

  it('leaves the database untouched when an update fails part way', () => {
    const driver = freshDriver();
    driver.replaceContent(bundle());

    driver.updateChordMastery('C-maj', {
      chordId: 'C-maj',
      level: 5,
      bestChangesPerMinute: 0,
      sessionsPractised: 12,
      lastPractisedAt: Date.now(),
    });

    // A song pointing at a pattern that does not exist violates a foreign key.
    const broken = bundle();
    expect(() =>
      driver.replaceContent({
        ...broken,
        songs: broken.songs.map((song, index) =>
          index === 0 ? { ...song, defaultPatternId: 'no-such-pattern' } : song,
        ),
      }),
    ).toThrow();

    // The whole update is one transaction, so a failure rolls back rather than
    // leaving content half-swapped underneath the learner's progress.
    expect(driver.getChordMastery('C-maj')?.level).toBe(5);
    expect(driver.getAllChordMastery().length).toBe(getChordLibrary().chords.length);
  });
});
