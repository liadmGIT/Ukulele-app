# Ukulele Learning App — Implementation Plan

## Context

`liadmgit/ukulele-app` is an empty repository (fresh clone, zero commits) on branch
`claude/ukulele-learning-app-plan-n7sx7c`. This plan is the greenfield design for the whole app.

**The need:** a complete beginner wants to learn ukulele from scratch and stay motivated. The three
things that make beginners quit are (a) not knowing what to practice today, (b) not being able to
tell whether they are actually improving, and (c) staring at a song list full of songs they can't
play yet. This app attacks all three: a guided daily session, measured mastery from real recorded
performance, and a song library that filters itself to what you can play right now.

**Outcome:** an offline-first bilingual (Hebrew-default, RTL) mobile app that teaches chords, plays
a precise rhythm/strumming guide for each song, listens to you play, and gives you a written review
of your timing and dynamics — with progress you can watch climb over weeks.

## Decisions locked with the user

| Decision | Choice |
|---|---|
| Platform | Expo / React Native (iOS + Android), TypeScript |
| Song content | Chords + rhythm + structure only. **No full lyrics** (copyright) — short cue words only |
| Audio | Hybrid: on-device DSP live + deeper on-device analysis after the take |
| MVP | Thin vertical slice of everything |
| Graded feedback | **Rhythm/timing** and **dynamics (strong vs soft)** are the scored dimensions |
| Language | Bilingual, Hebrew default, full RTL, English toggle |
| Progress | Skill mastery (0–5) from measured performance + practice stats |
| Data | Local-only (SQLite), designed so sync can be added later |
| Routine | Guided daily session ("Practice today" → one tap) |
| Also in v1 | "Songs I can play now" filter, tuner + metronome, chord-change speed drill, auto-scrolling song player |
| Instrument | Standard soprano/concert, re-entrant high-G **GCEA** only |

## Architecture

### Stack

- **Expo SDK 54+**, New Architecture, TypeScript strict, `expo-router` (file-based routes).
- **Audio: `react-native-audio-api`** (Software Mansion). This is the load-bearing choice. It is a
  Web Audio API implementation for React Native and gives us, in one library:
  - `AudioRecorder` → real-time raw PCM Float32 frames from the mic (required for our DSP; the
    standard `expo-audio` only gives finished files, which cannot do live feedback).
  - `AnalyserNode` → FFT for the tuner and live visualisation.
  - `AudioContext` with sample-accurate scheduling → a metronome that does not drift, which is the
    foundation of every timing measurement in the app.
  - An official Expo config plugin (`iosMicrophonePermission`, Android `RECORD_AUDIO`).
  - **Constraint:** contains native code, so it does not run in Expo Go. We use an Expo **dev
    build** (`npx expo run:ios` / `run:android`) from day one. Worth knowing up front.
- **DB: `expo-sqlite` + Drizzle ORM** — typed schema, real migrations, and a clean seam to add a
  server-sync layer later without a rewrite.
- **State:** Zustand for session/player state; DB is the source of truth for everything persisted.
- **i18n:** `i18next` + `react-i18next`, `expo-localization`, RTL via `I18nManager`.
- **Rendering:** `react-native-svg` for chord diagrams, fretboard, rhythm strip and charts;
  `react-native-reanimated` for the auto-scroll and beat animations (runs on the UI thread, so
  scrolling stays locked to the metronome even when JS is busy doing DSP).

### Repo layout

```
app/                      # expo-router screens
  (tabs)/index.tsx        #   Today — guided session
  (tabs)/chords/          #   library, [id] detail, trainer, change-drill
  (tabs)/songs/           #   library, [id] player
  (tabs)/practice/        #   tuner, metronome, drills
  (tabs)/progress/        #   mastery, stats, recording history
  settings/
src/
  audio/                  # capture, metronome, tuner, synth
  dsp/                    # onset, envelope, chroma, pitch — pure TS, unit-testable
  analysis/               # scoring, review generation
  db/                     # drizzle schema, migrations, queries
  content/                # zod schemas + loaders for chord/song JSON
  i18n/                   # he.json, en.json
  ui/                     # design system, ChordDiagram, RhythmStrip, charts
content/
  chords.json
  songs/*.json
scripts/                  # validate-content.ts, gen-chords.ts, make-test-audio.ts
```

Keeping `src/dsp` and `src/analysis` as **pure TypeScript functions over `Float32Array`** (no React,
no native calls) is deliberate: it is what makes the risky audio work testable on CI with synthetic
signals instead of only by ear on a device.

## The rhythm guide (core feature)

Every strum pattern is a sequence of steps on a fixed subdivision (usually 8ths). Each step encodes
exactly what was asked for — direction, silence, mute, and force:

```ts
type StrumStep = {
  dir:    'D' | 'U' | 'rest';   // down, up, or don't strum
  muted:  boolean;              // true = percussive "chnk" (damped), false = let it ring
  accent: 'strong' | 'normal' | 'soft';
};
type StrumPattern = {
  id: string; nameHe: string; nameEn: string;
  timeSignature: [number, number];
  subdivision: 4 | 8 | 16;
  steps: StrumStep[];
  difficulty: 1 | 2 | 3 | 4 | 5;
};
```

