import type { GridOptions } from '@/music/grid';

import { Metronome } from '../metronome';

jest.mock('../engine', () => ({
  audioNow: () => 0,
  getAudioContext: () => {
    throw new Error('the real audio context must not be touched in tests');
  },
}));

// `start()` installs a real setInterval as its wake-up source. These tests
// drive `pump()` directly from a controlled clock, so fake timers are used to
// stop that interval from holding Jest's event loop open once the assertions
// are done.
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

type Booking = { when: number; accented: boolean };

/**
 * Drives the scheduler from a clock the test controls, so the no-drift claim is
 * proved rather than asserted. `advance` deliberately jitters — a real JS timer
 * is late by a variable amount, and the whole point of the design is that this
 * lateness never reaches a click.
 */
function harness(options: GridOptions) {
  const bookings: Booking[] = [];
  let clock = 0;

  const metronome = new Metronome(
    options,
    {},
    {
      now: () => clock,
      scheduleClick: (when, accented) => bookings.push({ when, accented }),
    },
  );

  return {
    bookings,
    metronome,
    get clock() {
      return clock;
    },
    /** Runs the scheduler forward, waking it up at irregular intervals. */
    run(seconds: number, jitter = true) {
      const target = clock + seconds;
      let step = 0;
      while (clock < target) {
        // 25 ms nominal, but wandering between 5 ms and 60 ms.
        const delta = jitter ? 0.005 + ((step * 37) % 55) / 1000 : 0.025;
        clock = Math.min(target, clock + delta);
        metronome.pump();
        step += 1;
      }
    },
  };
}

describe('Metronome', () => {
  it('books every click of a fixed-length run exactly on the grid', () => {
    const h = harness({ bpm: 120, bars: 2, countInBars: 0 });
    const start = h.metronome.start();
    h.run(5);

    expect(h.bookings).toHaveLength(8);
    h.bookings.forEach((booking, index) => {
      expect(booking.when).toBeCloseTo(start + index * 0.5, 10);
    });
  });

  it('accents the first beat of each bar', () => {
    const h = harness({ bpm: 120, bars: 2, countInBars: 0 });
    h.metronome.start();
    h.run(5);

    expect(h.bookings.map((b) => b.accented)).toEqual([
      true, false, false, false,
      true, false, false, false,
    ]);
  });

  it('does not let a late scheduler move a single click', () => {
    // The core guarantee. The wake-ups here are irregular and sometimes much
    // later than the nominal interval; every click must still land on the grid.
    const h = harness({ bpm: 140, bars: 4, countInBars: 0 });
    const start = h.metronome.start();
    h.run(12);

    const beatSeconds = 60 / 140;
    h.bookings.forEach((booking, index) => {
      expect(booking.when).toBeCloseTo(start + index * beatSeconds, 9);
    });
  });

  it('does not accumulate drift across hundreds of loops', () => {
    // Three minutes of looping a single bar. Re-anchoring to "now" instead of
    // to the end of the pattern would show up here as a growing error.
    const h = harness({ bpm: 120, bars: 1, countInBars: 0 });
    const start = h.metronome.start({ loop: true });
    h.run(180);

    const beatSeconds = 0.5;
    expect(h.bookings.length).toBeGreaterThan(340);

    h.bookings.forEach((booking, index) => {
      expect(booking.when).toBeCloseTo(start + index * beatSeconds, 6);
    });

    const last = h.bookings[h.bookings.length - 1]!;
    const expected = start + (h.bookings.length - 1) * beatSeconds;
    expect(Math.abs(last.when - expected)).toBeLessThan(1e-6);
  });

  it('schedules ahead of the clock, never behind it', () => {
    const h = harness({ bpm: 100, bars: 4, countInBars: 0 });
    h.metronome.start();

    const bookedBy: number[] = [];
    const originalLength = () => h.bookings.length;

    let previous = originalLength();
    for (let i = 0; i < 200; i += 1) {
      h.run(0.02, false);
      while (previous < h.bookings.length) {
        bookedBy.push(h.bookings[previous]!.when - h.clock);
        previous += 1;
      }
    }

    // Every click was booked for a moment still in the future.
    for (const lead of bookedBy) expect(lead).toBeGreaterThan(0);
  });

  it('plays the count-in before the performance starts', () => {
    const h = harness({ bpm: 120, bars: 1, countInBars: 1 });
    const start = h.metronome.start();
    h.run(6);

    // One bar of count-in plus one played bar.
    expect(h.bookings).toHaveLength(8);
    expect(h.metronome.getGrid().steps[0]!.time).toBeCloseTo(2, 10);
    expect(h.bookings[4]!.when).toBeCloseTo(start + 2, 10);
  });

  it('stops when a fixed-length run finishes', () => {
    let finished = false;
    const bookings: Booking[] = [];
    let clock = 0;

    const metronome = new Metronome(
      { bpm: 120, bars: 1, countInBars: 0 },
      { onFinish: () => (finished = true) },
      { now: () => clock, scheduleClick: (when, accented) => bookings.push({ when, accented }) },
    );

    metronome.start();
    while (clock < 5) {
      clock += 0.025;
      metronome.pump();
    }

    expect(finished).toBe(true);
    expect(metronome.isRunning()).toBe(false);
    expect(bookings).toHaveLength(4);
  });

  it('keeps looping past the end of the pattern', () => {
    const h = harness({ bpm: 120, bars: 1, countInBars: 0 });
    h.metronome.start({ loop: true });
    h.run(10);

    expect(h.metronome.isRunning()).toBe(true);
    expect(h.bookings.length).toBeGreaterThan(16);
  });

  it('books nothing once stopped', () => {
    const h = harness({ bpm: 120, bars: 4, countInBars: 0 });
    h.metronome.start();
    h.run(1);

    const countAtStop = h.bookings.length;
    h.metronome.stop();
    h.run(5);

    expect(h.bookings).toHaveLength(countAtStop);
  });

  it('ignores a second start while already running', () => {
    const h = harness({ bpm: 120, bars: 4, countInBars: 0 });
    const first = h.metronome.start();
    const second = h.metronome.start();
    expect(second).toBe(first);
  });
});
