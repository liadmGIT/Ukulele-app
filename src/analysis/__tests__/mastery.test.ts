import {
  DECAY_FLOOR,
  DECAY_GRACE_DAYS,
  DECAY_PERIOD_DAYS,
  MAX_LEVEL,
  applyAttempt,
  daysUntilDecay,
  effectiveLevel,
  isRusty,
  levelForAttempt,
  nextRequirement,
  weakestFirst,
  type MasteryState,
} from '../mastery';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

const state = (overrides: Partial<MasteryState> = {}): MasteryState => ({
  level: 0,
  sessionsPractised: 0,
  lastPractisedAt: null,
  ...overrides,
});

describe('levelForAttempt', () => {
  it('gives nothing for a poor attempt', () => {
    expect(levelForAttempt({ score: 20, tempoFraction: 1, at: NOW })).toBe(0);
  });

  it('rewards a good attempt at full speed with the top level', () => {
    expect(levelForAttempt({ score: 95, tempoFraction: 1, at: NOW })).toBe(MAX_LEVEL);
  });

  it('caps a perfect attempt played slowly', () => {
    // Playing it flawlessly at half speed is real progress, but it is not the
    // same as playing it, and the level has to say so.
    const slow = levelForAttempt({ score: 100, tempoFraction: 0.5, at: NOW });
    const fast = levelForAttempt({ score: 100, tempoFraction: 1, at: NOW });

    expect(slow).toBe(1);
    expect(fast).toBe(MAX_LEVEL);
    expect(slow).toBeLessThan(fast);
  });

  it('needs both the score and the tempo', () => {
    expect(levelForAttempt({ score: 88, tempoFraction: 0.6, at: NOW })).toBe(2);
    expect(levelForAttempt({ score: 62, tempoFraction: 1, at: NOW })).toBe(2);
  });

  it('rises monotonically with tempo at a fixed score', () => {
    const levels = [0.5, 0.6, 0.75, 0.9, 1].map((tempoFraction) =>
      levelForAttempt({ score: 95, tempoFraction, at: NOW }),
    );

    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]!);
    }
  });
});

describe('applyAttempt', () => {
  it('advances one level at a time', () => {
    // The rule that stops one lucky take reading as mastery.
    const first = applyAttempt(state(), { score: 100, tempoFraction: 1, at: NOW });

    expect(first.level).toBe(1);
    expect(first.levelledUp).toBe(true);
    expect(first.previousLevel).toBe(0);
  });

  it('takes five good sessions to reach the top', () => {
    let current = state();
    for (let session = 0; session < MAX_LEVEL; session += 1) {
      current = applyAttempt(current, {
        score: 95,
        tempoFraction: 1,
        at: NOW + session * DAY,
      });
    }

    expect(current.level).toBe(MAX_LEVEL);
  });

  it('does not advance past what the attempt justifies', () => {
    let current = applyAttempt(state(), { score: 95, tempoFraction: 1, at: NOW });
    // Level 1 achieved. Now a weak attempt: it must not advance.
    current = applyAttempt(current, { score: 30, tempoFraction: 1, at: NOW + DAY });

    expect(current.level).toBe(1);
  });

  it('never drops the level for a bad take', () => {
    // Losing a level for one shaky attempt would make the app feel punitive,
    // and decay already handles genuinely losing a skill.
    const earned = state({ level: 3, sessionsPractised: 5, lastPractisedAt: NOW });
    const after = applyAttempt(earned, { score: 5, tempoFraction: 0.5, at: NOW + DAY });

    expect(after.level).toBe(3);
    expect(after.levelledUp).toBe(false);
  });

  it('counts the session either way', () => {
    const after = applyAttempt(state({ sessionsPractised: 4 }), {
      score: 10,
      tempoFraction: 0.5,
      at: NOW,
    });
    expect(after.sessionsPractised).toBe(5);
  });

  it('records when it happened', () => {
    expect(
      applyAttempt(state(), { score: 90, tempoFraction: 1, at: NOW }).lastPractisedAt,
    ).toBe(NOW);
  });

  it('stops at the maximum', () => {
    const top = state({ level: MAX_LEVEL, lastPractisedAt: NOW });
    expect(applyAttempt(top, { score: 100, tempoFraction: 1, at: NOW + DAY }).level).toBe(
      MAX_LEVEL,
    );
  });
});

