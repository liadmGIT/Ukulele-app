# אוקולילי · Ukulele Learning App

An offline-first, Hebrew-default (RTL) mobile app for learning ukulele from scratch.

- **Chord library** — ~50 chords for standard re-entrant high-G **GCEA** tuning, with SVG diagrams.
- **Rhythm guide** — every song carries a strum pattern encoding direction (down/up), rests,
  muted "chnk" strokes, and accent (strong/normal/soft).
- **Listen & review** — records you playing, then reviews your **timing** and **dynamics** against
  the metronome grid and tells you what to improve.
- **Progress** — mastery levels 0–5 per chord and song, earned from measured performance.
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

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests (DSP, analysis, content validation) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run validate:content` | Validates every chord and song JSON file against its schema |

## Content policy

Song files contain chord progressions, structure, tempo and strum patterns only — **never full
lyrics**. See [`CONTENT.md`](CONTENT.md).
