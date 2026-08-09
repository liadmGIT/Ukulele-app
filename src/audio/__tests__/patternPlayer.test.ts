import { COMMON_TIME } from '@/music/grid';
import { parseStrumPattern, type StrumStep } from '@/music/strum';

import { PatternPlayer, type PatternPlayerOptions } from '../patternPlayer';

jest.mock('../engine', () => ({
  audioNow: () => 0,
  getAudioContext: () => {
    throw new Error('the real audio context must not be touched in tests');
  },
}));

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const C_MAJOR = [0, 0, 0, 3];

type Booking =
  | { kind: 'click'; when: number; accented: boolean }
  | { kind: 'strum'; when: number; step: StrumStep };

function harness(overrides: Partial<PatternPlayerOptions> = {}) {
  const bookings: Booking[] = [];
  let clock = 0;

  const options: PatternPlayerOptions = {
    steps: parseStrumPattern('D - D u - u D u'),
    bpm: 120,
    timeSignature: COMMON_TIME,
    subdivision: 8,
    frets: C_MAJOR,
    countInBars: 0,
    ...overrides,
  };

  const player = new PatternPlayer(
    options,
    {},
    {
      now: () => clock,
      playClick: (when, accented) => bookings.push({ kind: 'click', when, accented }),
      strummer: {
        prepare: () => {},
        strum: (when: number, step: StrumStep) => bookings.push({ kind: 'strum', when, step }),
      },
    },
  );

  return {
    player,
    bookings,
    clicks: () => bookings.filter((b) => b.kind === 'click'),
    strums: () => bookings.filter((b) => b.kind === 'strum'),
    run(seconds: number) {
      const target = clock + seconds;
      let step = 0;
      while (clock < target) {
        // Irregular wake-ups, as a real JS timer would be.
        clock = Math.min(target, clock + 0.005 + ((step * 37) % 55) / 1000);
        player.pump();
        step += 1;
      }
    },
  };
}

describe('PatternPlayer', () => {
  it('strums only the steps that are not rests', () => {
    const h = harness();
    h.player.start({ loop: false });
    h.run(4);

    // "D - D u - u D u" has six strokes and two rests.
    expect(h.strums()).toHaveLength(6);
  });

  it('places each strum exactly on its grid step', () => {
    const h = harness();
    const start = h.player.start({ loop: false });
    h.run(4);

    const stepSeconds = 0.25; // eighths at 120 BPM
    const expected = [0, 2, 3, 5, 6, 7].map((index) => start + index * stepSeconds);
    expect(h.strums().map((b) => b.when)).toEqual(expected.map((t) => expect.closeTo(t, 9)));
  });

  it('keeps clicks and strums locked together on shared beats', () => {
    // The reason both come from one scheduler: a click and the strum on the
    // same beat must be simultaneous, not merely close.
    const h = harness();
    h.player.start({ loop: false });
    h.run(4);

    const clickTimes = h.clicks().map((b) => b.when);
    const strumTimes = h.strums().map((b) => b.when);

    // "D - D u - u D u" strums on beats 1, 2 and 4; beat 3 falls on the rest,
    // so it is deliberately silent and must have no strum at all.
    for (const beatIndex of [0, 1, 3]) {
      const beatTime = clickTimes[beatIndex]!;
      const matching = strumTimes.find((time) => Math.abs(time - beatTime) < 1e-9);
      expect(matching).toBeDefined();
    }

    const restBeat = clickTimes[2]!;
    expect(strumTimes.some((time) => Math.abs(time - restBeat) < 1e-9)).toBe(false);
  });

  it('sounds the click before the strum at the same instant', () => {
    const h = harness();
    h.player.start({ loop: false });
    h.run(1);

    const first = h.bookings[0];
    const second = h.bookings[1];
    expect(first?.kind).toBe('click');
    expect(second?.kind).toBe('strum');
    expect(first?.when).toBeCloseTo(second!.when, 9);
  });

  it('preserves each step\'s direction, muting and accent', () => {
    const h = harness({ steps: parseStrumPattern('D! u X u D u U! u') });
    h.player.start({ loop: false });
    h.run(4);

    const strums = h.strums();
    expect(strums[0]!.step.accent).toBe('strong');
    expect(strums[1]!.step.accent).toBe('soft');
    expect(strums[2]!.step.muted).toBe(true);
    expect(strums[6]!.step.dir).toBe('U');
    expect(strums[6]!.step.accent).toBe('strong');
  });

  it('waits out the count-in before the first strum', () => {
    const h = harness({ countInBars: 1 });
    const start = h.player.start({ loop: false });
    h.run(6);

    // A bar of 4/4 at 120 BPM is two seconds.
    expect(h.strums()[0]!.when).toBeCloseTo(start + 2, 9);
    expect(h.clicks()[0]!.when).toBeCloseTo(start, 9);
  });

  it('slows down without changing the pattern', () => {
    const full = harness();
    full.player.start({ loop: false });
    full.run(4);

    const half = harness({ tempoFraction: 0.5 });
    half.player.start({ loop: false });
    half.run(8);

    expect(half.strums()).toHaveLength(full.strums().length);
    expect(half.strums().map((b) => b.step)).toEqual(full.strums().map((b) => b.step));

    const fullSpan = full.strums()[5]!.when - full.strums()[0]!.when;
    const halfSpan = half.strums()[5]!.when - half.strums()[0]!.when;
    expect(halfSpan).toBeCloseTo(fullSpan * 2, 6);
  });

  it('can play without the click', () => {
    const h = harness({ withClick: false });
    h.player.start({ loop: false });
    h.run(4);

    expect(h.clicks()).toHaveLength(0);
    expect(h.strums().length).toBeGreaterThan(0);
  });

  it('loops without drifting', () => {
    const h = harness();
    const start = h.player.start({ loop: true });
    h.run(120);

    const strums = h.strums();
    expect(strums.length).toBeGreaterThan(200);

    // The pattern is one bar of eighths = 2 s at 120 BPM, six strokes per pass.
    const offsets = [0, 2, 3, 5, 6, 7].map((index) => index * 0.25);
    strums.forEach((booking, index) => {
      const pass = Math.floor(index / offsets.length);
      const within = offsets[index % offsets.length]!;
      expect(booking.when).toBeCloseTo(start + pass * 2 + within, 6);
    });
  });

  it('handles a waltz', () => {
    const h = harness({
      steps: parseStrumPattern('D - D u D u'),
      timeSignature: { beatsPerBar: 3, beatUnit: 4 },
    });
    h.player.start({ loop: false });
    h.run(4);

    expect(h.clicks()).toHaveLength(3);
    expect(h.strums()).toHaveLength(5);
  });

  it('books nothing once stopped', () => {
    const h = harness();
    h.player.start({ loop: true });
    h.run(1);

    const before = h.bookings.length;
    h.player.stop();
    h.run(5);

    expect(h.bookings).toHaveLength(before);
  });

  it('rejects a pattern that is not a whole number of bars', () => {
    expect(() =>
      harness({ steps: parseStrumPattern('D u D') }),
    ).toThrow(/not a whole number of bars/);
  });
});
