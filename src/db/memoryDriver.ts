import type {
  ChordMastery,
  StorageDriver,
  StoredDrillResult,
  StoredRecording,
  ContentBundle,
} from './types';

/**
 * In-memory storage used by the web preview build.
 *
 * expo-sqlite's synchronous API is native-only — on web it runs through a
 * worker and deadlocks the main thread — and the app reads its language setting
 * before the first render, so it cannot go async. Rather than contort the
 * native path, the browser build simply runs against memory: every screen
 * renders, nothing is saved.
 */
function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export class MemoryDriver implements StorageDriver {
  readonly persistent = false;

  private settings = new Map<string, string>();
  private mastery = new Map<string, ChordMastery>();
  private recordings: StoredRecording[] = [];
  private songMastery = new Map<string, ChordMastery>();
  private drills: StoredDrillResult[] = [];
  private practice = new Map<number, number>();

  getSetting(key: string): string | null {
    return this.settings.get(key) ?? null;
  }

  setSetting(key: string, value: string): void {
    this.settings.set(key, value);
  }

  /**
   * Only the chord mastery rows matter here: the browser preview reads content
   * straight from the bundled JSON, and holds nothing that needs joining
   * against stored copies of it.
   *
   * Existing rows are left alone, matching the SQLite driver's contract that a
   * content update never disturbs progress.
   */
  replaceContent({ chords }: ContentBundle): void {
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

    // A chord that has left the bundle takes its progress with it, so the two
    // drivers agree about what survives an update.
    const ids = new Set(chords.map((chord) => chord.id));
    for (const chordId of [...this.mastery.keys()]) {
      if (!ids.has(chordId)) this.mastery.delete(chordId);
    }
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

  updateChordMastery(chordId: string, state: ChordMastery): void {
    this.mastery.set(chordId, { ...state, chordId });
  }

  getSongMastery(songId: string): ChordMastery | null {
    return this.songMastery.get(songId) ?? null;
  }

  updateSongMastery(songId: string, state: ChordMastery): void {
    this.songMastery.set(songId, { ...state, chordId: songId });
  }

  saveDrillResult(result: StoredDrillResult): void {
    this.drills.unshift(result);
  }

  listDrillResults(limit: number): StoredDrillResult[] {
    return this.drills.slice(0, limit);
  }

  bestChangesPerMinute(chordA: string, chordB: string): number {
    const pair = [chordA, chordB].sort().join('|');
    return this.drills
      .filter((drill) => [drill.chordA, drill.chordB].sort().join('|') === pair)
      .reduce((best, drill) => Math.max(best, drill.changesPerMinute), 0);
  }

  listPracticeDays(limit: number): number[] {
    return [...this.practice.keys()].sort((a, b) => b - a).slice(0, limit);
  }

  recordPracticeMinutes(at: number, minutes: number): void {
    const day = startOfDay(at);
    this.practice.set(day, (this.practice.get(day) ?? 0) + minutes);
  }

  practiceMinutesSince(since: number): { day: number; minutes: number }[] {
    return [...this.practice.entries()]
      .filter(([day]) => day >= startOfDay(since))
      .map(([day, minutes]) => ({ day, minutes }))
      .sort((a, b) => a.day - b.day);
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
