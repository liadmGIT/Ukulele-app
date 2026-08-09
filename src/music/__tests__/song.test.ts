import { getSongById, getSongs } from '@/content';
import { songLibrarySchema, type SongData } from '@/content/schemas';

import {
  barAtBeat,
  beatAtSecond,
  buildSongTimeline,
  chordAtBeat,
  songDurationSeconds,
} from '../song';

function song(overrides: Partial<SongData> = {}): SongData {
  return songLibrarySchema.parse({
    version: 1,
    songs: [
      {
        id: 'test',
        titleHe: 'בדיקה',
        titleEn: 'Test',
        artistHe: 'בדיקה',
        artistEn: 'Test',
        language: 'en',
        songKey: 'C',
        bpm: 120,
        beatsPerBar: 4,
        beatUnit: 4,
        difficulty: 1,
        defaultPatternId: 'all-downs',
        source: 'test',
        publicDomain: true,
        sections: [
          {
            kind: 'verse',
            measures: [
              { chordId: 'C-maj', beats: 4, cueWord: 'one' },
              { chordId: 'F-maj', beats: 4 },
              { chordId: 'G-dom7', beats: 2 },
              { chordId: 'C-maj', beats: 2 },
            ],
          },
        ],
        ...overrides,
      },
    ],
  }).songs[0]!;
}

describe('buildSongTimeline', () => {
  it('groups measures into bars', () => {
    const timeline = buildSongTimeline(song());

    expect(timeline.totalBars).toBe(3);
    expect(timeline.bars[0]!.chords).toHaveLength(1);
    expect(timeline.bars[2]!.chords).toHaveLength(2);
  });

  it('gives every chord an absolute beat position', () => {
    const timeline = buildSongTimeline(song());
    const positions = timeline.bars.flatMap((bar) =>
      bar.chords.map((chord) => chord.startBeat),
    );

    expect(positions).toEqual([0, 4, 8, 10]);
    expect(timeline.totalBeats).toBe(12);
  });

  it('lists distinct chords in order of first appearance', () => {
    expect(buildSongTimeline(song()).chordIds).toEqual(['C-maj', 'F-maj', 'G-dom7']);
  });

  it('keeps cue words with their chord', () => {
    expect(buildSongTimeline(song()).bars[0]!.chords[0]!.cueWord).toBe('one');
  });

  it('marks where sections begin', () => {
    const timeline = buildSongTimeline(
      song({
        sections: [
          { kind: 'verse', measures: [{ chordId: 'C-maj', beats: 4 }] },
          { kind: 'chorus', measures: [{ chordId: 'F-maj', beats: 4 }] },
        ],
      }),
    );

    expect(timeline.bars.map((bar) => bar.startsSection)).toEqual([true, true]);
    expect(timeline.bars.map((bar) => bar.sectionKind)).toEqual(['verse', 'chorus']);
  });

  it('numbers bars within their section', () => {
    const timeline = buildSongTimeline(
      song({
        sections: [
          {
            kind: 'verse',
            measures: [
              { chordId: 'C-maj', beats: 4 },
              { chordId: 'C-maj', beats: 4 },
            ],
          },
          { kind: 'chorus', measures: [{ chordId: 'F-maj', beats: 4 }] },
        ],
      }),
    );

    expect(timeline.bars.map((bar) => bar.barInSection)).toEqual([1, 2, 1]);
    expect(timeline.bars.map((bar) => bar.index)).toEqual([0, 1, 2]);
  });

  it('handles a waltz', () => {
    const timeline = buildSongTimeline(
      song({
        beatsPerBar: 3,
        sections: [
          {
            kind: 'verse',
            measures: [
              { chordId: 'C-maj', beats: 3 },
              { chordId: 'G-dom7', beats: 3 },
            ],
          },
        ],
      }),
    );

    expect(timeline.totalBars).toBe(2);
    expect(timeline.totalBeats).toBe(6);
  });
});

describe('chordAtBeat', () => {
  const timeline = buildSongTimeline(song());

  it('finds the chord sounding at a moment', () => {
    expect(chordAtBeat(timeline, 0)?.chordId).toBe('C-maj');
    expect(chordAtBeat(timeline, 3.9)?.chordId).toBe('C-maj');
    expect(chordAtBeat(timeline, 4)?.chordId).toBe('F-maj');
    expect(chordAtBeat(timeline, 8)?.chordId).toBe('G-dom7');
    expect(chordAtBeat(timeline, 10)?.chordId).toBe('C-maj');
  });

  it('returns nothing outside the song', () => {
    expect(chordAtBeat(timeline, -1)).toBeNull();
    expect(chordAtBeat(timeline, 12)).toBeNull();
  });
});

describe('barAtBeat', () => {
  const timeline = buildSongTimeline(song());

  it('finds the bar containing a moment', () => {
    expect(barAtBeat(timeline, 0)?.index).toBe(0);
    expect(barAtBeat(timeline, 5)?.index).toBe(1);
    expect(barAtBeat(timeline, 11)?.index).toBe(2);
  });

  it('holds on the last bar past the end, so the chart does not jump', () => {
    expect(barAtBeat(timeline, 99)?.index).toBe(2);
  });
});

describe('timing', () => {
  it('converts beats to seconds at a given tempo', () => {
    const timeline = buildSongTimeline(song());
    expect(songDurationSeconds(timeline, 120)).toBeCloseTo(6, 6);
    expect(songDurationSeconds(timeline, 120, 0.5)).toBeCloseTo(12, 6);
  });

  it('converts seconds back to beats', () => {
    expect(beatAtSecond(1, 120)).toBeCloseTo(2, 6);
    expect(beatAtSecond(1, 120, 0.5)).toBeCloseTo(1, 6);
  });
});

describe('the shipped song library', () => {
  const songs = getSongs();

  it('ships a usable library', () => {
    expect(songs.length).toBeGreaterThanOrEqual(25);
  });

  it('has both languages', () => {
    expect(songs.filter((entry) => entry.language === 'he').length).toBeGreaterThanOrEqual(8);
    expect(songs.filter((entry) => entry.language === 'en').length).toBeGreaterThanOrEqual(15);
  });

  it('gives every song a unique id', () => {
    expect(new Set(songs.map((entry) => entry.id)).size).toBe(songs.length);
  });

  it('starts beginners off gently', () => {
    // The library is useless if nothing is playable with two or three chords.
    const easy = songs.filter((entry) => entry.timeline.chordIds.length <= 3);
    expect(easy.length).toBeGreaterThanOrEqual(15);
  });

  it('lays every section out in whole bars', () => {
    for (const entry of songs) {
      for (const section of entry.sections) {
        const beats = section.measures.reduce((sum, measure) => sum + measure.beats, 0);
        expect(beats % entry.beatsPerBar).toBe(0);
      }
    }
  });

  it('never puts a cue word on a song that is not public domain', () => {
    // The content policy, enforced rather than trusted.
    for (const entry of songs) {
      if (entry.publicDomain) continue;
      for (const section of entry.sections) {
        for (const measure of section.measures) {
          expect(measure.cueWord).toBeUndefined();
        }
      }
    }
  });

  it('keeps cue words to at most two words', () => {
    for (const entry of songs) {
      for (const section of entry.sections) {
        for (const measure of section.measures) {
          if (!measure.cueWord) continue;
          expect(measure.cueWord.split(/\s+/).length).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('can be looked up by id', () => {
    expect(getSongById('hava-nagila')?.titleEn).toBe('Hava Nagila');
    expect(getSongById('nope')).toBeUndefined();
  });
});
