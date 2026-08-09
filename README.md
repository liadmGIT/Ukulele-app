# אוקולילי · Ukulele Learning App

An offline-first, Hebrew-default (RTL) mobile app for learning ukulele from scratch.

- **Chord library** — ~50 chords for standard re-entrant high-G **GCEA** tuning, with SVG diagrams.
- **Rhythm guide** — every song carries a strum pattern encoding direction (down/up), rests,
  muted "chnk" strokes, and accent (strong/normal/soft).
- **Listen & review** — records you playing, then reviews your **timing** and **dynamics** against
  the metronome grid and tells you what to improve.
- **Songs** — a library of arrangements in Hebrew and English, with an auto-scrolling chord
  chart, the strum pattern playing underneath, and practice speeds from 50%.
- **Practice today** — one tap builds a ten-minute session from your weakest material: tune,
  chords, a chord-change drill, and a song to finish on.
- **Progress** — mastery levels 0–5 per chord and song, earned from measured performance at
  progressively higher tempos, and decaying if you stop playing.
- **Songs I can play now** — the library filters to songs using only chords you've mastered.

See [`docs/PLAN.md`](docs/PLAN.md) for the full design, architecture and milestones.

## Requirements

- Node 20+
- An iOS or Android device (or simulator)

## Getting started

```bash
npm install
npx expo run:ios      # or: npx expo run:android
```

> **This app does not run in Expo Go.** Real-time microphone PCM access requires native code
> (`react-native-audio-api`), so a development build is required. `expo run:*` creates one.

### Installing it to actually use

The command above builds in **debug**, which loads the JavaScript from a server on your computer:
the machine has to stay awake on the same network, and the app reconnects constantly. For an app
you can carry around, build in release instead:

```bash
npx expo run:ios --device --configuration Release
```

That bundles the JavaScript into the app. No computer, no network — everything here works in
airplane mode, because nothing in it talks to the internet. Signed with a free Apple ID the app
expires after seven days and the command has to be run again; a paid developer account extends
that to a year.

**Do not delete the app to reinstall it.** Mastery levels, practice streak and past reviews live
in on-device SQLite with no cloud copy, so deleting is the one action that loses them. Installing
over the top keeps everything.

### Web preview

`npx expo export --platform web` produces a browser build that is useful for iterating on layout
and chord diagrams without a device. It is a **preview only**: microphone features do not work,
and progress is held in memory rather than saved, because `expo-sqlite`'s synchronous API is
native-only. See `src/db/memoryDriver.ts`.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests (music theory, DSP, analysis) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run validate:content` | Validates every chord and song file against its schema and against music theory |
| `npm run gen:chords` | Regenerates `content/chords.json` from the curated fingerings |
| `npm run gen:songs` | Regenerates `content/songs.json` from the compact arrangements |

## Content policy

Song files contain chord progressions, structure, tempo and strum patterns only — **never full
lyrics**. See [`CONTENT.md`](CONTENT.md).
