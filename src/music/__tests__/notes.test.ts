import {
  centsFromNearestNote,
  frequencyToMidi,
  frettedMidi,
  midiToFrequency,
  parsePitchClass,
  spellNote,
  STANDARD_TUNING,
} from '../notes';

describe('pitch class parsing', () => {
  it.each([
    ['C', 0],
    ['C#', 1],
    ['Db', 1],
    ['E', 4],
    ['F', 5],
    ['Gb', 6],
    ['A#', 10],
    ['Bb', 10],
    ['B', 11],
  ])('parses %s', (name, expected) => {
    expect(parsePitchClass(name)).toBe(expected);
  });

  it('rejects nonsense', () => {
    expect(() => parsePitchClass('H')).toThrow();
    expect(() => parsePitchClass('')).toThrow();
  });
});

describe('standard tuning', () => {
  it('is re-entrant: the G string is pitched above C and E', () => {
    const [g, c, e, a] = STANDARD_TUNING;
    expect(g!.midi).toBeGreaterThan(c!.midi);
    expect(g!.midi).toBeGreaterThan(e!.midi);
    expect(g!.midi).toBeLessThan(a!.midi);
  });

  it('sounds the documented frequencies for open strings', () => {
    expect(midiToFrequency(STANDARD_TUNING[3]!.midi)).toBeCloseTo(440, 5);
    expect(midiToFrequency(STANDARD_TUNING[1]!.midi)).toBeCloseTo(261.63, 1);
  });

  it('raises pitch by one semitone per fret', () => {
    expect(frettedMidi(1, 0)).toBe(60);
    expect(frettedMidi(1, 3)).toBe(63);
    expect(frettedMidi(0, 2)).toBe(69);
  });
});

describe('frequency conversion', () => {
  it('round-trips midi to frequency and back', () => {
    for (let midi = 55; midi <= 88; midi += 1) {
      expect(frequencyToMidi(midiToFrequency(midi))).toBeCloseTo(midi, 6);
    }
  });

  it('reports how sharp or flat a frequency is', () => {
    expect(centsFromNearestNote(440).cents).toBeCloseTo(0, 6);

    const sharp = centsFromNearestNote(440 * 2 ** (10 / 1200));
    expect(sharp.midi).toBe(69);
    expect(sharp.cents).toBeCloseTo(10, 4);

    const flat = centsFromNearestNote(440 * 2 ** (-15 / 1200));
    expect(flat.midi).toBe(69);
    expect(flat.cents).toBeCloseTo(-15, 4);
  });
});

describe('note spelling', () => {
  it('spells the seventh on the seventh letter, not the easier enharmonic', () => {
    // Em7b5's seventh is D; its flat fifth must read Bb, never A#.
    expect(spellNote('E', 4, 10)).toBe('Bb');
  });

  it('keeps flat roots in flats', () => {
    // Eb minor seventh: the third is 2 letters up (G), the fifth 4 (B).
    expect(spellNote('Eb', 2, 6)).toBe('Gb');
    expect(spellNote('Eb', 4, 10)).toBe('Bb');
  });

  it('uses a sharp when the letter demands it', () => {
    expect(spellNote('A', 4, 5)).toBe('E#'); // the fifth of A augmented
    expect(spellNote('F#', 2, 10)).toBe('A#');
  });
});
