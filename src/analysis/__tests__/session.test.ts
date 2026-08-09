import type { MasteryState } from '../mastery';
import { buildSession, practiceStreak, practisedOn, type SessionCandidate } from '../session';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-03-15T19:00:00Z').getTime();

const mastery = (overrides: Partial<MasteryState> = {}): MasteryState => ({
  level: 0,
  sessionsPractised: 0,
  lastPractisedAt: null,
  ...overrides,
});

const chord = (
  id: string,
  overrides: Partial<MasteryState> = {},
  difficulty = 1,
  usefulness = 0,
): SessionCandidate => ({
  id,
  difficulty,
  usefulness,
  mastery: mastery(overrides),
});

const SOME_CHORDS = [
  chord('C-maj', { level: 4, lastPractisedAt: NOW - DAY }),
  chord('A-min', { level: 1, lastPractisedAt: NOW - 2 * DAY }),
  chord('F-maj', { level: 0 }),
  chord('G-maj', { level: 2, lastPractisedAt: NOW - 3 * DAY }),
];

const SOME_SONGS = [chord('hava-nagila', { level: 1, lastPractisedAt: NOW - 5 * DAY })];

describe('buildSession', () => {
  const plan = buildSession({ chords: SOME_CHORDS, playableSongs: SOME_SONGS, now: NOW });

  it('always starts by tuning', () => {
    // A beginner cannot hear that the instrument is the problem, and every
    // measurement afterwards depends on it being in tune.
    expect(plan.items[0]!.kind).toBe('tune');
  });

  it('puts chords before the drill and the song last', () => {
    const kinds = plan.items.map((item) => item.kind);
    const firstChord = kinds.indexOf('chord');
    const drill = kinds.indexOf('drill');
    const song = kinds.indexOf('song');

    expect(firstChord).toBeGreaterThan(0);
    expect(drill).toBeGreaterThan(firstChord);
    expect(song).toBeGreaterThan(drill);
    expect(song).toBe(kinds.length - 1);
  });

  it('picks the weakest chords', () => {
    const chordIds = plan.items
      .filter((item) => item.kind === 'chord')
      .map((item) => item.targetId);

    expect(chordIds).toContain('F-maj');
    expect(chordIds).toContain('A-min');
    expect(chordIds).not.toContain('C-maj');
  });

  it('drills the two weakest chords against each other', () => {
    const drill = plan.items.find((item) => item.kind === 'drill');
    expect(drill?.targetId).toBeDefined();
    expect(drill?.pairId).toBeDefined();
    expect(drill?.targetId).not.toBe(drill?.pairId);
  });

  it('lands near the target length', () => {
    expect(plan.estimatedMinutes).toBeGreaterThan(8);
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(15);
  });

  it('explains why each item is there', () => {
    for (const item of plan.items) {
      expect(item.reasonKey).toMatch(/^session\./);
    }
  });

  it('says a rusty chord is rusty and a new one is new', () => {
    const withRusty = buildSession({
      chords: [
        chord('rusty', { level: 4, lastPractisedAt: NOW - 90 * DAY }),
        chord('fresh', { level: 0 }),
        chord('other', { level: 2, lastPractisedAt: NOW }),
      ],
      playableSongs: [],
      now: NOW,
    });

    // Chord items only: the drill also carries a chord id in `targetId`.
    const byId = new Map(
      withRusty.items
        .filter((item) => item.kind === 'chord')
        .map((item) => [item.targetId, item.reasonKey]),
    );
    expect(byId.get('rusty')).toBe('session.reasonRusty');
    expect(byId.get('fresh')).toBe('session.reasonNew');
  });

  it('offers calibration once, when it has not been done', () => {
    const uncalibrated = buildSession({
      chords: SOME_CHORDS,
      playableSongs: SOME_SONGS,
      now: NOW,
      needsCalibration: true,
    });

    expect(uncalibrated.items.some((item) => item.targetId === 'calibrate')).toBe(true);
    expect(plan.items.some((item) => item.targetId === 'calibrate')).toBe(false);
  });

  it('keeps the song when the session has to be cut short', () => {
    // Finishing on something that sounds like music is what brings a learner
    // back, so it is the last thing to be dropped.
    const short = buildSession({
      chords: SOME_CHORDS,
      playableSongs: SOME_SONGS,
      now: NOW,
      targetMinutes: 7,
    });

    expect(short.items.some((item) => item.kind === 'song')).toBe(true);
    expect(short.items.some((item) => item.kind === 'tune')).toBe(true);
    expect(short.estimatedMinutes).toBeLessThanOrEqual(8);
  });

  it('still produces a session for someone with nothing playable yet', () => {
    const beginner = buildSession({
      chords: [chord('C-maj'), chord('A-min')],
      playableSongs: [],
      now: NOW,
    });

    expect(beginner.items.length).toBeGreaterThan(1);
    expect(beginner.items[0]!.kind).toBe('tune');
  });

  it('skips the drill when there is only one chord to work on', () => {
    const single = buildSession({
      chords: [chord('C-maj')],
      playableSongs: [],
      now: NOW,
    });

    expect(single.items.some((item) => item.kind === 'drill')).toBe(false);
  });

  it('does not hand a complete beginner a barre chord first', () => {
    // On day one every chord is at level 0, so difficulty is the only thing
    // separating them — and it has to be, or the first thing the app ever
    // recommends is whatever happens to sort first in the library.
    const beginner = buildSession({
      chords: [
        chord('B-maj', {}, 5),
        chord('Bb-maj', {}, 4),
        chord('C-maj', {}, 1),
        chord('A-min', {}, 1),
        chord('F-maj', {}, 2),
      ],
      playableSongs: [],
      now: NOW,
    });

    const chordIds = beginner.items
      .filter((item) => item.kind === 'chord')
      .map((item) => item.targetId);

    expect(chordIds).toContain('C-maj');
    expect(chordIds).toContain('A-min');
    expect(chordIds).not.toContain('B-maj');
  });

  it('starts a beginner on chords that combine into songs', () => {
    // Three voicings of the same root are all equally easy and equally useless
    // together. What a beginner needs first is chords that appear in songs.
    const beginner = buildSession({
      chords: [
        chord('C-maj7', {}, 1, 0),
        chord('C-dom7', {}, 1, 1),
        chord('C-maj', {}, 1, 20),
        chord('A-min', {}, 1, 12),
        chord('F-maj', {}, 2, 10),
      ],
      playableSongs: [],
      now: NOW,
    });

    const chordIds = beginner.items
      .filter((item) => item.kind === 'chord')
      .map((item) => item.targetId);

    expect(chordIds).toEqual(['C-maj', 'A-min', 'F-maj']);
  });

  it('is deterministic', () => {
    const a = buildSession({ chords: SOME_CHORDS, playableSongs: SOME_SONGS, now: NOW });
    const b = buildSession({ chords: SOME_CHORDS, playableSongs: SOME_SONGS, now: NOW });
    expect(a).toEqual(b);
  });
});

