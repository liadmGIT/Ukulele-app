import { getChords } from '@/content';

import {
  assignFingers,
  chordName,
  chordTones,
  shapeDifficulty,
  shapePitchClasses,
  validateShape,
  type ChordQuality,
} from '../chords';

describe('validateShape', () => {
  it('accepts correct fingerings', () => {
    expect(validateShape('C', 'maj', [0, 0, 0, 3]).valid).toBe(true);
    expect(validateShape('A', 'min', [2, 0, 0, 0]).valid).toBe(true);
    expect(validateShape('F', 'maj', [2, 0, 1, 0]).valid).toBe(true);
  });

  it('rejects a shape that sounds a note outside the chord', () => {
    // C major with the A string at fret 1 sounds Bb, which is not in C major.
    const result = validateShape('C', 'maj', [0, 0, 0, 1]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.extra).toContain('A#');
    }
  });

  it('rejects a triad that is missing its third', () => {
    const result = validateShape('C', 'maj', [0, 0, 3, 3]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.missing).toContain('E');
    }
  });

  it('allows a seventh chord to drop its fifth but not its seventh', () => {
    // F7 as played: F, A, Eb — no C. That is a legitimate voicing.
    expect(validateShape('F', 'dom7', [2, 3, 1, 0]).valid).toBe(true);
    // Plain F major cannot pass as F7, because the Eb is gone.
    expect(validateShape('F', 'dom7', [2, 0, 1, 0]).valid).toBe(false);
  });
});

describe('chordTones', () => {
  it.each<[string, ChordQuality, string[]]>([
    ['C', 'maj', ['C', 'E', 'G']],
    ['A', 'min', ['A', 'C', 'E']],
    ['G', 'dom7', ['G', 'B', 'D', 'F']],
    ['E', 'min7b5', ['E', 'G', 'Bb', 'D']],
    ['C', 'dim7', ['C', 'Eb', 'Gb', 'A']],
    ['A', 'aug', ['A', 'C#', 'E#']],
    ['Eb', 'min7', ['Eb', 'Gb', 'Bb', 'Db']],
    ['C', 'sus4', ['C', 'F', 'G']],
  ])('spells %s%s correctly', (root, quality, expected) => {
    expect(chordTones(root, quality)).toEqual(expected);
  });
});

describe('chordName', () => {
  it('appends the quality suffix', () => {
    expect(chordName('C', 'maj')).toBe('C');
    expect(chordName('A', 'min7')).toBe('Am7');
    expect(chordName('Bb', 'dom7')).toBe('Bb7');
  });
});

describe('assignFingers', () => {
  it('numbers fingers from the lowest fret upwards', () => {
    // G major: index on C string (fret 2), middle on A (fret 2), ring on E (3).
    expect(assignFingers([0, 2, 3, 2])).toEqual([0, 1, 3, 2]);
  });

  it('gives every barred string the index finger', () => {
    const fingers = assignFingers([4, 2, 2, 2], { fret: 2, fromString: 1, toString: 3 });
    expect(fingers[1]).toBe(1);
    expect(fingers[2]).toBe(1);
    expect(fingers[3]).toBe(1);
    expect(fingers[0]).toBe(2);
  });

  it('leaves open strings unfingered', () => {
    expect(assignFingers([2, 0, 0, 0])).toEqual([1, 0, 0, 0]);
  });
});

describe('shapeDifficulty', () => {
  it('rates a one-finger open chord easier than a barre chord', () => {
    const c = shapeDifficulty({ frets: [0, 0, 0, 3] });
    const bFlat = shapeDifficulty({
      frets: [3, 2, 1, 1],
      barre: { fret: 1, fromString: 2, toString: 3 },
    });
    expect(c).toBeLessThan(bFlat);
  });
});

describe('the shipped chord library', () => {
  const chords = getChords();

  it('ships a substantial library', () => {
    expect(chords.length).toBeGreaterThanOrEqual(80);
  });

  it('has a unique id for every chord', () => {
    expect(new Set(chords.map((c) => c.id)).size).toBe(chords.length);
  });

  // The regression that matters most: a wrong diagram is invisible to a
  // beginner, who will simply learn the wrong shape.
  it.each(chords.map((chord) => [chord.nameEn, chord] as const))(
    '%s is spelled correctly by its fingering',
    (_name, chord) => {
      for (const shape of chord.shapes) {
        const result = validateShape(chord.root, chord.quality as ChordQuality, shape.frets);
        expect(result.valid ? null : result.reason).toBeNull();
      }
    },
  );

  it('sounds at least three distinct pitch classes per chord', () => {
    for (const chord of chords) {
      for (const shape of chord.shapes) {
        expect(shapePitchClasses(shape.frets).length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('covers every one of the twelve roots with a major and a minor chord', () => {
    const majors = new Set(chords.filter((c) => c.quality === 'maj').map((c) => c.root));
    const minors = new Set(chords.filter((c) => c.quality === 'min').map((c) => c.root));
    expect(majors.size).toBe(12);
    expect(minors.size).toBe(12);
  });

  it('never assigns a finger to an open or muted string', () => {
    for (const chord of chords) {
      for (const shape of chord.shapes) {
        shape.frets.forEach((fret, index) => {
          if (fret <= 0) expect(shape.fingers[index]).toBe(0);
        });
      }
    }
  });
});
