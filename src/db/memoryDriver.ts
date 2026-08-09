import type { Chord } from '@/content/schemas';

import type { ChordMastery, StorageDriver, StoredRecording } from './types';

/**
 * In-memory storage used by the web preview build.
 *
 * expo-sqlite's synchronous API is native-only — on web it runs through a
 * worker and deadlocks the main thread — and the app reads its language setting
 * before the first render, so it cannot go async. Rather than contort the
 * native path, the browser build simply runs against memory: every screen
 * renders, nothing is saved.
 */
export class MemoryDriver implements StorageDriver {
  readonly persistent = false;

  private settings = new Map<string, string>();
  private mastery = new Map<string, ChordMastery>();
  private recordings: StoredRecording[] = [];

  getSetting(key: string): string | null {
    return this.settings.get(key) ?? null;
  }

  setSetting(key: string, value: string): void {
    this.settings.set(key, value);
  }

  replaceChords(chords: readonly Chord[]): void {
    for (const chord of chords) {
      if (this.mastery.has(chord.id)) continue;
      this.mastery.set(chord.id, {
        chordId: chord.id,
        level: 0,
        bestChangesPerMinute: 0,
        sessionsPractised: 0,
        lastPractisedAt: null,
      });
    }
  }

  replaceStrumPatterns(): void {
    // Nothing to do: the browser preview reads patterns straight from the
    // bundled JSON, and holds no user data that needs joining against them.
  }

  getAllChordMastery(): ChordMastery[] {
    return [...this.mastery.values()];
  }

  getChordMastery(chordId: string): ChordMastery | null {
    return this.mastery.get(chordId) ?? null;
  }

  getChordIdsAtOrAboveLevel(level: number): string[] {
    return this.getAllChordMastery()
      .filter((entry) => entry.level >= level)
      .map((entry) => entry.chordId);
  }

  saveRecording(recording: StoredRecording): void {
    this.recordings.unshift(recording);
  }

  listRecordings(limit: number): StoredRecording[] {
    return this.recordings.slice(0, limit);
  }

  deleteRecording(id: string): void {
    this.recordings = this.recordings.filter((recording) => recording.id !== id);
  }
}
