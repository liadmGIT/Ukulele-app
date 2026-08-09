/**
 * Schema migrations, applied in order and tracked with SQLite's `user_version`
 * pragma. Never edit a migration that has shipped — append a new one instead.
 *
 * Content tables (chords, strum_patterns, songs*) are derived from the JSON in
 * `content/` and are rebuilt whenever the bundled content version changes. User
 * tables are never rebuilt; they are the only thing that cannot be regenerated.
 */

export const MIGRATIONS: readonly string[] = [
  // 1 — initial schema
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  ---------------------------------------------------------------- content ----

  CREATE TABLE chords (
    id           TEXT PRIMARY KEY NOT NULL,
    name_en      TEXT NOT NULL,
    name_he      TEXT NOT NULL,
    root         TEXT NOT NULL,
    quality      TEXT NOT NULL,
    aliases      TEXT NOT NULL DEFAULT '[]',  -- JSON array of alternate names
    shapes       TEXT NOT NULL,               -- JSON array of ChordShape
    difficulty   INTEGER NOT NULL,            -- 1..5
    category     TEXT NOT NULL,               -- open | barre | extended
    sort_order   INTEGER NOT NULL
  );

  CREATE TABLE strum_patterns (
    id             TEXT PRIMARY KEY NOT NULL,
    name_en        TEXT NOT NULL,
    name_he        TEXT NOT NULL,
    beats_per_bar  INTEGER NOT NULL,
    beat_unit      INTEGER NOT NULL,
    subdivision    INTEGER NOT NULL,          -- 4 | 8 | 16
    pattern        TEXT NOT NULL,             -- compact notation, e.g. "D! - D u X u D! u"
    difficulty     INTEGER NOT NULL
  );

  CREATE TABLE songs (
    id                 TEXT PRIMARY KEY NOT NULL,
    title_he           TEXT NOT NULL,
    title_en           TEXT NOT NULL,
    artist             TEXT NOT NULL,
    language           TEXT NOT NULL,         -- he | en
    song_key           TEXT NOT NULL,
    bpm                INTEGER NOT NULL,
    beats_per_bar      INTEGER NOT NULL,
    beat_unit          INTEGER NOT NULL,
    difficulty         INTEGER NOT NULL,
    default_pattern_id TEXT NOT NULL REFERENCES strum_patterns(id),
    chord_count        INTEGER NOT NULL,      -- denormalised: distinct chords used
    source             TEXT
  );

  -- Which chords a song needs. Denormalised on purpose: it is what powers the
  -- "songs I can play right now" query, which must stay a single fast join.
  CREATE TABLE song_chords (
    song_id  TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    chord_id TEXT NOT NULL REFERENCES chords(id),
    PRIMARY KEY (song_id, chord_id)
  );

  -- Sections and measures are reserved. The chart itself is read from the
  -- bundled JSON, which is where it can be validated at build time; these
  -- tables exist for a future feature that needs to query inside a song.
  CREATE TABLE song_sections (
    id         TEXT PRIMARY KEY NOT NULL,
    song_id    TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,                 -- intro | verse | chorus | bridge | outro
    label_he   TEXT NOT NULL,
    label_en   TEXT NOT NULL,
    pattern_id TEXT REFERENCES strum_patterns(id),
    position   INTEGER NOT NULL
  );

  CREATE TABLE song_measures (
    id         TEXT PRIMARY KEY NOT NULL,
    section_id TEXT NOT NULL REFERENCES song_sections(id) ON DELETE CASCADE,
    position   INTEGER NOT NULL,
    chord_id   TEXT REFERENCES chords(id),    -- NULL = continue previous chord
    beats      INTEGER NOT NULL,
    cue_word   TEXT                           -- at most two words; never full lyrics
  );

  ------------------------------------------------------------- user data ----

  CREATE TABLE chord_mastery (
    chord_id                TEXT PRIMARY KEY NOT NULL REFERENCES chords(id),
    level                   INTEGER NOT NULL DEFAULT 0,   -- 0..5
    best_changes_per_minute INTEGER NOT NULL DEFAULT 0,
    sessions_practised      INTEGER NOT NULL DEFAULT 0,
    last_practised_at       INTEGER
  );

  CREATE TABLE song_progress (
    song_id            TEXT PRIMARY KEY NOT NULL REFERENCES songs(id),
    level              INTEGER NOT NULL DEFAULT 0,
    best_tempo_pct     INTEGER NOT NULL DEFAULT 0,
    best_timing_score  REAL NOT NULL DEFAULT 0,
    attempts           INTEGER NOT NULL DEFAULT 0,
    sessions_practised INTEGER NOT NULL DEFAULT 0,
    last_practised_at  INTEGER
  );

  CREATE TABLE practice_sessions (
    id            TEXT PRIMARY KEY NOT NULL,
    started_at    INTEGER NOT NULL,
    ended_at      INTEGER,
    active_ms     INTEGER NOT NULL DEFAULT 0,
    plan          TEXT NOT NULL DEFAULT '[]'  -- JSON: the generated session plan
  );

  CREATE TABLE recordings (
    id            TEXT PRIMARY KEY NOT NULL,
    session_id    TEXT REFERENCES practice_sessions(id) ON DELETE SET NULL,
    created_at    INTEGER NOT NULL,
    file_uri      TEXT NOT NULL,
    duration_ms   INTEGER NOT NULL,
    song_id       TEXT REFERENCES songs(id),
    pattern_id    TEXT REFERENCES strum_patterns(id),
    bpm           INTEGER NOT NULL,
    tempo_pct     INTEGER NOT NULL,
    metrics       TEXT NOT NULL,              -- JSON: PerformanceMetrics
    review        TEXT NOT NULL               -- JSON: generated review notes
  );

  CREATE TABLE drill_results (
    id                 TEXT PRIMARY KEY NOT NULL,
    session_id         TEXT REFERENCES practice_sessions(id) ON DELETE SET NULL,
    created_at         INTEGER NOT NULL,
    chord_a            TEXT NOT NULL REFERENCES chords(id),
    chord_b            TEXT NOT NULL REFERENCES chords(id),
    changes            INTEGER NOT NULL,
    duration_ms        INTEGER NOT NULL,
    changes_per_minute INTEGER NOT NULL
  );

  CREATE INDEX idx_song_chords_chord   ON song_chords(chord_id);
  CREATE INDEX idx_sections_song       ON song_sections(song_id, position);
  CREATE INDEX idx_measures_section    ON song_measures(section_id, position);
  CREATE INDEX idx_recordings_created  ON recordings(created_at DESC);
  CREATE INDEX idx_drill_created       ON drill_results(created_at DESC);
  CREATE INDEX idx_sessions_started    ON practice_sessions(started_at DESC);
  `,
];
