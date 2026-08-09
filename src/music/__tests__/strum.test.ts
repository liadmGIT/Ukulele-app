import { COMMON_TIME } from '../grid';
import {
  StrumNotationError,
  accentGain,
  countingSyllables,
  describeStep,
  formatStrumPattern,
  formatStrumStep,
  isAudible,
  parseStrumPattern,
  parseStrumToken,
  patternBars,
  type StrumStep,
} from '../strum';

describe('parseStrumToken', () => {
  it('reads direction', () => {
    expect(parseStrumToken('D').dir).toBe('D');
    expect(parseStrumToken('U').dir).toBe('U');
    expect(parseStrumToken('-').dir).toBe('rest');
  });

  it('reads dynamics from case and the accent mark', () => {
    expect(parseStrumToken('D').accent).toBe('normal');
    expect(parseStrumToken('d').accent).toBe('soft');
    expect(parseStrumToken('D!').accent).toBe('strong');
    expect(parseStrumToken('u').accent).toBe('soft');
    expect(parseStrumToken('U!').accent).toBe('strong');
  });

  it('reads muting from the x suffix', () => {
    expect(parseStrumToken('Dx').muted).toBe(true);
    expect(parseStrumToken('Ux').muted).toBe(true);
    expect(parseStrumToken('D').muted).toBe(false);
  });

  it('treats X as shorthand for a muted down-stroke', () => {
    expect(parseStrumToken('X')).toEqual(parseStrumToken('Dx'));
    expect(parseStrumToken('X!')).toEqual(parseStrumToken('D!x'));
    expect(parseStrumToken('x')).toEqual(parseStrumToken('dx'));
  });

  it('gives a rest no direction and no force', () => {
    expect(parseStrumToken('-')).toEqual({ dir: 'rest', muted: false, accent: 'normal' });
  });

  it('rejects a token that contradicts itself', () => {
    // Lowercase means soft, "!" means strong. Resolving this quietly would pick
    // a dynamic the author never asked for.
    expect(() => parseStrumToken('d!')).toThrow(StrumNotationError);
    expect(() => parseStrumToken('u!')).toThrow(/contradictory/);
  });

  it('names the offending token and its position', () => {
    expect(() => parseStrumToken('Q', 2)).toThrow(/Token 3 "Q"/);
  });

  it.each(['', 'DD', 'D!!', '!D', 'xX', 'Dxx', '--'])('rejects %p', (token) => {
    expect(() => parseStrumToken(token)).toThrow(StrumNotationError);
  });

  it('returns a fresh rest each time', () => {
    // Rests share a template internally; callers must not be able to mutate it.
    const first = parseStrumToken('-');
    first.accent = 'strong';
    expect(parseStrumToken('-').accent).toBe('normal');
  });
});

describe('parseStrumPattern', () => {
  it('parses the island strum', () => {
    const steps = parseStrumPattern('D - D u - u D u');

    expect(steps).toHaveLength(8);
    expect(steps.map((s) => s.dir)).toEqual(['D', 'rest', 'D', 'U', 'rest', 'U', 'D', 'U']);
    expect(steps.map((s) => s.accent)).toEqual([
      'normal', 'normal', 'normal', 'soft', 'normal', 'soft', 'normal', 'soft',
    ]);
  });

  it('parses a chnk on two and four', () => {
    const steps = parseStrumPattern('D u X u D u X u');
    expect(steps.filter((s) => s.muted)).toHaveLength(2);
    expect(steps[2]!.muted).toBe(true);
    expect(steps[6]!.muted).toBe(true);
  });

  it('tolerates irregular spacing', () => {
    expect(parseStrumPattern('  D   u\tD  u ')).toHaveLength(4);
  });

  it('rejects an empty pattern', () => {
    expect(() => parseStrumPattern('   ')).toThrow(StrumNotationError);
  });

  it('reports the index of a bad token within the pattern', () => {
    expect(() => parseStrumPattern('D u Z u')).toThrow(/Token 3 "Z"/);
  });
});

