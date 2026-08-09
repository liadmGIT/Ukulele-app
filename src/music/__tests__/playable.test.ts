import { getSongs } from '@/content';

import {
  isPlayable,
  missingChords,
  playableSongIds,
  rankSongs,
  suggestNextChords,
  type SongChordRequirement,
} from '../playable';

const LIBRARY: SongChordRequirement[] = [
  { songId: 'one-chord', chordIds: ['C-maj'] },
  { songId: 'two-chord', chordIds: ['C-maj', 'G-dom7'] },
  { songId: 'needs-f', chordIds: ['C-maj', 'F-maj'] },
  { songId: 'also-needs-f', chordIds: ['C-maj', 'G-dom7', 'F-maj'] },
  { songId: 'needs-am', chordIds: ['C-maj', 'A-min'] },
  { songId: 'far-away', chordIds: ['B-maj', 'Eb-min', 'F#-dom7'] },
];

const known = (...ids: string[]) => new Set(ids);

describe('isPlayable', () => {
  it('needs every chord, not most of them', () => {
    expect(isPlayable(LIBRARY[1]!, known('C-maj', 'G-dom7'))).toBe(true);
    expect(isPlayable(LIBRARY[1]!, known('C-maj'))).toBe(false);
  });

  it('ignores chords the learner knows but the song does not use', () => {
    expect(isPlayable(LIBRARY[0]!, known('C-maj', 'B-maj', 'Eb-min'))).toBe(true);
  });
});

describe('playableSongIds', () => {
  it('lists only what can be played today', () => {
    expect(playableSongIds(LIBRARY, known('C-maj', 'G-dom7'))).toEqual([
      'one-chord',
      'two-chord',
    ]);
  });

  it('is empty for a complete beginner', () => {
    expect(playableSongIds(LIBRARY, known())).toEqual([]);
  });
});

describe('missingChords', () => {
  it('names what is still needed', () => {
    expect(missingChords(LIBRARY[3]!, known('C-maj'))).toEqual(['G-dom7', 'F-maj']);
  });
});

describe('suggestNextChords', () => {
  it('recommends the chord that unlocks the most songs', () => {
    const suggestions = suggestNextChords(LIBRARY, known('C-maj', 'G-dom7'));

    expect(suggestions[0]!.chordId).toBe('F-maj');
    expect(suggestions[0]!.count).toBe(2);
    expect(suggestions[0]!.unlockedSongIds).toEqual(['needs-f', 'also-needs-f']);
  });

  it('only counts songs that are one chord away', () => {
    // 'far-away' needs three chords the learner does not have. Counting its
    // chords by raw frequency would recommend practising something that
    // unlocks nothing.
    const suggestions = suggestNextChords(LIBRARY, known('C-maj'));
    const chordIds = suggestions.map((suggestion) => suggestion.chordId);

    expect(chordIds).not.toContain('B-maj');
    expect(chordIds).not.toContain('Eb-min');
    expect(chordIds).toContain('G-dom7');
  });

  it('suggests nothing when everything playable is already played', () => {
    expect(suggestNextChords([LIBRARY[0]!], known('C-maj'))).toEqual([]);
  });

  it('respects the limit', () => {
    expect(suggestNextChords(LIBRARY, known('C-maj'), 2)).toHaveLength(2);
  });

  it('is deterministic when two chords unlock the same number', () => {
    const first = suggestNextChords(LIBRARY, known('C-maj'));
    const second = suggestNextChords(LIBRARY, known('C-maj'));
    expect(first.map((s) => s.chordId)).toEqual(second.map((s) => s.chordId));
  });
});

describe('rankSongs', () => {
  const withDifficulty = LIBRARY.map((entry, index) => ({ ...entry, difficulty: index % 3 }));

  it('puts playable songs first', () => {
    const ranked = rankSongs(withDifficulty, known('C-maj', 'G-dom7'));
    const playable = new Set(['one-chord', 'two-chord']);

    expect(playable.has(ranked[0]!.songId)).toBe(true);
    expect(playable.has(ranked[1]!.songId)).toBe(true);
  });

  it('then puts the songs closest to being playable', () => {
    const ranked = rankSongs(withDifficulty, known('C-maj'));
    const distances = ranked.map(
      (entry) => missingChords(entry, known('C-maj')).length,
    );

    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]!).toBeGreaterThanOrEqual(distances[i - 1]!);
    }
  });

  it('does not mutate the input', () => {
    const original = [...withDifficulty];
    rankSongs(withDifficulty, known('C-maj'));
    expect(withDifficulty).toEqual(original);
  });
});

describe('against the shipped library', () => {
  const requirements = getSongs().map((song) => ({
    songId: song.id,
    chordIds: song.timeline.chordIds,
    difficulty: song.difficulty,
  }));

  it('gives a learner something to play after their first two chords', () => {
    // The first real test of whether the library is any use: two easy chords
    // should already open something.
    const playable = playableSongIds(requirements, known('C-maj', 'G-dom7'));
    expect(playable.length).toBeGreaterThan(0);
  });

  it('opens up substantially with the first four common chords', () => {
    const playable = playableSongIds(
      requirements,
      known('C-maj', 'G-dom7', 'F-maj', 'A-min'),
    );
    expect(playable.length).toBeGreaterThanOrEqual(8);
  });

  it('always has something concrete to recommend next', () => {
    for (const chords of [
      known('C-maj'),
      known('C-maj', 'G-dom7'),
      known('A-min', 'E-dom7'),
    ]) {
      expect(suggestNextChords(requirements, chords).length).toBeGreaterThan(0);
    }
  });
});
