/**
 * Mastery: turning measured performances into a level you can watch climb.
 *
 * Three rules shape everything here, and each exists to stop a specific lie.
 *
 * 1. **A level is earned at a tempo.** Playing something perfectly at half
 *    speed is real progress, but it is not the same as playing it. Each level
 *    demands both a higher score and a higher fraction of the written tempo.
 * 2. **One take is never enough.** Levels advance at most one step per session,
 *    so a single lucky attempt cannot jump from beginner to mastered. What is
 *    being measured is whether you can do it, not whether you once did.
 * 3. **Mastery decays.** A chord practised twice in March is not mastered in
 *    June. Decay is applied when the level is *read* rather than written, so
 *    nothing is destroyed and a single practice restores it.
 *
 * Pure functions, so every one of those claims is checkable.
 */

export const MAX_LEVEL = 5;

export type LevelRequirement = {
  /** Overall score needed, 0-100. */
  score: number;
  /** Fraction of the written tempo it must be played at. */
  tempoFraction: number;
};

/**
 * What each level costs. Index 0 is unused — level 0 is where everyone starts.
 *
 * The curve is deliberately gentle at the bottom and steep at the top: the
 * first level should arrive on the first honest attempt, and level 5 should
 * mean the learner can genuinely play the thing at speed.
 */
export const LEVEL_REQUIREMENTS: readonly LevelRequirement[] = [
  { score: 0, tempoFraction: 0 },
  { score: 45, tempoFraction: 0.5 },
  { score: 60, tempoFraction: 0.6 },
  { score: 70, tempoFraction: 0.75 },
  { score: 80, tempoFraction: 0.9 },
  { score: 88, tempoFraction: 1 },
];

/** No decay before this; a few days off is rest, not forgetting. */
export const DECAY_GRACE_DAYS = 10;
/** One level lost per this many days beyond the grace period. */
export const DECAY_PERIOD_DAYS = 21;
/**
 * Decay stops here. Something learned is never fully unlearned, and resetting
 * to zero would tell a returning learner they had achieved nothing.
 */
export const DECAY_FLOOR = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export type MasteryState = {
  level: number;
  sessionsPractised: number;
  lastPractisedAt: number | null;
};

export type Attempt = {
  /** Overall score from the analysis, 0-100. */
  score: number;
  /** Tempo it was played at, as a fraction of written. */
  tempoFraction: number;
  /** When it happened. */
  at: number;
};

export type MasteryUpdate = MasteryState & {
  /** True when this attempt moved the level up. */
  levelledUp: boolean;
  previousLevel: number;
};

/** The highest level an attempt qualifies for on its own. */
export function levelForAttempt(attempt: Attempt): number {
  let earned = 0;

  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    const requirement = LEVEL_REQUIREMENTS[level];
    if (!requirement) break;
    if (attempt.score >= requirement.score && attempt.tempoFraction >= requirement.tempoFraction) {
      earned = level;
    }
  }

  return earned;
}

/**
 * Applies an attempt to a chord's or song's mastery.
 *
 * Advances at most one level, and only when the attempt would justify at least
 * the next one. A brilliant take at level 1 makes you level 2, not level 5.
 */
export function applyAttempt(state: MasteryState, attempt: Attempt): MasteryUpdate {
  const previousLevel = state.level;
  const earned = levelForAttempt(attempt);
  const levelledUp = earned > previousLevel;

  return {
    level: levelledUp ? Math.min(MAX_LEVEL, previousLevel + 1) : previousLevel,
    sessionsPractised: state.sessionsPractised + 1,
    lastPractisedAt: attempt.at,
    levelledUp,
    previousLevel,
  };
}

/**
 * The level as it stands today, after decay.
 *
 * Non-destructive: the stored level is what was earned, and this is what it is
 * currently worth. Practising once brings the stored level straight back into
 * play, so a learner returning after a break is not made to climb from zero.
 */
export function effectiveLevel(state: MasteryState, now: number): number {
  if (state.level <= DECAY_FLOOR || state.lastPractisedAt === null) return state.level;

  const daysSince = (now - state.lastPractisedAt) / DAY_MS;
  if (daysSince <= DECAY_GRACE_DAYS) return state.level;

  const lost = Math.floor((daysSince - DECAY_GRACE_DAYS) / DECAY_PERIOD_DAYS) + 1;
  return Math.max(DECAY_FLOOR, state.level - lost);
}

/** True when the level shown is below the level earned. */
export function isRusty(state: MasteryState, now: number): boolean {
  return effectiveLevel(state, now) < state.level;
}

/** Days until the level would drop, or null when it is not going to. */
export function daysUntilDecay(state: MasteryState, now: number): number | null {
  if (state.level <= DECAY_FLOOR || state.lastPractisedAt === null) return null;

  const daysSince = (now - state.lastPractisedAt) / DAY_MS;
  if (daysSince > DECAY_GRACE_DAYS) return 0;

  return Math.ceil(DECAY_GRACE_DAYS - daysSince);
}

/**
 * What the learner has to do next, for a progress screen to show.
 *
 * Naming the target — "score 70 at 75% speed" — is far more actionable than a
 * bar that is 60% full.
 */
export function nextRequirement(state: MasteryState): LevelRequirement | null {
  if (state.level >= MAX_LEVEL) return null;
  return LEVEL_REQUIREMENTS[state.level + 1] ?? null;
}

/**
 * Picks what most needs work: the weakest things practised least recently.
 *
 * Rusty items come first — restoring something almost known is a better use of
 * ten minutes than starting something new — then genuinely low levels.
 *
 * The tie-breaks matter more than they sound, because on day one *everything*
 * is at level 0 and the ties are all there is. Without them the ordering falls
 * back to however the library happens to be sorted, and the first thing the app
 * ever recommends is a barre chord, or three voicings of the same root.
 *
 * So: usefulness first — how many songs the chord actually appears in, which is
 * what turns practice into something playable — then difficulty, so that among
 * equally useful chords the easier one comes first.
 */
export function weakestFirst<
  T extends { mastery: MasteryState; difficulty?: number; usefulness?: number },
>(items: readonly T[], now: number, limit = 5): T[] {
  return [...items]
    .map((item) => ({
      item,
      effective: effectiveLevel(item.mastery, now),
      rusty: isRusty(item.mastery, now),
      lastPractisedAt: item.mastery.lastPractisedAt ?? 0,
      difficulty: item.difficulty ?? 0,
      usefulness: item.usefulness ?? 0,
    }))
    .sort((a, b) => {
      if (a.rusty !== b.rusty) return a.rusty ? -1 : 1;
      if (a.effective !== b.effective) return a.effective - b.effective;
      if (a.usefulness !== b.usefulness) return b.usefulness - a.usefulness;
      if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
      return a.lastPractisedAt - b.lastPractisedAt;
    })
    .slice(0, limit)
    .map((entry) => entry.item);
}
