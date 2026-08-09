import { STANDARD_TUNING, midiToFrequency } from '../notes';
import {
  DEFAULT_STRUM_SPREAD_SECONDS,
  shapeMidiNotes,
  strumDurationSeconds,
  strumNotes,
} from '../voicing';

const C_MAJOR = [0, 0, 0, 3];
const A_MINOR = [2, 0, 0, 0];

describe('strumNotes', () => {
  it('strikes the strings in physical order on a down-stroke', () => {
    expect(strumNotes(C_MAJOR, 'D').map((note) => note.stringIndex)).toEqual([0, 1, 2, 3]);
  });

  it('reverses the order on an up-stroke', () => {
    expect(strumNotes(C_MAJOR, 'U').map((note) => note.stringIndex)).toEqual([3, 2, 1, 0]);
  });

  it('does not ascend in pitch on a down-stroke', () => {
    // The re-entrant high-G fact, asserted rather than assumed: the G string is
    // pitched above C and E, so a down-stroke is not a pitch sweep. Every
    // attempt to infer strum direction from audio founders on exactly this.
    const midis = strumNotes(C_MAJOR, 'D').map((note) => note.midi);
    const ascending = [...midis].sort((a, b) => a - b);

    expect(midis).not.toEqual(ascending);
    expect(midis[0]).toBeGreaterThan(midis[1]!);
  });

  it('spaces the strings evenly through the stroke', () => {
    const notes = strumNotes(C_MAJOR, 'D');
    notes.forEach((note, index) => {
      expect(note.offsetSeconds).toBeCloseTo(index * DEFAULT_STRUM_SPREAD_SECONDS, 10);
    });
  });

  it('honours a custom spread', () => {
    const fast = strumNotes(C_MAJOR, 'D', 0.004);
    expect(fast[3]!.offsetSeconds).toBeCloseTo(0.012, 10);
  });

  it('sounds the right pitches for a C major shape', () => {
    const midis = strumNotes(C_MAJOR, 'D').map((note) => note.midi);
    // G4, C4, E4, and the A string stopped at the 3rd fret = C5.
    expect(midis).toEqual([67, 60, 64, 72]);
  });

  it('sounds the right pitches for A minor', () => {
    expect(strumNotes(A_MINOR, 'D').map((note) => note.midi)).toEqual([69, 60, 64, 69]);
  });

  it('reports a frequency matching each midi note', () => {
    for (const note of strumNotes(C_MAJOR, 'D')) {
      expect(note.frequency).toBeCloseTo(midiToFrequency(note.midi), 6);
    }
  });

  it('skips muted strings entirely', () => {
    const notes = strumNotes([-1, 0, 0, 3], 'D');
    expect(notes).toHaveLength(3);
    expect(notes.map((note) => note.stringIndex)).toEqual([1, 2, 3]);
    // The remaining strings close up, rather than leaving a silent gap.
    expect(notes[0]!.offsetSeconds).toBe(0);
  });

  it('covers every string of an open shape', () => {
    expect(strumNotes([0, 0, 0, 0], 'D')).toHaveLength(STANDARD_TUNING.length);
  });
});

describe('shapeMidiNotes', () => {
  it('lists distinct pitches low to high', () => {
    expect(shapeMidiNotes(C_MAJOR)).toEqual([60, 64, 67, 72]);
  });

  it('collapses a doubled pitch', () => {
    // A minor sounds A4 on both the G string (2nd fret) and the open A string.
    expect(shapeMidiNotes(A_MINOR)).toEqual([60, 64, 69]);
  });

  it('ignores muted strings', () => {
    expect(shapeMidiNotes([-1, 0, 0, 3])).toEqual([60, 64, 72]);
  });
});

describe('strumDurationSeconds', () => {
  it('measures from the first string to the last', () => {
    expect(strumDurationSeconds(C_MAJOR)).toBeCloseTo(3 * DEFAULT_STRUM_SPREAD_SECONDS, 10);
  });

  it('is zero when only one string sounds', () => {
    expect(strumDurationSeconds([-1, -1, -1, 0])).toBe(0);
  });
});
