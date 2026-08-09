import * as SQLite from 'expo-sqlite';

import type { Chord, StrumPatternData } from '@/content/schemas';

import { MIGRATIONS } from './migrations';
import type { ChordMastery, StorageDriver, StoredRecording } from './types';

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
      this.db.execSync(`BEGIN; ${sql} PRAGMA user_version = ${version + 1}; COMMIT;`);
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

  replaceChords(chords: readonly Chord[]): void {
    this.db.withTransactionSync(() => {
      this.db.runSync('DELETE FROM chords;');

      const statement = this.db.prepareSync(
        `INSERT INTO chords
           (id, name_en, name_he, root, quality, aliases, shapes, difficulty, category, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
    });
  }

  replaceStrumPatterns(patterns: readonly StrumPatternData[]): void {
    this.db.withTransactionSync(() => {
      this.db.runSync('DELETE FROM strum_patterns;');

      const statement = this.db.prepareSync(
        `INSERT INTO strum_patterns
           (id, name_en, name_he, beats_per_bar, beat_unit, subdivision, pattern, difficulty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
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
    });
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
