import type { PerformanceMetrics } from '@/analysis/metrics';
import type { Review } from '@/analysis/review';

import type { StoredRecording } from './types';

import { SETTING_KEYS, getSetting, getStorage, setSetting } from './index';

/**
 * Practice history.
 *
 * The review is stored as its rule ids and parameters rather than as finished
 * text, so a take from three weeks ago still reads in whichever language the
 * learner is using now, and rewording a rule does not rewrite history.
 */

export type SavedTake = {
  id: string;
  createdAt: number;
  fileUri: string;
  durationMs: number;
  patternId: string | null;
  songId: string | null;
  bpm: number;
  tempoPct: number;
  metrics: PerformanceMetrics;
  review: Review;
};

export function saveTake(take: Omit<SavedTake, 'id' | 'createdAt'> & { id?: string }): SavedTake {
  const saved: SavedTake = {
    ...take,
    id: take.id ?? `take-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };

  getStorage().saveRecording({
    id: saved.id,
    createdAt: saved.createdAt,
    fileUri: saved.fileUri,
    durationMs: saved.durationMs,
    songId: saved.songId,
    patternId: saved.patternId,
    bpm: saved.bpm,
    tempoPct: saved.tempoPct,
    metrics: JSON.stringify(saved.metrics),
    review: JSON.stringify(saved.review),
  });

  return saved;
}

export function listTakes(limit = 50): SavedTake[] {
  return getStorage()
    .listRecordings(limit)
    .map(fromStored)
    .filter((take): take is SavedTake => take !== null);
}

export function deleteTake(id: string): void {
  getStorage().deleteRecording(id);
}

function fromStored(row: StoredRecording): SavedTake | null {
  try {
    return {
      id: row.id,
      createdAt: row.createdAt,
      fileUri: row.fileUri,
      durationMs: row.durationMs,
      songId: row.songId,
      patternId: row.patternId,
      bpm: row.bpm,
      tempoPct: row.tempoPct,
      metrics: JSON.parse(row.metrics) as PerformanceMetrics,
      review: JSON.parse(row.review) as Review,
    };
  } catch {
    // A row written by an older, incompatible version. Skipping it loses one
    // history entry; throwing would take down the whole progress screen.
    return null;
  }
}

// ------------------------------------------------------- microphone latency --

/**
 * Round-trip latency between the audio clock and the microphone, in seconds.
 *
 * Zero until the learner runs calibration. An uncorrected delay is
 * indistinguishable from consistently playing late, so until this is measured
 * the app is one constant away from blaming the player for the hardware.
 */
export function getMicLatencySeconds(): number {
  const stored = getSetting(SETTING_KEYS.micLatencyMs);
  if (!stored) return 0;

  const ms = Number.parseFloat(stored);
  return Number.isFinite(ms) ? ms / 1000 : 0;
}

export function setMicLatencyMs(milliseconds: number): void {
  setSetting(SETTING_KEYS.micLatencyMs, String(Math.round(milliseconds)));
}

export function hasCalibratedMicLatency(): boolean {
  return getSetting(SETTING_KEYS.micLatencyMs) !== null;
}