describe('formatting', () => {
  it.each(['-', 'D', 'U', 'd', 'u', 'D!', 'U!', 'X', 'X!', 'x', 'Ux', 'U!x', 'ux'])(
    'round-trips %p',
    (token) => {
      expect(formatStrumStep(parseStrumToken(token))).toBe(token);
    },
  );

  it('normalises Dx to the X shorthand', () => {
    expect(formatStrumStep(parseStrumToken('Dx'))).toBe('X');
    expect(formatStrumStep(parseStrumToken('D!x'))).toBe('X!');
    expect(formatStrumStep(parseStrumToken('dx'))).toBe('x');
  });

  it('round-trips a whole pattern', () => {
    const notation = 'D! - D u X u D! u';
    expect(formatStrumPattern(parseStrumPattern(notation))).toBe(notation);
  });

  it('survives a second round trip unchanged', () => {
    const once = formatStrumPattern(parseStrumPattern('Dx u D! - U ux'));
    expect(formatStrumPattern(parseStrumPattern(once))).toBe(once);
  });
});

describe('patternBars', () => {
  it('counts whole bars', () => {
    expect(patternBars(parseStrumPattern('D u D u D u D u'), COMMON_TIME, 8)).toBe(1);
    expect(patternBars(parseStrumPattern('D D D D'), COMMON_TIME, 4)).toBe(1);
    expect(patternBars(parseStrumPattern('D u D u D u D u D u D u D u D u'), COMMON_TIME, 8)).toBe(
      2,
    );
  });

  it('handles 3/4 and 6/8', () => {
    expect(
      patternBars(parseStrumPattern('D - D u D u'), { beatsPerBar: 3, beatUnit: 4 }, 8),
    ).toBe(1);
    expect(
      patternBars(parseStrumPattern('D - u D - u'), { beatsPerBar: 6, beatUnit: 8 }, 8),
    ).toBe(1);
  });

  it('refuses a pattern that stops halfway through a bar', () => {
    // Silent acceptance here would desynchronise the pattern from the song a
    // bar at a time.
    expect(() => patternBars(parseStrumPattern('D u D'), COMMON_TIME, 8)).toThrow(
      /not a whole number of bars/,
    );
  });
});

describe('helpers', () => {
  it('treats only rests as silent', () => {
    expect(isAudible(parseStrumToken('D'))).toBe(true);
    expect(isAudible(parseStrumToken('X'))).toBe(true);
    expect(isAudible(parseStrumToken('-'))).toBe(false);
  });

  it('orders accent gain strong > normal > soft', () => {
    expect(accentGain('strong')).toBeGreaterThan(accentGain('normal'));
    expect(accentGain('normal')).toBeGreaterThan(accentGain('soft'));
    expect(accentGain('soft')).toBeGreaterThan(0);
    expect(accentGain('strong')).toBeLessThanOrEqual(1);
  });

  it('describes a step as translation keys, never as English', () => {
    expect(describeStep(parseStrumToken('-'))).toEqual(['rhythm.rest']);
    expect(describeStep(parseStrumToken('D'))).toEqual(['rhythm.down']);
    expect(describeStep(parseStrumToken('U!'))).toEqual(['rhythm.up', 'rhythm.strong']);
    expect(describeStep(parseStrumToken('x'))).toEqual([
      'rhythm.down',
      'rhythm.muted',
      'rhythm.soft',
    ]);

    for (const keys of [describeStep(parseStrumToken('D')), describeStep(parseStrumToken('X!'))]) {
      for (const key of keys) expect(key).toMatch(/^rhythm\./);
    }
  });
});

describe('countingSyllables', () => {
  it('counts eighths as 1 & 2 & 3 & 4 &', () => {
    expect(countingSyllables(COMMON_TIME, 8)).toEqual(['1', '&', '2', '&', '3', '&', '4', '&']);
  });

  it('counts quarters as plain beat numbers', () => {
    expect(countingSyllables(COMMON_TIME, 4)).toEqual(['1', '2', '3', '4']);
  });

  it('counts sixteenths as 1 e & a', () => {
    expect(countingSyllables(COMMON_TIME, 16).slice(0, 8)).toEqual([
      '1', 'e', '&', 'a', '2', 'e', '&', 'a',
    ]);
  });

  it('counts a waltz to three', () => {
    expect(countingSyllables({ beatsPerBar: 3, beatUnit: 4 }, 8)).toEqual([
      '1', '&', '2', '&', '3', '&',
    ]);
  });

  it('produces one syllable per step', () => {
    for (const subdivision of [4, 8, 16] as const) {
      const steps: StrumStep[] = parseStrumPattern(
        Array.from({ length: subdivision }, () => 'D').join(' '),
      );
      expect(countingSyllables(COMMON_TIME, subdivision)).toHaveLength(steps.length);
    }
  });
});