describe('practisedOn', () => {
  it('knows whether today has happened yet', () => {
    expect(practisedOn([NOW - 60_000], NOW)).toBe(true);
    expect(practisedOn([NOW - 2 * DAY], NOW)).toBe(false);
  });

  it('handles an empty history', () => {
    expect(practisedOn([], NOW)).toBe(false);
  });
});

describe('practiceStreak', () => {
  const daysAgo = (n: number) => NOW - n * DAY;

  it('counts consecutive days', () => {
    expect(practiceStreak([daysAgo(0), daysAgo(1), daysAgo(2)], NOW)).toBe(3);
  });

  it('does not break because today has not happened yet', () => {
    // A streak that resets at midnight would punish someone who practises every
    // evening for not having done it yet this morning.
    expect(practiceStreak([daysAgo(1), daysAgo(2), daysAgo(3)], NOW)).toBe(3);
  });

  it('breaks after a missed day', () => {
    expect(practiceStreak([daysAgo(2), daysAgo(3)], NOW)).toBe(0);
  });

  it('counts several sessions in one day once', () => {
    expect(practiceStreak([daysAgo(0), NOW - 3600_000, daysAgo(1)], NOW)).toBe(2);
  });

  it('is zero with no history', () => {
    expect(practiceStreak([], NOW)).toBe(0);
  });

  it('ignores an old block of practice', () => {
    expect(practiceStreak([daysAgo(30), daysAgo(31), daysAgo(32)], NOW)).toBe(0);
  });
});
