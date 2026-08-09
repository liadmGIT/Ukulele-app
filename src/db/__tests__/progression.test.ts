import { getChordLibrary, getSongs } from '@/content';
import { playableSongIds } from '@/music/playable';

import { getStorage, setStorage } from '../index';
import { getPlayableChordIds, PLAYABLE_MASTERY_LEVEL } from '../mastery';
import { MemoryDriver } from '../memoryDriver';
import { getSongMasteryState, recordChordAttempt, recordSongAttempt } from '../progress';

/**
 * The loop the whole app is built around.
 *
 * Practise a chord, earn a level; earn enough levels and songs that need that
 * chord become playable. Every piece of this was individually correct and
 * tested, and the loop was still broken end to end: `recordSongAttempt` had no
 * callers at all, and the only route to `recordChordAttempt` was a screen
 * offering four hardcoded chords. So 81 of 85 chords could never leave level 0,
 * and no song could ever rise above it.
 *
 * Unit tests could not see that, because nothing was individually wrong. These
 * tests exercise the wiring instead.
 */

/** A take good enough to earn the next level, at full tempo. */
const GOOD_TAKE = { score: 95, tempoFraction: 1 };

function practiseToLevel(chordId: string, level: number, startAt = Date.UTC(2026, 0, 1)) {
  const DAY = 24 * 60 * 60 * 1000;
  // One level per session at most, by design — a single lucky take must not be
  // able to jump from beginner to mastered.
  for (let session = 0; session < level; session += 1) {
    recordChordAttempt(chordId, { ...GOOD_TAKE, at: startAt + session * DAY });
  }
}

describe('practising a chord', () => {
  beforeEach(() => {
    const driver = new MemoryDriver();
    driver.replaceContent({ chords: getChordLibrary().chords, patterns: [], songs: [] });
    setStorage(driver);
  });

  afterEach(() => setStorage(null));

  it('starts every chord in the library at level zero', () => {
    const mastery = getStorage().getAllChordMastery();

    expect(mastery.length).toBe(getChordLibrary().chords.length);
    expect(mastery.every((entry) => entry.level === 0)).toBe(true);
  });

  it('raises the level one session at a time', () => {
    const first = recordChordAttempt('C-maj', { ...GOOD_TAKE, at: Date.now() });
    expect(first.level).toBe(1);

    const second = recordChordAttempt('C-maj', { ...GOOD_TAKE, at: Date.now() });
    expect(second.level).toBe(2);
  });

  it('counts as playable once it reaches the playable level', () => {
    practiseToLevel('C-maj', PLAYABLE_MASTERY_LEVEL);

    expect(getPlayableChordIds().has('C-maj')).toBe(true);
  });

  it('works for a chord the record screen never used to offer', () => {
    // The four the screen hardcoded were C, Am, F and G. Any other chord was
    // unreachable, which is the bug this asserts is gone.
    practiseToLevel('D-maj', PLAYABLE_MASTERY_LEVEL);

    expect(getPlayableChordIds().has('D-maj')).toBe(true);
  });
});

describe('unlocking songs by practising chords', () => {
  const songs = getSongs().map((song) => ({
    songId: song.id,
    chordIds: song.timeline.chordIds,
  }));

  beforeEach(() => {
    const driver = new MemoryDriver();
    driver.replaceContent({ chords: getChordLibrary().chords, patterns: [], songs: [] });
    setStorage(driver);
  });

  afterEach(() => setStorage(null));

  it('has nothing playable before anything is practised', () => {
    expect(playableSongIds(songs, getPlayableChordIds())).toHaveLength(0);
  });

  it('unlocks a song once every chord in it is playable', () => {
    // Pick the easiest real song in the library rather than inventing one, so
    // this fails if the content ever drifts away from what a beginner can do.
    const easiest = [...songs].sort((a, b) => a.chordIds.length - b.chordIds.length)[0]!;

    for (const chordId of easiest.chordIds) {
      practiseToLevel(chordId, PLAYABLE_MASTERY_LEVEL);
    }

    expect(playableSongIds(songs, getPlayableChordIds())).toContain(easiest.songId);
  });

  it('does not unlock a song while one of its chords is still short', () => {
    const easiest = [...songs].sort((a, b) => a.chordIds.length - b.chordIds.length)[0]!;
    const [held, ...rest] = easiest.chordIds;

    for (const chordId of rest) practiseToLevel(chordId, PLAYABLE_MASTERY_LEVEL);
    practiseToLevel(held!, PLAYABLE_MASTERY_LEVEL - 1);

    expect(playableSongIds(songs, getPlayableChordIds())).not.toContain(easiest.songId);
  });
});

describe('song mastery', () => {
  beforeEach(() => {
    const driver = new MemoryDriver();
    driver.replaceContent({ chords: getChordLibrary().chords, patterns: [], songs: [] });
    setStorage(driver);
  });

  afterEach(() => setStorage(null));

  it('rises when a song is played well', () => {
    // Until the song player recorded takes, this function had no callers and
    // every song sat at level 0 forever however well it was played.
    const songId = getSongs()[0]!.id;

    expect(getSongMasteryState(songId).level).toBe(0);

    recordSongAttempt(songId, { ...GOOD_TAKE, at: Date.now() });

    expect(getSongMasteryState(songId).level).toBe(1);
  });

  it('will not award the top levels at a reduced tempo', () => {
    const songId = getSongs()[0]!.id;
    const DAY = 24 * 60 * 60 * 1000;
    const start = Date.UTC(2026, 0, 1);

    // Played perfectly, but at 60% speed, over many sessions.
    for (let session = 0; session < 8; session += 1) {
      recordSongAttempt(songId, { score: 100, tempoFraction: 0.6, at: start + session * DAY });
    }

    // Level 3 demands 75% of the written tempo, so half speed stops at 2.
    expect(getSongMasteryState(songId).level).toBe(2);
  });
});
