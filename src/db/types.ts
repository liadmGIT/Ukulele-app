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

export interface StorageDriver {
  readonly persistent: boolean;

  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;

  /** Replaces the stored copy of the bundled content. */
  replaceChords(chords: readonly Chord[]): void;
  replaceStrumPatterns(patterns: readonly StrumPatternData[]): void;
  /** Songs and the chords they need. `song_progress` has a foreign key onto this. */
  replaceSongs(songs: readonly (SongData & { chordIds: readonly string[] })[]): void;

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