Authored compactly as a string and expanded by a parser (`src/content/strum.ts`):

`D! - D u X u D! u` → strong down, rest, down, soft up, muted chunk, soft up, strong down, soft up

- `D`/`U` down/up · lowercase = soft · `!` = strong · `X` = muted/chunk · `-` = rest (silent)

**Rendering (`ui/RhythmStrip`):** arrows down/up, hollow arrow for soft, filled+bold for strong, an
`✕` glyph for muted, a gap for rests, with the beat numbers `1 & 2 & 3 & 4 &` underneath and a
playhead that moves with the metronome. **Audible:** the pattern can be played back over a synth
chord so you hear the groove before you attempt it. **Practice speed:** a tempo slider (50–100% of
the song's BPM) that gates mastery — you must play it clean at full tempo to reach level 5.

## The listening & review engine

This is the highest-risk part, so the design deliberately avoids the hard version of the problem.

**Key insight: we don't have to guess the beat.** The app drives the metronome, so the expected
grid — BPM, count-in, and the exact expected step times — is known exactly. Blind beat-tracking of a
learner's shaky playing is a research problem; measuring deviation against a known grid is not.

**Pipeline** (`src/dsp` → `src/analysis`):

1. **Capture** — `AudioRecorder` → Float32 frames @44.1kHz, hop 512.
2. **Preprocess** — high-pass ~80Hz (removes handling rumble), RMS envelope.
3. **Onset detection** — STFT (2048/512) → **spectral flux** with an adaptive median threshold and
   peak-picking → onset times in ms. Strums are broadband transients, which is the easy case for
   spectral flux.
4. **Grid alignment** — match each onset to its nearest expected step; classify as hit / missed /
   extra. Produces a signed deviation in ms per strum.
5. **Timing metrics** — mean |deviation|, % inside tolerance (±50ms beginner → ±25ms advanced),
   deviation standard deviation (steadiness), and a **linear regression of deviation over time** to
   detect rushing vs dragging, plus whether it worsens in a specific section.
6. **Dynamics metrics** — peak RMS in a 60ms window per onset, normalised to the take's max →
   correlate the measured accent curve against the pattern's intended accent map. Catches the
   classic beginner failure of hitting every strum identically ("accent contrast" ratio).
7. **Review generation** (`analysis/review.ts`) — a **rule-based, bilingual, offline** template
   engine ranking findings by severity and emitting at most 3 actionable notes plus one genuine
   positive. Deterministic, free, no network, no per-session cost. Example output:
   *"טוב מאוד בשמונה התיבות הראשונות. אחר כך התחלת למהר — בממוצע 40 מ״ש לפני הביט. נסה לספור 1‑2‑3‑4 בקול."*
   Every rule is a pure function of the metrics, so reviews are unit-testable.

**Live feedback while playing** uses the cheap half of the pipeline only (envelope + onset) so it
runs comfortably in real time; the full analysis runs on the buffered take when you stop.

**Supporting capability — chord verification (P1):** the chord trainer needs to know whether you
played C or Am, so we compute a **chroma vector** over the sustain window and cosine-match it
against templates for the four GCEA voicings. Used for pass/fail in the trainer and for a "that
sounded like a different chord" flag in songs — but per your choice it is **not** a scored review
dimension.

**Strum direction detection — deliberately not graded (P3 / experimental).** Honest reasoning: the
usual trick is inferring direction from the order the strings are struck, but this ukulele is
**re-entrant high-G**, where the 4th string (G4) is pitched *above* the C4 and E4 strings. So the
physical strum order is not monotonic in pitch and the standard heuristic breaks. Direction is
**shown** in the rhythm guide (it's how you learn the pattern) but the app will not tell you that
you strummed up when you strummed down, because it cannot honestly know. A spectral-brightness
experiment is parked in the backlog behind a feature flag.

## Data model (Drizzle / SQLite)

**Content (read-only, shipped as JSON, loaded into SQLite on first run):**
- `chords` — id, nameEn (`C`, `Am`, `F#m7`), nameHe, root, quality, aliases, `shapes[]` (fret + finger
  per GCEA string, barre spans), difficulty, category. ~50 chords: all open majors/minors/7ths, plus
  m7/maj7/sus2/sus4/dim/aug and the common barre shapes.
- `strum_patterns` — as above, ~15 patterns from "all downs" to island strum / calypso / 16th funk.
- `songs` — id, titleHe, titleEn, artist, language, key, bpm, timeSignature, difficulty,
  `chordIds[]`, `defaultPatternId`, `sections[]`.
- `sections` → `measures` → `{ chordId, beats, cueWord? }`. `cueWord` is a **single word or two**
  marking where the chord lands. This is what makes the player followable without shipping lyrics.

**User data (writable):**
- `chord_mastery` — chordId, level 0–5, cleanChangeRate, bestChangesPerMinute, lastPracticedAt,
  decayed by time since last practice so mastery reflects current ability.
- `song_progress` — songId, level 0–5, bestTempoPct, bestTimingScore, attempts.
- `sessions` — start/end, minutes, items practised, XP-free (mastery is the metric).
- `recordings` — file uri, songId/exerciseId, tempo, all computed metrics JSON, generated review.
  Kept so you can replay a take from three weeks ago and hear the difference.
- `drill_results` — chord pair, changes-per-minute, timestamp (personal-best charting).

**Mastery rule (`analysis/mastery.ts`):** a level is earned by hitting score thresholds at
progressively higher tempo percentages across *multiple separate sessions* — never from one lucky
take, and never from mere attendance.

## Content pipeline & legal posture

- `scripts/gen-chords.ts` derives chord shapes from music theory and validates that every shipped
  voicing actually spells its chord — prevents the classic wrong-diagram bug.
- `scripts/validate-content.ts` runs zod schemas over every song JSON in CI: chord ids exist,
  measures sum to the time signature, BPM sane, both titles present.
- `CONTENT.md` records the policy: chord progressions, structure, tempo and strum patterns only;
  **no lyric bodies**; cue words capped at two words per measure. Song files carry a `source` field
  for provenance.
- v1 target ~50 songs, roughly half Hebrew / half English, sorted so the first 15 need ≤4 chords.

## Milestones

Each milestone ends with something runnable on your phone.

- **M0 — Foundations.** Expo dev build, TS strict, expo-router tabs, SQLite + Drizzle + migrations,
  i18n with Hebrew RTL default, design system. *Done when:* the app opens on-device in Hebrew RTL.
- **M1 — Chords.** `content/chords.json` (~50), SVG `ChordDiagram`, library with search/filter,
  chord detail with a synth playback. *Done when:* you can browse every chord and hear it.
- **M2 — Audio foundation.** Mic capture, `AnalyserNode` tuner (GCEA, cents needle), sample-accurate
  metronome with count-in. *Done when:* the tuner agrees with a reference tuner and the metronome
  holds tempo over 3 minutes.
- **M3 — Rhythm guide.** Strum pattern model + parser, `RhythmStrip`, audible pattern playback,
  tempo slider. *Done when:* a pattern renders and plays correctly with a moving playhead.
- **M4 — Listening & review (the hard one).** Onset detection, grid alignment, timing + dynamics
  metrics, bilingual review generator, recording storage, playback of past takes. *Done when:*
  synthetic-audio tests pass **and** a real take produces a review you agree with.
- **M5 — Songs.** Song schema + ~50 song files, song player (auto-scroll, chord highlight, rhythm
  strip, record → review), "songs I can play now" filter with "learn G to unlock 12 more".
- **M6 — Progress & routine.** Mastery model, progress dashboard (mastery grid, practice-minutes
  chart, personal bests), chord-change speed drill with auto-counting, and the "Practice today"
  session builder that assembles warm-up → weakest chords → drill → current song.

**Explicitly post-v1:** chord-accuracy scoring as a review dimension, strum-direction detection,
cloud sync/accounts, licensed lyrics, low-G / baritone / left-handed, LLM-polished reviews.

## Verification

**Automated (Jest/Vitest, runs in CI, no device needed):**
- `scripts/make-test-audio.ts` synthesises WAV fixtures with **known** onset times and amplitudes —
  click trains, a take deliberately 40ms ahead, one that accelerates, one with flat dynamics, one
  with a missed strum. DSP tests assert detected onsets land within a few ms of ground truth and
  that the metrics come out with the expected sign and magnitude. This is what makes the audio work
  provable rather than vibes.
- Review-generator golden tests: metric fixtures → exact expected Hebrew/English review text.
- Mastery tests: a level cannot be reached from a single session or at reduced tempo.
- Content validation over all chord and song JSON.
- `tsc --noEmit` + ESLint.

**Manual on-device checklist (each milestone):**
1. `npx expo run:ios` (or `run:android`) — dev build installs, mic permission prompts.
2. Tuner: play each open string, needle centres; compare against any reference tuner.
3. Metronome at 80 BPM for 3 min against a stopwatch — no audible drift.
4. Play a known pattern deliberately early, then deliberately late — the review must say "rushing"
   then "dragging". Play it flat, then with hard accents — the dynamics note must flip.
5. Verify RTL: Hebrew layout mirrors correctly, switching to English re-lays out and back.
6. Airplane mode: every feature still works.

## Risks

| Risk | Mitigation |
|---|---|
| Onset detection unreliable on a quiet/soft-strummed uke | Calibration step in settings (play 4 strums to set the noise floor + gain); adaptive threshold |
| DSP too slow in JS on older Android | DSP is pure functions over Float32Array — hot loops can move to a JSI/native module without touching callers |
| Mic latency offsets all timing measurements | One-time latency calibration (metronome click recorded through the mic, measure the round trip) stored in settings |
| Song content authoring is the real bulk of work | Schema + validator first, then bulk authoring; a song file is ~30 lines |
| RTL retrofit pain | Hebrew RTL is built in at M0, never retrofitted |
