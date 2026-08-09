import { changesPerMinute, countChordChanges } from '../changes';
import { ChromaAnalyser, chromaSimilarity } from '../chroma';
import { pluckedString } from '../karplus';

import { DEFAULT_SAMPLE_RATE, silence } from './signals';
import { CHORD_VOICINGS, alternatingTake, steadyTake } from './takes';

const sampleRate = DEFAULT_SAMPLE_RATE;

function count(samples: Float32Array) {
  return countChordChanges(samples, { sampleRate });
}

/** Renders a chord as one simultaneous sound, for chroma tests. */
function chordSamples(name: keyof typeof CHORD_VOICINGS): Float32Array {
  const voicing = CHORD_VOICINGS[name];
  const buffer = new Float32Array(Math.round(0.5 * sampleRate));

  for (const frequency of voicing) {
    const note = pluckedString({
      frequency,
      sampleRate,
      durationSeconds: 0.5,
      amplitude: 0.5 / voicing.length,
    });
    for (let i = 0; i < buffer.length; i += 1) buffer[i]! += note[i]!;
  }

  return buffer;
}

describe('ChromaAnalyser', () => {
  const analyser = new ChromaAnalyser(sampleRate);

  it('puts a C major chord\'s energy on C, E and G', () => {
    const chroma = analyser.analyse(chordSamples('C'), 2000);
    const ranked = [...chroma.keys()].sort((a, b) => chroma[b]! - chroma[a]!);

    // Pitch classes: C = 0, E = 4, G = 7.
    expect(ranked.slice(0, 3).sort()).toEqual([0, 4, 7]);
  });

  it('is unit length, so comparisons ignore loudness', () => {
    const chroma = analyser.analyse(chordSamples('F'), 2000);
    const norm = Math.sqrt([...chroma].reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1, 4);
  });

  it('gives silence an empty profile rather than noise', () => {
    const chroma = analyser.analyse(silence(0.5), 0);
    expect([...chroma].every((value) => value === 0)).toBe(true);
  });
});

describe('chromaSimilarity', () => {
  const analyser = new ChromaAnalyser(sampleRate);

  it('rates the same chord as nearly identical', () => {
    const a = analyser.analyse(chordSamples('C'), 2000);
    const b = analyser.analyse(chordSamples('C'), 6000);
    expect(chromaSimilarity(a, b)).toBeGreaterThan(0.95);
  });

  it('rates different chords as clearly different', () => {
    const c = analyser.analyse(chordSamples('C'), 2000);
    const f = analyser.analyse(chordSamples('F'), 2000);
    expect(chromaSimilarity(c, f)).toBeLessThan(0.9);
  });

  it('separates chords that share two notes', () => {
    // C and Am share C and E. If the drill cannot tell these apart it cannot
    // count the single most common beginner chord change.
    const c = analyser.analyse(chordSamples('C'), 2000);
    const am = analyser.analyse(chordSamples('Am'), 2000);

    const similarity = chromaSimilarity(c, am);
    expect(similarity).toBeLessThan(0.95);
    expect(similarity).toBeGreaterThan(0.4);
  });
});

describe('countChordChanges', () => {
  it('counts every change when alternating on each strum', () => {
    const take = alternatingTake(12, 0.5, ['C', 'F']);
    const result = count(take.samples);

    // Twelve strums, eleven transitions, of which the first establishes the
    // reference chord — see the note in changes.ts.
    expect(result.onsets).toHaveLength(12);
    expect(result.changes).toBe(10);
  });

  it('counts nothing when the learner freezes on one chord', () => {
    // The failure the drill exists to catch: strumming happily without ever
    // changing. Counting strums would score this highly.
    const take = steadyTake(12, 0.5);
    const result = count(take.samples);

    expect(result.onsets).toHaveLength(12);
    expect(result.changes).toBe(0);
  });

  it('counts changes, not strums, when several strums share a chord', () => {
    // Four strums per chord across twelve strums: two changes.
    const take = alternatingTake(12, 0.4, ['C', 'F'], 4);
    const result = count(take.samples);

    expect(result.onsets).toHaveLength(12);
    expect(result.changes).toBe(2);
  });

  it('handles the C to Am change beginners actually practise', () => {
    // The hardest realistic pair: C and A minor share two of their three notes.
    const take = alternatingTake(10, 0.5, ['C', 'Am']);
    expect(count(take.samples).changes).toBe(8);
  });

  it('is indifferent to how hard the strums are', () => {
    // A soft strum of C followed by a hard strum of C is not a chord change.
    const quiet = steadyTake(8, 0.5, 0.3, { amplitude: 0.2 });
    const loud = steadyTake(8, 0.5, 0.3, { amplitude: 0.9 });

    expect(count(quiet.samples).changes).toBe(0);
    expect(count(loud.samples).changes).toBe(0);
  });

  it('reports a similarity for every strum', () => {
    const result = count(alternatingTake(6, 0.5).samples);
    expect(result.similarities).toHaveLength(result.onsets.length);
    expect(result.similarities[0]).toBe(1);
  });

  it('finds nothing in silence', () => {
    const result = count(silence(3));
    expect(result.changes).toBe(0);
    expect(result.onsets).toHaveLength(0);
  });
});

describe('changesPerMinute', () => {
  it('scales to a minute', () => {
    expect(changesPerMinute(30, 60)).toBe(30);
    expect(changesPerMinute(15, 30)).toBe(30);
    expect(changesPerMinute(10, 20)).toBe(30);
  });

  it('handles a zero-length drill', () => {
    expect(changesPerMinute(5, 0)).toBe(0);
  });
});
