import type { Chord, SongData, StrumPatternData } from '@/content/schemas';

export type ChordMastery = {
  chordId: string;
  level: number;
  bestChangesPerMinute: number;
  sessionsPractised: number;
  lastPractisedAt: number | null;
};

/**
 * Everything the app needs from storage.
 *
 * Two implementations exist. On iOS and Android this is SQLite, which is the
 * real one: it persists, and it can join user progress against content in a
 * single query. On web it is an in-memory store so the UI can be previewed in a
 * browser during development — web is a **preview only**, progress there is not
 * saved and is not meant to be.
 */
export type StoredRecording = {
  id: string;
  createdAt: number;
  fileUri: string;
  durationMs: number;
  songId: string | null;
  patternId: string | null;
  bpm: number;
  tempoPct: number;
  /** JSON: PerformanceMetrics. */
  metrics: string;
  /** JSON: the Review — note ids and params, so it re-renders in any language. */
  review: string;
};

export type StoredDrillResult = {
  id: string;
  createdAt: number;
  chordA: string;
  chordB: string;
  changes: number;
  durationMs: number;
  changesPerMinute: number;
};

export type ContentBundle = {
  chords: readonly Chord[];
  patterns: readonly StrumPatternData[];
  /** Songs and the chords they need. `song_progress` has a foreign key onto this. */
  songs: readonly (SongData & { chordIds: readonly string[] })[];
};

export interface StorageDriver {
  readonly persistent: boolean;

  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;

  /**
   * Brings the stored copy of the bundled content up to date, in one
   * transaction, without disturbing the learner's progress.
   *
   * One call rather than three, because the three tables reference each other
   * and the user's tables reference all of them. Anything that empties a
   * content table in isolation either violates a foreign key or destroys
   * progress; the ordering that avoids both only exists if the whole swap
   * happens together.
   */
  replaceContent(content: ContentBundle): void;

  getAllChordMastery(): ChordMastery[];
  getChordMastery(chordId: string): ChordMastery | null;
  getChordIdsAtOrAboveLevel(level: number): string[];

  /** Records an attempt against a chord or song and returns the new state. */
  updateChordMastery(chordId: string, state: ChordMastery): void;
  getSongMastery(songId: string): ChordMastery | null;
  updateSongMastery(songId: string, state: ChordMastery): void;

  saveDrillResult(result: StoredDrillResult): void;
  listDrillResults(limit: number): StoredDrillResult[];
  bestChangesPerMinute(chordA: string, chordB: string): number;

  /** Timestamps of every practice session, for streaks and charts. */
  listPracticeDays(limit: number): number[];
  recordPracticeMinutes(at: number, minutes: number): void;
  practiceMinutesSince(since: number): { day: number; minutes: number }[];

  saveRecording(recording: StoredRecording): void;
  listRecordings(limit: number): StoredRecording[];
  deleteRecording(id: string): void;
}