describe('effectiveLevel', () => {
  it('leaves a freshly practised level alone', () => {
    const fresh = state({ level: 4, lastPractisedAt: NOW });
    expect(effectiveLevel(fresh, NOW)).toBe(4);
  });

  it('does not punish a few days off', () => {
    const recent = state({ level: 4, lastPractisedAt: NOW - (DECAY_GRACE_DAYS - 1) * DAY });
    expect(effectiveLevel(recent, NOW)).toBe(4);
  });

  it('drops a level once the grace period passes', () => {
    const stale = state({ level: 4, lastPractisedAt: NOW - (DECAY_GRACE_DAYS + 1) * DAY });
    expect(effectiveLevel(stale, NOW)).toBe(3);
  });

  it('keeps dropping over months', () => {
    const ancient = state({
      level: 5,
      lastPractisedAt: NOW - (DECAY_GRACE_DAYS + DECAY_PERIOD_DAYS * 2 + 1) * DAY,
    });
    expect(effectiveLevel(ancient, NOW)).toBe(2);
  });

  it('never falls below the floor', () => {
    // Something learned is never fully unlearned; telling a returning learner
    // they had achieved nothing would be both false and demoralising.
    const forgotten = state({ level: 5, lastPractisedAt: NOW - 3650 * DAY });
    expect(effectiveLevel(forgotten, NOW)).toBe(DECAY_FLOOR);
  });

  it('leaves level 1 and 0 alone entirely', () => {
    expect(effectiveLevel(state({ level: 1, lastPractisedAt: NOW - 3650 * DAY }), NOW)).toBe(1);
    expect(effectiveLevel(state({ level: 0, lastPractisedAt: null }), NOW)).toBe(0);
  });

  it('is non-destructive — one practice restores what was earned', () => {
    const rusty = state({ level: 4, sessionsPractised: 9, lastPractisedAt: NOW - 60 * DAY });
    expect(effectiveLevel(rusty, NOW)).toBeLessThan(4);

    const revisited = applyAttempt(rusty, { score: 70, tempoFraction: 0.8, at: NOW });
    expect(effectiveLevel(revisited, NOW)).toBe(4);
  });
});

describe('rustiness', () => {
  it('flags a level that has slipped', () => {
    expect(isRusty(state({ level: 4, lastPractisedAt: NOW - 40 * DAY }), NOW)).toBe(true);
    expect(isRusty(state({ level: 4, lastPractisedAt: NOW }), NOW)).toBe(false);
  });

  it('counts down to the drop', () => {
    const fresh = state({ level: 3, lastPractisedAt: NOW });
    expect(daysUntilDecay(fresh, NOW)).toBe(DECAY_GRACE_DAYS);

    const overdue = state({ level: 3, lastPractisedAt: NOW - 30 * DAY });
    expect(daysUntilDecay(overdue, NOW)).toBe(0);
  });

  it('has nothing to count down for a level that cannot decay', () => {
    expect(daysUntilDecay(state({ level: 1, lastPractisedAt: NOW }), NOW)).toBeNull();
    expect(daysUntilDecay(state({ level: 0 }), NOW)).toBeNull();
  });
});

describe('nextRequirement', () => {
  it('names the target rather than a percentage', () => {
    expect(nextRequirement(state({ level: 2 }))).toEqual({ score: 70, tempoFraction: 0.75 });
  });

  it('has nothing left to ask at the top', () => {
    expect(nextRequirement(state({ level: MAX_LEVEL }))).toBeNull();
  });
});

describe('weakestFirst', () => {
  it('puts rusty skills before merely low ones', () => {
    // Restoring something almost known beats starting something new.
    const items = [
      { id: 'new', mastery: state({ level: 0 }) },
      { id: 'rusty', mastery: state({ level: 4, lastPractisedAt: NOW - 60 * DAY }) },
    ];

    expect(weakestFirst(items, NOW)[0]!.id).toBe('rusty');
  });

  it('then orders by how low the level is', () => {
    const items = [
      { id: 'high', mastery: state({ level: 4, lastPractisedAt: NOW }) },
      { id: 'low', mastery: state({ level: 1, lastPractisedAt: NOW }) },
      { id: 'mid', mastery: state({ level: 2, lastPractisedAt: NOW }) },
    ];

    expect(weakestFirst(items, NOW).map((entry) => entry.id)).toEqual(['low', 'mid', 'high']);
  });

  it('breaks ties by how long ago it was practised', () => {
    const items = [
      { id: 'recent', mastery: state({ level: 2, lastPractisedAt: NOW - DAY }) },
      { id: 'older', mastery: state({ level: 2, lastPractisedAt: NOW - 5 * DAY }) },
    ];

    expect(weakestFirst(items, NOW)[0]!.id).toBe('older');
  });

  it('respects the limit and does not mutate its input', () => {
    const items = [
      { id: 'a', mastery: state({ level: 1 }) },
      { id: 'b', mastery: state({ level: 2 }) },
      { id: 'c', mastery: state({ level: 3 }) },
    ];
    const original = [...items];

    expect(weakestFirst(items, NOW, 2)).toHaveLength(2);
    expect(items).toEqual(original);
  });
});
