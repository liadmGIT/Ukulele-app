import * as SQLite from 'expo-sqlite';

import type { Chord, SongData, StrumPatternData } from '@/content/schemas';

import { MIGRATIONS } from './migrations';
import type {
  ChordMastery,
  ContentBundle,
  StorageDriver,
  StoredDrillResult,
  StoredRecording,
} from './types';

const DATABASE_NAME = 'ukulele.db';

type ChordMasteryRow = {
  chord_id: string;
  level: number;
  best_changes_per_minute: number;
  sessions_practised: number;
  last_practised_at: number | null;
};

function toChordMastery(row: ChordMasteryRow): ChordMastery {
  return {
    chordId: row.chord_id,
    level: row.level,
    bestChangesPerMinute: row.best_changes_per_minute,
    sessionsPractised: row.sessions_practised,
    lastPractisedAt: row.last_practised_at,
  };
}

/**
 * The real storage: SQLite on iOS and Android.
 *
 * Opened synchronously on purpose — the layout direction has to be decided from
 * the stored language before React renders its first frame, and an async read
 * would land after that.
 */
export class SqliteDriver implements StorageDriver {
  readonly persistent = true;

  private readonly db: SQLite.SQLiteDatabase;

  constructor() {
    this.db = SQLite.openDatabaseSync(DATABASE_NAME);
    this.db.execSync('PRAGMA journal_mode = WAL;');
    this.db.execSync('PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  private migrate(): void {
    const row = this.db.getFirstSync<{ user_version: number }>('PRAGMA user_version;');
    const current = row?.user_version ?? 0;

    for (let version = current; version < MIGRATIONS.length; version += 1) {
      const sql = MIGRATIONS[version];
      if (!sql) continue;

      // The driver's own transaction helper rather than a hand-written
      // BEGIN/COMMIT: a statement failing inside the latter left the
      // transaction open, so every write for the rest of the launch failed with
      // "cannot start a transaction within a transaction" — one broken
      // migration turning into an app that silently saves nothing.
      this.db.withTransactionSync(() => {
        this.db.execSync(sql);
        this.db.execSync(`PRAGMA user_version = ${version + 1};`);
      });
    }
  }

  getSetting(key: string): string | null {
    const row = this.db.getFirstSync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?;',
      key,
    );
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.db.runSync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      key,
      value,
    );
  }

  /**
   * Updates the bundled content in place.
   *
   * This used to be three methods, each starting with `DELETE FROM` its own
   * table. With foreign keys enforced — and `chord_mastery` holding a row for
   * every chord from the very first seed — those deletes could not succeed.
   * The first install worked because the tables were empty; the first *content
   * update* would have thrown here, at module scope during startup, on every
   * launch, with no error boundary to catch it. The app would have been
   * unopenable, and the only way out is deleting it, which erases every level,
   * streak and review the learner had earned.
   *
   * So nothing is emptied. Rows are inserted or updated in place, and only ids
   * that have genuinely disappeared from the bundle are removed — dependents
   * first, in an order the constraints allow. Progress for everything that
   * survives is untouched, which is the whole point: content is disposable,
   * what the learner did is not.
   */
  replaceContent({ chords, patterns, songs }: ContentBundle): void {
    this.db.withTransactionSync(() => {
      this.upsertChords(chords);
      this.upsertPatterns(patterns);
      this.upsertSongs(songs);

      // Pruning runs after every insert, so anything the new bundle introduced
      // is already present and only genuinely departed ids are considered.
      // Order matters and runs from the most dependent table outwards.
      this.pruneSongs(songs.map((song) => song.id));
      this.prunePatterns(patterns.map((pattern) => pattern.id));
      this.pruneChords(chords.map((chord) => chord.id));
    });
  }

  private upsertChords(chords: readonly Chord[]): void {
    const statement = this.db.prepareSync(
      `INSERT INTO chords
         (id, name_en, name_he, root, quality, aliases, shapes, difficulty, category, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name_en = excluded.name_en, name_he = excluded.name_he, root = excluded.root,
         quality = excluded.quality, aliases = excluded.aliases, shapes = excluded.shapes,
         difficulty = excluded.difficulty, category = excluded.category,
         sort_order = excluded.sort_order;`,
    );

    try {
      for (const chord of chords) {
        statement.executeSync(
          chord.id,
          chord.nameEn,
          chord.nameHe,
          chord.root,
          chord.quality,
          JSON.stringify(chord.aliases),
          JSON.stringify(chord.shapes),
          chord.difficulty,
          chord.category,
          chord.sortOrder,
        );
      }
    } finally {
      statement.finalizeSync();
    }

    // Give every chord a mastery row up front so progress queries never have
    // to distinguish "not started" from "row missing".
    this.db.runSync(
      `INSERT INTO chord_mastery (chord_id)
       SELECT id FROM chords
       WHERE id NOT IN (SELECT chord_id FROM chord_mastery);`,
    );
  }

  private upsertPatterns(patterns: readonly StrumPatternData[]): void {
    const statement = this.db.prepareSync(
      `INSERT INTO strum_patterns
         (id, name_en, name_he, beats_per_bar, beat_unit, subdivision, pattern, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name_en = excluded.name_en, name_he = excluded.name_he,
         beats_per_bar = excluded.beats_per_bar, beat_unit = excluded.beat_unit,
         subdivision = excluded.subdivision, pattern = excluded.pattern,
         difficulty = excluded.difficulty;`,
    );

    try {
      for (const pattern of patterns) {
        statement.executeSync(
          pattern.id,
          pattern.nameEn,
          pattern.nameHe,
          pattern.beatsPerBar,
          pattern.beatUnit,
          pattern.subdivision,
          pattern.notation,
          pattern.difficulty,
        );
      }
    } finally {
      statement.finalizeSync();
    }
  }

  private upsertSongs(songs: readonly (SongData & { chordIds: readonly string[] })[]): void {
    const insertSong = this.db.prepareSync(
      `INSERT INTO songs
         (id, title_he, title_en, artist, language, song_key, bpm, beats_per_bar, beat_unit,
          difficulty, default_pattern_id, chord_count, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title_he = excluded.title_he, title_en = excluded.title_en, artist = excluded.artist,
         language = excluded.language, song_key = excluded.song_key, bpm = excluded.bpm,
         beats_per_bar = excluded.beats_per_bar, beat_unit = excluded.beat_unit,
         difficulty = excluded.difficulty, default_pattern_id = excluded.default_pattern_id,
         chord_count = excluded.chord_count, source = excluded.source;`,
    );
    const insertChord = this.db.prepareSync(
      `INSERT INTO song_chords (song_id, chord_id) VALUES (?, ?);`,
    );

    try {
      for (const song of songs) {
        insertSong.executeSync(
          song.id,
          song.titleHe,
          song.titleEn,
          song.artistEn,
          song.language,
          song.songKey,
          song.bpm,
          song.beatsPerBar,
          song.beatUnit,
          song.difficulty,
          song.defaultPatternId,
          song.chordIds.length,
          song.source,
        );

        // song_chords is a plain join table with no user data in it, so it is
        // safe to rebuild per song — and rebuilding is simpler than working out
        // which pairings changed.
        this.db.runSync('DELETE FROM song_chords WHERE song_id = ?;', song.id);
        for (const chordId of song.chordIds) {
          insertChord.executeSync(song.id, chordId);
        }
      }
    } finally {
      insertSong.finalizeSync();
      insertChord.finalizeSync();
    }
  }

  private pruneSongs(keep: readonly string[]): void {
    const list = placeholders(keep);
    if (!list) return;

    // Progress for a song that no longer exists goes with it; there is nothing
    // left for it to describe. Recordings survive with a null reference,
    // because a take is a record of something the learner actually did.
    this.db.runSync(`UPDATE recordings SET song_id = NULL WHERE song_id NOT IN (${list});`, ...keep);
    this.db.runSync(`DELETE FROM song_progress WHERE song_id NOT IN (${list});`, ...keep);
    this.db.runSync(`DELETE FROM song_chords WHERE song_id NOT IN (${list});`, ...keep);
    this.db.runSync(`DELETE FROM songs WHERE id NOT IN (${list});`, ...keep);
  }

  private prunePatterns(keep: readonly string[]): void {
    const list = placeholders(keep);
    if (!list) return;

    this.db.runSync(
      `UPDATE recordings SET pattern_id = NULL WHERE pattern_id NOT IN (${list});`,
      ...keep,
    );
    // Songs were pruned first and re-pointed by the upsert above, so any
    // pattern still referenced here is one the new bundle kept.
    this.db.runSync(
      `DELETE FROM strum_patterns
       WHERE id NOT IN (${list})
         AND id NOT IN (SELECT default_pattern_id FROM songs);`,
      ...keep,
    );
  }

  private pruneChords(keep: readonly string[]): void {
    const list = placeholders(keep);
    if (!list) return;

    this.db.runSync(
      `DELETE FROM drill_results WHERE chord_a NOT IN (${list}) OR chord_b NOT IN (${list});`,
      ...keep,
      ...keep,
    );
    this.db.runSync(`DELETE FROM chord_mastery WHERE chord_id NOT IN (${list});`, ...keep);
    this.db.runSync(
      `DELETE FROM chords
       WHERE id NOT IN (${list})
         AND id NOT IN (SELECT chord_id FROM song_chords);`,
      ...keep,
    );
  }

  getAllChordMastery(): ChordMastery[] {
    return this.db
      .getAllSync<ChordMasteryRow>('SELECT * FROM chord_mastery;')
      .map(toChordMastery);
  }

  getChordMastery(chordId: string): ChordMastery | null {
    const row = this.db.getFirstSync<ChordMasteryRow>(
      'SELECT * FROM chord_mastery WHERE chord_id = ?;',
      chordId,
    );
    return row ? toChordMastery(row) : null;
  }

  getChordIdsAtOrAboveLevel(level: number): string[] {
    return this.db
      .getAllSync<{ chord_id: string }>(
        'SELECT chord_id FROM chord_mastery WHERE level >= ?;',
        level,
      )
      .map((row) => row.chord_id);
  }

  updateChordMastery(chordId: string, state: ChordMastery): void {
    this.db.runSync(
      `INSERT INTO chord_mastery
         (chord_id, level, best_changes_per_minute, sessions_practised, last_practised_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(chord_id) DO UPDATE SET
         level = excluded.level,
         best_changes_per_minute = MAX(best_changes_per_minute, excluded.best_changes_per_minute),
         sessions_practised = excluded.sessions_practised,
         last_practised_at = excluded.last_practised_at;`,
      chordId,
      state.level,
      state.bestChangesPerMinute,
      state.sessionsPractised,
      state.lastPractisedAt,
    );
  }

  getSongMastery(songId: string): ChordMastery | null {
    const row = this.db.getFirstSync<{
      level: number;
      sessions_practised: number;
      last_practised_at: number | null;
    }>('SELECT level, sessions_practised, last_practised_at FROM song_progress WHERE song_id = ?;', songId);

    if (!row) return null;
    return {
      chordId: songId,
      level: row.level,
      bestChangesPerMinute: 0,
      sessionsPractised: row.sessions_practised,
      lastPractisedAt: row.last_practised_at,
    };
  }

  updateSongMastery(songId: string, state: ChordMastery): void {
    this.db.runSync(
      `INSERT INTO song_progress (song_id, level, sessions_practised, last_practised_at, attempts)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(song_id) DO UPDATE SET
         level = excluded.level,
         sessions_practised = excluded.sessions_practised,
         last_practised_at = excluded.last_practised_at,
         attempts = attempts + 1;`,
      songId,
      state.level,
      state.sessionsPractised,
      state.lastPractisedAt,
    );
  }

  saveDrillResult(result: StoredDrillResult): void {
    this.db.runSync(
      `INSERT INTO drill_results
         (id, created_at, chord_a, chord_b, changes, duration_ms, changes_per_minute)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      result.id,
      result.createdAt,
      result.chordA,
      result.chordB,
      result.changes,
      result.durationMs,
      result.changesPerMinute,
    );
  }

  listDrillResults(limit: number): StoredDrillResult[] {
    return this.db
      .getAllSync<DrillRow>(
        'SELECT * FROM drill_results ORDER BY created_at DESC LIMIT ?;',
        limit,
      )
      .map(toDrillResult);
  }

  bestChangesPerMinute(chordA: string, chordB: string): number {
    // The pair is unordered: drilling C to F is the same exercise as F to C.
    const row = this.db.getFirstSync<{ best: number | null }>(
      `SELECT MAX(changes_per_minute) AS best FROM drill_results
       WHERE (chord_a = ? AND chord_b = ?) OR (chord_a = ? AND chord_b = ?);`,
      chordA,
      chordB,
      chordB,
      chordA,
    );
    return row?.best ?? 0;
  }

  listPracticeDays(limit: number): number[] {
    return this.db
      .getAllSync<{ started_at: number }>(
        'SELECT started_at FROM practice_sessions ORDER BY started_at DESC LIMIT ?;',
        limit,
      )
      .map((row) => row.started_at);
  }

  recordPracticeMinutes(at: number, minutes: number): void {
    this.db.runSync(
      'INSERT INTO practice_sessions (id, started_at, ended_at, active_ms) VALUES (?, ?, ?, ?);',
      `session-${at}-${Math.random().toString(36).slice(2, 8)}`,
      at,
      at + minutes * 60_000,
      Math.round(minutes * 60_000),
    );
  }

  practiceMinutesSince(since: number): { day: number; minutes: number }[] {
    const rows = this.db.getAllSync<{ started_at: number; active_ms: number }>(
      'SELECT started_at, active_ms FROM practice_sessions WHERE started_at >= ?;',
      since,
    );

    const byDay = new Map<number, number>();
    for (const row of rows) {
      const day = startOfDay(row.started_at);
      byDay.set(day, (byDay.get(day) ?? 0) + row.active_ms / 60_000);
    }

    return [...byDay.entries()]
      .map(([day, minutes]) => ({ day, minutes: Math.round(minutes) }))
      .sort((a, b) => a.day - b.day);
  }

  saveRecording(recording: StoredRecording): void {
    this.db.runSync(
      `INSERT INTO recordings
         (id, created_at, file_uri, duration_ms, song_id, pattern_id, bpm, tempo_pct, metrics, review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      recording.id,
      recording.createdAt,
      recording.fileUri,
      recording.durationMs,
      recording.songId,
      recording.patternId,
      recording.bpm,
      recording.tempoPct,
      recording.metrics,
      recording.review,
    );
  }

  listRecordings(limit: number): StoredRecording[] {
    return this.db
      .getAllSync<RecordingRow>(
        'SELECT * FROM recordings ORDER BY created_at DESC LIMIT ?;',
        limit,
      )
      .map(toStoredRecording);
  }

  deleteRecording(id: string): void {
    this.db.runSync('DELETE FROM recordings WHERE id = ?;', id);
  }
}

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

