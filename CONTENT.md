# Content policy

## What song files contain

Song files in `content/songs/` describe **how to play** a song:

- chord progression and song structure (intro / verse / chorus / bridge / outro)
- key, tempo, time signature
- the strum pattern for each section
- at most **two cue words** per measure, marking where a chord change lands

## What they never contain

- **Full or substantial lyrics.** Lyrics are a separate copyrighted work from
  the composition, and reproducing them requires a licence.
- Sheet music, tablature transcriptions, or audio of the original recording.

The `cueWord` field exists so a learner can follow along without the app
shipping a lyric sheet. It is a single word or two — the syllable the chord
lands on — not a line of the song. `npm run validate:content` enforces the
limit.

## Provenance

Every song file carries a `source` field naming where the arrangement came
from. Chord arrangements for a given song vary; we record which one we used.

## Chord data

`content/chords.json` is **generated** — do not edit it by hand. Edit the
curated fingerings in `scripts/data/chord-shapes.ts` and run:

```bash
npm run gen:chords
```

Every fingering is checked against its chord spelling before it is written. A
shape that sounds a note outside the chord, or drops a note the chord cannot do
without, fails the build. This matters more than it might seem: a beginner has
no way to tell that a diagram is wrong, and will simply learn the wrong shape.
