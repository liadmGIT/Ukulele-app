import { STANDARD_TUNING, midiToFrequency } from '../notes';
import { IN_TUNE_CENTS, analyseTuning, nearestOpenString } from '../tuner';

describe('analyseTuning', () => {
  it('calls a perfectly tuned open string in tune', () => {
    for (const string of STANDARD_TUNING) {
      const reading = analyseTuning(midiToFrequency(string.midi));

      expect(reading.string?.name).toBe(string.name);
      expect(reading.noteName).toBe(string.name);
      expect(reading.inTune).toBe(true);
      expect(reading.direction).toBe('in-tune');
      expect(Math.abs(reading.cents)).toBeLessThan(0.001);
    }
  });

  it('says flat when the string is under pitch', () => {
    const flat = 440 * 2 ** (-20 / 1200);
    const reading = analyseTuning(flat);

    expect(reading.direction).toBe('flat');
    expect(reading.cents).toBeCloseTo(-20, 3);
    expect(reading.inTune).toBe(false);
    expect(reading.string?.name).toBe('A');
  });

  it('says sharp when the string is over pitch', () => {
    const sharp = 440 * 2 ** (30 / 1200);
    const reading = analyseTuning(sharp);

    expect(reading.direction).toBe('sharp');
    expect(reading.cents).toBeCloseTo(30, 3);
    expect(reading.inTune).toBe(false);
  });

  it('treats the tolerance boundary consistently', () => {
    const justInside = 440 * 2 ** ((IN_TUNE_CENTS - 0.5) / 1200);
    const justOutside = 440 * 2 ** ((IN_TUNE_CENTS + 0.5) / 1200);

    expect(analyseTuning(justInside).inTune).toBe(true);
    expect(analyseTuning(justOutside).inTune).toBe(false);
  });

  it('identifies the octave', () => {
    expect(analyseTuning(midiToFrequency(69)).octave).toBe(4); // A4
    expect(analyseTuning(midiToFrequency(60)).octave).toBe(4); // C4
    expect(analyseTuning(midiToFrequency(81)).octave).toBe(5); // A5
  });

  it('reads against the target string, not the nearest chromatic note', () => {
    // F4 — exactly a semitone sharp of the open E string. Measured against the
    // nearest chromatic note this sits at 0 cents and would misleadingly read
    // "in tune"; measured against the string it is 100 cents sharp, which is
    // what the learner needs to know.
    const reading = analyseTuning(midiToFrequency(65));

    expect(reading.noteName).toBe('F');
    expect(reading.cents).toBeCloseTo(0, 6);
    expect(reading.string?.name).toBe('E');
    expect(reading.centsFromString).toBeCloseTo(100, 3);
    expect(reading.direction).toBe('sharp');
    expect(reading.inTune).toBe(false);
  });

  it('falls back to the chromatic note when no string is in range', () => {
    const reading = analyseTuning(3000);
    expect(reading.string).toBeNull();
    expect(reading.centsFromString).toBeNull();
    expect(reading.inTune).toBe(false);
  });

  it('never reports a wildly out-of-range note as being on a string', () => {
    expect(analyseTuning(80).string).toBeNull();
    expect(analyseTuning(3000).string).toBeNull();
  });
});

describe('nearestOpenString', () => {
  it('picks each string from its own pitch', () => {
    for (const string of STANDARD_TUNING) {
      expect(nearestOpenString(midiToFrequency(string.midi))?.name).toBe(string.name);
    }
  });

  it('compares in cents, not hertz', () => {
    // Between C4 (261.6) and E4 (329.6) the two midpoints differ: 293.7 Hz in
    // cents, 295.6 Hz in plain hertz. 294.5 falls between them, so a hertz
    // comparison picks C while the musically correct answer is E.
    expect(nearestOpenString(294.5)?.name).toBe('E');
  });

  it('distinguishes the re-entrant G from the A string', () => {
    // High-G sits between E4 and A4, which a low-G assumption would get wrong.
    expect(nearestOpenString(midiToFrequency(67))?.name).toBe('G');
    expect(nearestOpenString(midiToFrequency(69))?.name).toBe('A');
  });

  it('still names a string for a badly slack string', () => {
    // A whole tone flat of C is the worst case inside the open range, and is
    // precisely when a beginner needs to be told which peg to turn.
    const wholeToneFlatOfC = midiToFrequency(58);
    expect(nearestOpenString(wholeToneFlatOfC)?.name).toBe('C');
  });

  it('gives up rather than guessing when nothing is close', () => {
    expect(nearestOpenString(100)).toBeNull();
    expect(nearestOpenString(3000)).toBeNull();
  });
});
