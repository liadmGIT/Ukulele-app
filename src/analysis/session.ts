import type { MasteryState } from './mastery';
import { effectiveLevel, isRusty, weakestFirst } from './mastery';

/**
 * Building today's practice session.
 *
 * "What should I even practise?" is one of the three things that make beginners
 * quit, and it is the one a piece of software can actually answer. So the app
 * answers it: one tap produces a specific ten to fifteen minutes made of this
 * learner's weakest material, in an order that works.
 *
 * The order is not arbitrary. Tune first, because a beginner cannot hear that
 * their instrument is the problem. Then chords, while the hands are fresh and
 * concentration is highest. Then the drill, which is physical rather than
 * mental. A song last, because finishing on something that sounds like music is
 * what brings someone back tomorrow.
 *
 * Pure functions of the learner's state, so the plan is inspectable and every
 * rule about it is testable.
 */

export type SessionItemKind = 'tune' | 'chord' | 'drill' | 'song' | 'pattern';

export type SessionItem = {
  kind: SessionItemKind;
  /** Chord id, song id or pattern id, depending on `kind`. */
  targetId?: string;
  /** For the drill: the pair to switch between. */
  pairId?: string;
  estimatedMinutes: number;
  /** Why this is in the plan, as an i18n key. */
  reasonKey: string;
};

export type SessionPlan = {
  items: SessionItem[];
  estimatedMinutes: number;
};

export type SessionCandidate = {
  id: string;
  mastery: MasteryState;
  /** 1-5. Breaks ties, so a beginner is not handed a barre chord first. */
  difficulty?: number;
  /**
   * How many songs need this chord. Breaks ties ahead of difficulty, so early
   * practice goes on the chords that actually unlock music rather than on three
   * voicings of the same root.
   */
  usefulness?: number;
};

export type BuildSessionOptions = {
  chords: readonly SessionCandidate[];
  /** Songs the learner can already play, best first. */
  playableSongs: readonly SessionCandidate[];
  now: number;
  /** Roughly how long the session should run. */
  targetMinutes?: number;
  /** Whether the learner has calibrated the microphone yet. */
  needsCalibration?: boolean;
};

const TUNE_MINUTES = 1;
const CHORD_MINUTES = 2;
const DRILL_MINUTES = 2;
const SONG_MINUTES = 4;

/** Below this level a chord is still being learned rather than maintained. */
const LEARNING_LEVEL = 3;

export function buildSession({
  chords,
  playableSongs,
  now,
  targetMinutes = 13,
  needsCalibration = false,
}: BuildSessionOptions): SessionPlan {
  const items: SessionItem[] = [];

  items.push({ kind: 'tune', estimatedMinutes: TUNE_MINUTES, reasonKey: 'session.reasonTune' });

  if (needsCalibration) {
    // Worth a minute once: until the microphone is calibrated every review is
    // one constant away from blaming the learner for the hardware.
    items.push({
      kind: 'tune',
      targetId: 'calibrate',
      estimatedMinutes: 1,
      reasonKey: 'session.reasonCalibrate',
    });
  }

  const weakChords = weakestFirst(chords, now, 3);

  for (const chord of weakChords) {
    items.push({
      kind: 'chord',
      targetId: chord.id,
      estimatedMinutes: CHORD_MINUTES,
      reasonKey: isRusty(chord.mastery, now)
        ? 'session.reasonRusty'
        : effectiveLevel(chord.mastery, now) < LEARNING_LEVEL
          ? 'session.reasonNew'
          : 'session.reasonPolish',
    });
  }

  // The drill needs two chords to switch between, and the pair worth drilling
  // is the two weakest — that is where the hesitation actually is.
  if (weakChords.length >= 2) {
    items.push({
      kind: 'drill',
      targetId: weakChords[0]!.id,
      pairId: weakChords[1]!.id,
      estimatedMinutes: DRILL_MINUTES,
      reasonKey: 'session.reasonDrill',
    });
  }

  const song = weakestFirst(playableSongs, now, 1)[0];
  if (song) {
    items.push({
      kind: 'song',
      targetId: song.id,
      estimatedMinutes: SONG_MINUTES,
      reasonKey: 'session.reasonSong',
    });
  }

  const trimmed = trimToTarget(items, targetMinutes);

  return {
    items: trimmed,
    estimatedMinutes: trimmed.reduce((sum, item) => sum + item.estimatedMinutes, 0),
  };
}

/**
 * Cuts the plan down to roughly the target length.
 *
 * Chords are dropped before the song. A session that ends without playing
 * anything musical is the one a learner does not come back to, so the song is
 * the last thing to go — and tuning never goes at all.
 */
function trimToTarget(items: readonly SessionItem[], targetMinutes: number): SessionItem[] {
  const kept = [...items];
  const total = () => kept.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  const droppableOrder: SessionItemKind[] = ['chord', 'drill', 'pattern'];

  for (const kind of droppableOrder) {
    while (total() > targetMinutes) {
      // Drop the last of this kind, keeping the highest-priority ones.
      const index = kept.map((item) => item.kind).lastIndexOf(kind);
      if (index < 0) break;
      kept.splice(index, 1);
    }
    if (total() <= targetMinutes) break;
  }

  return kept;
}

/**
 * Whether the learner has practised today already, for the streak and for
 * deciding whether to offer a fresh session or continue one.
 */
export function practisedOn(timestamps: readonly number[], day: number): boolean {
  const start = startOfDay(day);
  const end = start + 24 * 60 * 60 * 1000;
  return timestamps.some((time) => time >= start && time < end);
}

/**
 * Consecutive days practised, counting back from today.
 *
 * Today not being practised yet does not break the streak — a streak that
 * resets at midnight would punish someone who practises every evening for
 * simply not having done it yet this morning.
 */
export function practiceStreak(timestamps: readonly number[], now: number): number {
  if (timestamps.length === 0) return 0;

  const dayMs = 24 * 60 * 60 * 1000;
  const days = new Set(timestamps.map((time) => startOfDay(time)));

  let streak = 0;
  let cursor = startOfDay(now);

  if (!days.has(cursor)) {
    cursor -= dayMs;
    if (!days.has(cursor)) return 0;
  }

  while (days.has(cursor)) {
    streak += 1;
    cursor -= dayMs;
  }

  return streak;
}

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
