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
lands on — not a line of the song.

**Cue words are only permitted on public-domain songs.** Two words per bar
across a whole song would accumulate into a meaningful portion of the lyric, so
anything still in copyright ships as chords and structure only, and the player
navigates it by section and bar number instead. Both rules are enforced by
`npm run validate:content` and by the schema in `src/content/schemas.ts`, not
left to the author to remember.

## Provenance

Every song file carries a `source` field naming where the arrangement came
from. Chord arrangements for a given song vary; we record which one we used.

## Song data

`content/songs.json` is **generated** — do not edit it by hand. Edit the compact
arrangements in `scripts/data/songs.ts` and run:

```bash
npm run gen:songs
```

Chord names are resolved against the shipped chord library, so a song can never
reference a chord the app cannot draw, and a bar whose beats do not add up to
the time signature fails the build rather than being silently padded — a
stretched bar would put the whole song out of step with the metronome from that
point on.

Every arrangement carries a `source`. These are the common, widely-taught simple
versions, not definitive transcriptions; arrangements of a song legitimately
vary. A wrong progression teaches a wrong song, and unlike a wrong chord diagram
the learner may never find out, so the library is weighted towards traditional
and public-domain material where the standard arrangement is unambiguous.

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