type DrillRow = {
  id: string;
  created_at: number;
  chord_a: string;
  chord_b: string;
  changes: number;
  duration_ms: number;
  changes_per_minute: number;
};

function toDrillResult(row: DrillRow): StoredDrillResult {
  return {
    id: row.id,
    createdAt: row.created_at,
    chordA: row.chord_a,
    chordB: row.chord_b,
    changes: row.changes,
    durationMs: row.duration_ms,
    changesPerMinute: row.changes_per_minute,
  };
}

type RecordingRow = {
  id: string;
  created_at: number;
  file_uri: string;
  duration_ms: number;
  song_id: string | null;
  pattern_id: string | null;
  bpm: number;
  tempo_pct: number;
  metrics: string;
  review: string;
};

function toStoredRecording(row: RecordingRow): StoredRecording {
  return {
    id: row.id,
    createdAt: row.created_at,
    fileUri: row.file_uri,
    durationMs: row.duration_ms,
    songId: row.song_id,
    patternId: row.pattern_id,
    bpm: row.bpm,
    tempoPct: row.tempo_pct,
    metrics: row.metrics,
    review: row.review,
  };
}

/**
 * A `?, ?, ?` list for an IN clause, or null when there is nothing to match.
 *
 * Null means "do not run the statement at all". An empty IN clause matches
 * nothing, which would make every prune delete the entire table — the exact
 * catastrophe this file is trying to avoid.
 */
function placeholders(values: readonly string[]): string | null {
  if (values.length === 0) return null;
  return values.map(() => '?').join(', ');
}
