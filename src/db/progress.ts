import { applyAttempt, type Attempt, type MasteryState } from '@/analysis/mastery';
import { changesPerMinute } from '@/dsp/changes';

import type { ChordMastery, StoredDrillResult } from './types';

import { getStorage } from './index';

/**
 * Writing progress: the bridge between the pure mastery rules and storage.
 *
 * All the judgement lives in `analysis/mastery.ts`; this only persists what it
 * decides. Keeping the rules out of the database layer is what lets them be
 * tested exhaustively without one.
 */

function toMasteryState(row: ChordMastery | null): MasteryState {
  return {
    level: row?.level ?? 0,
    sessionsPractised: row?.sessionsPractised ?? 0,
    lastPractisedAt: row?.lastPractisedAt ?? null,
  };
}

export function recordChordAttempt(chordId: string, attempt: Attempt) {
  const storage = getStorage();
  const current = toMasteryState(storage.getChordMastery(chordId));
  const updated = applyAttempt(current, attempt);

  storage.updateChordMastery(chordId, {
    chordId,
    level: updated.level,
    bestChangesPerMinute: storage.getChordMastery(chordId)?.bestChangesPerMinute ?? 0,
    sessionsPractised: updated.sessionsPractised,
    lastPractisedAt: updated.lastPractisedAt,
  });

  return updated;
}

export function recordSongAttempt(songId: string, attempt: Attempt) {
  const storage = getStorage();
  const current = toMasteryState(storage.getSongMastery(songId));
  const updated = applyAttempt(current, attempt);

  storage.updateSongMastery(songId, {
    chordId: songId,
    level: updated.level,
    bestChangesPerMinute: 0,
    sessionsPractised: updated.sessionsPractised,
    lastPractisedAt: updated.lastPractisedAt,
  });

  return updated;
}

export function getSongMasteryState(songId: string): MasteryState {
  return toMasteryState(getStorage().getSongMastery(songId));
}

// ------------------------------------------------------------------ drill --

export type DrillOutcome = {
  chordA: string;
  chordB: string;
  changes: number;
  durationSeconds: number;
};

export function saveDrillResult(outcome: DrillOutcome): StoredDrillResult {
  const rate = changesPerMinute(outcome.changes, outcome.durationSeconds);

  const result: StoredDrillResult = {
    id: `drill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    chordA: outcome.chordA,
    chordB: outcome.chordB,
    changes: outcome.changes,
    durationMs: Math.round(outcome.durationSeconds * 1000),
    changesPerMinute: rate,
  };

  getStorage().saveDrillResult(result);
  return result;
}

export function getBestChangesPerMinute(chordA: string, chordB: string): number {
  return getStorage().bestChangesPerMinute(chordA, chordB);
}

export function listDrillResults(limit = 30): StoredDrillResult[] {
  return getStorage().listDrillResults(limit);
}

// --------------------------------------------------------------- practice --

export function recordPractice(minutes: number, at = Date.now()): void {
  if (minutes <= 0) return;
  getStorage().recordPracticeMinutes(at, minutes);
}

export function getPracticeDays(limit = 400): number[] {
  return getStorage().listPracticeDays(limit);
}

/** Minutes practised per day over the last `days`, oldest first. */
export function getPracticeMinutes(days = 7): { day: number; minutes: number }[] {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const recorded = new Map(
    getStorage()
      .practiceMinutesSince(since)
      .map((entry) => [entry.day, entry.minutes]),
  );

  // Fill the gaps, so a chart shows the days with nothing on them rather than
  // quietly closing up and making a patchy week look continuous.
  const out: { day: number; minutes: number }[] = [];
  const today = startOfDay(Date.now());

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = today - i * 24 * 60 * 60 * 1000;
    out.push({ day, minutes: recorded.get(day) ?? 0 });
  }

  return out;
}

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
